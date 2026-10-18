/**
 * What the sidebar's git status shows (task-039; spec-010 §3, §7; decisions D39-6 … D39-9), from
 * the project header's `repository` and `conditions` — pure, so every state is unit-tested:
 *
 * - the head line: the branch (none on a detached HEAD) and the 7-character hash (none before the
 *   first commit), and the number of files with local changes — always shown (spec-010 §7);
 * - the sync part only while `has-remote` holds: the copy line, the last fetch error with the time
 *   of the last success (the only place that time is shown: a successful fetch that moves nothing
 *   sends no `repo`, RP-40, so a permanent time would go stale — D39-9), and the last update error;
 * - the actions (task-040, D40-1, D40-3): *Update* while the copy is behind its upstream (behind or
 *   diverged: the server's refusal of a diverged copy names the terminal commands), *Push* with the
 *   number of commits to push while the copy is only ahead (whatever `autoPush` says: a failed
 *   auto-push is retried with it), both read-only for a user who is not one member (RP-14: the
 *   server refuses them with 403; *Fetch* stays offered).
 */
import type {
  ProjectCondition,
  RepositoryCopy,
  RepositoryStatus,
  SyncError,
  UpdateSyncError,
} from '@wingfoil-ui/contracts';

/** The condition that shows the sync controls (spec-010 §7). */
const HAS_REMOTE: ProjectCondition = 'has-remote';

/** HEAD before the first commit (`repository.head`). */
const NO_COMMIT = /^0+$/;

/** The copy against its upstream, as the sidebar words it (D39-7). */
export type CopyLine =
  | { kind: 'inSync' }
  | { kind: 'ahead'; ahead: number }
  | { kind: 'behind'; behind: number }
  | { kind: 'diverged'; ahead: number; behind: number }
  | { kind: 'noUpstream'; upstream: string | null }
  /** A detached HEAD: the head line says it all. */
  | { kind: 'none' };

/** The last failed fetch. */
export interface FetchErrorView {
  code?: NonNullable<SyncError['code']>;
  /** Git's message (local paths redacted by the server), possibly empty. */
  message: string;
  lastSuccessAt: string | null;
}

/** What the user can start from the git status besides *Fetch* (D40-1, D40-3). */
export interface SyncActions {
  update: boolean;
  /** "N commits to push" with *Push*, or none. */
  push: { commits: number } | null;
  /** Update and Push shown but disabled: the user is not one member of the team. */
  readOnly: boolean;
}

/** The sync part of the git status. */
export interface SyncView {
  line: CopyLine;
  fetchError: FetchErrorView | null;
  updateError: UpdateSyncError | null;
  actions: SyncActions;
}

/** Everything the git status shows. */
export interface GitStatusView {
  head: { branch: string | null; commit: string | null };
  localChanges: number;
  /** `null` without `has-remote`: no count, no sync control (Y-04.1, S-11.2). */
  sync: SyncView | null;
}

/** The copy line of each copy state; `no-remote` never reaches it (`has-remote` is false then). */
const LINES: Record<RepositoryCopy, (r: RepositoryStatus) => CopyLine> = {
  'in-sync': () => ({ kind: 'inSync' }),
  ahead: (r) => ({ kind: 'ahead', ahead: r.ahead }),
  behind: (r) => ({ kind: 'behind', behind: r.behind }),
  diverged: (r) => ({ kind: 'diverged', ahead: r.ahead, behind: r.behind }),
  'no-upstream': (r) => ({ kind: 'noUpstream', upstream: r.upstream }),
  detached: () => ({ kind: 'none' }),
  'no-remote': () => ({ kind: 'none' }),
};

/** The copy states behind their upstream: *Update* (D40-1). */
const UPDATABLE: ReadonlySet<RepositoryCopy> = new Set<RepositoryCopy>(['behind', 'diverged']);

/** The copy states that are only ahead of their upstream: *Push* (D40-1). */
const PUSHABLE: ReadonlySet<RepositoryCopy> = new Set<RepositoryCopy>(['ahead']);

/** The git status of `repository` under `conditions`; `member`: the user is one member of the team. */
export function gitStatusView(
  repository: RepositoryStatus,
  conditions: readonly ProjectCondition[],
  member = true,
): GitStatusView {
  const head = {
    branch: repository.branch,
    commit: NO_COMMIT.test(repository.head) ? null : repository.head.slice(0, 7),
  };
  if (!conditions.includes(HAS_REMOTE)) return { head, localChanges: repository.localChanges, sync: null };
  const { fetch, update } = repository.sync;
  const fetchError: FetchErrorView | null = fetch.lastError
    ? {
        ...(fetch.lastError.code ? { code: fetch.lastError.code } : {}),
        message: fetch.lastError.message,
        lastSuccessAt: fetch.lastSuccessAt,
      }
    : null;
  return {
    head,
    localChanges: repository.localChanges,
    sync: {
      line: LINES[repository.copy](repository),
      fetchError,
      updateError: update.lastError,
      actions: {
        update: UPDATABLE.has(repository.copy) && repository.behind > 0,
        push: PUSHABLE.has(repository.copy) && repository.ahead > 0 ? { commits: repository.ahead } : null,
        readOnly: !member,
      },
    },
  };
}

/** When the last successful fetch was, for the failure line (D39-8). */
export type LastFetched = { when: 'none' } | { when: 'today' | 'other'; at: Date };

/** `lastSuccessAt` against `now`: today (time only), another day (date and time), or none. */
export function lastFetched(lastSuccessAt: string | null, now: Date = new Date()): LastFetched {
  if (lastSuccessAt === null) return { when: 'none' };
  const at = new Date(lastSuccessAt);
  const today =
    at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth() && at.getDate() === now.getDate();
  return { when: today ? 'today' : 'other', at };
}
