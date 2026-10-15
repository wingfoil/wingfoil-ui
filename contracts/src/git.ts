/**
 * Git sync (spec-010, v0.2, task-033): the repository status of `GET /api/p/:pid`
 * (`contracts/api/repository.schema.json`), the project conditions, and the bodies of
 * `POST /api/p/:pid/git/fetch`, `/git/update`, `/git/push` (`git.response.schema.json`,
 * `git.refusal.schema.json`).
 */

/** The copy against its remote upstream (spec-010 §1). */
export type RepositoryCopy = 'in-sync' | 'ahead' | 'behind' | 'diverged' | 'detached' | 'no-remote' | 'no-upstream';

/** A project condition that holds (spec-001 §6, spec-010 §7). */
export type ProjectCondition = 'has-remote';

/** A git route. */
export type GitOperation = 'fetch' | 'update' | 'push';

/** The 409 refusals of the git routes before any transport process (spec-010 §5; `remote-not-owned`: D33-1). */
export type GitTransportRefusalCode =
  | 'no-remote'
  | 'no-fetch-target'
  | 'detached-head'
  | 'no-upstream'
  | 'diverged'
  | 'local-changes-in-the-way'
  | 'remote-not-owned';

/** Every code a git route answers with (`git.refusal.schema.json`). */
export type GitRefusalCode =
  | 'forbidden-origin'
  | 'unauthenticated'
  | 'not-found'
  | 'invalid-request'
  | 'not-in-team'
  | GitTransportRefusalCode
  | 'git-refused'
  | 'internal';

/** The last failed fetch: git's message (local paths redacted) and when. */
export interface SyncError {
  message: string;
  /** ISO 8601 UTC. */
  at: string;
}

/** The last refused or failed update (manual or automatic). */
export interface UpdateSyncError {
  code: Exclude<GitTransportRefusalCode, 'no-fetch-target'> | 'git-refused';
  /** `local-changes-in-the-way`: the files in the way, relative to the project. */
  detail?: { files: string[] };
  /** `git-refused`: git's message (local paths redacted). */
  message?: string;
  at: string;
}

/** The sync status kept in memory since the server start (spec-010 §3). */
export interface RepositorySync {
  fetch: { lastSuccessAt: string | null; lastError: SyncError | null };
  update: { lastError: UpdateSyncError | null };
}

/** `repository` of `GET /api/p/:pid` (spec-010 §3). */
export interface RepositoryStatus {
  /** The `X-Repo-State` value. */
  state: string;
  /** HEAD commit (40 zeros before the first commit). */
  head: string;
  /** Number of entries of the working-tree status (files with local changes). */
  localChanges: number;
  /** The branch checked out; `null` when HEAD is detached. */
  branch: string | null;
  copy: RepositoryCopy;
  /** Commits ahead of / behind the last fetched upstream; 0 when unknown. */
  ahead: number;
  behind: number;
  /** The remote upstream's name (`origin/main`), also when its tracking ref is missing; else `null`. */
  upstream: string | null;
  sync: RepositorySync;
}

/** 200 of a git route. */
export interface GitResponse {
  repository: RepositoryStatus;
}
