import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { binScript, pinnedVersion } from './cli.js';
import {
  buildFixture,
  cliPackageDir,
  copyFixture,
  envWithoutWingfoil,
  installCliStub,
  removeCli,
  type Fixture,
} from './fixtures/index.js';
import { git, run } from './run.js';

let root: string;
let template: Fixture;
let n = 0;

/** A fresh copy of the kanban fixture. */
async function freshKanban(): Promise<Fixture> {
  n += 1;
  return copyFixture(template, path.join(root, `copy-${n}`));
}

/** Run the fixture's CLI as the server does: `node <bin.wingfoil of node_modules/wingfoil>`. */
function wingfoil(fx: Fixture, args: string[]) {
  return run(process.execPath, [binScript(cliPackageDir(fx)), ...args], {
    cwd: fx.dir,
    env: fx.env,
    allowFailure: true,
  });
}

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'wfui-var-'));
  template = await buildFixture('kanban', { root: path.join(root, 'template') });
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('copyFixture', () => {
  it('copies the repository and re-points origin to the copied remote', async () => {
    const fx = await freshKanban();
    expect(fx.dir).not.toBe(template.dir);
    expect(fx.home).not.toBe(template.home);
    expect(fx.env.GIT_CONFIG_GLOBAL).not.toBe(template.env.GIT_CONFIG_GLOBAL);
    expect((await git(fx.dir, ['remote', 'get-url', 'origin'], fx.env)).stdout.trim()).toBe(`file://${fx.remoteDir}`);
    await git(fx.dir, ['fetch', '-q', 'origin'], fx.env);
    expect((await wingfoil(fx, ['--version'])).stdout.trim()).toBe(pinnedVersion());
  });
});

describe('CLI stub variant', () => {
  it('fails the listed commands with the scenario status and message, and leaves git untouched', async () => {
    const fx = await freshKanban();
    const head = (await git(fx.dir, ['rev-parse', 'HEAD'], fx.env)).stdout;
    await installCliStub(fx, {
      failures: [{ command: ['memory', 'approve'], exitCode: 1, stderr: 'error: simulated failure' }],
    });
    const result = await wingfoil(fx, [
      'memory',
      'approve',
      'task-001-login-form',
      '--reason',
      'ok',
      '--format',
      'json',
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr.trim()).toBe('error: simulated failure');
    expect((await git(fx.dir, ['rev-parse', 'HEAD'], fx.env)).stdout).toBe(head);
    expect((await git(fx.dir, ['status', '--porcelain'], fx.env)).stdout).toBe('');
  });

  it('delegates every other command to the real CLI', async () => {
    const fx = await freshKanban();
    await installCliStub(fx, { failures: [{ command: ['memory', 'approve'], exitCode: 1, stderr: 'x' }] });
    const result = await wingfoil(fx, ['memory', 'search', '--format', 'json', '--status', 'approved']);
    expect(result.code).toBe(0);
    expect((JSON.parse(result.stdout) as { matches: { id: string }[] }).matches.map((m) => m.id)).toEqual([
      'task-003-logout',
    ]);
  });

  it('can be installed again and still delegates to the real CLI', async () => {
    const fx = await freshKanban();
    await installCliStub(fx, { version: '0.1.9' });
    await installCliStub(fx, { failures: [{ command: ['dna'], exitCode: 3, stderr: 'no dna' }] });
    expect((await wingfoil(fx, ['--version'])).stdout.trim()).toBe(pinnedVersion());
    expect((await wingfoil(fx, ['dna', 'show'])).code).toBe(3);
    expect((await wingfoil(fx, ['memory', 'search', '--format', 'json'])).code).toBe(0);
  });

  it('is the bin.wingfoil script of node_modules/wingfoil/package.json', async () => {
    const fx = await freshKanban();
    const script = await installCliStub(fx, {});
    expect(binScript(cliPackageDir(fx))).toBe(script);
    expect(await readFile(script, 'utf8')).toContain('CLI stub');
  });
});

describe('version-fake variant', () => {
  it('declares and answers the fake version, and delegates the rest', async () => {
    const fx = await freshKanban();
    await installCliStub(fx, { version: '0.1.9' });
    const pkg = JSON.parse(await readFile(path.join(cliPackageDir(fx), 'package.json'), 'utf8')) as { version: string };
    expect(pkg.version).toBe('0.1.9');
    expect((await wingfoil(fx, ['--version'])).stdout.trim()).toBe('0.1.9');
    expect((await wingfoil(fx, ['dna', 'show', 'project', '--format', 'json'])).stdout).toContain('"kanban"');
  });
});

describe('no-CLI variant', () => {
  it('removes node_modules/wingfoil', async () => {
    const fx = await freshKanban();
    await removeCli(fx);
    await expect(stat(cliPackageDir(fx))).rejects.toThrow();
  });

  it('builds a PATH that holds no wingfoil executable but still reaches git and node', async () => {
    const bin = path.join(root, 'fake-bin');
    await mkdir(bin, { recursive: true });
    await writeFile(path.join(bin, 'wingfoil'), '#!/bin/sh\necho 0.2.2\n');
    await chmod(path.join(bin, 'wingfoil'), 0o755);
    const other = path.join(root, 'other-bin');
    await mkdir(other, { recursive: true });
    const safe = path.join(root, 'safe-bin');
    const env = await envWithoutWingfoil(
      { PATH: [bin, other, ...(process.env.PATH ?? '').split(path.delimiter)].join(path.delimiter) },
      safe,
    );
    const entries = (env.PATH ?? '').split(path.delimiter);
    expect(entries).not.toContain(bin);
    expect(entries).toContain(other);
    expect(entries.at(-1)).toBe(safe);
    expect((await run('git', ['--version'], { env })).stdout).toMatch(/^git version/);
    expect((await run('node', ['--version'], { env })).stdout.trim()).toBe(process.version);
    expect(entries.filter((e) => existsSync(path.join(e, 'wingfoil')))).toEqual([]);
  });
});
