// adr-001 D2, REQ-ARC-02 — which `wingfoil` runs for a project: the project's pinned one, else the
// PATH's (resolved to an absolute path, an npm shim to its package's bin script), else none
// (S-08.1, S-08.2, S-10.1, S-10.2 on the adapter side).
import { chmod, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CliNotFoundError, discoverCli, INSTALL_COMMAND } from '../../../server/src/cli/discovery.js';
import { binScript, PINNED_PACKAGE_DIR } from '../../harness/cli.js';
import {
  buildFixture,
  cliPackageDir,
  copyFixture,
  envWithoutWingfoil,
  removeCli,
  type Fixture,
} from '../../harness/fixtures/index.js';
import { installGlobally, markingCliSource, withPathFirst, writeCliPackage } from './fake-cli.js';

let root: string;
let template: Fixture;
let n = 0;

async function freshKanban(): Promise<Fixture> {
  n += 1;
  return copyFixture(template, path.join(root, `copy-${n}`));
}

async function noWingfoilEnv(fx: Fixture): Promise<NodeJS.ProcessEnv> {
  return envWithoutWingfoil(fx.env, path.join(root, `safe-bin-${n}`));
}

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-disc-')));
  template = await buildFixture('kanban', { root: path.join(root, 'template') });
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('discoverCli', () => {
  it("S-08.1 — uses the project's own node_modules/wingfoil, run with this Node.js", async () => {
    const fx = await freshKanban();
    const cli = await discoverCli(fx.dir, { env: fx.env });
    expect(cli).toMatchObject({
      source: 'project',
      projectRoot: fx.dir,
      file: process.execPath,
      prefixArgs: [binScript(cliPackageDir(fx))],
      packageDir: cliPackageDir(fx),
    });
  });

  it('prefers the pinned CLI over a wingfoil on the PATH', async () => {
    const fx = await freshKanban();
    const pkg = path.join(root, `fake-${n}`, 'pkg');
    await writeCliPackage(pkg, '0.2.1', markingCliSource('0.2.1', path.join(root, `marker-${n}`)));
    const bin = await installGlobally(path.join(root, `fake-${n}`, 'prefix'), pkg);
    const cli = await discoverCli(fx.dir, { env: withPathFirst(fx.env, bin) });
    expect(cli.source).toBe('project');
    expect(cli.prefixArgs).toEqual([binScript(cliPackageDir(fx))]);
  });

  it('S-08.2 — uses the PATH when the project pins none: an npm shim runs its package bin script', async () => {
    const fx = await freshKanban();
    await removeCli(fx);
    const bin = await installGlobally(path.join(root, `global-${n}`), PINNED_PACKAGE_DIR);
    const env = withPathFirst(await noWingfoilEnv(fx), bin);
    const cli = await discoverCli(fx.dir, { env });
    expect(cli).toMatchObject({
      source: 'path',
      file: process.execPath,
      prefixArgs: [await realpath(binScript(PINNED_PACKAGE_DIR))],
    });
    expect(cli.packageDir).toBe(await realpath(PINNED_PACKAGE_DIR));
  });

  it('runs a PATH executable that is not an npm package by its absolute path', async () => {
    const fx = await freshKanban();
    await removeCli(fx);
    const bin = path.join(root, `native-${n}`);
    await mkdir(bin, { recursive: true });
    await writeFile(path.join(bin, 'wingfoil'), '#!/bin/sh\necho 0.2.2\n');
    await chmod(path.join(bin, 'wingfoil'), 0o755);
    const cli = await discoverCli(fx.dir, { env: withPathFirst(await noWingfoilEnv(fx), bin) });
    expect(cli).toMatchObject({ source: 'path', file: path.join(bin, 'wingfoil'), prefixArgs: [] });
    expect(cli.packageDir).toBeUndefined();
  });

  it('skips relative PATH entries and files that are not executable', async () => {
    const fx = await freshKanban();
    await removeCli(fx);
    const plain = path.join(root, `plain-${n}`);
    await mkdir(plain, { recursive: true });
    await writeFile(path.join(plain, 'wingfoil'), '#!/bin/sh\necho 0.2.2\n');
    await mkdir(path.join(fx.dir, 'bin'), { recursive: true });
    await writeFile(path.join(fx.dir, 'bin', 'wingfoil'), '#!/bin/sh\necho 0.2.2\n');
    await chmod(path.join(fx.dir, 'bin', 'wingfoil'), 0o755);
    const base = await noWingfoilEnv(fx);
    const env = { ...base, PATH: ['bin', plain, base.PATH ?? ''].join(path.delimiter) };
    await expect(discoverCli(fx.dir, { env })).rejects.toBeInstanceOf(CliNotFoundError);
  });

  it('S-10.1 — finds no CLI when the project pins none and none is on the PATH', async () => {
    const fx = await freshKanban();
    await removeCli(fx);
    const error = await discoverCli(fx.dir, { env: await noWingfoilEnv(fx) }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CliNotFoundError);
    expect(error).toMatchObject({ code: 'cli-not-found', projectRoot: fx.dir, installCommand: INSTALL_COMMAND });
    expect(INSTALL_COMMAND).toBe('npm install --save-dev wingfoil');
  });

  it('S-10.2 — finds no CLI any more once the pinned one is uninstalled and none is on the PATH', async () => {
    const fx = await freshKanban();
    const env = await noWingfoilEnv(fx);
    expect((await discoverCli(fx.dir, { env })).source).toBe('project');
    await removeCli(fx);
    await expect(discoverCli(fx.dir, { env })).rejects.toBeInstanceOf(CliNotFoundError);
  });

  it('treats a node_modules/wingfoil without bin.wingfoil as no CLI, without falling back to the PATH', async () => {
    const fx = await freshKanban();
    await removeCli(fx);
    await mkdir(cliPackageDir(fx), { recursive: true });
    await writeFile(path.join(cliPackageDir(fx), 'package.json'), '{"name":"wingfoil","version":"0.2.2"}\n');
    const bin = await installGlobally(path.join(root, `global-${n}`), PINNED_PACKAGE_DIR);
    await expect(discoverCli(fx.dir, { env: withPathFirst(fx.env, bin) })).rejects.toBeInstanceOf(CliNotFoundError);
  });

  it('treats a dangling node_modules/wingfoil link as no CLI, without falling back to the PATH', async () => {
    const fx = await freshKanban();
    await removeCli(fx);
    await symlink(path.join(root, `gone-${n}`), cliPackageDir(fx), 'dir');
    const bin = await installGlobally(path.join(root, `global-${n}`), PINNED_PACKAGE_DIR);
    await expect(discoverCli(fx.dir, { env: withPathFirst(fx.env, bin) })).rejects.toBeInstanceOf(CliNotFoundError);
  });

  it('searches only the project root, not its parent folders', async () => {
    const fx = await freshKanban();
    const nested = path.join(fx.dir, 'sub');
    await mkdir(nested, { recursive: true });
    await expect(discoverCli(nested, { env: await noWingfoilEnv(fx) })).rejects.toBeInstanceOf(CliNotFoundError);
  });

  it('on Windows, resolves a wingfoil.cmd shim to the bin script of the package next to it', async () => {
    const fx = await freshKanban();
    await removeCli(fx);
    const prefix = path.join(root, `win-${n}`);
    await mkdir(prefix, { recursive: true });
    await writeFile(
      path.join(prefix, 'wingfoil.cmd'),
      '@ECHO off\r\nnode "%~dp0\\node_modules\\wingfoil\\dist\\cli.js" %*\r\n',
    );
    const pkg = path.join(prefix, 'node_modules', 'wingfoil');
    const script = await writeCliPackage(pkg, '0.2.2', '');
    const env = withPathFirst(await noWingfoilEnv(fx), prefix);
    const cli = await discoverCli(fx.dir, { env, platform: 'win32' });
    expect(cli).toMatchObject({ source: 'path', file: process.execPath, prefixArgs: [script], packageDir: pkg });
  });

  it('on Windows, ignores a .cmd that is not an npm shim (it would need a shell)', async () => {
    const fx = await freshKanban();
    await removeCli(fx);
    const prefix = path.join(root, `wincmd-${n}`);
    await mkdir(prefix, { recursive: true });
    await writeFile(path.join(prefix, 'wingfoil.cmd'), '@ECHO 0.2.2\r\n');
    const env = withPathFirst(await noWingfoilEnv(fx), prefix);
    await expect(discoverCli(fx.dir, { env, platform: 'win32' })).rejects.toBeInstanceOf(CliNotFoundError);
  });
});
