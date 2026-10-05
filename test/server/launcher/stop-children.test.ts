// spec-007 §6, adr-001 D5 — the stop sequence terminates the wingfoil and git children still running.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { EXIT, runLauncher, type LauncherIo } from '../../../server/src/launcher/start.js';
import { LocalProcessRunner } from '../../../server/src/process/runner.js';

let staticDir: string;

beforeAll(async () => {
  staticDir = await mkdtemp(path.join(tmpdir(), 'wfui-stopkids-'));
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterAll(async () => {
  vi.restoreAllMocks();
  await rm(staticDir, { recursive: true, force: true });
});

describe('runLauncher stop sequence', () => {
  it('terminates the running child processes, then exits 0', async () => {
    const processes = new LocalProcessRunner();
    let signal: (() => void) | undefined;
    const exits: number[] = [];
    const io: LauncherIo = {
      stdout: () => undefined,
      stderr: () => undefined,
      version: '9.9.9',
      staticDir,
      platform: 'linux',
      onSignal: (h) => (signal = h),
      exit: (code) => exits.push(code),
      processes,
    };
    expect(await runLauncher(['--no-open'], io)).toBeUndefined();
    const child = processes.run({
      file: process.execPath,
      args: ['-e', 'setTimeout(() => {}, 60_000)'],
      cwd: staticDir,
      timeoutMs: null,
    });
    await vi.waitFor(() => expect(processes.running).toBe(1));
    signal?.();
    expect((await child).ended).toBe('terminated');
    await vi.waitFor(() => expect(exits).toEqual([EXIT.ok]));
    expect(processes.running).toBe(0);
  });
});
