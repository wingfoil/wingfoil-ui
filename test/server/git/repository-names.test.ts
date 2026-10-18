// task-040 review round 4 (bug-017, S4-1): a branch and an upstream name git allows may hold a
// bidi control (U+202E); the repository status the API sends carries them escaped, like a file name
// (`neutralise`), while the server's own git work keeps the raw names.
import { describe, expect, it } from 'vitest';
import { repositoryStatus } from '../../../server/src/git/sync-status.js';

const RLO = String.fromCharCode(0x202e);
const SYNC = { fetch: { lastSuccessAt: null, lastError: null }, update: { lastError: null } };

describe('repositoryStatus — git-given names escaped', () => {
  it('a branch and an upstream with U+202E come out as visible escapes', () => {
    const state = {
      key: 'k',
      head: 'h',
      changed: new Map(),
      branch: `feat${RLO}gpj.exe`,
      copy: 'no-upstream',
      ahead: 0,
      behind: 0,
      upstream: `origin/feat${RLO}gpj.exe`,
    };
    const status = repositoryStatus(state as never, SYNC);
    expect(status.branch).toBe('feat\\u202egpj.exe');
    expect(status.upstream).toBe('origin/feat\\u202egpj.exe');
  });

  it('a detached HEAD and no upstream stay null', () => {
    const state = {
      key: 'k',
      head: 'h',
      changed: new Map(),
      branch: null,
      copy: 'detached',
      ahead: 0,
      behind: 0,
      upstream: null,
    };
    const status = repositoryStatus(state as never, SYNC);
    expect(status.branch).toBeNull();
    expect(status.upstream).toBeNull();
  });
});
