/**
 * Fixture variants (`02_bdd/00_conventions.md` v0.6 *Variants*): the CLI stub, the version-fake
 * variant and the no-CLI variant. They change only the fixture's `node_modules/wingfoil`, which
 * is not versioned, so the fixture's git history is untouched.
 */
import { cp, mkdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { binScript } from '../cli.js';
import { git } from '../run.js';
import type { Fixture } from './builder.js';

/** A command the CLI stub makes fail. */
export interface StubFailure {
  /** Leading positional words of the command, e.g. `['memory', 'approve']`. */
  command: readonly string[];
  /** Exit status (non-zero). */
  exitCode: number;
  /** Message written on stderr. */
  stderr: string;
}

/** Options of {@link installCliStub}. */
export interface StubOptions {
  /** Version declared by `package.json` and answered to `--version` (the version-fake variant). */
  version?: string;
  /** Commands that fail with the given status and message. */
  failures?: readonly StubFailure[];
}

/** Path of the fixture's `node_modules/wingfoil`. */
export function cliPackageDir(fixture: Pick<Fixture, 'dir'>): string {
  return path.join(fixture.dir, 'node_modules', 'wingfoil');
}

/**
 * Replace the fixture's `node_modules/wingfoil` with a package whose `bin.wingfoil` script is a
 * wrapper: it answers `--version` with `options.version` (when set), fails the commands listed in
 * `options.failures`, and delegates everything else to the CLI the fixture was built with.
 * Returns the path of the wrapper script.
 */
export async function installCliStub(fixture: Pick<Fixture, 'dir'>, options: StubOptions): Promise<string> {
  const dir = cliPackageDir(fixture);
  // Resolve through the link before replacing it: the stub delegates to the real package.
  const realScript = binScript(await realpath(dir));
  const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8')) as Record<string, unknown>;
  await rm(dir, { recursive: true, force: true });
  await mkdir(path.join(dir, 'bin'), { recursive: true });
  const stubPkg = { ...pkg, version: options.version ?? pkg.version, bin: { wingfoil: 'bin/wingfoil-stub.cjs' } };
  await writeFile(path.join(dir, 'package.json'), `${JSON.stringify(stubPkg, null, 2)}\n`);
  const script = path.join(dir, 'bin', 'wingfoil-stub.cjs');
  await writeFile(script, stubSource(realScript, options));
  return script;
}

function stubSource(realScript: string, options: StubOptions): string {
  const config = JSON.stringify({ realScript, version: options.version ?? null, failures: options.failures ?? [] });
  return `#!/usr/bin/env node
'use strict';
// WingFoil CLI stub of the e2e harness (BDD conventions: CLI stub / version-fake variants).
const { spawnSync } = require('node:child_process');
const config = ${config};
const args = process.argv.slice(2);
if (config.version && (args.includes('--version') || args.includes('-V'))) {
  process.stdout.write(config.version + '\\n');
  process.exit(0);
}
const words = args.filter((a, i) => !a.startsWith('-') && !(i > 0 && /^--(format|reason|type|title|set|value|tags|status|tag|template)$/.test(args[i - 1])));
for (const failure of config.failures) {
  if (failure.command.every((w, i) => words[i] === w)) {
    process.stderr.write(failure.stderr + '\\n');
    process.exit(failure.exitCode);
  }
}
const result = spawnSync(process.execPath, [config.realScript, ...args], { stdio: 'inherit' });
process.exit(result.status === null ? 1 : result.status);
`;
}

/** The no-CLI variant: remove the fixture's `node_modules/wingfoil`. */
export async function removeCli(fixture: Pick<Fixture, 'dir'>): Promise<void> {
  await rm(cliPackageDir(fixture), { recursive: true, force: true });
}

/** `env` with a `PATH` holding no directory that contains a `wingfoil` executable. */
export async function envWithoutWingfoil(env: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv> {
  const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  const names = process.platform === 'win32' ? ['wingfoil.cmd', 'wingfoil.exe', 'wingfoil'] : ['wingfoil'];
  const kept: string[] = [];
  for (const entry of (env[key] ?? '').split(path.delimiter).filter(Boolean)) {
    let found = false;
    for (const name of names) {
      if (await exists(path.join(entry, name))) found = true;
    }
    if (!found) kept.push(entry);
  }
  return { ...env, [key]: kept.join(path.delimiter) };
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

/** Copy a built fixture (repository and remote) under `root`, re-pointing `origin`. */
export async function copyFixture(fixture: Fixture, root: string): Promise<Fixture> {
  const dir = path.join(root, fixture.kind);
  const remoteDir = path.join(root, 'remotes', `${fixture.kind}.git`);
  await cp(fixture.dir, dir, { recursive: true, verbatimSymlinks: true });
  await cp(fixture.remoteDir, remoteDir, { recursive: true });
  const remoteUrl = `file://${remoteDir}`;
  await git(dir, ['remote', 'set-url', 'origin', remoteUrl], fixture.env);
  return { ...fixture, dir, remoteDir, remoteUrl };
}
