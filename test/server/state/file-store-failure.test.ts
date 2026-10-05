// spec-006 §4 — atomic write: `state.json.tmp-<pid>` in the same directory, fsync, rename. A failed
// write leaves the previous `state.json` whole and no temporary file behind.
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

const failures = vi.hoisted(() => ({
  rename: false,
  corruptGone: false,
  renames: [] as [string, string][],
  syncs: 0,
  /** Windows-like transient errors still to throw: on the lock creation, on the rename. */
  lockBusy: [] as string[],
  renameBusy: [] as string[],
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...real,
    rename: async (from: string, to: string) => {
      failures.renames.push([from, to]);
      const busy = failures.renameBusy.shift();
      if (busy) throw Object.assign(new Error(`${busy}: simulated`), { code: busy });
      if (failures.rename) throw Object.assign(new Error('EIO: simulated'), { code: 'EIO' });
      if (failures.corruptGone && to.includes('.corrupt-')) {
        // Another console kept the corrupt file first.
        await real.rename(from, `${to}-other`);
        throw Object.assign(new Error('ENOENT: simulated'), { code: 'ENOENT' });
      }
      return real.rename(from, to);
    },
    open: async (...args: Parameters<typeof real.open>) => {
      if (String(args[0]).endsWith('state.json.lock') && args[1] === 'wx') {
        const busy = failures.lockBusy.shift();
        if (busy) throw Object.assign(new Error(`${busy}: simulated`), { code: busy });
      }
      const handle = await real.open(...args);
      const sync = handle.sync.bind(handle);
      handle.sync = async () => {
        failures.syncs++;
        return sync();
      };
      return handle;
    },
  };
});

const { openFileStateStore } = await import('../../../server/src/state/file-store.js');

let root: string;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'wfui-atomic-'));
});

beforeEach(() => {
  failures.rename = false;
  failures.corruptGone = false;
  failures.lockBusy = [];
  failures.renameBusy = [];
  failures.renames = [];
  failures.syncs = 0;
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

it('writes through state.json.tmp-<pid>, synced, renamed over state.json', async () => {
  const dir = path.join(root, 'ok');
  const store = await openFileStateStore({ dir });
  await store.add({ path: '/home/alex/kanban', name: 'kanban', remote: '' });
  expect(failures.renames).toHaveLength(1);
  const [from, to] = failures.renames[0]!;
  expect(path.dirname(from)).toBe(dir);
  expect(path.basename(from)).toMatch(new RegExp(`^state\\.json\\.tmp-${process.pid}-\\d+$`));
  expect(to).toBe(path.join(dir, 'state.json'));
  expect(failures.syncs).toBeGreaterThanOrEqual(1);
});

it('a failed rename leaves the previous file whole, the state unchanged and no temporary file', async () => {
  const dir = path.join(root, 'fail');
  const store = await openFileStateStore({ dir });
  await store.add({ path: '/home/alex/kanban', name: 'kanban', remote: '' });
  const before = await readFile(path.join(dir, 'state.json'), 'utf8');
  failures.rename = true;
  await expect(store.add({ path: '/home/alex/custom', name: 'custom', remote: '' })).rejects.toThrow('EIO');
  expect(await readFile(path.join(dir, 'state.json'), 'utf8')).toBe(before);
  expect(await readdir(dir)).toEqual(['state.json']);
  expect(store.projects().map((p) => p.name)).toEqual(['kanban']);
});

it('a corrupt file another console moved aside first is not reported twice', async () => {
  const dir = path.join(root, 'race');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'state.json'), 'garbage');
  failures.corruptGone = true;
  const store = await openFileStateStore({ dir });
  expect(store.projects()).toEqual([]);
  expect(store.warnings()).toEqual([]);
});

it('a rename failure other than ENOENT while keeping a corrupt file is not hidden', async () => {
  const dir = path.join(root, 'corrupt-eio');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'state.json'), 'garbage');
  failures.rename = true;
  await expect(openFileStateStore({ dir })).rejects.toThrow('EIO');
  expect(await readFile(path.join(dir, 'state.json'), 'utf8')).toBe('garbage');
});

it('every write has its own temporary file, and a stale one never lends its mode to state.json', async () => {
  const dir = path.join(root, 'stale-tmp');
  const store = await openFileStateStore({ dir });
  await store.add({ path: '/home/alex/kanban', name: 'kanban', remote: '' });
  const first = failures.renames[0]![0];
  const n = Number(/-(\d+)$/.exec(first)![1]);
  // The next write's temporary file already exists, world-readable (left by an earlier run).
  const next = path.join(dir, `state.json.tmp-${process.pid}-${n + 1}`);
  await writeFile(next, 'stale', { mode: 0o644 });
  await chmod(next, 0o644);
  await store.add({ path: '/home/alex/custom', name: 'custom', remote: '' });
  expect(failures.renames[1]![0]).toBe(next);
  if (process.platform !== 'win32') expect((await stat(path.join(dir, 'state.json'))).mode & 0o777).toBe(0o600);
  expect(await readdir(dir)).toEqual(['state.json']);
});

it('win32: a lock creation refused with EPERM/EACCES/EBUSY is retried, and so is the rename', async () => {
  const dir = path.join(root, 'win32');
  const store = await openFileStateStore({ dir, platform: 'win32' });
  failures.lockBusy = ['EPERM', 'EACCES', 'EBUSY'];
  failures.renameBusy = ['EBUSY', 'EPERM', 'EACCES'];
  await store.add({ path: '/home/alex/kanban', name: 'kanban', remote: '' });
  expect(failures.lockBusy).toEqual([]);
  expect(failures.renames).toHaveLength(4);
  expect(store.projects()).toHaveLength(1);
  expect(await readdir(dir)).toEqual(['state.json']);
});

it('POSIX: EBUSY on the rename is not retried', async () => {
  const dir = path.join(root, 'posix-busy');
  const store = await openFileStateStore({ dir, platform: 'linux' });
  failures.renameBusy = ['EBUSY'];
  await expect(store.add({ path: '/home/alex/kanban', name: 'kanban', remote: '' })).rejects.toThrow('EBUSY');
  expect(await readdir(dir)).toEqual([]);
});
