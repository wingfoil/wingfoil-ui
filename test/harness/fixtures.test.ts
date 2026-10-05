import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { run } from './run.js';
import { buildFixture, FIXTURE_KINDS, STANDARD_TEAM, type Fixture, type FixtureKind } from './fixtures/index.js';
import { git } from './run.js';

/** S-28.1 Examples: the type filters of each fixture, in `memory.yaml` order. */
const TYPES: Record<FixtureKind, string[]> = {
  kanban: ['adr', 'bug', 'decision-log', 'release', 'release-line', 'task', 'tech-spec'],
  custom: ['release-line', 'release', 'task', 'adr', 'decision-log', 'tech-spec', 'bug', 'plan', 'service'],
  unknown: ['story', 'note'],
};

/** Standard elements and their states (BDD conventions *Standard elements*). */
const ELEMENTS: Record<FixtureKind, Record<string, string>> = {
  kanban: {
    'task-001-login-form': 'pending',
    'task-002-password-reset': 'draft',
    'task-003-logout': 'approved',
    'task-004-session-timeout': 'draft',
    'bug-001-crash-on-save': 'pending',
  },
  custom: {
    'task-001-cli-adapter': 'in-review',
    'task-002-memory-list': 'done',
    'task-003-element-panel': 'backlog',
    'task-004-themes': 'backlog',
    'dl-001-initialise-wingfoil-before-inception': 'ready',
    'dl-002-use-fastify': 'in-discussion',
    'bug-001-toast-overlap': 'open',
    'adr-001-local-server': 'draft',
    'minor-v0.1': 'planning',
  },
  unknown: {
    'story-001-onboarding': 'shaping',
    'story-002-billing': 'ready-to-build',
    'note-001-kickoff': 'open',
    'note-002-retro': 'on-hold',
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
  const script = path.join(fx.dir, 'node_modules', 'wingfoil', 'dist', 'cli.js');
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

  it('holds every standard element in its state', async () => {
    const found = (await cli(fx(), ['memory', 'search'])) as { matches: SearchMatch[] };
    const states: Record<string, string> = {};
    for (const m of found.matches) states[m.id] = m.status;
    for (const [id, state] of Object.entries(ELEMENTS[kind])) {
      if (states[id] === undefined) {
        // An undeclared state is not returned by the CLI: read it from the file.
        const file = await readFile(path.join(fx().dir, 'docs', 'notes', `${id}.md`), 'utf8');
        states[id] = /^status:\s*(\S+)/m.exec(file)?.[1] ?? '';
      }
      expect.soft(states[id], id).toBe(state);
    }
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

  it('dates the last transition of every element 3 days before the test clock', async () => {
    const f = fx();
    const { stdout } = await git(f.dir, ['log', '-1', '--format=%aI', '--', 'docs/'], f.env);
    expect(new Date(stdout.trim()).toISOString()).toBe(new Date(NOW.getTime() - 3 * 86_400_000).toISOString());
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
