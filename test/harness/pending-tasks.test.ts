// task-061 — the Given step of T-02.6 (D61-12): `addPendingTasks` adds tasks to a kanban fixture and
// submits them with the pinned CLI as Jordan, dated after the fixture's own commits.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { binScript } from './cli.js';
import { addPendingTasks, buildFixture, cliPackageDir, type Fixture } from './fixtures/index.js';
import { HEAVY_MS } from './load.js';
import { git, run } from './run.js';

const NOW = new Date('2026-10-05T12:00:00Z');
let root: string;
let kanban: Fixture;
let custom: Fixture;

async function search(fx: Fixture): Promise<{ id: string; type: string; status: string }[]> {
  const script = binScript(cliPackageDir(fx));
  const { stdout } = await run(process.execPath, [script, 'memory', 'search', '--format', 'json'], {
    cwd: fx.dir,
    env: fx.env,
  });
  return (JSON.parse(stdout) as { matches: { id: string; type: string; status: string }[] }).matches;
}

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'wfui-pending-'));
  [kanban, custom] = await Promise.all([
    buildFixture('kanban', { root, now: NOW }),
    buildFixture('custom', { root, now: NOW }),
  ]);
}, HEAVY_MS);

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

it(
  'adds and submits the tasks as Jordan, after the fixture’s commits (T-02.6)',
  async () => {
    const before = await search(kanban);
    const lastBefore = (await git(kanban.dir, ['log', '-1', '--format=%ct'], kanban.env)).stdout.trim();
    const ids = await addPendingTasks(kanban, 3);
    expect(ids).toHaveLength(3);
    const after = await search(kanban);
    expect(after.filter((m) => !before.some((b) => b.id === m.id)).map((m) => [m.id, m.type, m.status])).toEqual(
      ids.map((id) => [id, 'task', 'pending']),
    );
    // Two commits per task (add, submit), all by Jordan, all after the fixture's last one.
    const log = (await git(kanban.dir, ['log', '-6', '--format=%an|%ct|%s'], kanban.env)).stdout.trim().split('\n');
    expect(log).toHaveLength(6);
    for (const line of log) {
      const [author, at, subject] = line.split('|');
      expect(author).toBe('Jordan');
      expect(Number(at)).toBeGreaterThan(Number(lastBefore));
      expect(subject).toMatch(/^wf\(task\): (add|submit) task-\d+-pending-task-\d$/);
    }
    // The working tree is clean: every change went through the CLI's commits.
    expect((await git(kanban.dir, ['status', '--porcelain'], kanban.env)).stdout).toBe('');
  },
  HEAVY_MS,
);

it('refuses another fixture kind and a count out of range', async () => {
  await expect(addPendingTasks(custom, 1)).rejects.toThrow(/kanban fixture, not custom/);
  await expect(addPendingTasks(kanban, 0)).rejects.toThrow(/1 to 100 tasks/);
  await expect(addPendingTasks(kanban, 1.5)).rejects.toThrow(/1 to 100 tasks/);
});
