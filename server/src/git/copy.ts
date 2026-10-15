/**
 * The copy state of spec-010 §1 (REQ-STATE-04, task-033), from the status headers of the existing
 * status read, the remotes `git remote` lists and the branch's `branch.<b>.remote`; the fetch
 * target of §4 (RP-36) and the push's merge ref (D33-8). Pure: no process.
 *
 * | `copy` | First match |
 * |--------|-------------|
 * | `detached` | `# branch.head (detached)` |
 * | `no-remote` | `git remote` lists none |
 * | `no-upstream` | no remote upstream (none, or a local one: `branch.<b>.remote = .`), or no `# branch.ab` (the tracking ref is missing, RP-32, RP-35) |
 * | `diverged` | ahead > 0 and behind > 0 |
 * | `behind` | behind > 0 |
 * | `ahead` | ahead > 0 |
 * | `in-sync` | otherwise |
 */
import type { RepositoryCopy } from '@wingfoil-ui/contracts';

/** What the copy is computed from. */
export interface CopyInputs {
  /** `# branch.head`: the branch, `null` when detached (`undefined`: not printed, read as detached). */
  branch?: string | null;
  /** `# branch.upstream`. */
  upstream?: string;
  /** `# branch.ab`. */
  ab?: { ahead: number; behind: number };
  /** `git remote`. */
  remotes: readonly string[];
  /** `git config --get branch.<branch>.remote`, read when an upstream is printed. */
  branchRemote?: string;
}

/** The copy against its remote upstream. */
export interface Copy {
  copy: RepositoryCopy;
  /** 0 when unknown. */
  ahead: number;
  behind: number;
  /** The remote upstream's name (also in `no-upstream` when only its tracking ref is missing), else `null`. */
  upstream: string | null;
  /** The remote of the remote upstream (a name `git remote` lists), else `null`. */
  upstreamRemote: string | null;
}

/** The copy state of spec-010 §1. */
export function copyOf(inputs: CopyInputs): Copy {
  const none = { ahead: 0, behind: 0, upstream: null, upstreamRemote: null };
  if (inputs.branch === null || inputs.branch === undefined) return { copy: 'detached', ...none };
  if (inputs.remotes.length === 0) return { copy: 'no-remote', ...none };
  // A remote upstream: its remote is a listed remote — never guessed from the name's prefix.
  const remote = inputs.branchRemote;
  if (inputs.upstream === undefined || remote === undefined || !inputs.remotes.includes(remote)) {
    return { copy: 'no-upstream', ...none };
  }
  const named = { upstream: inputs.upstream, upstreamRemote: remote };
  if (!inputs.ab) return { copy: 'no-upstream', ahead: 0, behind: 0, ...named };
  const { ahead, behind } = inputs.ab;
  const copy: RepositoryCopy =
    ahead > 0 && behind > 0 ? 'diverged' : behind > 0 ? 'behind' : ahead > 0 ? 'ahead' : 'in-sync';
  return { copy, ahead, behind, ...named };
}

/**
 * The fetch target of spec-010 §4 (RP-36): the remote upstream's remote; with none, the only remote,
 * else `origin` when listed; `undefined` → `no-fetch-target`.
 */
export function fetchTarget(copy: Copy, remotes: readonly string[]): string | undefined {
  if (copy.upstreamRemote !== null) return copy.upstreamRemote;
  if (remotes.length === 1) return remotes[0];
  return remotes.includes('origin') ? 'origin' : undefined;
}

/**
 * Whether `ref` is a branch ref a push may name as its destination (D33-8): `refs/heads/<name>`
 * with no `:`, `+`, `*`, `?`, `[`, `\`, `^`, `~`, space or control character, no `..` or `@{`, no
 * empty, `.`-led or `.lock` component, not ending in `/` or `.`. Anything else could be read by git
 * as two refs or a forced update.
 */
export function isMergeRef(ref: string): boolean {
  const match = /^refs\/heads\/(.+)$/s.exec(ref);
  if (!match) return false;
  const name = match[1]!;
  // eslint-disable-next-line no-control-regex -- control characters are what is refused
  if (/[\u0000- \u007f:+*?[\\^~]/.test(name)) return false;
  if (name.includes('..') || name.includes('@{') || name === '@') return false;
  if (name.endsWith('/') || name.endsWith('.')) return false;
  return name.split('/').every((part) => part !== '' && !part.startsWith('.') && !part.endsWith('.lock'));
}

/** The copy states that block a governed write (spec-004 §4 row 8, REQ-STATE-04). */
export function blocksWrites(copy: RepositoryCopy): boolean {
  return copy === 'behind' || copy === 'diverged' || copy === 'detached';
}
