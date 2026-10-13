/**
 * One temporary root per test run (task-026, D26-2): the global setup of every runner — Vitest
 * (`npm test` / `test:coverage` and `test:timing` through `test/global-setup.ts`, `test:smoke`
 * through `test/smoke/global-setup.ts`) and Playwright (`test:e2e` and the Playwright part of
 * `test:timing`, `test/e2e/support/global-setup.ts` / `global-teardown.ts`, a root of its own next
 * to its run directory) — creates `<system tmp>/wfui-run-<pid>-<time>-<random>/`, owned by its
 * process (an `owner` file), and points `TMPDIR`, `TMP` and `TEMP` at its `tmp/` folder: every
 * `os.tmpdir()` of the run — test files, workers, the consoles and git processes they start —
 * lands there. The global teardown removes the root it owns, and only that one; the next start
 * removes the roots whose owner process is gone (a run killed before its teardown), never a
 * root of a run still going.
 */
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** Prefix of the run roots, under the system temporary directory. */
export const TEMP_ROOT_PREFIX = 'wfui-run-';

/** Prefix of a root being made (never swept). */
export const TEMP_ROOT_STAGING_PREFIX = '.wfui-run-staging-';

/** The file of a root naming the process that owns it. */
export const TEMP_ROOT_OWNER = 'owner';

/** Environment variable naming the run's root (set by {@link useTempRoot}). */
export const TEMP_ROOT_ENV = 'WFUI_TEMP_ROOT';

/** An owner-less root younger than this is left alone (it may be one being made). */
export const TEMP_ROOT_GRACE_MS = 60_000;

/** The variables that name the temporary directory on Linux, macOS and Windows. */
export const TEMP_DIR_VARS = ['TMPDIR', 'TMP', 'TEMP'] as const;

/**
 * True while `pid` runs (a zombie counts as gone). A copy of `isRunning` of
 * `test/e2e/support/reaper.ts` with one difference kept on purpose: a process of another user
 * (`EPERM`) counts as running here, so the sweep never removes a root whose owner may still run;
 * the reaper, which kills, treats it as not its own.
 */
export function processRuns(pid: number): boolean {
  try {
    process.kill(pid, 0);
  } catch (error) {
    // EPERM: it runs, as another user.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    return stat.slice(stat.lastIndexOf(')') + 2, stat.lastIndexOf(')') + 3) !== 'Z';
  } catch {
    return true;
  }
}

/** The owner pid recorded in `root`, or `undefined`. */
export function tempRootOwner(root: string): number | undefined {
  try {
    const pid = Number(readFileSync(path.join(root, TEMP_ROOT_OWNER), 'utf8'));
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A new root under `base`, owned by `owner`, with its empty `tmp/` folder. Made complete under
 * another name, then renamed into place: a concurrent sweep never sees it without its owner.
 */
export function createTempRoot(base: string = tmpdir(), owner: number = process.pid): string {
  const name = `${owner}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const staging = path.join(base, `${TEMP_ROOT_STAGING_PREFIX}${name}`);
  // A setup killed between the mkdir and the rename leaves this staging folder: it is never swept
  // (its name does not start with the root prefix) — a small leftover (its `tmp/` and maybe `owner`), accepted.
  mkdirSync(path.join(staging, 'tmp'), { recursive: true, mode: 0o700 });
  writeFileSync(path.join(staging, TEMP_ROOT_OWNER), String(owner));
  const root = path.join(base, `${TEMP_ROOT_PREFIX}${name}`);
  renameSync(staging, root);
  return root;
}

/** The folder of `root` that becomes the run's temporary directory. */
export function tempDirOf(root: string): string {
  return path.join(root, 'tmp');
}

/**
 * Point the temporary directory of this process (and of every process it starts afterwards) at
 * `root`'s `tmp/`. Returns a function restoring the previous values.
 */
export function useTempRoot(root: string, env: NodeJS.ProcessEnv = process.env): () => void {
  const saved = Object.fromEntries([...TEMP_DIR_VARS, TEMP_ROOT_ENV].map((k) => [k, env[k]]));
  for (const key of TEMP_DIR_VARS) env[key] = tempDirOf(root);
  env[TEMP_ROOT_ENV] = root;
  return () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  };
}

/**
 * Remove `root` when `owner` owns it; a root owned by another process (a concurrent run) or by
 * nobody is left alone. Returns whether it was removed.
 */
export function removeTempRoot(root: string, owner: number = process.pid): boolean {
  if (tempRootOwner(root) !== owner) return false;
  rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  return true;
}

/**
 * Remove the roots under `base` whose owner process is gone (a run killed before its teardown);
 * a root whose owner still runs belongs to a concurrent run and is kept, as is an owner-less root
 * younger than {@link TEMP_ROOT_GRACE_MS}. Returns the removed roots.
 */
export function sweepStaleTempRoots(
  base: string = tmpdir(),
  now: number = Date.now(),
  runs: (pid: number) => boolean = processRuns,
): string[] {
  const removed: string[] = [];
  for (const name of readdirSync(base)) {
    if (!name.startsWith(TEMP_ROOT_PREFIX)) continue;
    const root = path.join(base, name);
    const owner = tempRootOwner(root);
    if (owner === undefined) {
      let mtime: number;
      try {
        mtime = statSync(root).mtimeMs;
      } catch {
        continue;
      }
      if (now - mtime < TEMP_ROOT_GRACE_MS) continue;
    } else if (runs(owner)) continue;
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
    removed.push(root);
  }
  return removed;
}

/**
 * The global setup's part: sweep the stale roots of the system temporary directory, create this
 * run's root and use it. Returns the teardown (restore the variables, remove the root it owns).
 */
export function setUpTempRoot(): () => void {
  const base = tmpdir();
  sweepStaleTempRoots(base);
  const root = createTempRoot(base);
  const restore = useTempRoot(root);
  return () => {
    restore();
    removeTempRoot(root);
  };
}
