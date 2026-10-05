import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { binScript } from './cli.js';
import {
  buildFixture,
  cliPackageDir,
  FIXTURE_KINDS,
  STANDARD_TEAM,
  type Fixture,
  type FixtureKind,
} from './fixtures/index.js';
import { git, run } from './run.js';

/** S-28.1 Examples: the type filters of each fixture, in `memory.yaml` order. */
const TYPES: Record<FixtureKind, string[]> = {
  kanban: ['adr', 'bug', 'decision-log', 'release', 'release-line', 'task', 'tech-spec'],
  custom: ['release-line', 'release', 'task', 'adr', 'decision-log', 'tech-spec', 'bug', 'plan', 'service'],
  unknown: ['story', 'note'],
};

/**
 * Standard and progress elements (BDD conventions): state, and the author and subject of the
 * element's last transition.
 */
const ELEMENTS: Record<FixtureKind, Record<string, [state: string, last: string]>> = {
  kanban: {
    'task-001-login-form': ['pending', 'Jordan|wf(task): submit task-001-login-form'],
    'task-002-password-reset': ['draft', 'Morgan|wf(task): reject task-002-password-reset [pending → draft]'],
    'task-003-logout': ['approved', 'Morgan|wf(task): approve task-003-logout [pending → approved]'],
    'task-004-session-timeout': ['draft', 'Jordan|wf(task): add task-004-session-timeout'],
    'bug-001-crash-on-save': ['pending', 'Sam|wf(bug): submit bug-001-crash-on-save'],
  },
  custom: {
    'task-001-cli-adapter': ['in-review', 'Jordan|wf(task): submit task-001-cli-adapter'],
    'task-002-memory-list': ['done', 'Jordan|wf(task): task-002-memory-list [approved → done]'],
    'task-003-element-panel': ['backlog', 'Morgan|wf(task): approve task-003-element-panel [pending → backlog]'],
    'task-004-themes': ['backlog', 'Morgan|wf(task): approve task-004-themes [pending → backlog]'],
    'dl-001-initialise-wingfoil-before-inception': [
      'ready',
      'Morgan|wf(decision-log): approve dl-001-initialise-wingfoil-before-inception [in-discussion → ready]',
    ],
    'dl-002-use-fastify': ['in-discussion', 'Casey|wf(decision-log): submit dl-002-use-fastify'],
    'bug-001-toast-overlap': ['open', 'Sam|wf(bug): submit bug-001-toast-overlap'],
    'adr-001-local-server': ['draft', 'Alex|wf(adr): add adr-001-local-server'],
    'minor-v0.1': ['planning', 'Alex|wf(release): submit minor-v0.1'],
  },
  unknown: {
    'story-001-onboarding': ['shaping', 'Jordan|wf(story): submit story-001-onboarding'],
    'story-002-billing': ['ready-to-build', 'Morgan|wf(story): approve story-002-billing [shaping → ready-to-build]'],
    'note-001-kickoff': ['open', 'Casey|wf(note): add note-001-kickoff'],
    'note-002-retro': ['on-hold', 'Casey|wf(note): note-002-retro [open → on-hold]'],
  },
};

interface SearchMatch {
  id: string;
  type: string;
  status: string;
  path: string;
}

const NOW = new Date('2026-10-05T12:00:00Z');
let root: string;
const built = new Map<FixtureKind, Fixture>();

async function cli(fx: Fixture, args: string[]): Promise<unknown> {
  const script = binScript(cliPackageDir(fx));
  const { stdout } = await run(process.execPath, [script, ...args, '--format', 'json'], { cwd: fx.dir, env: fx.env });
  return JSON.parse(stdout) as unknown;
}

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'wfui-fx-'));
  await Promise.all(FIXTURE_KINDS.map(async (kind) => built.set(kind, await buildFixture(kind, { root, now: NOW }))));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe.each(FIXTURE_KINDS)('%s fixture', (kind) => {
  const fx = (): Fixture => built.get(kind)!;

  it('names the project after the fixture and declares the standard team', async () => {
    const dna = (await cli(fx(), ['dna', 'show'])) as {
      project: { name: string };
      team: { members: unknown[]; agents: unknown[] };
    };
    expect(dna.project.name).toBe(kind);
    expect(dna.team.members).toEqual(STANDARD_TEAM.map((m) => ({ name: m.name, email: m.email, roles: [...m.roles] })));
    expect(dna.team.agents).toEqual([{ name: 'Build agent', executes_as: ['developer'], approval_authority: false }]);
  });

  it('declares exactly the S-28.1 types, in memory.yaml order', async () => {
    const yaml = await readFile(path.join(fx().dir, '.wingfoil', 'memory.yaml'), 'utf8');
    const types = [...yaml.split(/^types:\s*$/m)[1]!.matchAll(/^ {2}([a-z][a-z-]*):\s*$/gm)].map((m) => m[1]);
    expect(types).toEqual(TYPES[kind]);
  });

  it('holds every standard element in its state, as memory search reports it', async () => {
    const found = (await cli(fx(), ['memory', 'search'])) as { matches: SearchMatch[] };
    const states = Object.fromEntries(found.matches.map((m) => [m.id, m.status]));
    expect(states).toEqual(Object.fromEntries(Object.entries(ELEMENTS[kind]).map(([id, [state]]) => [id, state])));
  });

  it('records the last transition of every element by the conventions member, 3 days before the clock', async () => {
    const f = fx();
    const found = (await cli(f, ['memory', 'search'])) as { matches: SearchMatch[] };
    const threeDays = NOW.getTime() - 3 * 86_400_000;
    for (const match of found.matches) {
      const { stdout } = await git(f.dir, ['log', '-1', '--format=%aI|%an|%s', '--', match.path], f.env);
      const [date, ...last] = stdout.trim().split('|');
      expect.soft(last.join('|'), match.id).toBe(ELEMENTS[kind][match.id]?.[1]);
      const at = new Date(date!).getTime();
      expect.soft(at <= threeDays && at > threeDays - 10 * 60_000, `${match.id} at ${date}`).toBe(true);
    }
  });

  it('gives every commit its own timestamp', async () => {
    const f = fx();
    const dates = (await git(f.dir, ['log', '--format=%aI'], f.env)).stdout.trim().split('\n');
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('is clean, pushed to its bare remote, and Alex is the current identity', async () => {
    const f = fx();
    expect((await git(f.dir, ['status', '--porcelain'], f.env)).stdout).toBe('');
    expect((await git(f.dir, ['rev-parse', 'HEAD'], f.env)).stdout).toBe(
      (await git(f.remoteDir, ['rev-parse', 'main'], f.env)).stdout,
    );
    expect((await git(f.dir, ['config', 'user.email'], f.env)).stdout.trim()).toBe('alex@example.test');
    expect(f.remoteUrl).toBe(`file://${f.remoteDir}`);
  });

  it('isolates git and the home directory of every process', () => {
    const f = fx();
    expect(f.env.HOME).toBe(f.home);
    expect(f.env.XDG_CONFIG_HOME).toBe(path.join(f.home, '.config'));
    expect(
      Object.keys(f.env)
        .filter((k) => k.startsWith('GIT_'))
        .sort(),
    ).toEqual(['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM']);
  });
});

describe('custom fixture history', () => {
  it('records the gates and hand transitions as wf(…) commits by the right members', async () => {
    const f = built.get('custom')!;
    const { stdout } = await git(
      f.dir,
      ['log', '--format=%an|%s', '--', 'docs/04_memory/v0.1/task-001-cli-adapter.md'],
      f.env,
    );
    expect(stdout.trim().split('\n').reverse()).toEqual([
      'Jordan|wf(task): add task-001-cli-adapter',
      'Jordan|wf(task): submit task-001-cli-adapter',
      'Morgan|wf(task): approve task-001-cli-adapter [pending → backlog]',
      'Jordan|wf(task): task-001-cli-adapter [backlog → in-progress]',
      'Jordan|wf(task): submit task-001-cli-adapter',
    ]);
  });

  it('kanban task-002 was rejected by Morgan with the reason', async () => {
    const f = built.get('kanban')!;
    const { stdout } = await git(f.dir, ['log', '--format=%an|%s', '--grep', 'reject'], f.env);
    expect(stdout.trim()).toBe('Morgan|wf(task): reject task-002-password-reset [pending → draft]');
  });
});
