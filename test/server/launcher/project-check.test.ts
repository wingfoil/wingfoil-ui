// task-008: `runLauncher` starts the project list's periodic availability check once listening
// (the `projects` event of spec-004 §6 without a page asking) and stops it in the stop sequence.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { EXIT, runLauncher, type LauncherIo } from '../../../server/src/launcher/start.js';
import { DEFAULT_CHECK_MS, ProjectList } from '../../../server/src/projects/project-list.js';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'wfui-project-check-'));
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});
afterAll(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

it('starts the check after listening and stops it at stop', async () => {
  const start = vi.spyOn(ProjectList.prototype, 'start');
  const stop = vi.spyOn(ProjectList.prototype, 'stop');
  let signal: (() => void) | undefined;
  const exits: number[] = [];
  const out: string[] = [];
  const io: LauncherIo = {
    stdout: (line) => out.push(line),
    stderr: () => undefined,
    version: '0.0.0',
    staticDir: dir,
    stateDir: path.join(dir, 'state'),
    platform: 'linux',
    onSignal: (h) => {
      signal = h;
    },
    exit: (code) => exits.push(code),
  };
  expect(await runLauncher(['--no-open'], io)).toBeUndefined();
  expect(out[0]).toMatch(/is running at/);
  expect(start).toHaveBeenCalledOnce();
  expect(start.mock.calls[0]).toEqual([]);
  expect(DEFAULT_CHECK_MS).toBe(10_000);
  const stopsBefore = stop.mock.calls.length;
  signal!();
  await vi.waitFor(() => expect(exits).toEqual([EXIT.ok]));
  expect(stop.mock.calls.length).toBeGreaterThan(stopsBefore);
});
