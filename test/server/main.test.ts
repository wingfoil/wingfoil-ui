// The process entry point: package version, refusals as exit status.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
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

it('kills the remaining CLI and git children synchronously when the process exits', async () => {
  const handlers: { event: string | symbol; listener: (...args: unknown[]) => void }[] = [];
  vi.spyOn(process, 'on').mockImplementation(((event: string | symbol, listener: (...args: unknown[]) => void) => {
    handlers.push({ event, listener });
    return process;
  }) as typeof process.on);
  const killAllNow = vi.spyOn(LocalProcessRunner.prototype, 'killAllNow').mockImplementation(() => undefined);
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  await main(['--version']);
  const exit = handlers.filter((h) => h.event === 'exit');
  expect(exit).toHaveLength(1);
  expect(killAllNow).not.toHaveBeenCalled();
  exit[0]?.listener(0);
  expect(killAllNow).toHaveBeenCalledTimes(1);
});
