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
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** Environment variable naming the run's directory of console records. */
export const RUN_DIR_ENV = 'WFUI_E2E_RUN_DIR';

/** What identifies a console process: the bin path on its command line. */
export const CONSOLE_MARK = path.join('bin', 'wingfoil-ui.cjs');

const live = new Set<number>();
let hooked = false;

/**
 * Kill the process group led by `pid` (every console is spawned detached: it leads its group),
 * ignoring one already gone. No fallback to the pid alone: a pid that leads no group is not one of
 * the consoles (review F5).
 */
export function killGroup(pid: number): void {
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // already gone
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

/** What {@link reapRun} found. */
export interface RunReap {
  /** Consoles still running: killed. */
  killed: { pid: number; command: string }[];
  /** Recorded pids still running whose command line cannot be read: left alone, reported. */
  unverified: number[];
}

/** The file of a run directory naming the Playwright process that owns it. */
export const OWNER_FILE = 'owner';

/** Prefix of the run directories (under the system temporary directory). */
export const RUN_DIR_PREFIX = 'wfui-e2e-run-';

/**
 * The global teardown's check: every console recorded by the run that still runs is killed and
 * reported; a running pid whose command line cannot be read is not killed (it may be another
 * user's process with a recycled pid) but reported. The directory is removed.
 */
export function reapRun(dir: string, readCommand: (pid: number) => string | undefined = commandLine): RunReap {
  const result: RunReap = { killed: [], unverified: [] };
  if (!existsSync(dir)) return result;
  for (const name of readdirSync(dir)) {
    const pid = Number(name);
    if (!Number.isInteger(pid) || pid <= 0 || !isRunning(pid)) continue;
    const command = readCommand(pid);
    if (command === undefined) result.unverified.push(pid);
    // A recycled pid that is not a console is left alone.
    else if (command.includes(CONSOLE_MARK)) {
      killGroup(pid);
      result.killed.push({ pid, command });
    }
  }
  rmSync(dir, { recursive: true, force: true });
  return result;
}

/** A new run directory owned by this process (the global setup's). */
export function createRunDir(root = tmpdir()): string {
  // Made complete under another name, then renamed into place: a concurrent sweep never sees the
  // run directory without its owner (review N1).
  const name = `${process.pid}-${Date.now()}`;
  const staging = path.join(root, `${STAGING_PREFIX}${name}`);
  mkdirSync(staging, { recursive: true });
  writeFileSync(path.join(staging, OWNER_FILE), String(process.pid));
  const dir = path.join(root, `${RUN_DIR_PREFIX}${name}`);
  renameSync(staging, dir);
  return dir;
}

/** Prefix of a run directory being made (never swept). */
export const STAGING_PREFIX = '.wfui-e2e-staging-';

/** An owner-less run directory younger than this is left alone (it may be one being made). */
export const ORPHAN_GRACE_MS = 60_000;

/**
 * Reap the run directories of earlier runs whose owner is gone (a run killed before its teardown,
 * review F2); a directory whose owner still runs belongs to a concurrent run and is left alone.
 */
export function sweepStaleRuns(root = tmpdir(), now = Date.now()): RunReap {
  const all: RunReap = { killed: [], unverified: [] };
  for (const name of readdirSync(root)) {
    if (!name.startsWith(RUN_DIR_PREFIX)) continue;
    const dir = path.join(root, name);
    let owner = NaN;
    try {
      owner = Number(readFileSync(path.join(dir, OWNER_FILE), 'utf8'));
    } catch {
      // No owner recorded: an orphan, unless it is recent (made by another tool, or by an older
      // support without the atomic creation, review N1).
      let mtime: number;
      try {
        mtime = statSync(dir).mtimeMs;
      } catch {
        continue;
      }
      if (now - mtime < ORPHAN_GRACE_MS) continue;
    }
    if (Number.isInteger(owner) && owner > 0 && isRunning(owner)) continue;
    const r = reapRun(dir);
    all.killed.push(...r.killed);
    all.unverified.push(...r.unverified);
  }
  return all;
}
