// REQ-ARC-06 (TT-ARC-06, e2e half) and REQ-ARC-05 (TT-ARC-05, v0.1 read-only half) — the action
// descriptor on the three fixtures built with the CLI of every version of `contracts/matrix.json`,
// its inputs read through the server's own read facade (`ProjectReads`), and spec-003 §9's
// contract check: every `submit`/`approve`/`reject` of every element, run on a copy, is accepted by
// the CLI exactly when the descriptor offers it, to the state it names. Scenarios S-28.1, S-28.2,
// M-02.1, M-02.2, M-02.3 (and M-01.2) at API level on the same build; their screens close in
// task-017.
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { MemoryYaml } from '@wingfoil-ui/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CliRefusedError, WingfoilCli } from '../../server/src/cli/adapter.js';
import { discoverCli } from '../../server/src/cli/discovery.js';
import {
  bucketOf,
  describeElements,
  type ActionDescriptor,
  type DescriptorProject,
} from '../../server/src/descriptor/descriptor.js';
import { LocalProcessRunner } from '../../server/src/process/runner.js';
import { resolveStates } from '../../server/src/reads/memory-yaml.js';
import { ProjectReads } from '../../server/src/reads/project-reads.js';
import { buildFixture, copyFixture, FIXTURE_KINDS, type Fixture, type FixtureKind } from '../harness/fixtures/index.js';
import { observed, STANDARD } from '../server/descriptor/standard.js';
import { actAs, cliBuildFor, matrixVersions } from './support.js';

const VERSIONS = await matrixVersions();
const OPS = ['submit', 'approve', 'reject'] as const;

let root: string;
const runners: LocalProcessRunner[] = [];

afterAll(async () => {
  for (const r of runners) await r.terminateAll();
  if (root) await rm(root, { recursive: true, force: true });
});

async function readsOf(fx: Fixture) {
  const runner = new LocalProcessRunner();
  runners.push(runner);
  const cli = new WingfoilCli({ cli: await discoverCli(fx.dir, { env: fx.env }), runner, env: fx.env });
  return { cli, reads: new ProjectReads({ root: fx.dir, cli }) };
}

/** The descriptors of every element of `fx`, from the reads the server makes. */
async function describeFixture(fx: Fixture): Promise<{ memoryYaml: MemoryYaml; descriptors: ActionDescriptor[] }> {
  const { reads } = await readsOf(fx);
  const memoryYaml = await reads.memoryTypes();
  const elements = (await reads.elements()).data.matches;
  const members = (await reads.dna()).data.team.members;
  const events = new Map<string, Awaited<ReturnType<ProjectReads['history']>>['data']['entries']>();
  for (const m of elements) events.set(m.id, (await reads.history(m.id)).data.entries);
  const project: DescriptorProject = {
    memoryYaml,
    members,
    enablement: { identified: true, version: { supported: true, range: '0.2.2' } },
  };
  return { memoryYaml, descriptors: describeElements(elements, (id) => events.get(id) ?? [], project) };
}

describe.each(VERSIONS)('action descriptor — wingfoil %s', (version) => {
  const fixtures = {} as Record<FixtureKind, Fixture>;
  const described = {} as Record<FixtureKind, Awaited<ReturnType<typeof describeFixture>>>;

  beforeAll(async () => {
    root ??= await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-descriptor-')));
    const cli = cliBuildFor(version);
    for (const kind of FIXTURE_KINDS) {
      fixtures[kind] = await buildFixture(kind, { root: path.join(root, version, kind), cli, cliVersion: version });
      described[kind] = await describeFixture(fixtures[kind]);
    }
  }, 600_000); // three fixture builds and 18 `memory history` reads; minutes under a load average of 50

  it.each(FIXTURE_KINDS)('%s: 100 % of the standard elements match the table (TT-ARC-06)', (kind) => {
    const got = Object.fromEntries(described[kind].descriptors.map((d) => [d.id, observed(d)]));
    expect(got).toEqual(STANDARD[kind]);
  });

  it('S-28.1 — the same build lists each fixture’s own types, every element with its own state', async () => {
    const expected: Record<FixtureKind, string[]> = {
      kanban: ['adr', 'bug', 'decision-log', 'release', 'release-line', 'task', 'tech-spec'],
      custom: ['release-line', 'release', 'task', 'adr', 'decision-log', 'tech-spec', 'bug', 'plan', 'service'],
      unknown: ['story', 'note'],
    };
    for (const kind of FIXTURE_KINDS) {
      expect(Object.keys(described[kind].memoryYaml.types)).toEqual(expected[kind]);
      const { reads } = await readsOf(fixtures[kind]);
      const statuses = (await reads.elements()).data.matches.map((m) => [m.id, m.status]);
      expect(described[kind].descriptors.map((d) => [d.id, d.status])).toEqual(statuses);
    }
  });

  it('S-28.2 / M-02.3 — the states of an unknown type come from its own definition', () => {
    const { memoryYaml, descriptors } = described.unknown;
    expect(resolveStates(memoryYaml, 'story')?.sequence).toEqual(['idea', 'shaping', 'ready-to-build', 'shipped']);
    expect(descriptors.find((d) => d.id === 'story-001-onboarding')?.status).toBe('shaping');
  });

  it('M-02.1 — unknown types under their own names, with their counts', () => {
    const counts: Record<string, number> = {};
    for (const d of described.unknown.descriptors) counts[d.type] = (counts[d.type] ?? 0) + 1;
    expect(counts).toEqual({ story: 2, note: 2 });
  });

  it('M-02.2 / M-01.2 — the generic buckets', () => {
    const bucket = (kind: FixtureKind, b: string) =>
      described[kind].descriptors
        .filter((d) => bucketOf(d.kind) === b)
        .map((d) => d.id)
        .sort();
    expect(bucket('unknown', 'to-approve')).toEqual(['story-001-onboarding']);
    expect(bucket('unknown', 'in-progress')).toEqual(['note-002-retro']);
    expect(bucket('unknown', 'waiting')).toEqual(['note-001-kickoff', 'story-002-billing']);
    expect(bucket('unknown', 'done')).toEqual([]);
    expect(bucket('kanban', 'to-approve')).toEqual(['bug-001-crash-on-save', 'task-001-login-form']);
  });

  it.each(FIXTURE_KINDS)(
    '%s: the CLI accepts a submit/approve/reject exactly when the descriptor offers it (spec-003 §9)',
    async (kind) => {
      let n = 0;
      const fresh = async () => {
        const fx = await copyFixture(fixtures[kind], path.join(root, version, `${kind}-verbs-${n++}`));
        await actAs(fx, 'Morgan'); // approver and tech-lead: the role is the CLI's, not under test here
        return { fx, cli: (await readsOf(fx)).cli };
      };
      let copy = await fresh();
      const mismatches: string[] = [];
      // A legal move the CLI refuses on the element's content — an empty required field of
      // `memory.yaml` (W-01: custom `adr-001-local-server`'s `sard_ref`) — is still offered: the UI
      // shows the CLI's message (action-feedback.feature, G-01.3). Listed, not hidden.
      const contentRefusals: string[] = [];
      for (const d of described[kind].descriptors) {
        const required = described[kind].memoryYaml.types[d.type]?.required ?? [];
        for (const op of OPS) {
          const offered = d.verbs.find((v) => v.verb === op);
          let accepted: string | undefined;
          let refusal = '';
          try {
            const out = await copy.cli.run(`memory ${op}`, {
              positionals: [d.id],
              ...(op === 'submit' ? {} : { options: { '--reason': 'Descriptor contract test' } }),
            });
            accepted = out.data.to;
          } catch (error) {
            if (!(error instanceof CliRefusedError)) throw error;
            refusal = error.message;
          }
          if (offered && accepted === undefined && required.some((f) => refusal.includes(f))) {
            contentRefusals.push(`${d.id} ${op}`);
            continue;
          }
          if (accepted !== offered?.to)
            mismatches.push(`${d.id} ${op}: CLI ${accepted ?? 'refused'}, offered ${offered?.to ?? 'no'}`);
          if (accepted !== undefined) copy = await fresh(); // the copy moved: start the next try from the fixture
        }
      }
      expect(mismatches).toEqual([]);
      expect(contentRefusals).toEqual(kind === 'custom' ? ['adr-001-local-server submit'] : []);
    },
    600_000,
  );
});
