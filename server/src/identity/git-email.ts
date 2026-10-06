/**
 * The effective `git config user.email` of a project (REQ-STATE-05): git's own resolution run in
 * the project folder — the repository's configuration, else the global one — as the CLI sees it.
 * A read of git for what the CLI does not expose (directive `cli-only-writes` rule 2), through the
 * process runner: argument array, no shell, the 30 s timeout.
 */
import { gitEnv } from '../git/git.js';
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
  /** Absolute path of `git` (`resolveGit` of `git/git.ts`). */
  git: string;
  /** Environment of the git process (default: the server's). */
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}

/**
 * `git config --get user.email` in `root` (the environment cleaned by `gitEnv` of
 * `git/git.ts`, so the project's own repository configuration is the one read): the trimmed value, or `undefined` when it is unset
 * (exit 1) or blank. Any other end is a {@link GitConfigError}.
 */
export async function readGitEmail(root: string, options: GitEmailOptions): Promise<string | undefined> {
  const result = await options.runner.run({
    file: options.git,
    args: ['config', '--get', 'user.email'],
    cwd: root,
    env: gitEnv(options.env ?? process.env),
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
