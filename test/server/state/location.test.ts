// spec-006 §1 — where the state directory is, and the state directory inside a project.
import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findProjectContaining, isWithin, resolveStateDir } from '../../../server/src/state/location.js';

describe('resolveStateDir', () => {
  it('uses WINGFOIL_UI_STATE_DIR first, on every platform', () => {
    for (const platform of ['linux', 'darwin', 'win32'] as const) {
      expect(
        resolveStateDir({
          env: { WINGFOIL_UI_STATE_DIR: '/tmp/wfui-state', XDG_CONFIG_HOME: '/x', APPDATA: 'C:\\A' },
          platform,
          homedir: '/home/alex',
        }),
      ).toBe(platform === 'win32' ? path.win32.resolve('/tmp/wfui-state') : '/tmp/wfui-state');
    }
  });

  it('resolves a relative WINGFOIL_UI_STATE_DIR against the working directory', () => {
    expect(
      resolveStateDir({ env: { WINGFOIL_UI_STATE_DIR: 'state' }, platform: 'linux', homedir: '/h', cwd: '/work' }),
    ).toBe('/work/state');
  });

  it('ignores an empty WINGFOIL_UI_STATE_DIR', () => {
    expect(resolveStateDir({ env: { WINGFOIL_UI_STATE_DIR: '' }, platform: 'linux', homedir: '/home/alex' })).toBe(
      '/home/alex/.config/wingfoil-ui',
    );
  });

  it('Linux and other Unix: $XDG_CONFIG_HOME/wingfoil-ui, else ~/.config/wingfoil-ui', () => {
    expect(resolveStateDir({ env: { XDG_CONFIG_HOME: '/cfg' }, platform: 'linux', homedir: '/home/alex' })).toBe(
      '/cfg/wingfoil-ui',
    );
    expect(resolveStateDir({ env: {}, platform: 'freebsd', homedir: '/home/alex' })).toBe(
      '/home/alex/.config/wingfoil-ui',
    );
    // The XDG base directory specification ignores a relative value.
    expect(resolveStateDir({ env: { XDG_CONFIG_HOME: 'cfg' }, platform: 'linux', homedir: '/home/alex' })).toBe(
      '/home/alex/.config/wingfoil-ui',
    );
  });

  it('macOS: ~/Library/Application Support/wingfoil-ui (XDG not used)', () => {
    expect(resolveStateDir({ env: { XDG_CONFIG_HOME: '/cfg' }, platform: 'darwin', homedir: '/Users/alex' })).toBe(
      '/Users/alex/Library/Application Support/wingfoil-ui',
    );
  });

  it('Windows: %APPDATA%\\wingfoil-ui, else the roaming folder under the home', () => {
    expect(
      resolveStateDir({
        env: { APPDATA: 'C:\\Users\\alex\\AppData\\Roaming' },
        platform: 'win32',
        homedir: 'C:\\Users\\alex',
      }),
    ).toBe('C:\\Users\\alex\\AppData\\Roaming\\wingfoil-ui');
    expect(resolveStateDir({ env: {}, platform: 'win32', homedir: 'C:\\Users\\alex' })).toBe(
      'C:\\Users\\alex\\AppData\\Roaming\\wingfoil-ui',
    );
  });
});

describe('findProjectContaining', () => {
  let root: string;
  const entry = (p: string, id = 'p_000000000001') => ({
    id,
    path: p,
    name: path.basename(p),
    remote: '',
    addedAt: '2026-10-05T00:00:00Z',
    roleView: '',
  });

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'wfui-loc-'));
    await mkdir(path.join(root, 'projects', 'kanban', '.config'), { recursive: true });
    await mkdir(path.join(root, 'projects', 'kanban2'), { recursive: true });
    await symlink(path.join(root, 'projects', 'kanban'), path.join(root, 'link'));
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('finds the project whose working tree holds the state directory (existing or not yet created)', async () => {
    const kanban = path.join(root, 'projects', 'kanban');
    const projects = [entry(path.join(root, 'projects', 'kanban2'), 'p_000000000002'), entry(kanban)];
    expect((await findProjectContaining(path.join(kanban, '.config', 'wingfoil-ui'), projects))?.path).toBe(kanban);
    expect((await findProjectContaining(kanban, projects))?.path).toBe(kanban);
  });

  it('follows symbolic links of the state directory (project paths are realpaths)', async () => {
    const kanban = path.join(root, 'projects', 'kanban');
    expect((await findProjectContaining(path.join(root, 'link', 'state'), [entry(kanban)]))?.path).toBe(kanban);
  });

  it('finds nothing for a sibling with a common prefix or a parent folder', async () => {
    const projects = [entry(path.join(root, 'projects', 'kanban'))];
    expect(await findProjectContaining(path.join(root, 'projects', 'kanban2', 'state'), projects)).toBeUndefined();
    expect(await findProjectContaining(path.join(root, 'state'), projects)).toBeUndefined();
    expect(await findProjectContaining(path.join(root, 'state'), [])).toBeUndefined();
  });
});

describe('isWithin', () => {
  it('folds letter case on macOS and Windows, not on Linux', () => {
    expect(isWithin('/Users/Alex/Kanban/state', '/users/alex/kanban', 'darwin')).toBe(true);
    expect(isWithin('/Users/Alex/Kanban/state', '/users/alex/kanban', 'linux')).toBe(false);
    expect(isWithin('C:\\Users\\Alex\\Kanban\\state', 'c:\\users\\alex\\kanban', 'win32')).toBe(true);
    expect(isWithin('D:\\state', 'C:\\users\\alex\\kanban', 'win32')).toBe(false);
  });

  it('is true for the folder itself and false for a sibling or a ..-named child of the parent', () => {
    expect(isWithin('/home/alex/kanban', '/home/alex/kanban', 'linux')).toBe(true);
    expect(isWithin('/home/alex/kanban2', '/home/alex/kanban', 'linux')).toBe(false);
    expect(isWithin('/home/alex/kanban/..state', '/home/alex/kanban', 'linux')).toBe(true);
    expect(isWithin('/home/alex', '/home/alex/kanban', 'linux')).toBe(false);
  });
});
