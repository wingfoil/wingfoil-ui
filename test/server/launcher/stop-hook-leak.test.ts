// spec-007 §6 — a launch that fails (build or listen) leaves no stop hook behind: a later stop
// sequence must not terminate the failed launch's process runner.
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { EXIT, runLauncher, type LauncherIo } from '../../../server/src/launcher/start.js';
import { LocalProcessRunner } from '../../../server/src/process/runner.js';

const failBuild = vi.hoisted(() => ({ on: false }));

vi.mock('../../../server/src/http/app.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../server/src/http/app.js')>();
  return {
    ...original,
    buildApp: async (options: Parameters<typeof original.buildApp>[0]) => {
      if (failBuild.on) throw new Error('build failed');
      return original.buildApp(options);
    },
  };
});

let staticDir: string;

beforeAll(async () => {
  staticDir = await mkdtemp(path.join(tmpdir(), 'wfui-hookleak-'));
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterAll(async () => {
  vi.restoreAllMocks();
  await rm(staticDir, { recursive: true, force: true });
});

function io(processes: LocalProcessRunner) {
  let signal: (() => void) | undefined;
  const exits: number[] = [];
  const value: LauncherIo = {
    stdout: () => undefined,
    stderr: () => undefined,
    version: '9.9.9',
    staticDir,
    stateDir: path.join(staticDir, 'state'),
    platform: 'linux',
    onSignal: (h) => (signal = h),
    exit: (code) => exits.push(code),
    processes,
  };
  return { io: value, exits, stop: () => signal?.() };
}

/** Start and stop a launch with its own runner: runs every registered stop hook. */
async function startAndStop(): Promise<void> {
  const ok = io(new LocalProcessRunner());
  expect(await runLauncher(['--no-open'], ok.io)).toBeUndefined();
  ok.stop();
  await vi.waitFor(() => expect(ok.exits).toEqual([EXIT.ok]));
}

async function stillRuns(runner: LocalProcessRunner): Promise<void> {
  const result = await runner.run({ file: process.execPath, args: ['-e', '0'], cwd: staticDir });
  expect(result.exitCode).toBe(0);
}

describe('runLauncher stop hook', () => {
  it('is removed when the listen fails', async () => {
    const blocker = net.createServer();
    await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve));
    const port = (blocker.address() as net.AddressInfo).port;
    const failed = new LocalProcessRunner();
    try {
      expect(await runLauncher(['--no-open', '--port', String(port)], io(failed).io)).toBe(EXIT.port);
    } finally {
      await new Promise((resolve) => blocker.close(resolve));
    }
    await startAndStop();
    await stillRuns(failed);
  });

  it('is not left behind when the application cannot be built', async () => {
    const failed = new LocalProcessRunner();
    failBuild.on = true;
    try {
      await expect(runLauncher(['--no-open'], io(failed).io)).rejects.toThrow('build failed');
    } finally {
      failBuild.on = false;
    }
    await startAndStop();
    await stillRuns(failed);
  });
});
