/**
 * The manual git transport of spec-010 §4–§5, §8 (task-033): `POST /api/p/:pid/git/fetch`,
 * `/git/update`, `/git/push`, under the repository's write lock (`ProjectSnapshot.lockKey`,
 * adr-001 D5), on the FRESH state read inside it.
 *
 * | Step | Check | Refusal | Read from |
 * |------|-------|---------|-----------|
 * | row 5 (update, push) | the user is one member of the team (REQ-SEC-08, RP-14, RP-34) | 403 `not-in-team` | the snapshot view (D33-12: no process once read); again under the lock when the fresh state moved |
 * | §5 | fetch: `no-remote`, `no-fetch-target`, `refspec-outside-remotes` (a configured refspec writes outside `refs/remotes/`, task-034 D34-8 / bug-014); update: `no-remote`, `detached-head`, `no-upstream`, `diverged`, `local-changes-in-the-way`; push: `no-remote`, `detached-head`, `no-upstream` (also an unusable merge ref, D33-8) | 409 | the fresh check (status, `git remote`, `branch.<b>.remote`); the incoming files (`git log HEAD..@{u}`), the merge ref |
 * | D33-1 | a local remote is owned by the server's user | 409 `remote-not-owned` | `git remote get-url`, the file system |
 * | — | nothing to do (update: behind = 0; push: ahead = 0) | 200, no transport process (D33-9) | the fresh check |
 *
 * Then the command (no timeout; fetch and push cancelled when the client leaves — the process group
 * is killed, RP-37; update runs to completion), a fresh check, the sync status (fetch and update),
 * and 200 `{repository}` or 422 `git-refused` with git's message, local folders redacted (D33-5).
 * Git's message is never logged: the log gets `{pid, op, exitCode, ended}` only.
 */
import path from 'node:path';
import type {
  ApiError,
  GitOperation,
  GitResponse,
  GitTransportRefusalCode,
  ProjectEntry,
} from '@wingfoil-ui/contracts';
import { fetchTarget, isMergeRef } from '../git/copy.js';
import type { ProcessResult } from '../process/runner.js';
import type { GitReadError } from '../git/git.js';
import { localPathOf, localRemoteProblem } from '../git/local-remote.js';
import { redactLocalPaths } from '../git/redact.js';
import { repositoryStatus } from '../git/sync-status.js';
import {
  fetchArgs,
  mergeArgs,
  pullArgs,
  pushArgs,
  sshInEnvironment,
  trackingRefspecs,
  transportEnv,
} from '../git/transport.js';
import { matchIdentity } from '../identity/identity.js';
import type { WriteLock } from '../process/write-lock.js';
import type { ProjectSnapshot, SnapshotView } from '../snapshot/snapshot.js';
import type { Snapshots } from '../snapshot/snapshots.js';
import type { RepoState } from '../snapshot/state.js';

/** Where the transport logs (pino's `Logger` fits): kinds and codes only. */
export interface TransportLogger {
  info(object: object, message: string): void;
  warn(object: object, message: string): void;
}

/** Options of {@link GitTransport}. */
export interface GitTransportOptions {
  snapshots: Snapshots;
  writeLock: WriteLock;
  /** The server's environment (default `process.env`): which ssh command the user configured. */
  env?: NodeJS.ProcessEnv;
}

/** The outcome of a git route: the HTTP status and body. */
export type GitOutcome = { status: 200; body: GitResponse } | { status: number; body: { error: ApiError } };

/** A transport refusal of spec-010 §5. */
export interface Refusal {
  code: GitTransportRefusalCode;
  detail?: { files: string[] };
}

/**
 * What a transport operation will do on a fresh state: run `args` (`remote` the remote it talks to,
 * `urls` its URLs, for the redaction), nothing (`args` undefined: nothing to do, D33-9), or refuse.
 */
export type TransportPlan =
  { args: string[] | undefined; urls: readonly string[]; remote?: string } | { refusal: Refusal };

const MESSAGES: Record<GitTransportRefusalCode, string> = {
  'no-remote': 'This repository has no remote',
  'no-fetch-target': 'No remote to fetch: no upstream and no single or origin remote',
  'detached-head': 'No branch checked out',
  'no-upstream': 'This branch has no upstream on the remote',
  diverged: 'Your copy and the remote have diverged',
  'local-changes-in-the-way': 'Local changes are in the way',
  'remote-not-owned': 'The local remote repository belongs to another user',
  'remote-unreadable': 'Git cannot read the repository of this remote',
  'refspec-outside-remotes': 'A fetch refspec of this remote writes outside refs/remotes/',
};

const notInTeam = (): GitOutcome => ({
  status: 403,
  body: { error: { code: 'not-in-team', message: 'Not identified as a member of the team' } },
});

/** The paths of `files` (relative to the repository's top level) relative to the project (D33-11). */
export function relativeToProject(files: readonly string[], prefix: string): string[] {
  const base = prefix.replace(/\/$/, '');
  return files.map((f) => (base === '' ? f : path.posix.relative(base, f)));
}

/** The git routes' transport. */
export class GitTransport {
  private readonly env: NodeJS.ProcessEnv;

  constructor(private readonly options: GitTransportOptions) {
    this.env = options.env ?? process.env;
  }

  /**
   * Run `op` on the listed project `entry`; `signal` cancels a fetch or a push (not an update). An
   * unexpected failure (a git read under the lock, the project's layout) answers 500 `internal`
   * and is logged by kind only — git's message may quote local paths (review round 1 F2).
   */
  async run(entry: ProjectEntry, op: GitOperation, log: TransportLogger, signal?: AbortSignal): Promise<GitOutcome> {
    try {
      return await this.runChecked(entry, op, log, signal);
    } catch (error) {
      const e = error as Partial<GitReadError> & Error;
      log.warn(
        { project: entry.id, op, kind: e.name, ...(e.exitCode !== undefined ? { exitCode: e.exitCode } : {}) },
        'git transport failed',
      );
      return { status: 500, body: { error: { code: 'internal', message: 'Internal error' } } };
    }
  }

  private async runChecked(
    entry: ProjectEntry,
    op: GitOperation,
    log: TransportLogger,
    signal?: AbortSignal,
  ): Promise<GitOutcome> {
    const snapshot = await this.options.snapshots.open(entry.id, entry.path);
    let seen: SnapshotView | undefined;
    if (op !== 'fetch') {
      // Row 5 on the page's state: no process once the console has read it (D33-12).
      seen = await snapshot.view();
      if (!(await identified(seen))) return notInTeam();
    }
    return this.options.writeLock.run(snapshot.lockKey, () =>
      this.locked(snapshot, entry.id, op, seen, log, op === 'update' ? undefined : signal),
    );
  }

  private async locked(
    snapshot: ProjectSnapshot,
    pid: string,
    op: GitOperation,
    seen: SnapshotView | undefined,
    log: TransportLogger,
    signal: AbortSignal | undefined,
  ): Promise<GitOutcome> {
    // Fresh: the state now, not the watcher's last one.
    const state = await snapshot.check();
    if (seen && (state.key !== seen.state.key || state.email !== seen.state.email)) {
      if (!(await identified(await snapshot.view()))) return notInTeam();
    }
    const plan = await this.plan(snapshot, state, op);
    if ('refusal' in plan) {
      if (op === 'update') {
        const { code, detail } = plan.refusal;
        if (code !== 'no-fetch-target' && code !== 'refspec-outside-remotes') {
          this.options.snapshots.sync.updateFailed(
            pid,
            { code, ...(detail ? { detail } : {}) },
            state.copy,
            new Date(),
          );
        }
      }
      const { code, detail } = plan.refusal;
      return { status: 409, body: { error: { code, message: MESSAGES[code], ...(detail ? { detail } : {}) } } };
    }
    if (plan.args === undefined) {
      // Nothing to do: no transport process (D33-9).
      if (op === 'update') this.options.snapshots.sync.updated(pid);
      return this.answer(pid, state);
    }
    const result = await snapshot.git.transport(plan.args, {
      env: transportEnv(await this.sshConfigured(snapshot), this.env),
      ...(signal ? { signal } : {}),
    });
    // `project`, not `pid`: the logger's own `pid` is the server's process id (review round 1 S9).
    log.info({ project: pid, op, ended: result.ended, exitCode: result.exitCode }, 'git transport');
    const after = await snapshot.check().catch((error: unknown) => {
      log.warn({ project: pid, op, kind: (error as Error).name }, 'git transport: state check failed');
      return snapshot.current() ?? state;
    });
    if (result.ended === 'cancelled' || result.ended === 'terminated') {
      // The client left (or the server stops): not a failure of the remote.
      return { status: 500, body: { error: { code: 'internal', message: `git ${op} ${result.ended}` } } };
    }
    const sync = this.options.snapshots.sync;
    if (result.ended === 'exit' && result.exitCode === 0) {
      if (op === 'fetch') sync.fetched(pid, new Date());
      if (op === 'update') sync.updated(pid);
      return this.answer(pid, after);
    }
    const message = this.message(snapshot, result, plan.urls);
    if (op === 'fetch') sync.fetchFailed(pid, message, new Date());
    if (op === 'update') sync.updateFailed(pid, { code: 'git-refused', message }, after.copy, new Date());
    return { status: 422, body: { error: { code: 'git-refused', message } } };
  }

  /**
   * The command to run, nothing to do (`args` undefined), or the refusal — from the fresh `state`,
   * under the write lock. `automatic`: the update is the scheduler's `merge --ff-only` (spec-010
   * §6, RP-41) instead of the manual `pull --ff-only`, with the same checks.
   */
  async plan(snapshot: ProjectSnapshot, state: RepoState, op: GitOperation, automatic = false): Promise<TransportPlan> {
    const refuse = (code: GitTransportRefusalCode, detail?: { files: string[] }) => ({
      refusal: { code, ...(detail ? { detail } : {}) },
    });
    if (state.remotes.length === 0) return refuse('no-remote');
    if (op === 'fetch') {
      const remote = fetchTarget(state, state.remotes);
      if (remote === undefined) return refuse('no-fetch-target');
      // `--prune` must delete tracking refs only (task-034 D34-5, D34-8 / bug-014).
      if (!trackingRefspecs(await snapshot.git.configValues(`remote.${remote}.fetch`))) {
        return refuse('refspec-outside-remotes');
      }
      const urls = await snapshot.git.remoteUrls(remote);
      const local = await localRemoteProblem(urls, snapshot.topLevel, { ...this.home() });
      if (local) return refuse(local);
      return { args: fetchArgs(remote), urls, remote };
    }
    if (state.copy === 'detached') return refuse('detached-head');
    if (state.copy === 'no-upstream' || state.upstreamRemote === null) return refuse('no-upstream');
    const remote = state.upstreamRemote;
    if (op === 'update') {
      if (state.copy === 'diverged') return refuse('diverged');
      if (state.behind === 0) return { args: undefined, urls: [] };
      const incoming = await snapshot.git.incomingPaths();
      const inTheWay = incoming.filter((f) => state.paths.has(f));
      if (inTheWay.length > 0)
        return refuse('local-changes-in-the-way', { files: relativeToProject(inTheWay, snapshot.prefix) });
      const urls = await snapshot.git.remoteUrls(remote);
      const local = await localRemoteProblem(urls, snapshot.topLevel, { ...this.home() });
      if (local) return refuse(local);
      const branch = state.branch ?? '';
      return { args: automatic ? mergeArgs(branch) : pullArgs(branch), urls, remote };
    }
    // push
    const mergeRef = await snapshot.git.configValue(`branch.${state.branch ?? ''}.merge`);
    if (mergeRef === undefined || !isMergeRef(mergeRef)) return refuse('no-upstream');
    if (state.ahead === 0) return { args: undefined, urls: [] };
    // Every push URL: a push goes to each of them (review round 1 S2).
    const urls = await snapshot.git.remoteUrls(remote, true);
    const local = await localRemoteProblem(urls, snapshot.topLevel, { ...this.home() });
    if (local) return refuse(local);
    return { args: pushArgs(remote, mergeRef), urls, remote };
  }

  /** Whether the user configured an ssh command (the environment or `core.sshCommand`, RP-24). */
  async sshConfigured(snapshot: ProjectSnapshot): Promise<boolean> {
    return sshInEnvironment(this.env) || (await snapshot.git.configValue('core.sshCommand')) !== undefined;
  }

  /** The server's environment the transport builds on. */
  get environment(): NodeJS.ProcessEnv {
    return this.env;
  }

  /** `~` as git sees it: the `HOME` of the transport's environment (review round 2 F10). */
  private home(): { home?: string } {
    // Also an empty HOME: git then expands `~/<rest>` to `/<rest>` (review round 3 S14).
    return this.env.HOME !== undefined ? { home: this.env.HOME } : {};
  }

  /**
   * Git's standard error, local folders and URL userinfo removed (D33-5); a local remote's path,
   * wherever it is, shown as `<remote>` (review round 1 R1).
   */
  message(snapshot: ProjectSnapshot, result: ProcessResult, urls: readonly string[]): string {
    const text =
      result.stderr.trim() ||
      (result.ended === 'exit' ? `git exited with status ${String(result.exitCode)}` : `git ended: ${result.ended}`);
    const remote = urls.flatMap((url) => {
      const raw = localPathOf(url);
      if (raw === undefined) return [];
      return path.isAbsolute(raw) ? [raw] : [path.join(snapshot.topLevel, raw), raw];
    });
    return redactLocalPaths(text, { ...snapshot.localRoots, remote });
  }

  private answer(pid: string, state: RepoState): GitOutcome {
    return {
      status: 200,
      body: { repository: repositoryStatus(state, this.options.snapshots.sync.of(pid, state.copy)) },
    };
  }
}

/** Row 5 on `view`: one member of the team (a failed `dna show` matches no member). */
export async function identified(view: SnapshotView): Promise<boolean> {
  const members = await view.dna().then(
    (dna) => dna.data.team.members,
    () => [],
  );
  return matchIdentity(view.state.email, members).kind === 'member';
}
