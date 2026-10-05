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
import { findGit, readGitEmail } from './git-email.js';
import { identityView, matchIdentity } from './identity.js';

/** No `git` on the `PATH`: the identity cannot be read. */
export class GitNotFoundError extends Error {
  constructor() {
    super('git not found on the PATH');
    this.name = 'GitNotFoundError';
  }
}

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
  let git: Promise<string | undefined> | undefined;
  return {
    async identify(project, signal) {
      git ??= findGit(env ? { env } : {});
      const gitFile = await git;
      if (gitFile === undefined) throw new GitNotFoundError();
      const cli = new WingfoilCli({
        cli: await discoverCli(project.path, env ? { env } : {}),
        runner: options.runner,
        ...(env ? { env } : {}),
        ...(options.logger ? { logger: options.logger } : {}),
      });
      const [email, dna] = await Promise.all([
        readGitEmail(project.path, {
          runner: options.runner,
          git: gitFile,
          ...(env ? { env } : {}),
          ...(signal ? { signal } : {}),
        }),
        new ProjectReads({ root: project.path, cli }).dna(signal),
      ]);
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
