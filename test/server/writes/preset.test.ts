// task-060 D60-6 — the exclusive create of the preset write through its file port (`PresetFs`), with
// the swaps a test can make between the steps: an entry that appears after row 7′ (409, never
// overwritten), `.wingfoil` swapped for another folder after the create (500, no git, nothing
// removed), a short write (the file removed), a refused create (500 `internal`, by its code).
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies, each validated against its schema */
import type { FastifyInstance } from 'fastify';
import { lstat, mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { gitSubcommand } from '../../../server/src/git/git.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { nodePresetFs, PartialCreateError, type PresetFs } from '../../../server/src/writes/preset.js';
import { buildFixture, type Fixture } from '../../harness/fixtures/index.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';
import { startGitConsole, type GitConsole, type GitConsoleOptions } from '../http/git-console.js';

const T = 120_000;
let ws: TempWorkspace;
let kanban: Fixture;
const registries: Snapshots[] = [];
const apps: FastifyInstance[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-060-preset-fs-');
  kanban = await buildFixture('kanban', { root: path.join(await realpath(ws.dir), 'kanban') });
}, 600_000);

afterEach(async () => {
  for (const a of apps.splice(0)) await a.close();
});

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await ws.dispose();
});

const start = (options: GitConsoleOptions = {}): Promise<GitConsole> =>
  startGitConsole(kanban, ws.dir, apps, registries, options);
const exists = (file: string) =>
  lstat(file).then(
    () => true,
    () => false,
  );
const writes = (c: GitConsole) =>
  c.runner.spawned.filter((r) => ['add', 'commit'].includes(gitSubcommand(r.args) ?? ''));

describe('the exclusive create (D60-6)', () => {
  it('nodePresetFs: a file is created once; a second create is EEXIST, the first content kept', async () => {
    const dir = path.join(await realpath(ws.dir), 'plain');
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, 'ui.yaml');
    const entry = await nodePresetFs.create(file, Buffer.from('one\n'));
    expect(entry.kind).toBe('file');
    expect(await nodePresetFs.lstat(file)).toEqual(entry);
    await expect(nodePresetFs.create(file, Buffer.from('two\n'))).rejects.toMatchObject({ code: 'EEXIST' });
    expect(await readFile(file, 'utf8')).toBe('one\n');
    expect(await nodePresetFs.lstat(path.join(dir, 'missing'))).toBeUndefined();
  });

  it(
    'an entry that appears between row 7′ and the create → 409 ui-config-exists, never overwritten, no git write',
    async () => {
      let planted = '';
      const fs: PresetFs = {
        ...nodePresetFs,
        create: async (file, bytes) => {
          planted = file;
          await writeFile(file, 'theirs\n');
          return nodePresetFs.create(file, bytes);
        },
      };
      const c = await start({ presetFs: fs });
      const res = await c.preset({ preset: 'kanban' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ui-config-exists');
      expect(await readFile(planted, 'utf8')).toBe('theirs\n');
      expect(writes(c)).toEqual([]);
    },
    T,
  );

  it(
    '.wingfoil swapped for another folder right after the create → 500 write-incomplete, no git, nothing removed',
    async () => {
      const log: string[] = [];
      let moved = '';
      const fs: PresetFs = {
        ...nodePresetFs,
        create: async (file, bytes) => {
          const entry = await nodePresetFs.create(file, bytes);
          const wingfoil = path.dirname(file);
          moved = `${wingfoil}-moved`;
          await rename(wingfoil, moved);
          await mkdir(wingfoil);
          return entry;
        },
      };
      const c = await start({ presetFs: fs, log });
      const res = await c.preset({ preset: 'kanban' });
      expect(res.status).toBe(500);
      expect(res.body.error).toMatchObject({ code: 'write-incomplete', detail: { file: '.wingfoil/ui.yaml' } });
      expect(await exists(path.join(moved, 'ui.yaml'))).toBe(true);
      expect(writes(c)).toEqual([]);
      expect(log.join('')).toContain('ui-yaml-swapped');
    },
    T,
  );

  it(
    'a short write → the created file removed, 500 internal, no git write',
    async () => {
      const fs: PresetFs = {
        ...nodePresetFs,
        create: async (file, bytes) => {
          const entry = await nodePresetFs.create(file, bytes.subarray(0, 3));
          throw new PartialCreateError(entry, Object.assign(new Error('no space'), { code: 'ENOSPC' }));
        },
      };
      const c = await start({ presetFs: fs });
      const res = await c.preset({ preset: 'kanban' });
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('internal');
      expect(await exists(path.join(c.fx.dir, '.wingfoil', 'ui.yaml'))).toBe(false);
      expect(writes(c)).toEqual([]);
    },
    T,
  );

  it(
    'a refused create (EACCES) → 500 internal, logged by its code only',
    async () => {
      const log: string[] = [];
      const fs: PresetFs = {
        ...nodePresetFs,
        create: () => Promise.reject(Object.assign(new Error('permission denied marker-task-060-eacces'), { code: 'EACCES' })),
      };
      const c = await start({ presetFs: fs, log });
      const res = await c.preset({ preset: 'kanban' });
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('internal');
      expect(log.join('')).toContain('EACCES');
      expect(log.join('')).not.toContain('marker-task-060-eacces');
    },
    T,
  );
});
