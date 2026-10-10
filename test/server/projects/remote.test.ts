// spec-006 §3, §6 — remote normalisation for the duplicate check (S-06.2, REQ-STATE-07): the
// scp-like form read as `ssh://`, userinfo removed, host lower-cased, trailing `/` and `.git`
// removed, then host + path compared whatever the scheme. And the default working directory of a
// clone (`ux-reference` §3: `~/projects/<repo>`).
import { describe, expect, it } from 'vitest';
import { cloneSourceProblem, credentialsInUrl, normaliseRemote, repoName, sameRemote } from '../../../server/src/projects/remote.js';

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
    ['https://github.com/acme/kanban.git?ref=main#readme', 'kanban'],
    ['https://h/.', undefined],
    ['https://h/..', undefined],
    ['/..', undefined],
    ['file:///', undefined],
  ])('%s → %s', (url, name) => {
    expect(repoName(url)).toBe(name);
  });
});

describe('cloneSourceProblem', () => {
  it.each([
    ['https://github.com/acme/kanban.git', undefined],
    ['git@github.com:acme/kanban.git', undefined],
    ['file:///srv/remotes/kanban.git', undefined],
    ['/srv/remotes/kanban.git', undefined],
    ['--upload-pack=x', 'url must not start with -'],
    ['kanban.git', 'a local url must be an absolute path'],
    ['./kanban', 'a local url must be an absolute path'],
    ['../remotes/kanban.git', 'a local url must be an absolute path'],
  ])('%s → %s', (url, problem) => {
    expect(cloneSourceProblem(url, 'linux')).toBe(problem);
  });

  it('accepts drive-letter and UNC paths on Windows only', () => {
    for (const url of ['C:\\remotes\\kanban.git', 'C:/remotes/kanban.git', '\\\\server\\share\\kanban.git']) {
      expect(cloneSourceProblem(url, 'win32'), url).toBeUndefined();
      expect(cloneSourceProblem(url, 'linux'), url).toBe('a local url must be an absolute path');
    }
  });
});

// bug-006, W5-15 (decided by the user 2026-10-10): any userinfo of an http(s)/ftp(s) URL is a
// credential (a password, or a token in the user's place); SSH logins stay allowed.
describe('credentialsInUrl', () => {
  it.each([
    ['https://alex:s3cret@github.com/acme/kanban.git', true],
    ['http://alex:@127.0.0.1:8080/private.git', true],
    ['https://ghp_0123456789abcdef@github.com/acme/kanban.git', true],
    ['https://alex@github.com/acme/kanban.git', true],
    ['https://u:p@ss@host/r.git', true],
    ['https://alex%3As3cret@host/r.git', true],
    ['HTTPS://alex:x@HOST/r.git', true],
    ['ftp://alex:x@host/r.git', true],
    ['ftps://alex@host/r.git', true],
    ['https://alex:x@host', true],
    ['https://github.com/acme/kanban.git', false],
    ['https://host/r.git?x=a@b', false],
    ['https://host?x=a@b', false],
    ['https://host#a@b', false],
    ['https://host/a@b/r.git', false],
    ['ssh://git@github.com/acme/kanban.git', false],
    ['git@github.com:acme/kanban.git', false],
    ['git://host/r.git', false],
    ['file:///srv/remotes/kanban.git', false],
    ['/srv/user@host/kanban.git', false],
    ['  https://alex:x@host/r.git  ', true],
  ])('%s → %s', (url, expected) => {
    expect(credentialsInUrl(url)).toBe(expected);
  });
});
