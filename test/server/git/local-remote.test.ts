// task-033 D33-1 (bug-010) — which remotes are local repositories, and whose they are.
import { mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { localRemotePath, ownedByAnother } from '../../../server/src/git/local-remote.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';

const posix = process.platform !== 'win32';
let ws: TempWorkspace;
let root: string;
beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-033-local-remote-');
  root = await realpath(ws.dir);
  await mkdir(path.join(root, 'mine.git'));
});
afterAll(() => ws.dispose());

describe('localRemotePath', () => {
  it.each<[string, string | undefined]>([
    ['file:///repos/x.git', '/repos/x.git'],
    ['file://localhost/repos/x.git', '/repos/x.git'],
    ['file:///repos/with%20space.git', '/repos/with space.git'],
    ['/repos/x.git', '/repos/x.git'],
    ['../up.git', '/up.git'],
    ['up.git', '/base/up.git'],
    ['file://server/share/x.git', undefined],
    ['https://example.test/x.git', undefined],
    ['ssh://git@example.test/x.git', undefined],
    ['git@example.test:owner/x.git', undefined],
    ['example.test:x.git', undefined],
    ['ext::sh -c x', undefined],
    ['', undefined],
  ])('%s → %s', (url, expected) => {
    expect(localRemotePath(url, '/base')).toBe(expected);
  });
});

describe.runIf(posix)('ownedByAnother', () => {
  it("is false for the user's own repository and for a folder that does not exist", async () => {
    expect(await ownedByAnother(path.join(root, 'mine.git'))).toBe(false);
    expect(await ownedByAnother(path.join(root, 'missing.git'))).toBe(false);
  });

  it('is true for a folder of another user (the file-system root, owned by root)', async () => {
    const uid = process.getuid!();
    expect(await ownedByAnother(path.parse(root).root, uid === 0 ? 4242 : uid)).toBe(true);
  });

  it('is false without an owner id (Windows)', async () => {
    expect(await ownedByAnother(path.parse(root).root, null)).toBe(false);
  });
});
