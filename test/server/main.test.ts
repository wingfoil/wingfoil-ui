// The process entry point: package version, refusals as exit status.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { main } from '../../server/src/main.js';
import { LocalProcessRunner } from '../../server/src/process/runner.js';

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

it('prints the root package version', async () => {
  const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  await main(['--version']);
  const { version } = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as { version: string };
  expect(write).toHaveBeenCalledWith(`${version}\n`);
  expect(process.exitCode).toBe(0);
});

it('sets the exit status of a refusal', async () => {
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  await main(['--nope']);
  expect(process.exitCode).toBe(2);
});

type Listener = (...args: unknown[]) => void;

/** Record the listeners `main` registers on `process` instead of installing them. */
function recordListeners(): { event: string | symbol; listener: Listener }[] {
  const handlers: { event: string | symbol; listener: Listener }[] = [];
  vi.spyOn(process, 'on').mockImplementation(((event: string | symbol, listener: Listener) => {
    handlers.push({ event, listener });
    return process;
  }) as typeof process.on);
  return handlers;
}

function listeners(handlers: { event: string | symbol; listener: Listener }[], event: string): Listener[] {
  return handlers.filter((h) => h.event === event).map((h) => h.listener);
}

it('registers no exit listener and no runner for --version', async () => {
  const handlers = recordListeners();
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  await main(['--version']);
  expect(listeners(handlers, 'exit')).toEqual([]);
});

describe('a start', () => {
  let out: string[];
  let exits: number[];

  beforeEach(() => {
    out = [];
    exits = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string) => {
      out.push(String(chunk));
      return true;
    }) as typeof process.stdout.write);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      exits.push(code ?? 0);
    }) as typeof process.exit);
  });

  function sleeper(processes: LocalProcessRunner) {
    return processes.run({
      file: process.execPath,
      args: ['-e', 'setTimeout(() => {}, 60_000)'],
      cwd: REPO_ROOT,
      timeoutMs: null,
    });
  }

  it('kills the remaining CLI and git children synchronously when the process exits', async () => {
    const handlers = recordListeners();
    const processes = new LocalProcessRunner();
    const killAllNow = vi.spyOn(processes, 'killAllNow');
    await main(['--no-open'], { processes });
    const exit = listeners(handlers, 'exit');
    expect(exit).toHaveLength(1);
    expect(killAllNow).not.toHaveBeenCalled();
    const child = sleeper(processes);
    await vi.waitFor(() => expect(processes.running).toBe(1));
    exit[0]?.(0);
    expect(killAllNow).toHaveBeenCalledTimes(1);
    expect(await child).toMatchObject({ ended: 'terminated', signal: 'SIGKILL' });
    // The server is still listening: stop it.
    listeners(handlers, 'SIGINT')[0]?.();
    await vi.waitFor(() => expect(exits).toEqual([0]));
  });

  it('SIGHUP (terminal closed) stops like SIGINT: children terminated, stop line, exit 0', async () => {
    const handlers = recordListeners();
    const processes = new LocalProcessRunner();
    await main(['--no-open'], { processes });
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) expect(listeners(handlers, signal), signal).toHaveLength(1);
    const child = sleeper(processes);
    await vi.waitFor(() => expect(processes.running).toBe(1));
    listeners(handlers, 'SIGHUP')[0]?.();
    expect((await child).ended).toBe('terminated');
    await vi.waitFor(() => expect(exits).toEqual([0]));
    expect(out).toContain('WingFoil UI stopped\n');
  });
});
