/**
 * Hand-made `wingfoil` packages for the discovery and invocation tests: a package with any bin
 * script, and an npm global install of a package (`<prefix>/bin/wingfoil` →
 * `<prefix>/lib/node_modules/wingfoil/<bin>`), as `npm install -g` lays it out on Linux and macOS.
 */
import { chmod, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { binScript } from '../../harness/cli.js';

/** Write a `wingfoil` package in `dir` whose `bin.wingfoil` is `bin/cli.cjs` with `source`. */
export async function writeCliPackage(dir: string, version: string, source: string): Promise<string> {
  await rm(dir, { recursive: true, force: true });
  await mkdir(path.join(dir, 'bin'), { recursive: true });
  const pkg = { name: 'wingfoil', version, bin: { wingfoil: 'bin/cli.cjs' } };
  await writeFile(path.join(dir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  const script = path.join(dir, 'bin', 'cli.cjs');
  await writeFile(script, `#!/usr/bin/env node\n'use strict';\n${source}\n`);
  await chmod(script, 0o755);
  return script;
}

/** Source of a CLI that records each run in `marker` and answers `--version` with `version`. */
export function markingCliSource(version: string, marker: string): string {
  return `require('node:fs').appendFileSync(${JSON.stringify(marker)}, process.argv.slice(2).join(' ') + '\\n');
process.stdout.write(${JSON.stringify(version)} + '\\n');`;
}

/** Source of a CLI that sleeps `seconds` before answering. */
export function sleepingCliSource(seconds: number): string {
  return `setTimeout(() => process.stdout.write('{}'), ${seconds * 1000});`;
}

/**
 * Install `packageDir` globally under `prefix` (linked, as `npm install -g <folder>` does) and
 * return the directory to put on the `PATH` (`<prefix>/bin`).
 */
export async function installGlobally(prefix: string, packageDir: string): Promise<string> {
  const lib = path.join(prefix, 'lib', 'node_modules');
  const bin = path.join(prefix, 'bin');
  await mkdir(lib, { recursive: true });
  await mkdir(bin, { recursive: true });
  const installed = path.join(lib, 'wingfoil');
  await rm(installed, { recursive: true, force: true });
  await symlink(packageDir, installed, 'dir');
  const script = binScript(installed);
  await rm(path.join(bin, 'wingfoil'), { force: true });
  await symlink(path.relative(bin, script), path.join(bin, 'wingfoil'));
  return bin;
}

/** `env` with `dir` first on the `PATH`. */
export function withPathFirst(env: NodeJS.ProcessEnv, dir: string): NodeJS.ProcessEnv {
  return { ...env, PATH: [dir, env.PATH ?? ''].filter(Boolean).join(path.delimiter) };
}
