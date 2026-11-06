// spec-007 §3.2 — the start reads the local state before listening; exit 4 when the state
// directory lies inside a listed project (spec-006 §1).
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { EXIT, runLauncher, type LauncherIo } from '../../../server/src/launcher/start.js';
import { openFileStateStore } from '../../../server/src/state/file-store.js';

let root: string;
const pending: (() => void)[] = [];

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'wfui-state-start-'));
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterAll(async () => {
  for (const stop of pending) stop();
  await new Promise((r) => setTimeout(r, 50));
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

function io(stateDir: string): LauncherIo & { out: string[]; err: string[] } {
  let handler: (() => void) | undefined;
  const result = {
    out: [] as string[],
    err: [] as string[],
    stdout: (line: string) => result.out.push(line),
    stderr: (line: string) => result.err.push(line),
    version: '0.0.0',
    staticDir: path.join(root, 'no-web'),
    stateDir,
    platform: 'linux' as const,
    onSignal: (h: () => void) => {
      handler = h;
    },
    exit: () => undefined,
  };
  pending.push(() => handler?.());
  return result;
}

it('exits 4, naming both paths, when the state directory lies inside a listed project', async () => {
  const project = path.join(root, 'kanban');
  const stateDir = path.join(project, '.wfui-state');
  await mkdir(project, { recursive: true });
  const store = await openFileStateStore({ dir: stateDir });
  await store.add({ path: project, name: 'kanban', remote: '' });
  const launcher = io(stateDir);
  expect(await runLauncher(['--no-open'], launcher)).toBe(EXIT.stateDirInsideProject);
  expect(launcher.out).toEqual([]);
  expect(launcher.err).toHaveLength(1);
  expect(launcher.err[0]).toContain(stateDir);
  expect(launcher.err[0]).toContain(project);
});

it('starts with an empty state when state.json is corrupt, keeping the file aside', async () => {
  const stateDir = path.join(root, 'corrupt');
  // 0700, as the console creates it: a group-writable state directory gets no address file (task-058 Q1 b).
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  await writeFile(path.join(stateDir, 'state.json'), 'not json');
  const launcher = io(stateDir);
  expect(await runLauncher(['--no-open'], launcher)).toBeUndefined();
  expect(launcher.out[0]).toMatch(/^WingFoil UI is running at /);
  // task-058 (D58-11): the console's address file lives in `consoles/` next to the kept file.
  const files = (await readdir(stateDir)).filter((f) => f !== 'consoles');
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/^state\.json\.corrupt-\d{8}T\d{6}Z$/);
  expect(await readdir(path.join(stateDir, 'consoles'))).toHaveLength(1);
});

it('fails (exit 70 in main) with a message naming a state.json it cannot read', async () => {
  const stateDir = path.join(root, 'unreadable');
  await mkdir(path.join(stateDir, 'state.json'), { recursive: true });
  await expect(runLauncher(['--no-open'], io(stateDir))).rejects.toThrow(path.join(stateDir, 'state.json'));
});
