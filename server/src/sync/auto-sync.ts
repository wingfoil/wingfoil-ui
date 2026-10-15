/**
 * The work of a scheduler tick (spec-010 §6; task-034): the automatic fetch and the automatic
 * update of the listed projects whose snapshot is open (RP-18), one repository at a time, under its
 * write lock (taken by the {@link SyncScheduler}).
 *
 * | Step | What | Recorded |
 * |------|------|----------|
 * | scope | listed projects ∩ open snapshots, grouped by `lockKey` (D34-4) | — |
 * | fetch | per group and fetch target, once: the fresh check, then task-033's plan (no remote, no fetch target, a refspec outside `refs/remotes/`, a local remote of another user or unreadable → skipped, logged by code); `fetch` with no hook (D34-1), no askpass (D34-3), killed after 60 s (RP-20) | every project of the group: `lastSuccessAt`, or `lastError` (git's message redacted; `fetch-timeout`, D34-9); a stop records nothing |
 * | update | per project: `autoUpdate` on, behind the fetched upstream, identified (RP-14), no operation in progress (D34-3) → task-033's §5 checks on the fresh state, then `merge --ff-only` (D34-2), no hook, no time limit (D34-7) | a refusal or git's failure as `sync.update.lastError`; success clears it |
 *
 * Logs carry the project, the operation, codes, `ended` and the exit status — never git's text
 * (it may quote local paths and URLs).
 */
import type { SyncError } from '@wingfoil-ui/contracts';
import { noHooksArgs, UNATTENDED_TIMEOUT_MS, unattendedEnv } from '../git/transport.js';
import { NO_HOOKS_PATH, noHooksPath } from '../projects/clone.js';
import type { ProcessResult } from '../process/runner.js';
import type { ProjectSnapshot } from '../snapshot/snapshot.js';
import type { Snapshots } from '../snapshot/snapshots.js';
import type { RepoState } from '../snapshot/state.js';
import type { StateStore } from '../state/store.js';
import { identified, type GitTransport, type TransportPlan } from '../writes/transport.js';
import type { SyncGroup, SyncWork } from './scheduler.js';

/** Where the automatic sync logs: codes and kinds only. */
export interface AutoSyncLogger {
  info(object: object, message: string): void;
  warn(object: object, message: string): void;
  error(object: object, message: string): void;
}

/** Options of {@link AutoSync}. */
export interface AutoSyncOptions {
  store: Pick<StateStore, 'projects' | 'settings'>;
  snapshots: Snapshots;
  /** The routes' transport: its plan (the §5 checks) and its message redaction. */
  transport: GitTransport;
  logger: AutoSyncLogger;
  /** The hooks path of unattended runs (default the clone's `NO_HOOKS_PATH`, D34-1). */
  hooksPath?: string;
  /** Time limit of the automatic fetch (default {@link UNATTENDED_TIMEOUT_MS}); tests lower it. */
  timeoutMs?: number;
}

/** A fetch's outcome, shared by the projects of its group. */
type FetchOutcome =
  { kind: 'fetched'; at: Date } | { kind: 'failed'; error: Omit<SyncError, 'at'>; at: Date } | { kind: 'none' };

/** The automatic fetch and update. */
export class AutoSync implements SyncWork {
  /** Set by the stop sequence: no further project, no further process (review R5). */
  private stopping = false;

  constructor(private readonly options: AutoSyncOptions) {}

  /**
   * The server stops: no project is started any more and no merge is spawned — a merge the stop
   * sequence killed during its checkout would leave the working tree half updated (D34-7).
   */
  stop(): void {
    this.stopping = true;
  }

  groups(): SyncGroup[] {
    const listed = new Set(this.options.store.projects().map((p) => p.id));
    const groups = new Map<string, SyncGroup>();
    for (const { pid, snapshot } of this.options.snapshots.openProjects()) {
      if (!listed.has(pid)) continue;
      const group = groups.get(snapshot.lockKey) ?? { key: snapshot.lockKey, pids: [] };
      group.pids.push(pid);
      groups.set(snapshot.lockKey, group);
    }
    return [...groups.values()];
  }

  async sync(group: SyncGroup): Promise<void> {
    let hooksPath: string;
    try {
      hooksPath = await noHooksPath(this.options.hooksPath ?? NO_HOOKS_PATH);
    } catch {
      // Fail closed: without a hooks path that runs nothing, nothing runs unattended.
      this.options.logger.error({ op: 'auto-sync', code: 'hooks-path-unusable' }, 'auto-sync skipped');
      return;
    }
    const fetched = new Map<string, FetchOutcome>();
    for (const pid of group.pids) {
      if (this.stopping) return;
      const snapshot = this.options.snapshots.get(pid);
      if (!snapshot || snapshot.lockKey !== group.key) continue;
      try {
        await this.project(pid, snapshot, hooksPath, fetched);
      } catch (error) {
        // A git read under the lock failed: its message may quote local paths — the kind only.
        const e = error as Error & { exitCode?: number | null };
        this.options.logger.warn(
          {
            project: pid,
            op: 'auto-sync',
            kind: e.name,
            ...(e.exitCode !== undefined ? { exitCode: e.exitCode } : {}),
          },
          'auto-sync failed',
        );
      }
    }
  }

  private async project(
    pid: string,
    snapshot: ProjectSnapshot,
    hooksPath: string,
    fetched: Map<string, FetchOutcome>,
  ): Promise<void> {
    const { transport, logger } = this.options;
    const state = await snapshot.check();
    if (state.remotes.length === 0) return;
    const plan = await transport.plan(snapshot, state, 'fetch');
    if ('refusal' in plan) {
      logger.info({ project: pid, op: 'auto-fetch', code: plan.refusal.code }, 'automatic fetch skipped');
      return;
    }
    const remote = plan.remote ?? '';
    let outcome = fetched.get(remote);
    if (!outcome) {
      if (this.stopping) return;
      outcome = await this.fetch(pid, snapshot, plan, hooksPath);
      fetched.set(remote, outcome);
    }
    const sync = this.options.snapshots.sync;
    if (outcome.kind === 'failed') {
      sync.fetchFailed(pid, outcome.error.message, outcome.at, outcome.error.code);
      return;
    }
    if (outcome.kind === 'none') return;
    sync.fetched(pid, outcome.at);
    // The tracking ref moved: the key moves and `repo` goes out now (spec-010 §2).
    const after = await snapshot.check();
    await this.update(pid, snapshot, after, hooksPath);
  }

  private async fetch(
    pid: string,
    snapshot: ProjectSnapshot,
    plan: Extract<TransportPlan, { args: unknown }>,
    hooksPath: string,
  ): Promise<FetchOutcome> {
    const { transport } = this.options;
    const result = await snapshot.git.transport([...noHooksArgs(hooksPath), ...(plan.args ?? [])], {
      env: unattendedEnv(await transport.sshConfigured(snapshot), transport.environment),
      timeoutMs: this.options.timeoutMs ?? UNATTENDED_TIMEOUT_MS,
    });
    this.logged(pid, 'auto-fetch', result);
    const at = new Date();
    if (result.ended === 'exit' && result.exitCode === 0) return { kind: 'fetched', at };
    // The server stops (or the process could not be watched to its end): not a failure of the remote.
    if (result.ended === 'terminated' || result.ended === 'cancelled') return { kind: 'none' };
    if (result.ended === 'timeout') {
      const message = result.stderr.trim() === '' ? '' : transport.message(snapshot, result, plan.urls);
      return { kind: 'failed', error: { code: 'fetch-timeout', message }, at };
    }
    return { kind: 'failed', error: { message: transport.message(snapshot, result, plan.urls) }, at };
  }

  private async update(pid: string, snapshot: ProjectSnapshot, state: RepoState, hooksPath: string): Promise<void> {
    const { transport, logger, store } = this.options;
    const sync = this.options.snapshots.sync;
    if (!store.settings().autoUpdate || state.behind === 0) return;
    // RP-14: only for a user identified in the team (the team is cached on HEAD and the working tree).
    if (!(await identified(await snapshot.view()))) return;
    if (await snapshot.operationInProgress()) {
      logger.info({ project: pid, op: 'auto-update', code: 'operation-in-progress' }, 'automatic update skipped');
      return;
    }
    const plan = await transport.plan(snapshot, state, 'update', true);
    if ('refusal' in plan) {
      const { code, detail } = plan.refusal;
      if (code === 'no-fetch-target' || code === 'refspec-outside-remotes') return;
      sync.updateFailed(pid, { code, ...(detail ? { detail } : {}) }, state.copy, new Date());
      return;
    }
    if (plan.args === undefined || this.stopping) return;
    const result = await snapshot.git.transport([...noHooksArgs(hooksPath), ...plan.args], {
      env: unattendedEnv(await transport.sshConfigured(snapshot), transport.environment),
      // D34-7: no time limit — a killed checkout leaves the working tree half updated.
      timeoutMs: null,
    });
    this.logged(pid, 'auto-update', result);
    const after = await snapshot.check();
    if (result.ended === 'terminated' || result.ended === 'cancelled') return;
    if (result.ended === 'exit' && result.exitCode === 0) {
      if (after.ahead !== 0 || after.behind !== 0) {
        // D34-2 post-condition: a fast-forward leaves HEAD at the upstream. No update code fits, so
        // it is logged only, and a previous update error is kept (review R4).
        logger.error({ project: pid, op: 'auto-update', code: 'merge-not-fast-forward' }, 'automatic update');
        return;
      }
      sync.updated(pid);
      return;
    }
    sync.updateFailed(
      pid,
      { code: 'git-refused', message: transport.message(snapshot, result, plan.urls) },
      after.copy,
      new Date(),
    );
  }

  private logged(pid: string, op: string, result: ProcessResult): void {
    this.options.logger.info({ project: pid, op, ended: result.ended, exitCode: result.exitCode }, 'git transport');
  }
}
