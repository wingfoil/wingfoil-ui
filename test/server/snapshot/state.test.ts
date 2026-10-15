// REQ-STATE-01/02, spec-004 §5 — the repository state: its key (`X-Repo-State`), the paths with
// local changes relative to the project folder (a project in a sub-folder of its repository), and
// when two states are the same for the cache.
import { describe, expect, it } from 'vitest';
import type { WorkingTreeStatus } from '../../../server/src/git/git.js';
import { REPO_STATE_HEADER, repoState, repoStateHeader, sameState } from '../../../server/src/snapshot/state.js';

const HEAD = 'c'.repeat(40);
const status: WorkingTreeStatus = {
  head: HEAD,
  hash: '0123456789abcdef',
  entries: [
    { code: '.M', path: 'proj/docs/memory/task/a.md' },
    { code: 'R.', path: 'proj/docs/b-new.md', from: 'proj/docs/b.md' },
    { code: '??', path: 'other/c.md' },
    { code: '??', path: 'project-two/d.md' },
  ],
};

describe('repoState', () => {
  it('keys the state `<HEAD>.<status hash>` and keeps the identity', () => {
    const state = repoState(status, 'alex@example.test', '');
    // The key's status hash covers the working tree and the copy's inputs (spec-010 §2, task-033);
    // `contentKey` the working tree only (D33-6).
    expect(state.key).toMatch(new RegExp(`^${HEAD}\\.[0-9a-f]{16}$`));
    expect(state.contentKey).toBe(`${HEAD}.0123456789abcdef`);
    expect(repoStateHeader(state)).toBe(state.key);
    expect(REPO_STATE_HEADER).toBe('X-Repo-State');
    expect(state.email).toBe('alex@example.test');
  });

  it('lists the changed paths relative to the project folder, both sides of a rename, nothing outside', () => {
    const state = repoState(status, undefined, 'proj/');
    expect([...state.changed].sort()).toEqual(['docs/b-new.md', 'docs/b.md', 'docs/memory/task/a.md']);
    expect([...repoState(status, undefined, '').changed]).toHaveLength(5);
  });
});

describe('sameState', () => {
  it('is false for no previous state, a new key or a new identity', () => {
    const a = repoState(status, 'alex@example.test', '');
    expect(sameState(undefined, a)).toBe(false);
    expect(sameState(a, repoState(status, 'alex@example.test', ''))).toBe(true);
    expect(sameState(a, repoState(status, 'morgan@example.test', ''))).toBe(false);
    expect(sameState(a, repoState({ ...status, hash: 'ffffffffffffffff' }, 'alex@example.test', ''))).toBe(false);
  });
});
