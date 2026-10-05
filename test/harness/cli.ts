/**
 * The pinned WingFoil CLI: the `wingfoil` devDependency of the root `package.json`, run as the
 * server runs it (`process.execPath` + the package's `bin.wingfoil` script, adr-001 D2).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Root of this repository. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

interface PackageJson {
  version?: string;
  bin?: string | Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readJson(file: string): PackageJson {
  return JSON.parse(readFileSync(file, 'utf8')) as PackageJson;
}

/** The `wingfoil` version pinned by the root `package.json`. */
export function pinnedVersion(): string {
  const pin = readJson(path.join(REPO_ROOT, 'package.json')).devDependencies?.wingfoil;
  if (!pin || !/^\d+\.\d+\.\d+$/.test(pin))
    throw new Error(`wingfoil is not pinned to an exact version: ${String(pin)}`);
  return pin;
}

/** Directory of the installed pinned `wingfoil` package. */
export const PINNED_PACKAGE_DIR = path.join(REPO_ROOT, 'node_modules', 'wingfoil');

/** Absolute path of the `bin.wingfoil` script of the package installed in `packageDir`. */
export function binScript(packageDir: string): string {
  const bin = readJson(path.join(packageDir, 'package.json')).bin;
  const rel = typeof bin === 'string' ? bin : bin?.wingfoil;
  if (!rel) throw new Error(`${packageDir}/package.json declares no bin.wingfoil`);
  return path.join(packageDir, rel);
}

/** A way to run one WingFoil CLI build: `node <script> …`. */
export interface CliBuild {
  /** The `bin.wingfoil` script. */
  script: string;
  /** Directory of the package, linked into the fixtures' `node_modules/wingfoil`. */
  packageDir: string;
}

/** The pinned CLI build. */
export function pinnedCli(): CliBuild {
  return { script: binScript(PINNED_PACKAGE_DIR), packageDir: PINNED_PACKAGE_DIR };
}
