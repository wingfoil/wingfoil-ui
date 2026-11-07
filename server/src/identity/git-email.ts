/**
 * The email of the git author a project's CLI authorises (REQ-STATE-05, amended for bug-029):
 * `GIT_AUTHOR_EMAIL` of the environment, else `author.email`, else `user.email` — the order of
 * WingFoil's `readGitIdentity` (`wingfoil-cli` W-39), never `EMAIL` nor git's hostname guess; the
 * configuration read by git in the project folder (the repository's, else the global one).
 * A read of git for what the CLI does not expose (directive `cli-only-writes` rule 2), through the
 * process runner: argument array, no shell, the 30 s timeout.
 */
import {
  authorEmailOfConfig,
  authorEmailVariable,
  gitEnv,
  GIT_READ_ARGS,
  NO_FSMONITOR,
  NO_TRANSPORT,
  READ_GIT_ENV,
  withoutNames,
} from '../git/git.js';
import type { ProcessRunner } from '../process/runner.js';

/** `git config` failed other than "unset" (a broken configuration, a timeout, a kill). */
export class GitConfigError extends Error {
  constructor(
    /** How the process ended (`exit <status>`, `timeout`, …); never git's own text. */
    readonly reason: string,
  ) {
    super(`git config (author email) failed: ${reason}`);
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
 * The author email in `root` (the environment cleaned by `gitEnv` of `git/git.ts`, so the
 * project's own repository configuration is the one read): `GIT_AUTHOR_EMAIL` when set (trimmed,
 * blank → `undefined`, no process), else one `git config -z --get-regexp '^(author|user)\.email$'`
 * — `undefined` when nothing matches (exit 1) or the value is blank. Any other end is a
 * {@link GitConfigError}.
 */
export async function readGitEmail(root: string, options: GitEmailOptions): Promise<string | undefined> {
  const base = gitEnv(options.env ?? process.env);
  const fromEnv = authorEmailVariable(base);
  if (fromEnv !== undefined) return fromEnv.trim() || undefined;
  const result = await options.runner.run({
    file: options.git,
    // As every `GitReads` read (review round 5 s-nit-4): no fsmonitor, no transport.
    args: [...NO_FSMONITOR, ...NO_TRANSPORT, ...GIT_READ_ARGS.email],
    cwd: root,
    env: { ...withoutNames(base, READ_GIT_ENV), ...READ_GIT_ENV },
    ...(options.signal ? { signal: options.signal } : {}),
  });
  // A cut output may be incomplete (task-034 W4-13).
  if (result.drained) throw new GitConfigError('pipes-held');
  if (result.ended === 'exit' && result.exitCode === 1) return undefined;
  if (result.ended !== 'exit' || result.exitCode !== 0) {
    // stderr may quote the configuration: only how the process ended is kept.
    throw new GitConfigError(result.ended === 'exit' ? `exit ${String(result.exitCode)}` : result.ended);
  }
  return authorEmailOfConfig(result.stdout);
}
