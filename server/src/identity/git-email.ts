/**
 * The effective `git config user.email` of a project (REQ-STATE-05): git's own resolution run in
 * the project folder — the repository's configuration, else the global one — as the CLI sees it.
 * A read of git for what the CLI does not expose (directive `cli-only-writes` rule 2), through the
 * process runner: argument array, no shell, the 30 s timeout.
 */
import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import type { ProcessRunner } from '../process/runner.js';

/** `git config` failed other than "unset" (a broken configuration, a timeout, a kill). */
export class GitConfigError extends Error {
  constructor(
    /** How the process ended (`exit <status>`, `timeout`, …); never git's own text. */
    readonly reason: string,
  ) {
    super(`git config user.email failed: ${reason}`);
    this.name = 'GitConfigError';
  }
}

/** Options of {@link readGitEmail}. */
export interface GitEmailOptions {
  runner: ProcessRunner;
  /** Absolute path of `git` ({@link findGit}). */
  git: string;
  /** Environment of the git process (default: the server's). */
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}

/**
 * `git config --get user.email` in `root`: the trimmed value, or `undefined` when it is unset
 * (exit 1) or blank. Any other end is a {@link GitConfigError}.
 */
export async function readGitEmail(root: string, options: GitEmailOptions): Promise<string | undefined> {
  const result = await options.runner.run({
    file: options.git,
    args: ['config', '--get', 'user.email'],
    cwd: root,
    ...(options.env ? { env: options.env } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  if (result.ended === 'exit' && result.exitCode === 1) return undefined;
  if (result.ended !== 'exit' || result.exitCode !== 0) {
    // stderr may quote the configuration: only how the process ended is kept.
    throw new GitConfigError(result.ended === 'exit' ? `exit ${String(result.exitCode)}` : result.ended);
  }
  const email = result.stdout.trim();
  return email === '' ? undefined : email;
}

/** Options of {@link findGit}. */
export interface FindGitOptions {
  /** Environment whose `PATH` is searched (default: the server's). */
  env?: NodeJS.ProcessEnv;
  /** Platform rules (default: the server's). */
  platform?: NodeJS.Platform;
}

/**
 * The first `git` (`git.exe` on Windows) on the `PATH`, as an absolute path; relative entries are
 * never searched (they would resolve against the project folder).
 */
export async function findGit(options: FindGitOptions = {}): Promise<string | undefined> {
  const env = options.env ?? process.env;
  const windows = (options.platform ?? process.platform) === 'win32';
  // The delimiter follows the platform rules; paths are the server's own (its file system).
  const delimiter = windows ? ';' : ':';
  const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  const entries = (env[key] ?? '').split(delimiter).filter((entry) => path.isAbsolute(entry));
  for (const entry of entries) {
    const candidate = path.join(entry, windows ? 'git.exe' : 'git');
    if (await isRunnable(candidate, windows)) return candidate;
  }
  return undefined;
}

async function isRunnable(file: string, windows: boolean): Promise<boolean> {
  try {
    if (!(await stat(file)).isFile()) return false;
    if (!windows) await access(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
