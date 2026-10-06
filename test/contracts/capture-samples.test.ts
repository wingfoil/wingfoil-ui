// spec-001 §5/§7, directive `claim-evidence` — captures the samples of `test/contracts/samples/`
// from the real CLI of each matrix version (raw CLI, as a terminal runs it). Skipped unless
// `WFUI_CAPTURE_SAMPLES=1`:
//   WFUI_CAPTURE_SAMPLES=1 npx vitest run test/contracts/capture-samples.test.ts
// The schema tests (`schemas.test.ts`) validate every captured sample.
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildFixture, copyFixture, FIXTURE_KINDS, type Fixture } from '../harness/fixtures/index.js';
import { actAs, archiveOne, cliBuildFor, matrixVersions, rawCli, samplesDir } from './support.js';

const CAPTURE = process.env.WFUI_CAPTURE_SAMPLES === '1';
/** Test clock of the captured fixtures (spec-001 captured on 2026-10-02). */
const NOW = new Date('2026-10-02T15:30:00Z');

/** Writes captured on a copy of each fixture: [file, member, CLI arguments]. */
const WRITES: Record<Fixture['kind'], [string, 'Jordan' | 'Morgan' | 'Alex', string[]][]> = {
  kanban: [
    ['memory-submit', 'Jordan', ['memory', 'submit', 'task-004-session-timeout']],
    ['memory-approve', 'Morgan', ['memory', 'approve', 'task-001-login-form', '--reason', 'Looks good']],
    ['memory-reject', 'Morgan', ['memory', 'reject', 'bug-001-crash-on-save', '--reason', 'Cannot reproduce']],
    ['memory-add', 'Jordan', ['memory', 'add', '--type', 'task', '--title', 'Remember me']],
  ],
  custom: [
    ['memory-approve', 'Morgan', ['memory', 'approve', 'dl-002-use-fastify', '--reason', 'Agreed']],
    ['memory-reject', 'Morgan', ['memory', 'reject', 'bug-001-toast-overlap', '--reason', 'Not a bug']],
    ['memory-add', 'Alex', ['memory', 'add', '--type', 'decision-log', '--title', 'Use pino']],
  ],
  unknown: [
    ['memory-submit', 'Jordan', ['memory', 'submit', 'note-001-kickoff']],
    ['memory-reject', 'Morgan', ['memory', 'reject', 'story-001-onboarding', '--reason', 'Too vague']],
  ],
};

/** Directive files kept as samples (custom: one with `tags`, one without). */
const DIRECTIVES: Record<Fixture['kind'], 'all' | string[]> = {
  kanban: 'all',
  custom: ['directives/built-in/testing.md', 'directives/custom/determinism.md'],
  unknown: [],
};

let root: string;

afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

async function json(fx: Fixture, args: string[]): Promise<string> {
  const result = await rawCli(fx, args);
  expect(result.code, `${args.join(' ')}: ${result.stderr}`).toBe(0);
  // Re-indented for review; the content is the CLI's.
  return `${JSON.stringify(JSON.parse(result.stdout), null, 2)}\n`;
}

describe.runIf(CAPTURE)('capture samples', () => {
  it('captures every consumed command and allow-listed file of every matrix version', async () => {
    root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-capture-')));
    for (const version of await matrixVersions()) {
      const cli = await cliBuildFor(version);
      const base = samplesDir(version);
      await rm(base, { recursive: true, force: true });
      for (const kind of FIXTURE_KINDS) {
        const fx = await buildFixture(kind, {
          root: path.join(root, version, kind),
          cli,
          cliVersion: version,
          now: NOW,
        });
        const out = path.join(base, kind);
        await mkdir(path.join(out, 'memory-history'), { recursive: true });
        const save = (name: string, text: string) => writeFile(path.join(out, name), text);

        await save('version.txt', (await rawCli(fx, ['--version'], false)).stdout);
        await save('dna-show.json', await json(fx, ['dna', 'show']));
        await save('paths.json', await json(fx, ['paths']));
        await save('directives-list.json', await json(fx, ['directives', 'list']));
        await save('workflow-list.json', await json(fx, ['workflow', 'list']));
        const search = await json(fx, ['memory', 'search']);
        await save('memory-search.json', search);
        const matches = (JSON.parse(search) as { matches: { id: string; path: string }[] }).matches;
        for (const m of matches) {
          await save(path.join('memory-history', `${m.id}.json`), await json(fx, ['memory', 'history', m.id]));
        }

        // Allow-listed files, as the readers find them.
        await mkdir(path.join(out, 'files', 'elements'), { recursive: true });
        await cp(path.join(fx.dir, '.wingfoil', 'memory.yaml'), path.join(out, 'files', 'memory.yaml'));
        for (const m of matches) await cp(path.join(fx.dir, m.path), path.join(out, 'files', 'elements', `${m.id}.md`));
        const entries = (
          JSON.parse(await readFile(path.join(out, 'directives-list.json'), 'utf8')) as { entries: { path: string }[] }
        ).entries.map((e) => e.path);
        const keep = DIRECTIVES[kind] === 'all' ? entries : entries.filter((p) => DIRECTIVES[kind].includes(p));
        for (const p of keep) {
          await mkdir(path.dirname(path.join(out, 'files', p)), { recursive: true });
          await cp(path.join(fx.dir, '.wingfoil', p), path.join(out, 'files', p));
        }

        // Writes, on a copy.
        const copy = await copyFixture(fx, path.join(root, version, `${kind}-writes`));
        for (const [name, member, args] of WRITES[kind]) {
          await actAs(copy, member);
          await save(`${name}.json`, await json(copy, args));
        }

        // Archived searches (W-19), after one element is archived.
        const archived = await archiveOne(fx);
        await save('memory-search-deprecated.json', await json(fx, ['memory', 'search', '--status', 'deprecated']));
        await save('memory-search-superseded.json', await json(fx, ['memory', 'search', '--status', 'superseded']));
        if (archived)
          expect(await readFile(path.join(out, `memory-search-${archived}.json`), 'utf8')).toContain(archived);
      }
    }
  }, 600_000);
});
