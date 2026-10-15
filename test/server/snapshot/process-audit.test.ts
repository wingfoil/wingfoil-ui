// Process audits over the real read routes (task-012; task-010's stand-ins before) and the real
// event stream, on the real kanban fixture with the production watcher settings (file watching +
// the periodic check):
// - REQ-PERF-05 (TT-PERF-05, S-26.3): opening the Memory list on a cold cache starts ≤ 6 CLI
//   processes; opening it again with no commit and no working-tree change starts 0 processes.
// - REQ-INT-09 (TT-INT-09, S-26.1 API side): one page open and no change for 60 s → 0 CLI
//   processes; after a change the page gets `repo` on its open stream and reads the new data.
// Counts, not timings: these stay in the default suite (bug-001). The screens close in task-017.
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_FALLBACK_MS, type Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { buildFixture, copyFixture, type Fixture } from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';
import { startReadConsole, type ReadConsole } from '../http/read-console.js';
import { GIT_ALLOWED_SUBCOMMANDS, gitSubcommand } from '../../../server/src/git/git.js';
import { auditedSnapshots, processKind } from './support.js';

const STATE = /^[0-9a-f]{40}\.[0-9a-f]{16}$/;
let root: string;
let template: Fixture;
let n = 0;
const registries: Snapshots[] = [];
const consoles: ReadConsole[] = [];

async function fresh(fallbackMs = DEFAULT_FALLBACK_MS) {
  n += 1;
  const fx = await copyFixture(template, path.join(root, `copy-${n}`));
  const audited = auditedSnapshots(fx.env, { watch: true, fallbackMs });
  registries.push(audited.snapshots);
  const pid = `p_${String(n).padStart(12, '0')}`;
  // The routes open the project in the registry on the first read, as in the console.
  const standIn = await startReadConsole(audited.snapshots, audited.bus, { [pid]: fx.dir });
  consoles.push(standIn);
  return { fx, pid, standIn, ...audited };
}

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-audit-')));
  template = await buildFixture('kanban', { root: path.join(root, 'template') });
}, 600_000);

afterAll(async () => {
  for (const c of consoles) await c.close();
  for (const s of registries) await s.closeAll();
  await rm(root, { recursive: true, force: true });
});

describe('TT-PERF-05 — batched CLI reads (S-26.3)', () => {
  it('Memory list: ≤ 6 CLI processes on a cold cache, 0 processes when reopened unchanged', async () => {
    // The watcher on, the periodic check out of the way: under load the cold half can last past
    // its first tick, which would add git processes to the warm half (review F5).
    const { pid, standIn, runner } = await fresh(3_600_000);
    // With the notification bell's Today read (task-042, review R8): the real cold page.
    const cold = await standIn.openMemoryList(pid);
    expect(cold).toHaveLength(4);
    expect(cold.every((r) => r.state !== null)).toBe(true);
    const commands = runner.wingfoilCommands();
    console.info(
      `TT-PERF-05 cold Memory list: ${commands.length} CLI processes (${commands.join(', ')}), ${runner.count('git')} git`,
    );
    expect(commands.length).toBeLessThanOrEqual(6);
    // open(): one rev-parse; the first state: one status, one user.email (review F4), one `git remote`
    // and `branch.main.remote` (spec-010 §1, task-033 D33-7); the actor events of the descriptors: one
    // `git log -p` (spec-002 §3) and its header-only sha list; the header's `origin` (spec-006 §2
    // refresh on open).
    expect(runner.count('git')).toBe(8);
    expect(runner.spawned.filter((r) => r.args.includes('log'))).toHaveLength(2);
    // REQ-INT-06: every git process of the read routes uses a subcommand of the allowed list.
    for (const r of runner.spawned.filter((x) => processKind(x) === 'git')) {
      expect(GIT_ALLOWED_SUBCOMMANDS, r.args.join(' ')).toContain(gitSubcommand(r.args));
    }
    expect(new Set(commands).size).toBe(commands.length);
    const states = cold.map((r) => r.state);
    expect(states[0]).toMatch(STATE);
    expect(new Set(states).size).toBe(1);

    const before = runner.spawned.length;
    const warm = await standIn.openMemoryList(pid);
    await standIn.openMemoryList(pid);
    expect(runner.spawned.length).toBe(before);
    expect(warm.map((r) => r.state)).toEqual(states);
    expect(warm.map((r) => r.body)).toEqual(cold.map((r) => r.body));
  });
});

describe('TT-INT-09 — server ↔ browser live updates', () => {
  it('starts 0 CLI processes in 60 s with one page open and no change; a change reaches the open page', async () => {
    const { fx, pid, standIn, runner } = await fresh();
    const stream = await standIn.events();
    expect(stream.status).toBe(200);
    const [, , list] = await standIn.openMemoryList(pid);
    const cli = runner.count('wingfoil');
    const gitBefore = runner.count('git');
    await new Promise((r) => setTimeout(r, 60_000));
    const idleGit = runner.count('git') - gitBefore;
    console.info(
      `TT-INT-09 60 s idle: ${runner.count('wingfoil') - cli} CLI processes, ${idleGit} git (periodic check)`,
    );
    expect(runner.count('wingfoil')).toBe(cli);
    expect(stream.events()).toEqual([]);

    const file = path.join(fx.dir, 'docs/memory/task/task-001-login-form.md');
    await writeFile(file, (await readFile(file, 'utf8')).replace('title: "Login form"', 'title: "Login form v2"'));
    await git(fx.dir, ['commit', '-qam', 'retitle outside the UI'], fx.env);
    await expect
      .poll(() => stream.events().filter((e) => e.event === 'repo'), { timeout: 20_000, interval: 50 })
      .not.toEqual([]);
    const events = stream.events().filter((e) => e.event === 'repo');
    const last = events.at(-1)!.data as { pid: string; state: string };
    expect(last.pid).toBe(pid);
    expect(last.state).not.toBe(list!.state);
    await expect
      .poll(async () => (await standIn.get(`/api/p/${pid}/elements`)).state, { timeout: 20_000, interval: 50 })
      .toBe(snapshotState(registries.at(-1)!, pid));
    const refetched = await standIn.get(`/api/p/${pid}/elements`);
    const task = (refetched.body as { elements: { id: string; title: string; localChanges: boolean }[] }).elements.find(
      (e) => e.id === 'task-001-login-form',
    );
    expect(task).toMatchObject({ title: 'Login form v2', localChanges: false });
  }, 180_000);
});

function snapshotState(snapshots: Snapshots, pid: string): string | undefined {
  return snapshots.get(pid)?.current()?.key;
}

// task-031 (adr-001 D6, spec-002 §2): Today and the Memory events read the snapshot's cache — the
// same CLI reads as the Memory list and one `git log -p` + its sha list per HEAD.
describe('Today and the Memory events (task-031)', () => {
  it('cold Today: ≤ 3 CLI processes and 2 git log; warm, any role view, the events: 0 processes', async () => {
    const { fx, pid, standIn, runner, snapshots } = await fresh(3_600_000);
    // Alex: a member holding seven roles (before the first read: the first state reads it).
    await git(fx.dir, ['config', 'user.email', 'alex@example.test'], fx.env);
    runner.spawned.length = 0;
    const cold = await standIn.get(`/api/p/${pid}/today`);
    expect(cold.status).toBe(200);
    const commands = runner.wingfoilCommands();
    console.info(
      `task-031 cold Today: ${commands.length} CLI processes (${commands.join(', ')}), ${runner.count('git')} git`,
    );
    expect(commands.length).toBeLessThanOrEqual(3);
    expect(runner.spawned.filter((r) => r.args.includes('log'))).toHaveLength(2);

    const before = runner.spawned.length;
    const warm = await standIn.get(`/api/p/${pid}/today`);
    expect(warm.body).toEqual(cold.body);
    expect(warm.state).toBe(cold.state);
    // Every role view of the same state.
    const views = (cold.body as { summary?: { role: string }[] }).summary?.map((l) => l.role) ?? [];
    expect(views).toHaveLength(7);
    for (const view of views) expect((await standIn.get(`/api/p/${pid}/today?view=${view}`)).status).toBe(200);
    expect((await standIn.get(`/api/p/${pid}/events/memory`)).status).toBe(200);
    expect(runner.spawned.length).toBe(before);

    // A new HEAD (asserted moved first, D26-3): the events are read again, 2 git log.
    await git(fx.dir, ['commit', '--allow-empty', '-qm', 'outside the UI'], fx.env);
    const next = await (await snapshots.open(pid, fx.dir)).check();
    expect(next.key).not.toBe(cold.state);
    const logs = runner.spawned.filter((r) => r.args.includes('log')).length;
    const today = await standIn.get(`/api/p/${pid}/today`);
    expect(today.status).toBe(200);
    expect(today.state).toBe(next.key);
    expect(runner.spawned.filter((r) => r.args.includes('log')).length).toBe(logs + 2);
    // The events of the new HEAD are shared with Today: no further git log.
    const after = await standIn.get(`/api/p/${pid}/events/memory`);
    expect(after.status).toBe(200);
    expect(after.state).toBe(next.key);
    expect(runner.spawned.filter((r) => r.args.includes('log')).length).toBe(logs + 2);
  });
});
