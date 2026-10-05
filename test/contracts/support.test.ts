// adr-001 D4, spec-001 §7 — the CLI build of each version of the support matrix: the pinned one
// as installed, any other installed once into a cache folder and reused.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pinnedCli, pinnedVersion } from '../harness/cli.js';
import { cliBuildFor } from './support.js';

let cacheRoot: string;

beforeAll(async () => {
  cacheRoot = await mkdtemp(path.join(tmpdir(), 'wfui-matrix-'));
});

afterAll(async () => {
  await rm(cacheRoot, { recursive: true, force: true });
});

async function fakeInstall(prefix: string, version: string): Promise<void> {
  const dir = path.join(prefix, 'node_modules', 'wingfoil');
  await mkdir(path.join(dir, 'dist'), { recursive: true });
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'wingfoil', version, bin: { wingfoil: 'dist/cli.js' } }),
  );
  await writeFile(path.join(dir, 'dist', 'cli.js'), '');
}

describe('cliBuildFor', () => {
  it('the pinned version is the installed devDependency, never reinstalled', async () => {
    const installs: string[] = [];
    const build = await cliBuildFor(pinnedVersion(), { cacheRoot, install: async (_p, v) => void installs.push(v) });
    expect(build).toEqual(pinnedCli());
    expect(installs).toEqual([]);
  });

  it('another matrix version is installed once into <cache>/<version> and then reused', async () => {
    const installs: Array<[string, string]> = [];
    const install = async (prefix: string, version: string) => {
      installs.push([prefix, version]);
      await fakeInstall(prefix, version);
    };
    const prefix = path.join(cacheRoot, '0.3.0');
    const expected = {
      packageDir: path.join(prefix, 'node_modules', 'wingfoil'),
      script: path.join(prefix, 'node_modules', 'wingfoil', 'dist', 'cli.js'),
    };
    expect(await cliBuildFor('0.3.0', { cacheRoot, install })).toEqual(expected);
    expect(await cliBuildFor('0.3.0', { cacheRoot, install })).toEqual(expected);
    expect(installs).toEqual([[prefix, '0.3.0']]);
  });

  it('refuses an install that does not give the requested version', async () => {
    await expect(
      cliBuildFor('0.3.1', { cacheRoot, install: (prefix) => fakeInstall(prefix, '0.3.2') }),
    ).rejects.toThrow(/0\.3\.1/);
  });

  it('refuses a version that is not an exact semantic version', async () => {
    await expect(cliBuildFor('^0.3.0', { cacheRoot, install: fakeInstall })).rejects.toThrow(/exact/);
  });
});
