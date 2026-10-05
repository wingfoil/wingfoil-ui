/**
 * Fixture variants (`02_bdd/00_conventions.md` v0.6 *Variants*): the CLI stub, the version-fake
 * variant and the no-CLI variant. They change only the fixture's `node_modules/wingfoil`, which
 * is not versioned, so the fixture's git history is untouched.
 */
import { cp, mkdir, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { binScript } from '../cli.js';
import { git } from '../run.js';
import { harnessEnv, type Fixture } from './builder.js';

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

/** Field of the stub's `package.json` recording the real CLI it delegates to. */
const STUB_FIELD = 'wingfoilUiHarnessStub';

/** Path of the fixture's `node_modules/wingfoil`. */
export function cliPackageDir(fixture: Pick<Fixture, 'dir'>): string {
  return path.join(fixture.dir, 'node_modules', 'wingfoil');
}

/**
 * Replace the fixture's `node_modules/wingfoil` with a package whose `bin.wingfoil` script is a
 * wrapper: it answers `--version` with `options.version` (when set), fails the commands listed in
 * `options.failures` (matched on the leading positional words, before the first `-` argument, after
 * any global option such as `--format json` placed before the command), and
 * delegates everything else to the CLI the fixture was built with. Installing it again replaces
 * the previous stub and keeps delegating to the same real CLI.
 * Returns the path of the wrapper script.
 */
export async function installCliStub(fixture: Pick<Fixture, 'dir'>, options: StubOptions): Promise<string> {
  const dir = cliPackageDir(fixture);
  const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8')) as Record<string, unknown>;
  // A previous stub records the real CLI it delegates to; otherwise resolve through the link
  // before replacing it.
  const previous = pkg[STUB_FIELD] as { realScript: string; version: unknown } | undefined;
  const realScript = previous?.realScript ?? binScript(await realpath(dir));
  const realVersion = previous?.version ?? pkg.version;
  await rm(dir, { recursive: true, force: true });
  await mkdir(path.join(dir, 'bin'), { recursive: true });
  const stubPkg = {
    ...pkg,
    version: options.version ?? realVersion,
    bin: { wingfoil: 'bin/wingfoil-stub.cjs' },
    [STUB_FIELD]: { realScript, version: realVersion },
  };
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
// wingfoil's global options and the number of values each takes.
const GLOBAL_OPTIONS = { '--format': 1, '--verbose': 0, '--no-color': 0, '--no-interactive': 0 };
const args = process.argv.slice(2);
if (config.version && (args.includes('--version') || args.includes('-V'))) {
  process.stdout.write(config.version + '\\n');
  process.exit(0);
}
// Global options may come before the command (the server's \`--format json <command>\`, spec-001 §1).
let start = 0;
while (start < args.length && GLOBAL_OPTIONS[args[start]] !== undefined) start += 1 + GLOBAL_OPTIONS[args[start]];
const rest = args.slice(start);
const firstOption = rest.findIndex((a) => a.startsWith('-'));
const words = firstOption === -1 ? rest : rest.slice(0, firstOption);
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

/**
 * `env` with a `PATH` holding no directory that contains a `wingfoil` executable. Dropping a
 * directory can drop `git` and `node` with it (a global `wingfoil` in `/usr/local/bin`), so
 * `binDir` is created with links to both and appended to the `PATH`.
 */
export async function envWithoutWingfoil(env: NodeJS.ProcessEnv, binDir: string): Promise<NodeJS.ProcessEnv> {
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
  await mkdir(binDir, { recursive: true });
  const gitPath = await which('git', env[key] ?? '');
  for (const [name, target] of [
    ['node', process.execPath],
    ['git', gitPath],
  ] as const) {
    const link = path.join(binDir, process.platform === 'win32' ? `${name}.exe` : name);
    if (target && !(await exists(link))) await symlink(target, link);
  }
  return { ...env, [key]: [...kept, binDir].join(path.delimiter) };
}

async function which(name: string, pathValue: string): Promise<string | undefined> {
  for (const entry of pathValue.split(path.delimiter).filter(Boolean)) {
    for (const file of process.platform === 'win32' ? [`${name}.exe`, `${name}.cmd`] : [name]) {
      if (await exists(path.join(entry, file))) return path.join(entry, file);
    }
  }
  return undefined;
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

/** Copy a built fixture (repository and remote) under `root`, re-pointing `origin`; the copy gets its own environment and home. */
export async function copyFixture(fixture: Fixture, root: string): Promise<Fixture> {
  const dir = path.join(root, fixture.kind);
  const remoteDir = path.join(root, 'remotes', `${fixture.kind}.git`);
  await cp(fixture.dir, dir, { recursive: true, verbatimSymlinks: true });
  await cp(fixture.remoteDir, remoteDir, { recursive: true });
  const remoteUrl = `file://${remoteDir}`;
  const { env, home } = await harnessEnv(root);
  await git(dir, ['remote', 'set-url', 'origin', remoteUrl], env);
  return { ...fixture, dir, remoteDir, remoteUrl, env, home };
}
