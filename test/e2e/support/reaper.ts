/**
 * Every console an e2e run starts is torn down (bug-004 scope added by the coordinator: consoles of
 * an earlier run were found running ten hours later). Each console runs in its own process group
 * (`detached`), is recorded in the run's directory (`WFUI_E2E_RUN_DIR`, set by the global setup)
 * and in the worker's memory, and is killed (the whole group, SIGKILL):
 *
 * - by the test's `consoles` fixture when the test ends, passed or failed;
 * - by the worker-scoped reaper when the worker's fixtures are torn down;
 * - synchronously on the worker's `exit` (and on SIGTERM/SIGINT), for a worker that dies early;
 * - by the global teardown ({@link reapRun}), which also fails the run loudly when one survived.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Environment variable naming the run's directory of console records. */
export const RUN_DIR_ENV = 'WFUI_E2E_RUN_DIR';

/** What identifies a console process: the bin path on its command line. */
export const CONSOLE_MARK = path.join('bin', 'wingfoil-ui.cjs');

const live = new Set<number>();
let hooked = false;

/** Kill the process group of `pid` (falling back to the process), ignoring one already gone. */
export function killGroup(pid: number): void {
  for (const target of [-pid, pid]) {
    try {
      process.kill(target, 'SIGKILL');
      return;
    } catch {
      // not a group leader, or already gone
    }
  }
}

/** True while `pid` runs (a zombie counts as gone). */
export function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    return stat.slice(stat.lastIndexOf(')') + 2, stat.lastIndexOf(')') + 3) !== 'Z';
  } catch {
    return true;
  }
}

/** The command line of `pid` (Linux; `undefined` elsewhere or when gone). */
function commandLine(pid: number): string | undefined {
  try {
    return readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').join(' ');
  } catch {
    return undefined;
  }
}

function runDir(): string | undefined {
  return process.env[RUN_DIR_ENV];
}

/** Kill every console this worker still tracks. */
export function reapWorker(): void {
  for (const pid of live) {
    killGroup(pid);
    forget(pid);
  }
}

/** Record a started console (in this worker and in the run's directory). */
export function track(pid: number): void {
  live.add(pid);
  const dir = runDir();
  if (dir) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, String(pid)), String(pid));
  }
  if (!hooked) {
    hooked = true;
    process.once('exit', reapWorker);
    for (const signal of ['SIGTERM', 'SIGINT'] as const) {
      process.once(signal, () => {
        reapWorker();
        process.kill(process.pid, signal);
      });
    }
  }
}

/** Forget a console that was stopped. */
export function forget(pid: number): void {
  live.delete(pid);
  const dir = runDir();
  if (dir) {
    try {
      unlinkSync(path.join(dir, String(pid)));
    } catch {
      // already gone
    }
  }
}

/**
 * The global teardown's check: every console recorded by the run that still runs is killed and
 * reported. Returns the survivors (pid and command line).
 */
export function reapRun(dir: string): { pid: number; command: string }[] {
  if (!existsSync(dir)) return [];
  const survivors: { pid: number; command: string }[] = [];
  for (const name of readdirSync(dir)) {
    const pid = Number(name);
    if (!Number.isInteger(pid) || pid <= 0) continue;
    const command = commandLine(pid);
    // A recycled pid that is not a console is left alone.
    if (isRunning(pid) && (command === undefined || command.includes(CONSOLE_MARK))) {
      killGroup(pid);
      survivors.push({ pid, command: command ?? '' });
    }
  }
  rmSync(dir, { recursive: true, force: true });
  return survivors;
}
