// bug-004 (scope added by the coordinator) — the e2e console reaper: a console still running when
// its worker ends, or when the run ends, is killed with its process group, and the run's teardown
// names it; an unrelated process with a recycled pid is left alone.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import globalTeardown from '../e2e/support/global-teardown.js';
import { CONSOLE_MARK, forget, isRunning, reapRun, reapWorker, RUN_DIR_ENV, track } from '../e2e/support/reaper.js';

const children: ChildProcess[] = [];
let dir: string;

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
  dir = mkdtempSync(path.join(tmpdir(), 'wfui-reaper-'));
  process.env[RUN_DIR_ENV] = dir;
});
afterEach(() => {
  delete process.env[RUN_DIR_ENV];
  for (const c of children.splice(0)) if (c.pid && isRunning(c.pid)) process.kill(c.pid, 'SIGKILL');
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

it('kills and reports at the end of the run a console that survived its worker', async () => {
  const c = fakeConsole();
  track(c.pid!);
  // The worker died without its teardown: the record stays, the process runs.
  expect(() => globalTeardown()).toThrow(
    new RegExp(`1 console\\(s\\) survived the e2e run and were killed: ${c.pid} `),
  );
  expect(await gone(c.pid!)).toBe(true);
  expect(existsSync(dir)).toBe(false);
  forget(c.pid!);
});

it('leaves alone a recorded pid that is no console, and passes when nothing survived', async () => {
  const other = fakeConsole('something-else');
  track(other.pid!);
  expect(reapRun(dir)).toEqual([]);
  expect(isRunning(other.pid!)).toBe(true);
  forget(other.pid!);
  process.env[RUN_DIR_ENV] = mkdtempSync(path.join(tmpdir(), 'wfui-reaper-'));
  expect(() => globalTeardown()).not.toThrow();
});
