// bug-004 (scope added by the coordinator; review F1, F2, F5) — the e2e console reaper: a console
// is recorded as soon as it is spawned; one still running when its worker ends, when its start times
// out, or when the run ends is killed with its process group, and the run's teardown names it; the
// next run's setup reaps the directories of a run killed before its teardown, never a concurrent
// run's; a recycled pid that is no console, or whose command line cannot be read, is left alone.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import globalTeardown from '../e2e/support/global-teardown.js';
import {
  CONSOLE_MARK,
  createRunDir,
  forget,
  isRunning,
  OWNER_FILE,
  reapRun,
  reapWorker,
  RUN_DIR_ENV,
  RUN_DIR_PREFIX,
  sweepStaleRuns,
  track,
} from '../e2e/support/reaper.js';
import { startLauncher } from '../launcher/launcher.js';
import { harnessEnv } from './fixtures/index.js';

const children: ChildProcess[] = [];
const dirs: string[] = [];
let dir: string;

/** A temporary directory removed after the test. */
function temp(prefix: string): string {
  const d = mkdtempSync(path.join(tmpdir(), prefix));
  dirs.push(d);
  return d;
}

/** A long-running process whose command line names the console bin (detached: its own group). */
function fakeConsole(mark = CONSOLE_MARK): ChildProcess {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', mark], {
    detached: true,
    stdio: 'ignore',
  });
  children.push(child);
  return child;
}

/** Wait until `pid` stops running. */
async function gone(pid: number): Promise<boolean> {
  for (let i = 0; i < 100 && isRunning(pid); i++) await new Promise((r) => setTimeout(r, 50));
  return !isRunning(pid);
}

beforeEach(() => {
  dir = temp('wfui-reaper-');
  process.env[RUN_DIR_ENV] = dir;
});
afterEach(() => {
  delete process.env[RUN_DIR_ENV];
  for (const c of children.splice(0)) {
    if (c.pid !== undefined) forget(c.pid);
    if (c.pid !== undefined && isRunning(c.pid)) process.kill(c.pid, 'SIGKILL');
  }
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

it('records a console in the run directory and forgets it once stopped', () => {
  const c = fakeConsole();
  track(c.pid!);
  expect(readdirSync(dir)).toEqual([String(c.pid)]);
  forget(c.pid!);
  expect(readdirSync(dir)).toEqual([]);
});

it('kills the consoles a worker still holds when it ends', async () => {
  const c = fakeConsole();
  track(c.pid!);
  reapWorker();
  expect(await gone(c.pid!)).toBe(true);
  expect(readdirSync(dir)).toEqual([]);
});

it('records a bin at spawn and kills its group when its start times out (review F1)', async () => {
  const env = (await harnessEnv(temp('wfui-reaper-env-'))).env;
  let recorded: number | undefined;
  await expect(
    startLauncher(['--no-open'], { ...env, WINGFOIL_UI_STATE_DIR: temp('wfui-reaper-state-') }, 1, {
      detached: true,
      onSpawn: (pid) => {
        recorded = pid;
        track(pid);
      },
    }),
  ).rejects.toThrow(/no running line after 1 ms/);
  expect(recorded).toBeGreaterThan(0);
  expect(readdirSync(dir)).toEqual([String(recorded)]);
  expect(await gone(recorded!)).toBe(true);
  forget(recorded!);
});

it('kills and reports at the end of the run a console that survived its worker', async () => {
  const c = fakeConsole();
  track(c.pid!);
  // The worker died without its teardown: the record stays, the process runs.
  expect(() => globalTeardown()).toThrow(
    new RegExp(`1 console\\(s\\) survived the e2e run and were killed: ${c.pid} `),
  );
  expect(await gone(c.pid!)).toBe(true);
  expect(existsSync(dir)).toBe(false);
});

it('leaves alone a recorded pid that is no console, or whose command line is unreadable (review F5)', () => {
  const other = fakeConsole('something-else');
  track(other.pid!);
  expect(reapRun(dir)).toEqual({ killed: [], unverified: [] });
  expect(isRunning(other.pid!)).toBe(true);
  const hidden = fakeConsole();
  const second = temp('wfui-reaper-');
  writeFileSync(path.join(second, String(hidden.pid)), '');
  expect(reapRun(second, () => undefined)).toEqual({ killed: [], unverified: [hidden.pid] });
  expect(isRunning(hidden.pid!)).toBe(true);
  process.env[RUN_DIR_ENV] = temp('wfui-reaper-');
  expect(() => globalTeardown()).not.toThrow();
});

it("reaps the directory of a run killed before its teardown, never a running run's (review F2)", async () => {
  const root = temp('wfui-reaper-root-');
  // A run whose owner is gone, with a console still running.
  const stale = path.join(root, `${RUN_DIR_PREFIX}stale`);
  mkdirSync(stale);
  const dead = spawn(process.execPath, ['-e', '']);
  await new Promise((r) => dead.once('exit', r));
  writeFileSync(path.join(stale, OWNER_FILE), String(dead.pid));
  const orphan = fakeConsole();
  writeFileSync(path.join(stale, String(orphan.pid)), '');
  // A concurrent run (its owner, this process, runs) with its own console.
  const live = createRunDir(root);
  const busy = fakeConsole();
  writeFileSync(path.join(live, String(busy.pid)), '');
  const swept = sweepStaleRuns(root);
  expect(swept.killed.map((k) => k.pid)).toEqual([orphan.pid]);
  expect(await gone(orphan.pid!)).toBe(true);
  expect(existsSync(stale)).toBe(false);
  expect(isRunning(busy.pid!)).toBe(true);
  expect(existsSync(live)).toBe(true);
});
