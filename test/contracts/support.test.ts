// adr-001 D4, spec-001 §7 — the CLI build of each version of the support matrix: the pinned one
// as installed, any other installed once into a cache folder and reused.
import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pinnedCli, pinnedVersion } from '../harness/cli.js';
import { cliBuildFor, ORPHAN_AGE_MS } from './support.js';

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
    expect(installs).toHaveLength(1);
    expect(installs[0]![0].startsWith(`${prefix}.tmp-`)).toBe(true);
    expect(installs[0]![1]).toBe('0.3.0');
    expect((await readdir(cacheRoot)).filter((name) => name.includes('.tmp-'))).toEqual([]);
  });

  it('parallel workers installing the same version both get the build; the first rename wins', async () => {
    let installs = 0;
    const install = async (prefix: string, version: string) => {
      installs += 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
      await fakeInstall(prefix, version);
    };
    const prefix = path.join(cacheRoot, '0.4.0');
    const builds = await Promise.all([
      cliBuildFor('0.4.0', { cacheRoot, install }),
      cliBuildFor('0.4.0', { cacheRoot, install }),
    ]);
    expect(installs).toBe(2);
    for (const build of builds) expect(build.packageDir).toBe(path.join(prefix, 'node_modules', 'wingfoil'));
    expect((await readdir(cacheRoot)).filter((name) => name.includes('.tmp-'))).toEqual([]);
  });

  it('refuses an install that does not give the requested version', async () => {
    await expect(
      cliBuildFor('0.3.1', { cacheRoot, install: (prefix) => fakeInstall(prefix, '0.3.2') }),
    ).rejects.toThrow(/0\.3\.1/);
    expect((await readdir(cacheRoot)).filter((name) => name.startsWith('0.3.1'))).toEqual([]);
  });

  it('recovers from a broken prefix (interrupted install): moved aside, removed, replaced', async () => {
    const prefix = path.join(cacheRoot, '0.5.0');
    await mkdir(path.join(prefix, 'node_modules', 'wingfoil'), { recursive: true });
    await writeFile(path.join(prefix, 'node_modules', 'wingfoil', 'package.json'), '{"name":"wingfoil"');
    const build = await cliBuildFor('0.5.0', { cacheRoot, install: fakeInstall });
    expect(build.packageDir).toBe(path.join(prefix, 'node_modules', 'wingfoil'));
    expect(await cliBuildFor('0.5.0', { cacheRoot, install: () => Promise.reject(new Error('no reinstall')) })).toEqual(
      build,
    );
    expect((await readdir(cacheRoot)).filter((name) => /^0\.5\.0\./.test(name))).toEqual([]);
  });

  it('removes staging and stale folders of a killed worker once old, keeps recent ones', async () => {
    const old = path.join(cacheRoot, '0.6.0.tmp-old');
    const stale = path.join(cacheRoot, '0.6.0.stale-old');
    const recent = path.join(cacheRoot, '0.6.0.tmp-recent');
    for (const dir of [old, stale, recent]) await mkdir(dir, { recursive: true });
    const hoursAgo = new Date(Date.now() - 7 * 60 * 60 * 1000);
    await utimes(old, hoursAgo, hoursAgo);
    await utimes(stale, hoursAgo, hoursAgo);
    await cliBuildFor('0.6.0', { cacheRoot, install: fakeInstall });
    expect((await readdir(cacheRoot)).filter((name) => name.startsWith('0.6.0.'))).toEqual(['0.6.0.tmp-recent']);
    expect(ORPHAN_AGE_MS).toBe(6 * 60 * 60 * 1000);
  });

  it('refuses a version that is not an exact semantic version', async () => {
    await expect(cliBuildFor('^0.3.0', { cacheRoot, install: fakeInstall })).rejects.toThrow(/exact/);
  });
});
