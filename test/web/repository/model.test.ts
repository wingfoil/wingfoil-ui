// task-039 — what the sidebar's git status shows (`web/src/repository/model.ts`, spec-010 §3, §7;
// D39-6 … D39-9): the head line, the local changes, the copy line per copy state, the failure
// lines, all of the sync part only while `has-remote` holds.
import type { RepositoryStatus } from '@wingfoil-ui/contracts';
import { describe, expect, it } from 'vitest';
import { gitStatusView, lastFetched } from '../../../web/src/repository/model.js';

const HEAD = '41c0e2a' + '9'.repeat(33);

function repo(over: Partial<RepositoryStatus> = {}): RepositoryStatus {
  return {
    state: 's1',
    head: HEAD,
    localChanges: 0,
    branch: 'main',
    copy: 'in-sync',
    ahead: 0,
    behind: 0,
    upstream: 'origin/main',
    sync: { fetch: { lastSuccessAt: null, lastError: null }, update: { lastError: null } },
    ...over,
  };
}

describe('head line and local changes (Y-01.1, Y-01.3, Y-04.1)', () => {
  it('names the branch and the short hash', () => {
    expect(gitStatusView(repo(), ['has-remote']).head).toEqual({ branch: 'main', commit: '41c0e2a' });
  });

  it('a detached HEAD has no branch, only the short hash', () => {
    expect(gitStatusView(repo({ branch: null, copy: 'detached' }), ['has-remote']).head).toEqual({
      branch: null,
      commit: '41c0e2a',
    });
  });

  it('no commit yet: no hash', () => {
    expect(gitStatusView(repo({ head: '0'.repeat(40) }), []).head.commit).toBeNull();
  });

  it('local changes are kept with or without a remote', () => {
    expect(gitStatusView(repo({ localChanges: 3 }), ['has-remote']).localChanges).toBe(3);
    const none = gitStatusView(repo({ localChanges: 3, copy: 'no-remote', upstream: null }), []);
    expect(none.localChanges).toBe(3);
    expect(none.sync).toBeNull();
  });
});

describe('copy line (spec-010 §1, D39-7)', () => {
  it.each([
    [{ copy: 'in-sync' }, { kind: 'inSync' }],
    [{ copy: 'ahead', ahead: 1 }, { kind: 'ahead', ahead: 1 }],
    [{ copy: 'behind', behind: 2 }, { kind: 'behind', behind: 2 }],
    [{ copy: 'diverged', ahead: 1, behind: 2 }, { kind: 'diverged', ahead: 1, behind: 2 }],
    [{ copy: 'no-upstream', upstream: null }, { kind: 'noUpstream', upstream: null }],
    [{ copy: 'no-upstream', upstream: 'origin/feature' }, { kind: 'noUpstream', upstream: 'origin/feature' }],
    [{ copy: 'detached', branch: null }, { kind: 'none' }],
  ] as const)('%o → %o', (over, line) => {
    expect(gitStatusView(repo(over), ['has-remote']).sync?.line).toEqual(line);
  });

  it('without has-remote there is no sync part, whatever the copy says (spec-010 §7)', () => {
    expect(gitStatusView(repo({ copy: 'behind', behind: 2 }), []).sync).toBeNull();
  });
});

describe('failure lines (Y-03.1, Y-03.2, D39-6)', () => {
  it('a failed fetch carries git message, code and the last success', () => {
    const v = gitStatusView(
      repo({
        sync: {
          fetch: {
            lastSuccessAt: '2026-10-16T10:02:00.000Z',
            lastError: { message: 'fatal: unable to access', at: '2026-10-16T10:05:00.000Z' },
          },
          update: { lastError: null },
        },
      }),
      ['has-remote'],
    );
    expect(v.sync?.fetchError).toEqual({ message: 'fatal: unable to access', lastSuccessAt: '2026-10-16T10:02:00.000Z' });
    expect(v.sync?.updateError).toBeNull();
  });

  it('a coded fetch error keeps its code', () => {
    const v = gitStatusView(
      repo({
        sync: {
          fetch: { lastSuccessAt: null, lastError: { code: 'config-in-worktree', message: '', at: 'x' } },
          update: { lastError: null },
        },
      }),
      ['has-remote'],
    );
    expect(v.sync?.fetchError).toEqual({ code: 'config-in-worktree', message: '', lastSuccessAt: null });
  });

  it('the update error is passed as recorded', () => {
    const lastError = { code: 'diverged', at: 'x' } as const;
    const v = gitStatusView(
      repo({ sync: { fetch: { lastSuccessAt: null, lastError: null }, update: { lastError } } }),
      ['has-remote'],
    );
    expect(v.sync?.updateError).toEqual(lastError);
  });
});

describe('lastFetched (D39-8)', () => {
  const now = new Date(2026, 9, 16, 15, 0);

  it('none', () => {
    expect(lastFetched(null, now)).toEqual({ when: 'none' });
  });

  it('today: the time only', () => {
    const at = new Date(2026, 9, 16, 10, 2);
    expect(lastFetched(at.toISOString(), now)).toEqual({ when: 'today', at });
  });

  it('another day: date and time', () => {
    const at = new Date(2026, 9, 15, 23, 59);
    expect(lastFetched(at.toISOString(), now)).toEqual({ when: 'other', at });
  });
});
