// task-026 (D26-2, AC-1): one temporary root per run. Inside a run every `os.tmpdir()` — this
// file's and a child process's — lies under the run's root; the teardown removes only the root
// its process owns; the start sweep removes only roots whose owner process is gone.
import { existsSync, mkdirSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { run } from './run.js';
import {
  createTempRoot,
  processRuns,
  removeTempRoot,
  sweepStaleTempRoots,
  TEMP_DIR_VARS,
  TEMP_ROOT_ENV,
  TEMP_ROOT_GRACE_MS,
  TEMP_ROOT_PREFIX,
  TEMP_ROOT_STAGING_PREFIX,
  tempDirOf,
  tempRootOwner,
  useTempRoot,
} from './temp-root.js';
import { TempWorkspace } from './temp-workspace.js';

let workspace: TempWorkspace;
let base = '';
let n = 0;

/** A fresh base folder standing for the system temporary directory. */
function freshBase(): string {
  n += 1;
  const dir = path.join(workspace.dir, `base-${n}`);
  mkdirSync(dir);
  return dir;
}

/** The pid of a process that has ended. */
async function deadPid(): Promise<number> {
  const r = await run(process.execPath, ['-e', 'process.stdout.write(String(process.pid))']);
  const pid = Number(r.stdout);
  expect(processRuns(pid)).toBe(false);
  return pid;
}

beforeAll(async () => {
  workspace = await TempWorkspace.create('wfui-temp-root-');
  base = workspace.dir;
});

afterAll(async () => {
  await workspace?.dispose();
});

describe('the run of this file', () => {
  it('has its temporary directory under the run root, owned by a running process', async () => {
    const root = process.env[TEMP_ROOT_ENV];
    expect(root, 'the global setup sets the run root').toBeDefined();
    expect(path.basename(root!).startsWith(TEMP_ROOT_PREFIX)).toBe(true);
    expect(tmpdir()).toBe(tempDirOf(root!));
    for (const key of TEMP_DIR_VARS) expect(process.env[key]).toBe(tempDirOf(root!));
    expect(processRuns(tempRootOwner(root!)!)).toBe(true);
    expect(base.startsWith(tempDirOf(root!) + path.sep)).toBe(true);
    // A child process inherits it.
    const child = await run(process.execPath, ['-e', "process.stdout.write(require('node:os').tmpdir())"]);
    expect(child.stdout).toBe(tempDirOf(root!));
  });
});

describe('createTempRoot / removeTempRoot', () => {
  it('creates a private root owned by the process, with its tmp folder', () => {
    const root = createTempRoot(freshBase());
    expect(path.basename(root).startsWith(TEMP_ROOT_PREFIX)).toBe(true);
    expect(tempRootOwner(root)).toBe(process.pid);
    expect(statSync(tempDirOf(root)).isDirectory()).toBe(true);
    if (process.platform !== 'win32') expect(statSync(tempDirOf(root)).mode & 0o077).toBe(0);
  });

  it('removes the root its process owns, never one owned by another process or by nobody', async () => {
    const b = freshBase();
    const mine = createTempRoot(b);
    const other = createTempRoot(b, process.ppid);
    const dead = createTempRoot(b, await deadPid());
    const ownerless = path.join(b, `${TEMP_ROOT_PREFIX}ownerless`);
    mkdirSync(ownerless);
    writeFileSync(path.join(tempDirOf(mine), 'f'), 'x');
    expect(removeTempRoot(other)).toBe(false);
    expect(removeTempRoot(dead)).toBe(false);
    expect(removeTempRoot(ownerless)).toBe(false);
    expect(removeTempRoot(mine)).toBe(true);
    expect([existsSync(mine), existsSync(other), existsSync(dead), existsSync(ownerless)]).toEqual([
      false,
      true,
      true,
      true,
    ]);
  });
});

describe('sweepStaleTempRoots', () => {
  it('removes only the roots whose owner is gone (and old owner-less ones)', async () => {
    const b = freshBase();
    const live = createTempRoot(b); // this process: a run still going
    const parent = createTempRoot(b, process.ppid); // a concurrent run
    const dead = createTempRoot(b, await deadPid());
    writeFileSync(path.join(tempDirOf(dead), 'left-behind'), 'x');
    const youngOrphan = path.join(b, `${TEMP_ROOT_PREFIX}young`);
    const oldOrphan = path.join(b, `${TEMP_ROOT_PREFIX}old`);
    mkdirSync(youngOrphan);
    mkdirSync(oldOrphan);
    const old = (Date.now() - 2 * TEMP_ROOT_GRACE_MS) / 1000;
    utimesSync(oldOrphan, old, old);
    const staging = path.join(b, `${TEMP_ROOT_STAGING_PREFIX}x`);
    const unrelated = path.join(b, 'wfui-other-123');
    mkdirSync(staging);
    mkdirSync(unrelated);
    utimesSync(staging, old, old);
    utimesSync(unrelated, old, old);
    expect(sweepStaleTempRoots(b).sort()).toEqual([dead, oldOrphan].sort());
    for (const kept of [live, parent, youngOrphan, staging, unrelated]) expect(existsSync(kept), kept).toBe(true);
  });

  it('keeps a root whose owner runs, removes it once the owner is gone', () => {
    const b = freshBase();
    const root = createTempRoot(b, 4242);
    expect(sweepStaleTempRoots(b, Date.now(), () => true)).toEqual([]);
    expect(sweepStaleTempRoots(b, Date.now(), () => false)).toEqual([root]);
  });
});

describe('useTempRoot', () => {
  it('points every temporary-directory variable at the root, and restores them', () => {
    const env: NodeJS.ProcessEnv = { TMPDIR: '/before', OTHER: 'x' };
    const root = createTempRoot(freshBase());
    const restore = useTempRoot(root, env);
    expect(env).toEqual({
      TMPDIR: tempDirOf(root),
      TMP: tempDirOf(root),
      TEMP: tempDirOf(root),
      [TEMP_ROOT_ENV]: root,
      OTHER: 'x',
    });
    restore();
    expect(env).toEqual({ TMPDIR: '/before', OTHER: 'x' });
  });
});
