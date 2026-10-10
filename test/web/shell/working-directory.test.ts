// The default working directory of a clone (W4-14, S-04.1): `~/projects/<repo>` with the server's
// rule for `<repo>` (`server/src/projects/remote.ts` `repoName`, spec-006 §3). The web mirror is
// replayed against the server function so the two rules cannot drift.
import { describe, expect, it } from 'vitest';
import { repoName as serverRepoName } from '../../../server/src/projects/remote.js';
import { defaultWorkingDirectory, displayUrl, repoName } from '../../../web/src/shell/working-directory.js';

/** The server's table (`test/server/projects/remote.test.ts`) plus the forms a user types. */
const URLS = [
  'file:///srv/remotes/kanban.git',
  'https://github.com/acme/kanban',
  'https://github.com/acme/kanban.git/',
  'git@github.com:acme/project.git',
  'git@github.com:project.git',
  'https://host/',
  'https://github.com/acme/kanban.git?ref=main#readme',
  'https://h/.',
  'https://h/..',
  '/..',
  'file:///',
  '',
  '   ',
  'h',
  'https://',
  'ssh://git@github.com:22/acme/kanban.git',
  'https://user:token@github.com/acme/Kanban.git',
  '/srv/remotes/kanban.git',
  'C:\\remotes\\kanban.git',
  '  https://git.invalid/team/project.git  ',
  'http://alex:wrong@127.0.0.1:8080/private.git',
  'git@github.com:',
];

describe('repoName mirrors the server', () => {
  it.each(URLS)('%j', (url) => {
    expect(repoName(url)).toBe(serverRepoName(url));
  });
});

describe('defaultWorkingDirectory', () => {
  it.each([
    ['file:///srv/remotes/kanban.git', '~/projects/kanban'],
    ['https://git.invalid/team/project.git', '~/projects/project'],
    ['git@github.com:acme/project.git', '~/projects/project'],
    ['https://h/..', ''],
    ['', ''],
  ])('%s → %j', (url, directory) => {
    expect(defaultWorkingDirectory(url)).toBe(directory);
  });
});

describe('displayUrl (review R1: no password shown or announced)', () => {
  it.each([
    ['http://alex:wrong@127.0.0.1:8080/private.git', 'http://127.0.0.1:8080/private.git'],
    ['HTTPS://user:tok%40en@github.com/acme/kanban.git', 'HTTPS://github.com/acme/kanban.git'],
    ['ssh://git@github.com:22/acme/kanban.git', 'ssh://github.com:22/acme/kanban.git'],
    ['  https://github.com/acme/kanban.git  ', 'https://github.com/acme/kanban.git'],
    ['file:///srv/remotes/kanban.git', 'file:///srv/remotes/kanban.git'],
    ['https://github.com/a@b/kanban.git', 'https://github.com/a@b/kanban.git'],
    // Up to the last '@' of the authority, never past it (review R8).
    ['https://u:p@ss@host/r.git', 'https://host/r.git'],
    ['https://host?x=a@b', 'https://host?x=a@b'],
    ['https://host#a@b', 'https://host#a@b'],
    // scp-like: no password possible, kept as typed.
    ['git@github.com:acme/kanban.git', 'git@github.com:acme/kanban.git'],
  ])('%s → %s', (url, shown) => {
    expect(displayUrl(url)).toBe(shown);
  });
});
