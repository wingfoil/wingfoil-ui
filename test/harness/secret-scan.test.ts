// Self-test of the REQ-SEC-09 secret scan: it finds what it must, and nothing in a clean state file.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { scanForSecrets, scanText } from './secret-scan.js';

let root: string;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'wfui-scan-'));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

it.each([
  ['url-userinfo', '{"remote":"https://alex:pw@github.com/acme/k.git"}'],
  ['url-userinfo', 'ssh://git@example.test/x'],
  ['bearer-header', 'authorization: Bearer abcdefghijklmnopqrstuvwxyz012345'],
  ['github-token', 'token ghp_abcdefghijklmnopqrstuvwxyz0123'],
  ['gitlab-token', 'glpat-abcdefghijklmnopqrstu'],
  ['aws-key', 'AKIAABCDEFGHIJKLMNOP'],
  ['session-cookie', 'cookie: wfui_session_5173=abc'],
])('finds %s', (what, text) => {
  expect(scanText('t', text).map((f) => f.what)).toContain(what);
});

it('finds a known value and nothing in a clean state file', async () => {
  const dir = path.join(root, 'state');
  await mkdir(dir);
  await writeFile(
    path.join(dir, 'state.json'),
    JSON.stringify({ version: 1, projects: [{ remote: 'https://github.com/acme/k.git', path: '/home/a' }] }),
  );
  await writeFile(path.join(root, 'log.txt'), 'planted-VALUE-123');
  expect(await scanForSecrets([dir, path.join(root, 'missing')], ['planted-VALUE-123'])).toEqual([]);
  expect(await scanForSecrets([root], ['planted-VALUE-123'])).toEqual([
    { where: path.join(root, 'log.txt'), what: 'value' },
  ]);
});
