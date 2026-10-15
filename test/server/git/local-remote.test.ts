// task-033 D33-1 (bug-010; review round 1 F1, S1–S5; round 2 F9, F10, S10, S11) — which remote URLs git opens as a local
// repository, and whether any folder git could open for them belongs to another user.
import { mkdir, realpath, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { localPathOf, localRemoteProblem, userHome } from '../../../server/src/git/local-remote.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';

const posix = process.platform !== 'win32';
let ws: TempWorkspace;
let root: string;
/** The file-system root: owned by root, not by the user running the tests. */
let fsRoot: string;
beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-033-local-remote-');
  root = await realpath(ws.dir);
  fsRoot = path.parse(root).root;
  await mkdir(path.join(root, 'mine.git'));
  await mkdir(path.join(root, 'top', 'proj'), { recursive: true });
  await mkdir(path.join(root, 'top', 'sibling.git'));
  // `foreign.git` is another user's repository (a link to the file-system root).
  await symlink(fsRoot, path.join(root, 'foreign.git'));
  await symlink(fsRoot, path.join(root, 'top', 'outside.git'));
  // A working tree whose `.git` file points at another user's folder.
  await mkdir(path.join(root, 'wt'));
  await writeFile(path.join(root, 'wt', '.git'), `gitdir: ${fsRoot}\n`);
  // `l` → the file-system root: `l/..` is the root physically, `root` lexically (S5).
  await symlink(fsRoot, path.join(root, 'l'));
});
afterAll(() => ws.dispose());

describe('localPathOf — git’s rule for a local URL (S1)', () => {
  it.each<[string, string | undefined]>([
    ['file:///repos/x.git', '/repos/x.git'],
    ['file://localhost/repos/x.git', '/repos/x.git'],
    ['file://127.0.0.1/repos/x.git', '/repos/x.git'],
    ['file://any-host/repos/x.git', '/repos/x.git'],
    ['file:///repos/with%20space.git', '/repos/with space.git'],
    ['/repos/x.git', '/repos/x.git'],
    ['../up.git', '../up.git'],
    ['up', 'up'],
    ['a/b:c.git', 'a/b:c.git'],
    ['https://example.test/x.git', undefined],
    ['ssh://git@example.test/x.git', undefined],
    ['git@example.test:owner/x.git', undefined],
    ['example.test:x.git', undefined],
    ['ext::sh -c x', undefined],
    ['git-remote+x.y::anything', undefined],
    // S10: `::` makes a remote helper only after a scheme-like name from the start.
    ['own/u::sr', 'own/u::sr'],
    ['./x::y', './x::y'],
    ['~/repos/x.git', '~/repos/x.git'],
    ['', undefined],
  ])('%j → %j', (url, expected) => {
    expect(localPathOf(url)).toBe(expected);
  });
});

describe.runIf(posix)('localRemoteProblem', () => {
  const uid = () => (process.getuid!() === 0 ? 4242 : process.getuid!());
  const check = (urls: string[], base = root, options: { home?: string; expandUser?: boolean } = {}) =>
    localRemoteProblem(urls, base, { uid: uid(), home: root, ...options });

  it("is undefined for the user's own repository, and for URLs that are not local", async () => {
    expect(await check([path.join(root, 'mine.git')])).toBeUndefined();
    expect(await check([`file://${path.join(root, 'mine.git')}`])).toBeUndefined();
    expect(await check(['https://example.test/x.git', 'git@example.test:x.git'])).toBeUndefined();
  });

  it('S1: a file:// URL with a host is checked like any local path', async () => {
    expect(await check([`file://127.0.0.1${fsRoot}`])).toBe('remote-not-owned');
    expect(await check([`file://some-host${fsRoot}`])).toBe('remote-not-owned');
  });

  it('S2: every URL is checked, not the first only', async () => {
    expect(await check([path.join(root, 'mine.git'), path.join(root, 'foreign.git')])).toBe('remote-not-owned');
  });

  it("S3: git's suffixes — a remote written without .git opens <p>.git", async () => {
    expect(await check([path.join(root, 'mine')])).toBeUndefined();
    expect(await check([path.join(root, 'foreign')])).toBe('remote-not-owned');
  });

  it('S3: a .git file (gitdir:) is followed to the folder git opens', async () => {
    expect(await check([path.join(root, 'wt')])).toBe('remote-not-owned');
  });

  it('S4: a relative URL is resolved against the given base (the top level of the repository)', async () => {
    const top = path.join(root, 'top');
    expect(await check(['sibling.git'], top)).toBeUndefined();
    expect(await check(['outside.git'], top)).toBe('remote-not-owned');
    expect(await check(['../top/outside'], path.join(top, 'proj'))).toBe('remote-not-owned');
  });

  it('S5: `..` after a symbolic link is resolved on the file system, not lexically', async () => {
    expect(await check(['l/..'])).toBe('remote-not-owned');
    expect(await check([`${path.join(root, 'l')}/../`])).toBe('remote-not-owned');
  });

  it('S10: a path holding `::` after a slash is a path, checked as one', async () => {
    await mkdir(path.join(root, 'own'), { recursive: true });
    await symlink(fsRoot, path.join(root, 'own', 'u::sr'));
    expect(await check(['own/u::sr'])).toBe('remote-not-owned');
  });

  it('F9: a local URL with no folder git could read → remote-unreadable (fail closed), not another user', async () => {
    expect(await check([path.join(root, 'missing')])).toBe('remote-unreadable');
    // Another user's folder wins over an unreadable one.
    expect(await check([path.join(root, 'missing'), path.join(root, 'foreign.git')])).toBe('remote-not-owned');
  });

  it("F10: a leading ~ is the git environment's home folder (git's enter_repo)", async () => {
    expect(await check(['~/mine.git'])).toBeUndefined();
    expect(await check(['~/foreign.git'])).toBe('remote-not-owned');
    expect(await check(['~'], root, { home: fsRoot })).toBe('remote-not-owned');
  });

  it("S11: ~user is that user's home folder from the user database; a committed `~root` folder does not bypass it", async () => {
    const rootHome = userHome('root');
    expect(rootHome).toBeDefined();
    // `<base>/~root/x.git` is ours, but git opens root's home.
    await mkdir(path.join(root, '~root', 'x.git'), { recursive: true });
    expect(await check(['~root'])).toBe('remote-not-owned');
    expect(await check(['~root/x.git'])).not.toBeUndefined();
    expect(await check(['~no-such-user-4711/x.git'])).toBe('remote-unreadable');
  });

  it('the clone does not expand ~ (git clone takes the path as written): `~/x` is relative to the base', async () => {
    await mkdir(path.join(root, '~', 'mine.git'), { recursive: true });
    expect(await check(['~/mine.git'], root, { home: fsRoot, expandUser: false })).toBeUndefined();
  });

  it('is undefined without an owner id (Windows)', async () => {
    expect(await localRemoteProblem([`file://${fsRoot}`], root, { uid: null })).toBeUndefined();
  });
});
