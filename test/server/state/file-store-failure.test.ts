// spec-006 §4 — atomic write: `state.json.tmp-<pid>` in the same directory, fsync, rename. A failed
// write leaves the previous `state.json` whole and no temporary file behind.
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

const failures = vi.hoisted(() => ({ rename: false, corruptGone: false, renames: [] as [string, string][], syncs: 0 }));

vi.mock('node:fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...real,
    rename: async (from: string, to: string) => {
      failures.renames.push([from, to]);
      if (failures.rename) throw Object.assign(new Error('EIO: simulated'), { code: 'EIO' });
      if (failures.corruptGone && to.includes('.corrupt-')) {
        // Another console kept the corrupt file first.
        await real.rename(from, `${to}-other`);
        throw Object.assign(new Error('ENOENT: simulated'), { code: 'ENOENT' });
      }
      return real.rename(from, to);
    },
    open: async (...args: Parameters<typeof real.open>) => {
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
  expect(failures.renames).toEqual([[path.join(dir, `state.json.tmp-${process.pid}`), path.join(dir, 'state.json')]]);
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
