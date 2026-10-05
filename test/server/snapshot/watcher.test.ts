// REQ-STATE-02 — changes are detected by file watching, with a periodic check as a fallback
// (adr-001 D6, adr-002 *Repository watcher*): a working-tree edit, a commit, a change of the
// repository's or the global `user.email`, a new top-level folder, a change of the project's CLI
// (`node_modules/wingfoil`, task-004 hand-over); nothing once closed.
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { globalConfigFiles } from '../../../server/src/snapshot/watcher.js';
import { buildFixture, copyFixture, installCliStub, type Fixture } from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';
import { auditedSnapshots } from './support.js';

const POLL = { timeout: 10_000, interval: 50 };
let root: string;
let template: Fixture;
let n = 0;
const registries: Snapshots[] = [];

async function fresh(options: { watch: boolean; fallbackMs: number }) {
  n += 1;
  const fx = await copyFixture(template, path.join(root, `copy-${n}`));
  const audited = auditedSnapshots(fx.env, { ...options, debounceMs: 50 });
  registries.push(audited.snapshots);
  const snapshot = await audited.snapshots.open(`p${n}`, fx.dir);
  await snapshot.state();
  return { fx, snapshot, ...audited };
}

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-watch-')));
  template = await buildFixture('kanban', { root: path.join(root, 'template') });
}, 600_000);

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await rm(root, { recursive: true, force: true });
});

describe('file watching', () => {
  it('detects a working-tree edit, a commit and a user.email change', async () => {
    const { fx, snapshot, events } = await fresh({ watch: true, fallbackMs: 0 });
    const first = snapshot.current()!.key;
    const file = path.join(fx.dir, 'docs/memory/task/task-001-login-form.md');
    await writeFile(file, (await readFile(file, 'utf8')).replace('Login form', 'Login form v2'));
    await expect.poll(() => snapshot.current()!.key, POLL).not.toBe(first);
    const edited = snapshot.current()!.key;
    await git(fx.dir, ['commit', '-qam', 'edit'], fx.env);
    await expect.poll(() => snapshot.current()!.head, POLL).not.toBe(edited.split('.')[0]);
    await git(fx.dir, ['config', 'user.email', 'morgan@example.test'], fx.env);
    await expect.poll(() => snapshot.current()!.email, POLL).toBe('morgan@example.test');
    expect(events.length).toBeGreaterThanOrEqual(3);
  });

  it('detects a change of the global user.email when the repository sets none', async () => {
    const { fx, snapshot } = await fresh({ watch: true, fallbackMs: 0 });
    await git(fx.dir, ['config', '--unset', 'user.email'], fx.env);
    await expect.poll(() => snapshot.current()!.email, POLL).toBeUndefined();
    await git(fx.dir, ['config', '--global', 'user.email', 'casey@example.test'], fx.env);
    await expect.poll(() => snapshot.current()!.email, POLL).toBe('casey@example.test');
  });

  it('detects edits in a top-level folder created after the start', async () => {
    const { fx, snapshot } = await fresh({ watch: true, fallbackMs: 0 });
    await mkdir(path.join(fx.dir, 'later'));
    // An empty folder changes no git status; let the watcher take the new folder up first.
    await new Promise((r) => setTimeout(r, 300));
    const before = snapshot.current()!.key;
    await mkdir(path.join(fx.dir, 'later', 'deep'));
    await writeFile(path.join(fx.dir, 'later', 'deep', 'x.md'), 'x\n');
    await expect.poll(() => snapshot.current()!.key, POLL).not.toBe(before);
  });

  it('starts a new CLI generation when node_modules/wingfoil changes', async () => {
    const { fx, snapshot } = await fresh({ watch: true, fallbackMs: 0 });
    expect(await (await snapshot.view()).version()).toBe('0.2.2');
    await installCliStub(fx, { version: '0.2.3' });
    await expect.poll(async () => (await snapshot.view()).version(), POLL).toBe('0.2.3');
  });

  it('stops watching once closed: no check, no process', async () => {
    const { fx, snapshot, snapshots, runner } = await fresh({ watch: true, fallbackMs: 100 });
    await snapshots.close(snapshot.pid);
    const before = runner.spawned.length;
    await writeFile(path.join(fx.dir, 'after-close.txt'), 'x\n');
    await new Promise((r) => setTimeout(r, 500));
    expect(runner.spawned.length).toBe(before);
    expect(snapshots.get(snapshot.pid)).toBeUndefined();
  });
});

describe('periodic check (fallback)', () => {
  it('detects a change with file watching off', async () => {
    const { fx, snapshot } = await fresh({ watch: false, fallbackMs: 200 });
    const before = snapshot.current()!.key;
    await writeFile(path.join(fx.dir, 'notes.txt'), 'x\n');
    await expect.poll(() => snapshot.current()!.key, POLL).not.toBe(before);
  });
});

describe('globalConfigFiles', () => {
  it('is GIT_CONFIG_GLOBAL when set', () => {
    expect(globalConfigFiles({ GIT_CONFIG_GLOBAL: '/x/.gitconfig', HOME: '/h' })).toEqual(['/x/.gitconfig']);
  });

  it('is $XDG_CONFIG_HOME/git/config (else ~/.config/git/config) and ~/.gitconfig otherwise', () => {
    expect(globalConfigFiles({ HOME: '/h', XDG_CONFIG_HOME: '/c' })).toEqual([
      path.join('/c', 'git', 'config'),
      path.join('/h', '.gitconfig'),
    ]);
    expect(globalConfigFiles({ HOME: '/h' })).toEqual([
      path.join('/h', '.config', 'git', 'config'),
      path.join('/h', '.gitconfig'),
    ]);
    expect(globalConfigFiles({})).toEqual([]);
  });
});
