// spec-006 §1, §4 — the file adapter: modes, missing / corrupt / newer files, two consoles.
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openFileStateStore } from '../../../server/src/state/file-store.js';

let root: string;
let dir: string;
let file: string;
const NOW = new Date('2026-10-05T10:15:30.123Z');
const KANBAN = { path: '/home/alex/projects/kanban', name: 'kanban', remote: '' };
const ENTRY = { id: 'p_7kq2m9x4r1tz', ...KANBAN, addedAt: '2026-10-03T09:12:44Z', roleView: 'developer' };
const posix = process.platform !== 'win32';

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'wfui-file-store-'));
  dir = path.join(root, 'config', 'wingfoil-ui');
  file = path.join(dir, 'state.json');
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function seed(content: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(file, content);
}

describe('missing file', () => {
  it('S-01.1 — is an empty state and is not created by a read', async () => {
    const store = await openFileStateStore({ dir });
    expect(store.projects()).toEqual([]);
    expect(store.warnings()).toEqual([]);
    await expect(stat(dir)).rejects.toThrow();
  });

  it.runIf(posix)('is created on first write: directory 0700, state.json 0600', async () => {
    const store = await openFileStateStore({ dir });
    await store.add(KANBAN);
    expect((await stat(dir)).mode & 0o777).toBe(0o700);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(await readdir(dir)).toEqual(['state.json']);
  });
});

describe('writes', () => {
  it('keep settings and actionLog written by another build of the same version', async () => {
    await seed(JSON.stringify({ version: 1, projects: [], settings: { theme: 'dark' }, actionLog: [{ sha: 'a1' }] }));
    const store = await openFileStateStore({ dir });
    await store.add(KANBAN);
    const written = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
    expect(written.settings).toEqual({ theme: 'dark' });
    expect(written.actionLog).toEqual([{ sha: 'a1' }]);
  });

  it('two consoles on the same state directory do not drop each other’s additions', async () => {
    const a = await openFileStateStore({ dir });
    const b = await openFileStateStore({ dir });
    await a.add(KANBAN);
    await b.add({ ...KANBAN, path: '/home/alex/projects/custom', name: 'custom' });
    await a.add({ ...KANBAN, path: '/home/alex/projects/third', name: 'third' });
    const names = (await openFileStateStore({ dir })).projects().map((p) => p.name);
    expect(names).toEqual(['kanban', 'custom', 'third']);
  });

  it('a no-op transaction does not write', async () => {
    await seed(`${JSON.stringify({ version: 1, projects: [ENTRY], settings: {}, actionLog: [] })}\n`);
    const before = await stat(file);
    const store = await openFileStateStore({ dir });
    await store.transaction(() => undefined);
    expect((await stat(file)).mtimeMs).toBe(before.mtimeMs);
    expect(await readFile(file, 'utf8')).toBe(
      `${JSON.stringify({ version: 1, projects: [ENTRY], settings: {}, actionLog: [] })}\n`,
    );
  });
});

describe('corrupt file', () => {
  it.each([
    ['unparsable', '{"version": 1, "projects": ['],
    [
      'schema-invalid',
      JSON.stringify({ version: 1, projects: [{ ...ENTRY, id: '../../etc' }], settings: {}, actionLog: [] }),
    ],
    [
      'with a duplicate id',
      JSON.stringify({ version: 1, projects: [ENTRY, { ...ENTRY, path: '/x' }], settings: {}, actionLog: [] }),
    ],
    ['not an object', '[]'],
  ])('%s: is kept as state.json.corrupt-<UTC>, the state starts empty, and a warning names it', async (_l, content) => {
    await seed(content);
    const store = await openFileStateStore({ dir, now: () => NOW });
    const kept = path.join(dir, 'state.json.corrupt-20261005T101530Z');
    expect(await readFile(kept, 'utf8')).toBe(content);
    await expect(stat(file)).rejects.toThrow();
    expect(store.projects()).toEqual([]);
    expect(store.readOnly).toBe(false);
    expect(store.warnings()).toEqual([{ key: 'state.corruptKept', args: { file: kept } }]);
    await store.add(KANBAN);
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ version: 1, projects: [{ name: 'kanban' }] });
    expect(await readFile(kept, 'utf8')).toBe(content);
  });

  it('never overwrites an earlier corrupt copy kept in the same second', async () => {
    await seed('first');
    await openFileStateStore({ dir, now: () => NOW });
    await writeFile(file, 'second');
    const store = await openFileStateStore({ dir, now: () => NOW });
    expect(await readFile(path.join(dir, 'state.json.corrupt-20261005T101530Z'), 'utf8')).toBe('first');
    expect(await readFile(path.join(dir, 'state.json.corrupt-20261005T101530Z-1'), 'utf8')).toBe('second');
    expect(store.warnings()[0]?.args.file).toBe(path.join(dir, 'state.json.corrupt-20261005T101530Z-1'));
  });

  it('found again before a mutation is kept too, and the mutation applies to an empty state', async () => {
    const store = await openFileStateStore({ dir, now: () => NOW });
    await store.add(KANBAN);
    await writeFile(file, 'garbage');
    await store.add({ ...KANBAN, path: '/home/alex/projects/custom', name: 'custom' });
    expect(store.projects().map((p) => p.name)).toEqual(['custom']);
    expect(store.warnings()).toEqual([
      { key: 'state.corruptKept', args: { file: path.join(dir, 'state.json.corrupt-20261005T101530Z') } },
    ]);
  });
});

describe('file written by a newer build', () => {
  const newer = {
    version: 2,
    projects: [{ ...ENTRY, pinned: true }],
    settings: { theme: 'dark' },
    actionLog: [],
    workspaces: [],
  };

  it('is read for the known fields, never written back, with a warning', async () => {
    const content = JSON.stringify(newer);
    await seed(content);
    const store = await openFileStateStore({ dir });
    expect(store.readOnly).toBe(true);
    expect(store.projects()).toEqual([ENTRY]);
    expect(store.warnings()).toEqual([{ key: 'state.newerVersion', args: {} }]);
    const added = await store.add({ ...KANBAN, path: '/home/alex/projects/custom', name: 'custom' });
    await store.update(ENTRY.id, { roleView: 'approver' });
    // Changes live for this run only (the shell says they are not saved).
    expect(store.get(added.id)?.name).toBe('custom');
    expect(store.get(ENTRY.id)?.roleView).toBe('approver');
    expect(await readFile(file, 'utf8')).toBe(content);
    expect(await readdir(dir)).toEqual(['state.json']);
  });

  it('is never moved aside, even when its known fields do not validate', async () => {
    const content = JSON.stringify({ ...newer, projects: [{ id: 42 }] });
    await seed(content);
    const store = await openFileStateStore({ dir });
    expect(store.readOnly).toBe(true);
    expect(store.projects()).toEqual([]);
    expect(store.warnings()).toEqual([{ key: 'state.newerVersion', args: {} }]);
    expect(await readdir(dir)).toEqual(['state.json']);
  });
});
