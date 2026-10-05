/**
 * CLI discovery (adr-001 D2, REQ-ARC-02): which `wingfoil` runs for a project.
 *
 * 1. The project's pinned CLI: `<project root>/node_modules/wingfoil/package.json`, entry
 *    `bin.wingfoil`, run as `process.execPath <bin script>` — no shell, no `.bin` shim. Only the
 *    project root is searched, never its parent folders. A `node_modules/wingfoil` without a bin
 *    script, or a dangling link, is a broken install: no CLI, and no fallback to another version on the `PATH`.
 * 2. Otherwise the first `wingfoil` on the `PATH` (absolute entries only), resolved to an absolute
 *    path by the server: an npm shim runs its package's bin script as in 1; any other executable
 *    runs by its absolute path (on Windows only npm shims are used: a `.cmd` needs a shell).
 * 3. Otherwise {@link CliNotFoundError}.
 *
 * The installed package counts, not the range written in the project's `package.json`.
 */
import { constants } from 'node:fs';
import { access, lstat, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

/** The install command shown when no CLI is found (S-10.1, spec-006 §3). */
export const INSTALL_COMMAND = 'npm install --save-dev wingfoil';

/** Where the resolved CLI comes from: the project's `node_modules` or the `PATH` (S-08.2). */
export type CliSource = 'project' | 'path';

/** The CLI to run for a project: `file` with `prefixArgs` before the CLI's own arguments. */
export interface ResolvedCli {
  source: CliSource;
  /** The project root: the working directory of every invocation. */
  projectRoot: string;
  /** Program started: `process.execPath` for a package's bin script, else the absolute executable. */
  file: string;
  /** Arguments before the CLI's own: the bin script, or none. */
  prefixArgs: readonly string[];
  /** Directory of the `wingfoil` package, when the CLI is one. */
  packageDir?: string;
}

/** No CLI for the project (S-10.1, S-10.2). */
export class CliNotFoundError extends Error {
  /** Refusal code of spec-006 §3. */
  readonly code = 'cli-not-found';
  /** Command that installs the project's CLI. */
  readonly installCommand = INSTALL_COMMAND;

  constructor(readonly projectRoot: string) {
    super(`WingFoil CLI not found for ${projectRoot}`);
    this.name = 'CliNotFoundError';
  }
}

/** Options of {@link discoverCli}. */
export interface DiscoveryOptions {
  /** Environment whose `PATH` is searched (default: the server's). */
  env?: NodeJS.ProcessEnv;
  /** Platform rules for the `PATH` lookup (default: the server's). */
  platform?: NodeJS.Platform;
  /** Node.js that runs a package's bin script (default: the server's own). */
  execPath?: string;
}

/** Resolve the CLI of the project whose root (the folder holding `.wingfoil/`) is `projectRoot`. */
export async function discoverCli(projectRoot: string, options: DiscoveryOptions = {}): Promise<ResolvedCli> {
  const execPath = options.execPath ?? process.execPath;
  const pinnedDir = path.join(projectRoot, 'node_modules', 'wingfoil');
  // `lstat`: a dangling link is a broken pinned install, not an absent one.
  if (await present(pinnedDir)) {
    const script = await packageBinScript(pinnedDir);
    if (!script) throw new CliNotFoundError(projectRoot);
    return { source: 'project', projectRoot, file: execPath, prefixArgs: [script], packageDir: pinnedDir };
  }
  const found = await findOnPath(options.env ?? process.env, options.platform ?? process.platform);
  if (found) {
    if ('script' in found) {
      return { source: 'path', projectRoot, file: execPath, prefixArgs: [found.script], packageDir: found.packageDir };
    }
    return { source: 'path', projectRoot, file: found.executable, prefixArgs: [] };
  }
  throw new CliNotFoundError(projectRoot);
}

type PathHit = { script: string; packageDir: string } | { executable: string };

async function findOnPath(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): Promise<PathHit | undefined> {
  const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  const windows = platform === 'win32';
  const names = windows ? ['wingfoil.cmd', 'wingfoil.exe', 'wingfoil'] : ['wingfoil'];
  // Relative entries would resolve against the project folder: never searched.
  const entries = (env[key] ?? '').split(path.delimiter).filter((entry) => path.isAbsolute(entry));
  for (const entry of entries) {
    for (const name of names) {
      const candidate = path.join(entry, name);
      if (!(await isRunnable(candidate, windows))) continue;
      if (windows) {
        // npm on Windows writes `<prefix>/wingfoil.cmd` next to `<prefix>/node_modules/wingfoil`.
        const packageDir = path.join(entry, 'node_modules', 'wingfoil');
        const script = await packageBinScript(packageDir);
        if (script) return { script, packageDir };
        if (name.endsWith('.exe')) return { executable: candidate };
        continue;
      }
      return (await npmShimTarget(candidate)) ?? { executable: candidate };
    }
  }
  return undefined;
}

/**
 * An npm shim on Linux and macOS is a link to its package's bin script: follow it, find the
 * enclosing `wingfoil` package and check that its `bin.wingfoil` is that script.
 */
async function npmShimTarget(candidate: string): Promise<{ script: string; packageDir: string } | undefined> {
  const target = await realpath(candidate);
  let dir = path.dirname(target);
  for (;;) {
    if (await exists(path.join(dir, 'package.json'))) {
      const script = await packageBinScript(dir);
      return script && (await realpath(script)) === target ? { script: target, packageDir: dir } : undefined;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Absolute path of the existing `bin.wingfoil` script of the `wingfoil` package in `dir`. */
async function packageBinScript(dir: string): Promise<string | undefined> {
  let pkg: { name?: unknown; bin?: unknown };
  try {
    pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8')) as typeof pkg;
  } catch {
    return undefined;
  }
  if (pkg.name !== 'wingfoil') return undefined;
  const rel = typeof pkg.bin === 'string' ? pkg.bin : (pkg.bin as Record<string, unknown> | undefined)?.wingfoil;
  if (typeof rel !== 'string') return undefined;
  const script = path.resolve(dir, rel);
  return (await isFile(script)) ? script : undefined;
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function present(file: string): Promise<boolean> {
  try {
    await lstat(file);
    return true;
  } catch {
    return false;
  }
}

async function isFile(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

async function isRunnable(file: string, windows: boolean): Promise<boolean> {
  if (!(await isFile(file))) return false;
  if (windows) return true;
  try {
    await access(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
