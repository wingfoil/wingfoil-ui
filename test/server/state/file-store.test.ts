// spec-006 §1, §4 — the file adapter: modes, missing / corrupt / newer files, two consoles.
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
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
  // Changed in task-030 (D30-1, D30-2): a write keeps the valid settings and the action log, and
  // drops unknown and invalid settings keys.
  it('keep valid settings and the action log; drop unknown and invalid settings keys', async () => {
    const actionLog = [{ sha: 'a1'.repeat(20), at: '2026-10-12T09:30:02Z' }];
    await seed(
      JSON.stringify({ version: 1, projects: [], settings: { theme: 'dark', autoPush: 'yes', newer: 1 }, actionLog }),
    );
    const store = await openFileStateStore({ dir });
    await store.add(KANBAN);
    const written = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
    expect(written.settings).toEqual({ theme: 'dark' });
    expect(written.actionLog).toEqual(actionLog);
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

describe('reading', () => {
  it('ignores a leading byte-order mark', async () => {
    await seed(`\uFEFF${JSON.stringify({ version: 1, projects: [ENTRY], settings: {}, actionLog: [] })}`);
    const store = await openFileStateStore({ dir });
    expect(store.projects()).toEqual([ENTRY]);
    expect(store.warnings()).toEqual([]);
  });

  it('a state.json that cannot be read fails with a message naming the file', async () => {
    await mkdir(file, { recursive: true });
    await expect(openFileStateStore({ dir })).rejects.toThrow(file);
  });

  it('reload() re-reads the list another console changed', async () => {
    const a = await openFileStateStore({ dir });
    const b = await openFileStateStore({ dir });
    await a.add(KANBAN);
    expect(b.projects()).toEqual([]);
    expect((await b.reload()).map((p) => p.name)).toEqual(['kanban']);
    expect(b.projects().map((p) => p.name)).toEqual(['kanban']);
  });

  it('a no-op transaction creates nothing when there is no state yet', async () => {
    const store = await openFileStateStore({ dir });
    expect(await store.transaction((draft) => draft.projects.length)).toBe(0);
    await expect(
      store.transaction(() => {
        throw new Error('refused');
      }),
    ).rejects.toThrow('refused');
    await expect(stat(dir)).rejects.toThrow();
  });

  it('reload() creates nothing when there is no state yet', async () => {
    const store = await openFileStateStore({ dir });
    expect(await store.reload()).toEqual([]);
    await expect(stat(dir)).rejects.toThrow();
  });
});

/** The pid of a process that has already exited. */
async function deadPid(): Promise<number> {
  const child = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' });
  await new Promise((r) => child.once('exit', r));
  return child.pid!;
}

describe('temporary files', () => {
  it('those of dead processes are swept when the state is opened; a live one is kept', async () => {
    const dead = await deadPid();
    await seed(JSON.stringify({ version: 1, projects: [ENTRY], settings: {}, actionLog: [] }));
    const live = `state.json.tmp-${process.pid}-999999`;
    for (const name of [`state.json.tmp-${dead}`, `state.json.tmp-${dead}-3`, live, 'state.json.tmp-x']) {
      await writeFile(path.join(dir, name), 'partial');
    }
    await openFileStateStore({ dir });
    expect((await readdir(dir)).sort()).toEqual(['state.json', live, 'state.json.tmp-x'].sort());
  });
});

describe('lock between processes (state.json.lock)', () => {
  const lock = () => path.join(dir, 'state.json.lock');

  it('is released after every mutation, also a refused one', async () => {
    const store = await openFileStateStore({ dir });
    await store.add(KANBAN);
    await expect(
      store.transaction(() => {
        throw new Error('refused');
      }),
    ).rejects.toThrow('refused');
    expect(await readdir(dir)).toEqual(['state.json']);
  });

  it('waits while a live process holds it', async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(lock(), `${hostname()} ${process.pid} other`);
    const store = await openFileStateStore({ dir });
    let done = false;
    const adding = store.add(KANBAN).then(() => (done = true));
    await new Promise((r) => setTimeout(r, 150));
    expect(done).toBe(false);
    await rm(lock());
    await adding;
    expect(store.projects()).toHaveLength(1);
    expect(await readdir(dir)).toEqual(['state.json']);
  });

  it('breaks a lock left by a dead process', async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(lock(), `${hostname()} ${await deadPid()} gone`);
    const store = await openFileStateStore({ dir });
    await store.add(KANBAN);
    expect(await readdir(dir)).toEqual(['state.json']);
  });

  it('holds the lock with "<hostname> <pid> <nonce>"', async () => {
    const store = await openFileStateStore({ dir });
    await store.add(KANBAN);
    let content = '';
    await store.transaction(async (draft) => {
      content = await readFile(lock(), 'utf8');
      draft.projects.push(draft.create({ ...KANBAN, path: '/home/alex/projects/custom' }));
    });
    expect(content).toMatch(
      new RegExp(`^${hostname().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ${process.pid} [0-9a-f-]{36}$`),
    );
  });

  it('does not judge the pid of another host: a fresh lock from another host is waited for', async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(lock(), `other-host.invalid ${await deadPid()} remote`);
    const store = await openFileStateStore({ dir });
    let done = false;
    const adding = store.add(KANBAN).then(() => (done = true));
    await new Promise((r) => setTimeout(r, 150));
    expect(done).toBe(false);
    await rm(lock());
    await adding;
    expect(store.projects()).toHaveLength(1);
  });

  it('breaks a lock of another host once it is older than the stale age', async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(lock(), `other-host.invalid 1 remote`);
    const old = new Date(Date.now() - 11_000);
    await utimes(lock(), old, old);
    const store = await openFileStateStore({ dir });
    await store.add(KANBAN);
    expect(await readdir(dir)).toEqual(['state.json']);
  });

  it('a holder slower than the stale age keeps its lock alive (heartbeat): no add is lost', async () => {
    const slow = await openFileStateStore({ dir, lockStaleMs: 600 });
    const other = await openFileStateStore({ dir, lockStaleMs: 600 });
    let entered!: () => void;
    const inside = new Promise<void>((r) => (entered = r));
    const slowWrite = slow.transaction(async (draft) => {
      entered();
      await new Promise((r) => setTimeout(r, 1_800));
      draft.projects.push(draft.create(KANBAN));
    });
    await inside;
    await other.add({ ...KANBAN, path: '/home/alex/projects/custom', name: 'custom' });
    await slowWrite;
    const names = (await openFileStateStore({ dir })).projects().map((p) => p.name);
    expect(names.sort()).toEqual(['custom', 'kanban']);
  });

  it('breaks a lock older than 10 s even when its pid is alive (pid reuse)', async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(lock(), `${hostname()} ${process.pid} old`);
    const old = new Date(Date.now() - 11_000);
    await utimes(lock(), old, old);
    const store = await openFileStateStore({ dir });
    await store.add(KANBAN);
    expect(await readdir(dir)).toEqual(['state.json']);
  });
});

// task-030 — the UI settings in `state.json` (spec-006 §2, §4; RP-38, RP-39, D30-1 … D30-3, D30-5).
describe('UI settings', () => {
  const SHA = (n: number): string => n.toString(16).padStart(40, '0');
  const CHANGED = {
    autoFetch: false,
    fetchIntervalSeconds: 15,
    autoUpdate: true,
    autoPush: true,
    theme: 'light' as const,
    confirmAgentLaunch: false,
    actionLogCap: 100,
  };

  it('C-07.1 — a v0.1 file ({}) reads the defaults; a stored invalid value reads as its default', async () => {
    await seed(JSON.stringify({ version: 1, projects: [ENTRY], settings: {}, actionLog: [] }));
    expect((await openFileStateStore({ dir })).settings()).toMatchObject({ autoFetch: true, autoPush: false });
    await seed(JSON.stringify({ version: 1, projects: [ENTRY], settings: { fetchIntervalSeconds: 5 }, actionLog: [] }));
    const store = await openFileStateStore({ dir });
    expect(store.settings().fetchIntervalSeconds).toBe(60);
    expect(store.warnings()).toEqual([]);
  });

  it('a malformed action-log entry makes the file corrupt (D30-1): kept aside, empty state', async () => {
    await seed(JSON.stringify({ version: 1, projects: [ENTRY], settings: {}, actionLog: [{ sha: 'a1' }] }));
    const store = await openFileStateStore({ dir, now: () => NOW });
    expect(store.projects()).toEqual([]);
    expect(store.warnings()).toEqual([
      { key: 'state.corruptKept', args: { file: expect.stringContaining('corrupt') } },
    ]);
  });

  it('putSettings writes the whole object and trims the action log in the same write', async () => {
    const log = Array.from({ length: 150 }, (_, i) => ({ sha: SHA(i), at: '2026-10-12T09:30:02Z' }));
    await seed(JSON.stringify({ version: 1, projects: [ENTRY], settings: { newer: true }, actionLog: log }));
    const store = await openFileStateStore({ dir });
    expect(await store.putSettings(CHANGED)).toEqual(CHANGED);
    const written = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
    expect(written).toEqual({ version: 1, projects: [ENTRY], settings: CHANGED, actionLog: log.slice(50) });
    expect(await readdir(dir)).toEqual(['state.json']);
  });

  it('a putSettings that changes nothing writes nothing; a no-op keeps unknown keys', async () => {
    await seed(`${JSON.stringify({ version: 1, projects: [ENTRY], settings: { newer: 1 }, actionLog: [] })}\n`);
    const before = await stat(file);
    const store = await openFileStateStore({ dir });
    const defaults = store.settings();
    expect(await store.putSettings(defaults)).toEqual(defaults);
    await store.update(ENTRY.id, { roleView: ENTRY.roleView });
    const after = await stat(file);
    expect(after.mtimeMs).toBe(before.mtimeMs);
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ settings: { newer: 1 } });
  });

  it('a putSettings with no state yet writes it (the first settings change creates the file)', async () => {
    const store = await openFileStateStore({ dir });
    await store.putSettings(CHANGED);
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ settings: CHANGED, projects: [] });
  });

  it('D30-3 — reload() shows the settings another console stored', async () => {
    const a = await openFileStateStore({ dir });
    const b = await openFileStateStore({ dir });
    await a.putSettings(CHANGED);
    // Fresh-read precondition: b still has what it read at open.
    expect(b.settings().autoPush).toBe(false);
    await b.reload();
    expect(b.settings()).toEqual(CHANGED);
  });

  it('D30-5 — a newer build’s file: putSettings applies for the run, nothing is written', async () => {
    const content = JSON.stringify({ version: 2, projects: [ENTRY], settings: {}, actionLog: [] });
    await seed(content);
    const store = await openFileStateStore({ dir });
    expect(store.readOnly).toBe(true);
    expect(await store.putSettings(CHANGED)).toEqual(CHANGED);
    expect(store.settings()).toEqual(CHANGED);
    expect(await readFile(file, 'utf8')).toBe(content);
  });
});

// task-030 review round 1 (F1, F2, F4).
describe('UI settings (review round 1)', () => {
  const STORED = {
    autoFetch: false,
    fetchIntervalSeconds: 15,
    autoUpdate: true,
    autoPush: true,
    theme: 'light' as const,
    confirmAgentLaunch: false,
    actionLogCap: 100,
  };

  it('F1 — a putSettings with the same values in another key order writes nothing', async () => {
    await seed(`${JSON.stringify({ version: 1, projects: [ENTRY], settings: STORED, actionLog: [] })}\n`);
    const before = await stat(file);
    const store = await openFileStateStore({ dir });
    const reordered = Object.fromEntries(Object.entries(STORED).reverse()) as typeof STORED;
    expect(await store.putSettings(reordered)).toEqual(STORED);
    expect((await stat(file)).mtimeMs).toBe(before.mtimeMs);
  });

  it('F1 — a changed putSettings writes the keys in the schema order, whatever the body order', async () => {
    const store = await openFileStateStore({ dir });
    await store.putSettings(Object.fromEntries(Object.entries(STORED).reverse()) as typeof STORED);
    const written = JSON.parse(await readFile(file, 'utf8')) as { settings: Record<string, unknown> };
    expect(Object.keys(written.settings)).toEqual(Object.keys(STORED));
  });

  it('F4 — a draft changing one setting writes that key only; missing keys stay missing', async () => {
    await seed(JSON.stringify({ version: 1, projects: [ENTRY], settings: { theme: 'dark' }, actionLog: [] }));
    const store = await openFileStateStore({ dir });
    await store.transaction((draft) => {
      draft.settings.autoPush = true;
    });
    const written = JSON.parse(await readFile(file, 'utf8')) as { settings: Record<string, unknown> };
    expect(written.settings).toEqual({ autoPush: true, theme: 'dark' });
  });

  it('F2 — a newer build’s richer action log keeps the file readable: projects, read-only, warning', async () => {
    const sha = 'b2'.repeat(20);
    const content = JSON.stringify({
      version: 2,
      projects: [ENTRY],
      settings: {},
      actionLog: [{ sha, at: '2026-10-12T09:30:02Z', kind: 'approve' }, { sha: 'short', at: 'x' }, 'text'],
    });
    await seed(content);
    const store = await openFileStateStore({ dir });
    expect(store.projects()).toEqual([ENTRY]);
    expect(store.readOnly).toBe(true);
    expect(store.warnings()).toEqual([{ key: 'state.newerVersion', args: {} }]);
    expect(store.snapshot().actionLog).toEqual([{ sha, at: '2026-10-12T09:30:02Z' }]);
    expect(await readFile(file, 'utf8')).toBe(content);
  });

  it('D30-1 stays: the same richer entry in a version-1 file makes it corrupt', async () => {
    await seed(
      JSON.stringify({
        version: 1,
        projects: [ENTRY],
        settings: {},
        actionLog: [{ sha: 'b2'.repeat(20), at: '2026-10-12T09:30:02Z', kind: 'approve' }],
      }),
    );
    const store = await openFileStateStore({ dir, now: () => NOW });
    expect(store.projects()).toEqual([]);
    expect(store.warnings()[0]?.key).toBe('state.corruptKept');
  });
});
