/**
 * The identity of the user in a listed project (REQ-STATE-05): the port the routes use and its
 * local adapter, which reads the effective `git config user.email` and `dna show` (the team) and
 * matches them. Every call reads both afresh, so a change of the git configuration or of the DNA is
 * seen by the next call; caching keyed on HEAD, the working-tree status and the effective email is
 * the snapshot's (adr-001 D6, task-010).
 */
import type { IdentityView, ProjectEntry, Identity } from '@wingfoil-ui/contracts';
import { WingfoilCli, type CliLogger } from '../cli/adapter.js';
import { discoverCli } from '../cli/discovery.js';
import type { ProcessRunner } from '../process/runner.js';
import { ProjectReads } from '../reads/project-reads.js';
import { GitNotFoundError, resolveGit } from '../git/git.js';
import { readGitEmail } from './git-email.js';
import { identityView, matchIdentity } from './identity.js';

// No `git` on the `PATH`: the identity cannot be read (the one error of the shared resolver).
export { GitNotFoundError };

/** The identity port. */
export interface IdentitySource {
  /**
   * Who the user is in `project`, evaluated now. Rejects with the CLI's errors (`CliError`,
   * `CliNotFoundError`: map them with `cliErrorEnvelope`), a `GitConfigError` or a
   * {@link GitNotFoundError}.
   */
  identify(project: ProjectEntry, signal?: AbortSignal): Promise<Identity>;
}

/** Options of {@link createLocalIdentitySource}. */
export interface LocalIdentityOptions {
  /** Runner of the git and `wingfoil` processes. */
  runner: ProcessRunner;
  /** Environment of those processes and of the `PATH` lookups (default: the server's). */
  env?: NodeJS.ProcessEnv;
  /** Where the CLI adapter logs its defects. */
  logger?: CliLogger;
}

/** The local adapter: git through the runner, the team through the project's own CLI. */
export function createLocalIdentitySource(options: LocalIdentityOptions): IdentitySource {
  const env = options.env;
  // Only a found path is kept: a `git` installed later is found on the next call.
  let gitFile: string | undefined;
  return {
    async identify(project, signal) {
      // `resolveGit` rejects with GitNotFoundError; nothing is kept then.
      gitFile ??= await resolveGit(env);
      const cli = new WingfoilCli({
        cli: await discoverCli(project.path, env ? { env } : {}),
        runner: options.runner,
        ...(env ? { env } : {}),
        ...(options.logger ? { logger: options.logger } : {}),
      });
      // One read failing (or the caller cancelling) cancels the other.
      const both = new AbortController();
      const cancel = (): void => both.abort();
      if (signal?.aborted) both.abort();
      signal?.addEventListener('abort', cancel, { once: true });
      const failFast = <T>(read: Promise<T>): Promise<T> =>
        read.catch((error: unknown) => {
          both.abort();
          throw error;
        });
      let email: string | undefined;
      let dna: Awaited<ReturnType<ProjectReads['dna']>>;
      try {
        [email, dna] = await Promise.all([
          failFast(
            readGitEmail(project.path, {
              runner: options.runner,
              git: gitFile,
              signal: both.signal,
              ...(env ? { env } : {}),
            }),
          ),
          failFast(new ProjectReads({ root: project.path, cli }).dna(both.signal)),
        ]);
      } finally {
        signal?.removeEventListener('abort', cancel);
      }
      return matchIdentity(email, dna.data.team.members);
    },
  };
}

/**
 * The identity part of `GET /api/p/:pid` (`contracts/api/identity.schema.json`): the identity
 * evaluated now, the role views, and the current one from the entry's remembered `roleView`.
 */
export async function projectIdentityView(
  source: IdentitySource,
  project: ProjectEntry,
  signal?: AbortSignal,
): Promise<IdentityView> {
  return identityView(await source.identify(project, signal), project.roleView);
}
