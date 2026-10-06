// spec-006 §3, §6 — remote normalisation for the duplicate check (S-06.2, REQ-STATE-07): the
// scp-like form read as `ssh://`, userinfo removed, host lower-cased, trailing `/` and `.git`
// removed, then host + path compared whatever the scheme. And the default working directory of a
// clone (`ux-reference` §3: `~/projects/<repo>`).
import { describe, expect, it } from 'vitest';
import { normaliseRemote, repoName, sameRemote } from '../../../server/src/projects/remote.js';

describe('normaliseRemote', () => {
  it.each([
    ['https://github.com/acme/kanban.git', 'github.com/acme/kanban'],
    ['https://github.com/acme/kanban', 'github.com/acme/kanban'],
    ['https://github.com/acme/kanban/', 'github.com/acme/kanban'],
    ['https://GitHub.COM/acme/kanban.git/', 'github.com/acme/kanban'],
    ['https://user:token@github.com/acme/kanban.git', 'github.com/acme/kanban'],
    ['git@github.com:acme/kanban.git', 'github.com/acme/kanban'],
    ['ssh://git@github.com/acme/kanban.git', 'github.com/acme/kanban'],
    ['ssh://git@github.com:22/acme/kanban.git', 'github.com:22/acme/kanban'],
    ['  https://github.com/acme/kanban.git  ', 'github.com/acme/kanban'],
    ['file:///srv/remotes/kanban.git', '/srv/remotes/kanban'],
    ['/srv/remotes/kanban.git', '/srv/remotes/kanban'],
    ['', ''],
  ])('%s → %s', (remote, key) => {
    expect(normaliseRemote(remote)).toBe(key);
  });

  it('keeps the case of the path (only the host is folded)', () => {
    expect(normaliseRemote('https://host/Acme/Kanban')).toBe('host/Acme/Kanban');
  });
});

describe('sameRemote', () => {
  it.each([
    ['https://github.com/acme/kanban', 'git@github.com:acme/kanban.git', true],
    ['https://github.com/acme/kanban.git', 'http://GITHUB.com/acme/kanban/', true],
    ['https://github.com/acme/kanban', 'https://github.com/acme/other', false],
    ['https://github.com/acme/kanban', 'https://gitlab.com/acme/kanban', false],
    ['', '', false],
    ['https://github.com/acme/kanban', '', false],
  ])('%s vs %s → %s', (a, b, same) => {
    expect(sameRemote(a, b)).toBe(same);
  });
});

describe('repoName', () => {
  it.each([
    ['file:///srv/remotes/kanban.git', 'kanban'],
    ['https://github.com/acme/kanban', 'kanban'],
    ['https://github.com/acme/kanban.git/', 'kanban'],
    ['git@github.com:acme/project.git', 'project'],
    ['git@github.com:project.git', 'project'],
    ['https://host/', 'host'],
  ])('%s → %s', (url, name) => {
    expect(repoName(url)).toBe(name);
  });
});
