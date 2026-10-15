/**
 * The repository state of a project (adr-001 D6, REQ-STATE-01/02): HEAD, the hash of the
 * working-tree status, the effective `user.email`, the paths with local changes and, from v0.2,
 * the copy against its remote (spec-010 §1). Its `key` (`<HEAD sha>.<status hash>`) is the
 * `X-Repo-State` header of the read responses and the `state` of the `repo` event (spec-004 §5–6);
 * the status hash covers the copy's inputs too — branch, upstream, ahead/behind, the remote list and
 * the upstream's remote (spec-010 §2) — while `contentKey` covers only what the CLI can see (HEAD
 * and the working tree, task-033 D33-6).
 */
import { createHash } from 'node:crypto';
import { copyOf, type Copy, type CopyInputs } from '../git/copy.js';
import type { WorkingTreeStatus } from '../git/git.js';

/** Header of the read responses carrying {@link RepoState.key} (spec-004 §5). */
export const REPO_STATE_HEADER = 'X-Repo-State';

/** One observed state of a project's repository, with its copy (spec-010 §1). */
export interface RepoState extends Copy {
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
  /** Every path of the status, relative to the repository's top level (spec-010 §5). */
  paths: ReadonlySet<string>;
  /** `<head>.<working-tree hash>`: the key of the CLI reads (D33-6). */
  contentKey: string;
  /** The branch checked out, `null` when detached. */
  branch: string | null;
  /** The remotes `git remote` lists. */
  remotes: readonly string[];
}

/** The remote part of a check: `git remote` and the branch's `branch.<b>.remote` (spec-010 §1). */
export type RemoteInputs = Pick<CopyInputs, 'remotes' | 'branchRemote'>;

/**
 * The state from a status, the identity, the project's prefix in its repository and the remote
 * inputs (none: no remote). `status.hash` is the working-tree hash; the key's status hash adds
 * the copy's inputs (spec-010 §2).
 */
export function repoState(
  status: WorkingTreeStatus,
  email: string | undefined,
  prefix: string,
  remote: RemoteInputs = { remotes: [] },
): RepoState {
  const changed = new Set<string>();
  const paths = new Set<string>();
  const add = (p: string | undefined): void => {
    if (p === undefined) return;
    paths.add(p);
    if (p.startsWith(prefix)) changed.add(p.slice(prefix.length));
  };
  for (const entry of status.entries) {
    add(entry.path);
    add(entry.from);
  }
  const remotes = [...remote.remotes];
  const branch = status.branch ?? null;
  const copy = copyOf({
    branch,
    remotes,
    ...(status.upstream !== undefined ? { upstream: status.upstream } : {}),
    ...(status.ab ? { ab: status.ab } : {}),
    ...(remote.branchRemote !== undefined ? { branchRemote: remote.branchRemote } : {}),
  });
  const inputs = JSON.stringify([
    branch,
    status.upstream ?? null,
    status.ab ?? null,
    [...remotes].sort(),
    remote.branchRemote ?? null,
  ]);
  const statusHash = createHash('sha256').update(`${status.hash}\0${inputs}`).digest('hex').slice(0, 16);
  return {
    head: status.head,
    statusHash,
    key: `${status.head}.${statusHash}`,
    contentKey: `${status.head}.${status.hash}`,
    email,
    changed,
    paths,
    branch,
    remotes,
    ...copy,
  };
}

/** True when both states are the same for the cache: same HEAD, status and identity. */
export function sameState(a: RepoState | undefined, b: RepoState): boolean {
  return a !== undefined && a.key === b.key && a.email === b.email;
}

/** Value of the `X-Repo-State` header for `state`. */
export function repoStateHeader(state: RepoState): string {
  return state.key;
}
