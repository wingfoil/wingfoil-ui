/**
 * The sync status of spec-010 §3 (task-033): per project id, in memory since the server start
 * (D33-10) — the last successful fetch, the last fetch error and the last refused or failed
 * update. Never logged nor stored: git's messages may echo a URL (they are redacted, D33-5).
 *
 * `repo {pid, state}` is sent with the unchanged state when a last error is set, changed or
 * cleared (spec-010 §2, RP-40) — never for a new `lastSuccessAt` alone. An update error is kept
 * until the next successful update or a change of the copy state (spec-010 §5), which sends its
 * own `repo` event (the key moves).
 */
import type { RepositoryCopy, RepositoryStatus, RepositorySync, UpdateSyncError } from '@wingfoil-ui/contracts';
import type { EventBus } from '../events/bus.js';
import type { RepoState } from '../snapshot/state.js';

interface Entry {
  lastSuccessAt: string | null;
  fetchError: { message: string; at: string } | null;
  updateError: UpdateSyncError | null;
  /** The copy when the update error was recorded. */
  updateCopy: RepositoryCopy | undefined;
}

/** What {@link SyncStatus} needs. */
export interface SyncStatusOptions {
  bus: EventBus;
  /** The last observed state key of `pid` (the `state` of the `repo` event), if any. */
  stateOf: (pid: string) => string | undefined;
}

/** ISO 8601 UTC to the second. */
export function isoSeconds(date: Date): string {
  return date.toISOString().replace(/\.\d+Z$/, 'Z');
}

/** The sync status of the server's projects. */
export class SyncStatus {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly options: SyncStatusOptions) {}

  /** The sync status of `pid` as `GET /api/p/:pid` shows it in a state whose copy is `copy`. */
  of(pid: string, copy: RepositoryCopy): RepositorySync {
    const entry = this.entries.get(pid);
    if (entry?.updateError && entry.updateCopy !== copy) {
      // The copy state changed since the update was refused: the error is stale (spec-010 §5).
      entry.updateError = null;
      entry.updateCopy = undefined;
    }
    return {
      fetch: { lastSuccessAt: entry?.lastSuccessAt ?? null, lastError: entry?.fetchError ?? null },
      update: { lastError: entry?.updateError ?? null },
    };
  }

  /** A fetch succeeded at `at`: `lastSuccessAt` set, the fetch error cleared. */
  fetched(pid: string, at: Date): void {
    const entry = this.entry(pid);
    entry.lastSuccessAt = isoSeconds(at);
    if (entry.fetchError) {
      entry.fetchError = null;
      this.changed(pid);
    }
  }

  /** A fetch failed with git's (redacted) `message`. */
  fetchFailed(pid: string, message: string, at: Date): void {
    const entry = this.entry(pid);
    const same = entry.fetchError?.message === message;
    entry.fetchError = { message, at: isoSeconds(at) };
    if (!same) this.changed(pid);
  }

  /** An update was refused (spec-010 §5) or failed (`git-refused`) in a state whose copy is `copy`. */
  updateFailed(pid: string, error: Omit<UpdateSyncError, 'at'>, copy: RepositoryCopy, at: Date): void {
    const entry = this.entry(pid);
    const previous = entry.updateError;
    const same =
      previous !== null &&
      previous.code === error.code &&
      previous.message === error.message &&
      JSON.stringify(previous.detail) === JSON.stringify(error.detail);
    entry.updateError = { ...error, at: isoSeconds(at) };
    entry.updateCopy = copy;
    if (!same) this.changed(pid);
  }

  /** An update succeeded (or had nothing to do): the update error cleared. */
  updated(pid: string): void {
    const entry = this.entries.get(pid);
    if (!entry?.updateError) return;
    entry.updateError = null;
    entry.updateCopy = undefined;
    this.changed(pid);
  }

  /** The project left the list. */
  forget(pid: string): void {
    this.entries.delete(pid);
  }

  private entry(pid: string): Entry {
    let entry = this.entries.get(pid);
    if (!entry) {
      entry = { lastSuccessAt: null, fetchError: null, updateError: null, updateCopy: undefined };
      this.entries.set(pid, entry);
    }
    return entry;
  }

  private changed(pid: string): void {
    const state = this.options.stateOf(pid);
    if (state !== undefined) this.options.bus.publish({ event: 'repo', data: { pid, state } });
  }
}

/** `repository` of `GET /api/p/:pid` and of the git routes' 200 (spec-010 §3). */
export function repositoryStatus(state: RepoState, sync: RepositorySync): RepositoryStatus {
  return {
    state: state.key,
    head: state.head,
    localChanges: state.changed.size,
    branch: state.branch,
    copy: state.copy,
    ahead: state.ahead,
    behind: state.behind,
    upstream: state.upstream,
    sync,
  };
}
