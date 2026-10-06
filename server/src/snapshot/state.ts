/**
 * The repository state of a project (adr-001 D6, REQ-STATE-01/02): HEAD, the hash of the
 * working-tree status, the effective `user.email` and the paths with local changes. Its `key`
 * (`<HEAD sha>.<status hash>`) is the `X-Repo-State` header of the read responses and the `state`
 * of the `repo` event (spec-004 §5–6).
 */
import type { WorkingTreeStatus } from '../git/git.js';

/** Header of the read responses carrying {@link RepoState.key} (spec-004 §5). */
export const REPO_STATE_HEADER = 'X-Repo-State';

/** One observed state of a project's repository. */
export interface RepoState {
  /** Commit of HEAD (40 zeros before the first commit). */
  head: string;
  /** Hash of the working-tree status (16 hex digits). */
  statusHash: string;
  /** `<head>.<statusHash>`. */
  key: string;
  /** Effective `git config user.email` (repository, else global), or `undefined`. */
  email: string | undefined;
  /**
   * Paths, relative to the project root, of every entry of the status — modified, staged,
   * untracked, conflicted, both sides of a rename: an element whose file is listed has local
   * changes (REQ-STATE-01). Entries outside the project folder are left out.
   */
  changed: ReadonlySet<string>;
}

/** The state from a status, the identity and the project's prefix in its repository. */
export function repoState(status: WorkingTreeStatus, email: string | undefined, prefix: string): RepoState {
  const changed = new Set<string>();
  const add = (p: string | undefined): void => {
    if (p !== undefined && p.startsWith(prefix)) changed.add(p.slice(prefix.length));
  };
  for (const entry of status.entries) {
    add(entry.path);
    add(entry.from);
  }
  return { head: status.head, statusHash: status.hash, key: `${status.head}.${status.hash}`, email, changed };
}

/** True when both states are the same for the cache: same HEAD, status and identity. */
export function sameState(a: RepoState | undefined, b: RepoState): boolean {
  return a !== undefined && a.key === b.key && a.email === b.email;
}

/** Value of the `X-Repo-State` header for `state`. */
export function repoStateHeader(state: RepoState): string {
  return state.key;
}
