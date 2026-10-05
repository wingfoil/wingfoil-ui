// The process entry point: package version, refusals as exit status.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { main } from '../../server/src/main.js';

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
