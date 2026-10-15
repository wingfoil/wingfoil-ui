// spec-010 §1, §4 (REQ-STATE-04, RP-32, RP-35, RP-36; task-033 D33-8) — the copy state per row from
// recorded porcelain v2 headers (git 2.43), the fetch target and the push's merge ref.
import { describe, expect, it } from 'vitest';
import { blocksWrites, copyOf, fetchTarget, isMergeRef, type CopyInputs } from '../../../server/src/git/copy.js';
import { parseStatus } from '../../../server/src/git/git.js';

const SHA = 'e73dc3f11b181c6562e5b9bea3bf5ab39eb663f1';
/** The inputs of a recorded `git status --porcelain=v2 --branch -z` with `git remote` and `branch.<b>.remote`. */
function recorded(headers: string[], remotes: string[], branchRemote?: string): CopyInputs {
  const status = parseStatus([`# branch.oid ${SHA}`, ...headers].join('\0') + '\0');
  return {
    remotes,
    ...(status.branch !== undefined ? { branch: status.branch } : {}),
    ...(status.upstream !== undefined ? { upstream: status.upstream } : {}),
    ...(status.ab ? { ab: status.ab } : {}),
    ...(branchRemote !== undefined ? { branchRemote } : {}),
  };
}

describe('copy state — one row of spec-010 §1 each (first match wins)', () => {
  it.each<[string, CopyInputs, ReturnType<typeof copyOf>]>([
    [
      'detached (even with remotes)',
      recorded(['# branch.head (detached)'], ['origin']),
      { copy: 'detached', ahead: 0, behind: 0, upstream: null, upstreamRemote: null },
    ],
    [
      'no remote',
      recorded(['# branch.head main'], []),
      { copy: 'no-remote', ahead: 0, behind: 0, upstream: null, upstreamRemote: null },
    ],
    [
      'no upstream configured',
      recorded(['# branch.head main'], ['origin']),
      { copy: 'no-upstream', ahead: 0, behind: 0, upstream: null, upstreamRemote: null },
    ],
    [
      'a local upstream (branch.<b>.remote = .) prints branch.ab but counts as none',
      recorded(['# branch.head loc', '# branch.upstream main', '# branch.ab +0 -0'], ['origin'], '.'),
      { copy: 'no-upstream', ahead: 0, behind: 0, upstream: null, upstreamRemote: null },
    ],
    [
      'an upstream whose remote is not listed',
      recorded(['# branch.head main', '# branch.upstream gone/main', '# branch.ab +0 -0'], ['origin'], 'gone'),
      { copy: 'no-upstream', ahead: 0, behind: 0, upstream: null, upstreamRemote: null },
    ],
    [
      'an upstream without tracking ref (never fetched, or pruned: RP-32, RP-35) names the upstream',
      recorded(['# branch.head main', '# branch.upstream origin/main'], ['origin'], 'origin'),
      { copy: 'no-upstream', ahead: 0, behind: 0, upstream: 'origin/main', upstreamRemote: 'origin' },
    ],
    [
      'diverged',
      recorded(['# branch.head main', '# branch.upstream origin/main', '# branch.ab +2 -3'], ['origin'], 'origin'),
      { copy: 'diverged', ahead: 2, behind: 3, upstream: 'origin/main', upstreamRemote: 'origin' },
    ],
    [
      'behind',
      recorded(['# branch.head main', '# branch.upstream origin/main', '# branch.ab +0 -3'], ['origin'], 'origin'),
      { copy: 'behind', ahead: 0, behind: 3, upstream: 'origin/main', upstreamRemote: 'origin' },
    ],
    [
      'ahead',
      recorded(['# branch.head main', '# branch.upstream origin/main', '# branch.ab +1 -0'], ['origin'], 'origin'),
      { copy: 'ahead', ahead: 1, behind: 0, upstream: 'origin/main', upstreamRemote: 'origin' },
    ],
    [
      'in sync, on a remote not named after the prefix of the upstream (never guessed from the name)',
      recorded(
        ['# branch.head main', '# branch.upstream up/stream/main', '# branch.ab +0 -0'],
        ['up/stream', 'up'],
        'up/stream',
      ),
      { copy: 'in-sync', ahead: 0, behind: 0, upstream: 'up/stream/main', upstreamRemote: 'up/stream' },
    ],
  ])('%s', (_label, inputs, expected) => {
    expect(copyOf(inputs)).toEqual(expected);
  });

  it('reads a repository without commits as above, ahead = behind = 0', () => {
    const status = parseStatus('# branch.oid (initial)\0# branch.head main\0');
    expect(copyOf({ branch: status.branch!, remotes: ['origin'] }).copy).toBe('no-upstream');
    expect(copyOf({ branch: status.branch!, remotes: [] }).copy).toBe('no-remote');
  });

  it('parses the branch headers (a branch name with spaces is not possible; one with slashes is)', () => {
    const status = parseStatus(
      `# branch.oid ${SHA}\0# branch.head feat/x\0# branch.upstream origin/feat/x\0# branch.ab +12 -0\0`,
    );
    expect(status).toMatchObject({ branch: 'feat/x', upstream: 'origin/feat/x', ab: { ahead: 12, behind: 0 } });
    expect(parseStatus(`# branch.oid ${SHA}\0# branch.head (detached)\0`).branch).toBeNull();
  });

  it('blocks governed writes on behind, diverged and detached only (spec-004 §4 row 8)', () => {
    expect(
      (['in-sync', 'ahead', 'behind', 'diverged', 'detached', 'no-remote', 'no-upstream'] as const).filter(
        blocksWrites,
      ),
    ).toEqual(['behind', 'diverged', 'detached']);
  });
});

describe('fetch target (spec-010 §4, RP-36)', () => {
  const copy = (upstreamRemote: string | null) => ({
    copy: 'in-sync' as const,
    ahead: 0,
    behind: 0,
    upstream: null,
    upstreamRemote,
  });
  it.each<[string, string | null, string[], string | undefined]>([
    ["the remote upstream's remote", 'up', ['origin', 'up'], 'up'],
    ['the only remote', null, ['mine'], 'mine'],
    ['origin among several', null, ['a', 'origin', 'b'], 'origin'],
    ['none: several remotes, none named origin', null, ['a', 'b'], undefined],
    ['none: no remote', null, [], undefined],
  ])('%s', (_label, upstreamRemote, remotes, expected) => {
    expect(fetchTarget(copy(upstreamRemote), remotes)).toBe(expected);
  });
});

describe('merge ref of a push (D33-8)', () => {
  it.each(['refs/heads/main', 'refs/heads/feat/x-1', 'refs/heads/release/v0.2'])('accepts %s', (ref) => {
    expect(isMergeRef(ref)).toBe(true);
  });

  it.each([
    'main',
    'refs/tags/v1',
    'refs/heads/',
    'refs/heads/a:refs/heads/b',
    '+refs/heads/main',
    'refs/heads/+main',
    'refs/heads/a b',
    'refs/heads/a\nb',
    'refs/heads/a..b',
    'refs/heads/a@{1}',
    'refs/heads/*',
    'refs/heads/a?',
    'refs/heads/a[b',
    'refs/heads/a\\b',
    'refs/heads/a^',
    'refs/heads/a~1',
    'refs/heads/a/',
    'refs/heads/a.',
    'refs/heads/a.lock',
    'refs/heads/.hidden',
    'refs/heads/a//b',
    'refs/heads/@',
  ])('refuses %j', (ref) => {
    expect(isMergeRef(ref)).toBe(false);
  });
});
