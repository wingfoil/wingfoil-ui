// spec-001 §7, adr-001 D4, REQ-INT-01 (TT-INT-01), REQ-ARC-04 — the contract tests (e2e-smoke
// `contract`, `npm run test:contract`): for every version of `contracts/matrix.json`, the three
// fixtures built with that version's CLI; every command of the adapter's static list run through
// the adapter (which validates its output against the command's schema), every allow-listed reader
// run on every file the CLI points at, and the §4.1 resolution check. S-27.1 on the adapter side.
import { appendFile, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CliRefusedError, WingfoilCli, type CliArgs } from '../../server/src/cli/adapter.js';
import { CLI_COMMANDS, type CliCommandName, type CliCommandOutputs } from '../../server/src/cli/commands.js';
import { discoverCli } from '../../server/src/cli/discovery.js';
import { LocalProcessRunner } from '../../server/src/process/runner.js';
import { resolveStates, transitionTarget } from '../../server/src/reads/memory-yaml.js';
import { ProjectReads } from '../../server/src/reads/project-reads.js';
import { buildFixture, copyFixture, FIXTURE_KINDS, type Fixture, type FixtureKind } from '../harness/fixtures/index.js';
import { actAs, archiveOne, cliBuildFor, matrixVersions } from './support.js';

const VERSIONS = await matrixVersions();

/** Writes run on a copy of each fixture: member, command, id, reason. */
const WRITES: Record<
  FixtureKind,
  ['Jordan' | 'Morgan', 'memory submit' | 'memory approve' | 'memory reject', string][]
> = {
  kanban: [
    ['Jordan', 'memory submit', 'task-004-session-timeout'],
    ['Morgan', 'memory approve', 'task-001-login-form'],
    ['Morgan', 'memory reject', 'bug-001-crash-on-save'],
  ],
  custom: [
    ['Morgan', 'memory approve', 'task-001-cli-adapter'],
    ['Morgan', 'memory approve', 'dl-002-use-fastify'],
    ['Morgan', 'memory reject', 'bug-001-toast-overlap'],
  ],
  unknown: [
    ['Jordan', 'memory submit', 'note-001-kickoff'],
    ['Morgan', 'memory reject', 'story-001-onboarding'],
  ],
};
const ADD: Record<FixtureKind, [string, string]> = {
  kanban: ['task', 'Remember me'],
  custom: ['decision-log', 'Use pino'],
  unknown: ['story', 'Search'],
};

let root: string;
const runners: LocalProcessRunner[] = [];

afterAll(async () => {
  for (const r of runners) await r.terminateAll();
  if (root) await rm(root, { recursive: true, force: true });
});

/** The adapter of `fx` and the commands it ran (a wrapper over the public API). */
async function adapterFor(fx: Fixture, ran: Set<CliCommandName>) {
  const runner = new LocalProcessRunner();
  runners.push(runner);
  const cli = new WingfoilCli({ cli: await discoverCli(fx.dir, { env: fx.env }), runner, env: fx.env });
  const json = cli.json.bind(cli);
  cli.json = (words: readonly string[], args?: CliArgs) => {
    ran.add(words.join(' ') as CliCommandName);
    return json(words, args);
  };
  const version = cli.version.bind(cli);
  cli.version = () => (ran.add('--version'), version());
  return { cli, reads: new ProjectReads({ root: fx.dir, cli }) };
}

describe.each(VERSIONS)('contract — wingfoil %s', (version) => {
  const fixtures = {} as Record<FixtureKind, Fixture>;
  const ran = new Set<CliCommandName>();

  beforeAll(async () => {
    root ??= await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-contract-')));
    const cli = cliBuildFor(version);
    for (const kind of FIXTURE_KINDS) {
      fixtures[kind] = await buildFixture(kind, { root: path.join(root, version, kind), cli, cliVersion: version });
    }
  }, 600_000); // three fixture builds: ~35 s idle, over 180 s measured under a load average of 50

  it.each(FIXTURE_KINDS)(
    '%s: every read command validates, every allow-listed file validates, transitions follow §4.1',
    async (kind) => {
      const fx = fixtures[kind];
      const { cli, reads } = await adapterFor(fx, ran);
      expect(await cli.version()).toBe(version);
      await reads.dna();
      await reads.paths();
      await reads.workflows();
      const types = await reads.memoryTypes();
      const matches = (await reads.elements()).data.matches;
      expect(matches.length).toBeGreaterThan(0);
      for (const m of matches) {
        const el = await reads.elementFromMatch(m);
        expect(el.frontmatter).toMatchObject({ id: m.id, type: m.type, status: m.status });
        // §4.1: every transition the CLI recorded is one the resolved states allow.
        const states = resolveStates(types, m.type);
        expect(states, `type ${m.type} of ${m.id} is declared`).toBeDefined();
        for (const e of (await reads.history(m.id)).data.entries) {
          if (e.operation === null || e.operation === 'add') continue;
          expect(transitionTarget(states!, e.from!, e.operation), `${m.id} ${e.operation} ${e.from} → ${e.to}`).toBe(
            e.to,
          );
        }
      }
      const entries = (await reads.directives()).data.entries;
      expect(entries.length).toBeGreaterThan(0);
      for (const d of entries) await reads.directiveFromEntry(d);
    },
    300_000,
  );

  it.each(FIXTURE_KINDS)(
    '%s: write commands validate and move along the resolved states (§4.1)',
    async (kind) => {
      const fx = await copyFixture(fixtures[kind], path.join(root, version, `${kind}-writes`));
      const { cli, reads } = await adapterFor(fx, ran);
      const types = await reads.memoryTypes();
      const before = new Map((await reads.elements()).data.matches.map((m) => [m.id, m]));
      for (const [member, name, id] of WRITES[kind]) {
        await actAs(fx, member);
        const out: CliCommandOutputs[typeof name] = (
          await cli.run(name, {
            positionals: [id],
            ...(name === 'memory submit' ? {} : { options: { '--reason': 'Contract test' } }),
          })
        ).data;
        const m = before.get(id)!;
        expect(out).toMatchObject({ id, path: m.path, from: m.status });
        const op = name.split(' ')[1] as 'submit' | 'approve' | 'reject';
        expect(transitionTarget(resolveStates(types, m.type)!, m.status, op), `${id} ${op}`).toBe(out.to);
        const after = await reads.elementFromMatch({ ...m, status: out.to });
        if (op === 'reject') expect(after.frontmatter.rejection_reason).toBe('Contract test');
      }
      await actAs(fx, 'Alex');
      const [type, title] = ADD[kind];
      const added = (await cli.run('memory add', { options: { '--type': type, '--title': title } })).data;
      expect(added.path.endsWith(`${added.id}.md`)).toBe(true);
      // W-21: memory add writes draft, whatever the type's first state.
      const created = (await reads.elements()).data.matches.find((m) => m.id === added.id);
      expect(created).toMatchObject({ type, status: 'draft', path: added.path });

      // The archived searches (W-19), with an archived element where the fixture can have one.
      const archived = await archiveOne(fx);
      const deprecated = (await reads.archivedElements('deprecated')).data;
      const superseded = (await reads.archivedElements('superseded')).data;
      for (const [state, result] of [
        ['deprecated', deprecated],
        ['superseded', superseded],
      ] as const) {
        expect(result.matches.every((m) => m.status === state)).toBe(true);
        if (archived === state) {
          expect(result.matches).toHaveLength(1);
          await reads.elementFromMatch(result.matches[0]!);
        } else expect(result.message).toBe('no documents matched the query');
      }
    },
    300_000,
  );

  it('S-27.1 — an invalid dna.yaml refuses dna show with the CLI message; memory search still validates', async () => {
    const fx = await copyFixture(fixtures.kanban, path.join(root, version, 'kanban-s27'));
    await appendFile(path.join(fx.dir, '.wingfoil', 'dna.yaml'), 'project: [unclosed\n  : :\n');
    const { reads } = await adapterFor(fx, ran);
    const error = await reads.dna().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CliRefusedError);
    expect((error as CliRefusedError).cliMessage).toMatch(
      /^E_YAML_PARSE_ERROR \(.*dna\.yaml\): invalid DNA: YAML parse error/,
    );
    expect((await reads.elements()).data.matches.map((m) => m.id)).toContain('task-001-login-form');
  }, 120_000);

  it('REQ-INT-01 — 100 % of the commands of the static list ran and validated', () => {
    expect([...ran].sort()).toEqual(Object.keys(CLI_COMMANDS).sort());
  });
});
