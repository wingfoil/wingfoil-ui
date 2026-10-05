// The local-state store port (adr-002, spec-006 §2–§5), run against the file adapter and the
// in-memory fake: both must behave the same for the domain.
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openFileStateStore } from '../../../server/src/state/file-store.js';
import { createMemoryStateStore } from '../../../server/src/state/memory-store.js';
import type { StateStore, StoreOptions } from '../../../server/src/state/store.js';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

interface Adapter {
  name: string;
  /** A new, empty store. */
  open(options?: StoreOptions): Promise<StateStore>;
  /** The store a restart would see. */
  reopen(store: StateStore, options?: StoreOptions): Promise<StateStore>;
}

const fileAdapter: Adapter = {
  name: 'file adapter',
  open: async (options = {}) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'wfui-store-'));
    dirs.push(dir);
    return openFileStateStore({ ...options, dir: path.join(dir, 'state') });
  },
  reopen: (store, options = {}) => openFileStateStore({ ...options, dir: store.location }),
};

const memoryAdapter: Adapter = {
  name: 'in-memory fake',
  open: (options = {}) => createMemoryStateStore(options),
  reopen: (store, options = {}) => createMemoryStateStore({ ...options, initial: store.snapshot() }),
};

const KANBAN = { path: '/home/alex/projects/kanban', name: 'kanban', remote: 'https://github.com/acme/kanban.git' };
const CUSTOM = { path: '/home/alex/projects/custom', name: 'custom', remote: '' };
const NOW = new Date('2026-10-05T10:15:30.123Z');

describe.each([fileAdapter, memoryAdapter])('StateStore ($name)', (adapter) => {
  it('starts empty, writable and without warnings', async () => {
    const store = await adapter.open();
    expect(store.projects()).toEqual([]);
    expect(store.readOnly).toBe(false);
    expect(store.warnings()).toEqual([]);
  });

  it('adds a project with an opaque id, the UTC add time and the default role view', async () => {
    const store = await adapter.open({ now: () => NOW });
    const entry = await store.add(KANBAN);
    expect(entry).toEqual({
      ...KANBAN,
      id: expect.stringMatching(/^p_[0-9a-hjkmnp-tv-z]{12}$/),
      addedAt: '2026-10-05T10:15:30Z',
      roleView: '',
    });
    expect(entry.id).not.toContain('kanban');
    expect(store.get(entry.id)).toEqual(entry);
  });

  it('S-17.1 — keeps the list, in insertion order, across a restart', async () => {
    const store = await adapter.open();
    const a = await store.add(KANBAN);
    const b = await store.add(CUSTOM);
    const restarted = await adapter.reopen(store);
    expect(restarted.projects().map((p) => p.id)).toEqual([a.id, b.id]);
    expect(restarted.projects()).toEqual(store.projects());
  });

  it('S-22.3 — keeps the role view per project across a restart', async () => {
    const store = await adapter.open();
    const kanban = await store.add(KANBAN);
    const custom = await store.add(CUSTOM);
    await store.update(kanban.id, { roleView: 'developer' });
    await store.update(custom.id, { roleView: 'approver' });
    const restarted = await adapter.reopen(store);
    expect(restarted.get(kanban.id)?.roleView).toBe('developer');
    expect(restarted.get(custom.id)?.roleView).toBe('approver');
  });

  it('refreshes name and remote, and removes an entry', async () => {
    const store = await adapter.open();
    const kanban = await store.add(KANBAN);
    const updated = await store.update(kanban.id, { name: 'Kanban board', remote: '' });
    expect(updated).toMatchObject({ id: kanban.id, name: 'Kanban board', remote: '', path: KANBAN.path });
    expect(await store.update('p_000000000000', { name: 'x' })).toBeUndefined();
    expect(await store.remove(kanban.id)).toEqual(updated);
    expect(await store.remove(kanban.id)).toBeUndefined();
    expect((await adapter.reopen(store)).projects()).toEqual([]);
  });

  it('X-05.2 — compares ids as exact strings, never as paths', async () => {
    const store = await adapter.open();
    const kanban = await store.add(KANBAN);
    for (const id of ['../../etc', KANBAN.path, kanban.id.toUpperCase(), ` ${kanban.id}`, `${kanban.id}/..`, '']) {
      expect(store.get(id)).toBeUndefined();
    }
  });

  it('draws a new id when the random draw collides with a listed one', async () => {
    const draws = [Buffer.alloc(8, 1), Buffer.alloc(8, 1), Buffer.alloc(8, 2)];
    const store = await adapter.open({ random: () => draws.shift() ?? Buffer.alloc(8, 3) });
    const a = await store.add(KANBAN);
    const b = await store.add(CUSTOM);
    expect(a.id).not.toBe(b.id);
  });

  it('REQ-SEC-09 — stores a remote without its userinfo', async () => {
    const store = await adapter.open();
    const a = await store.add({ ...KANBAN, remote: 'https://alex:ghp_s3cr3t@github.com/acme/kanban.git' });
    expect(a.remote).toBe('https://github.com/acme/kanban.git');
    const b = await store.add({ ...CUSTOM, remote: 'ssh://git@example.test:2222/acme/custom.git' });
    expect(b.remote).toBe('ssh://example.test:2222/acme/custom.git');
    const c = await store.update(b.id, { remote: 'https://token@example.test/x' });
    expect(c?.remote).toBe('https://example.test/x');
    // The scp-like form names a login, never a password: kept as the user typed it.
    const d = await store.add({ ...CUSTOM, path: '/p/d', remote: 'git@github.com:acme/d.git' });
    expect(d.remote).toBe('git@github.com:acme/d.git');
    expect(JSON.stringify(store.snapshot())).not.toContain('s3cr3t');
  });

  it('a transaction sees the current list and writes only when it returns normally', async () => {
    const store = await adapter.open();
    await store.add(KANBAN);
    const before = store.snapshot();
    await expect(
      store.transaction((draft) => {
        draft.projects.push(draft.create(CUSTOM));
        throw new Error('already-listed');
      }),
    ).rejects.toThrow('already-listed');
    expect(store.snapshot()).toEqual(before);
    expect((await adapter.reopen(store)).snapshot()).toEqual(before);
    const seen = await store.transaction((draft) => draft.projects.map((p) => p.name));
    expect(seen).toEqual(['kanban']);
  });

  it('refuses to write a state that breaks the schema (relative path, duplicate id)', async () => {
    const store = await adapter.open();
    await expect(store.add({ ...KANBAN, path: 'projects/kanban' })).rejects.toThrow(/state/i);
    const a = await store.add(KANBAN);
    await expect(
      store.transaction((draft) => {
        draft.projects.push({ ...a, path: '/other' });
      }),
    ).rejects.toThrow(/duplicate/i);
    expect(store.projects()).toEqual([a]);
  });

  it('serialises concurrent mutations: none is lost', async () => {
    const store = await adapter.open();
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => store.add({ path: `/home/alex/p${i}`, name: `p${i}`, remote: '' })),
    );
    expect(store.projects()).toHaveLength(20);
    expect((await adapter.reopen(store)).projects()).toHaveLength(20);
  });

  it('hands out copies: a caller cannot change the stored list', async () => {
    const store = await adapter.open();
    const a = await store.add(KANBAN);
    (store.projects() as { name: string }[])[0]!.name = 'changed';
    store.get(a.id)!.name = 'changed';
    expect(store.get(a.id)?.name).toBe('kanban');
  });
});

it('the in-memory fake starts from a given state', async () => {
  const store = await createMemoryStateStore({
    initial: {
      version: 1,
      projects: [{ id: 'p_7kq2m9x4r1tz', ...KANBAN, addedAt: '2026-10-03T09:12:44Z', roleView: 'developer' }],
      settings: {},
      actionLog: [],
    },
  });
  expect(store.get('p_7kq2m9x4r1tz')?.roleView).toBe('developer');
  expect(store.location).toBe('memory');
});

it('the file adapter writes the spec-006 §2 shape', async () => {
  const store = await fileAdapter.open({ now: () => NOW });
  await store.add(KANBAN);
  const file = JSON.parse(await readFile(path.join(store.location, 'state.json'), 'utf8')) as unknown;
  expect(file).toEqual({ version: 1, projects: store.projects(), settings: {}, actionLog: [] });
});
