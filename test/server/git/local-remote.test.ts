// task-033 D33-1 (bug-010; review round 1 F1, S1–S5) — which remote URLs git opens as a local
// repository, and whether any folder git could open for them belongs to another user.
import { mkdir, realpath, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { foreignLocalRemote, localPathOf } from '../../../server/src/git/local-remote.js';
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
    ['', undefined],
  ])('%j → %j', (url, expected) => {
    expect(localPathOf(url)).toBe(expected);
  });
});

describe.runIf(posix)('foreignLocalRemote', () => {
  const uid = () => (process.getuid!() === 0 ? 4242 : process.getuid!());
  const check = (urls: string[], base = root) => foreignLocalRemote(urls, base, uid());

  it("is false for the user's own repository, and for URLs that are not local", async () => {
    expect(await check([path.join(root, 'mine.git')])).toBe(false);
    expect(await check([`file://${path.join(root, 'mine.git')}`])).toBe(false);
    expect(await check(['https://example.test/x.git', 'git@example.test:x.git'])).toBe(false);
  });

  it('S1: a file:// URL with a host is checked like any local path', async () => {
    expect(await check([`file://127.0.0.1${fsRoot}`])).toBe(true);
    expect(await check([`file://some-host${fsRoot}`])).toBe(true);
  });

  it('S2: every URL is checked, not the first only', async () => {
    expect(await check([path.join(root, 'mine.git'), path.join(root, 'foreign.git')])).toBe(true);
  });

  it("S3: git's suffixes — a remote written without .git opens <p>.git", async () => {
    expect(await check([path.join(root, 'mine')])).toBe(false);
    expect(await check([path.join(root, 'foreign')])).toBe(true);
  });

  it('S3: a .git file (gitdir:) is followed to the folder git opens', async () => {
    expect(await check([path.join(root, 'wt')])).toBe(true);
  });

  it('S4: a relative URL is resolved against the given base (the top level of the repository)', async () => {
    const top = path.join(root, 'top');
    expect(await check(['sibling.git'], top)).toBe(false);
    expect(await check(['outside.git'], top)).toBe(true);
    expect(await check(['../top/outside'], path.join(top, 'proj'))).toBe(true);
  });

  it('S5: `..` after a symbolic link is resolved on the file system, not lexically', async () => {
    expect(await check(['l/..'])).toBe(true);
    expect(await check([`${path.join(root, 'l')}/../`])).toBe(true);
  });

  it('fails closed: a local URL with no folder git could open is refused', async () => {
    expect(await check([path.join(root, 'missing')])).toBe(true);
  });

  it('is false without an owner id (Windows)', async () => {
    expect(await foreignLocalRemote([`file://${fsRoot}`], root, null)).toBe(false);
  });
});
