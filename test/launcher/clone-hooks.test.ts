// task-026 / bug-008 on the bin (D26-1, D26-5): a clone through `POST /api/projects/clone` runs git
// with `core.hooksPath` set to a regular file of the built console (`server/dist`), so the remote's
// committed hook never runs even with a relative `core.hooksPath` in the user's configuration; and
// the console creates no `wfui-no-hooks-*` folder, so a console killed with SIGKILL after a clone
// leaves none behind, before or after the next start. The console's temporary directory is a folder
// of this test (`TMPDIR`, `TMP`, `TEMP`): concurrent runs in other checkouts cannot disturb the count.
import { appendFile, chmod, lstat, mkdir, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveGit } from '../../server/src/git/git.js';
import { REPO_ROOT } from '../harness/cli.js';
import { harnessEnv } from '../harness/fixtures/index.js';
import { BIN_START_MS, BIN_TEST_MS } from '../harness/load.js';
import { git } from '../harness/run.js';
import { TempWorkspace } from '../harness/temp-workspace.js';
import { startLauncher, type Launcher } from './launcher.js';

let workspace: TempWorkspace;
let env: NodeJS.ProcessEnv;
let consoleTmp: string;
let remote: string;
let marker: string;
let gitLog: string;
const started: Launcher[] = [];

/** The `wfui-no-hooks-*` entries of the console's temporary directory. */
async function hookFolders(): Promise<string[]> {
  return (await readdir(consoleTmp)).filter((e) => e.startsWith('wfui-no-hooks-'));
}

async function start(): Promise<Launcher> {
  const l = await startLauncher(['--no-open'], env, BIN_START_MS);
  started.push(l);
  return l;
}

beforeAll(async () => {
  workspace = await TempWorkspace.create('wfui-clone-hooks-');
  const root = await realpath(workspace.dir);
  const base = await harnessEnv(root);
  consoleTmp = path.join(root, 'console-tmp');
  await mkdir(consoleTmp);
  marker = path.join(root, 'hook-ran.txt');
  // A WingFoil-looking repository with a committed, executable post-checkout hook, pushed to a bare
  // remote.
  const src = path.join(root, 'src');
  await mkdir(path.join(src, '.wingfoil'), { recursive: true });
  await mkdir(path.join(src, '.githooks'));
  await writeFile(path.join(src, '.wingfoil', 'dna.yaml'), 'version: 1\n');
  await writeFile(path.join(src, '.githooks', 'post-checkout'), `#!/bin/sh\necho ran >> '${marker}'\n`);
  await chmod(path.join(src, '.githooks', 'post-checkout'), 0o755);
  remote = path.join(root, 'remote.git');
  await git(root, ['init', '--quiet', src], base.env);
  await git(src, ['add', '.'], base.env);
  await git(src, ['-c', 'user.name=T', '-c', 'user.email=t@example.test', 'commit', '-qm', 'hooks'], base.env);
  await git(root, ['clone', '--quiet', '--bare', src, remote], base.env);
  // The user's global configuration: hooks from the working tree (a husky-like set-up).
  await appendFile(base.env['GIT_CONFIG_GLOBAL']!, '[core]\n\thooksPath = .githooks\n');
  // A `git` on the PATH that records its arguments, then runs the real git.
  const realGit = await resolveGit(base.env);
  const bin = path.join(root, 'bin');
  await mkdir(bin);
  gitLog = path.join(root, 'git-args.log');
  await writeFile(path.join(bin, 'git'), `#!/bin/sh\nprintf '%s\\n' "$@" >> '${gitLog}'\nexec '${realGit}' "$@"\n`);
  await chmod(path.join(bin, 'git'), 0o755);
  env = {
    ...base.env,
    PATH: `${bin}${path.delimiter}${base.env['PATH'] ?? ''}`,
    WINGFOIL_UI_STATE_DIR: path.join(root, 'state'),
    TMPDIR: consoleTmp,
    TMP: consoleTmp,
    TEMP: consoleTmp,
  };
}, BIN_TEST_MS);

afterAll(async () => {
  for (const l of started) await l.kill();
  await workspace?.dispose();
});

describe.skipIf(process.platform === 'win32')('the hooks path of a clone on the bin (bug-008)', () => {
  it(
    'clones with core.hooksPath on a regular file of server/dist, runs no hook, and leaves no hooks folder after SIGKILL',
    async () => {
      const first = await start();
      const res = await fetch(`http://127.0.0.1:${first.port}/api/projects/clone`, {
        method: 'POST',
        headers: { authorization: `Bearer ${first.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ url: `file://${remote}`, directory: '~/projects/hooked' }),
      });
      expect(res.status, await res.clone().text()).toBe(201);
      // The clone ran, with its hook in the working tree, and the hook did not run.
      const home = env['HOME']!;
      expect((await lstat(path.join(home, 'projects', 'hooked', '.githooks', 'post-checkout'))).isFile()).toBe(true);
      await expect(lstat(marker)).rejects.toThrow();
      // The hooks path git received: a regular file of the built console, nothing below it.
      const args = (await readFile(gitLog, 'utf8')).split('\n');
      const hooksPaths = args.filter((a) => a.startsWith('core.hooksPath=')).map((a) => a.slice(15));
      expect(hooksPaths).toHaveLength(1);
      const hooksPath = hooksPaths[0]!;
      expect(hooksPath.startsWith(path.join(REPO_ROOT, 'server', 'dist') + path.sep), hooksPath).toBe(true);
      expect((await lstat(hooksPath)).isFile()).toBe(true);
      await expect(stat(path.join(hooksPath, 'post-checkout'))).rejects.toMatchObject({ code: 'ENOTDIR' });
      // No hooks folder while it runs, none after a SIGKILL, none after the next start.
      expect(await hookFolders()).toEqual([]);
      first.signal('SIGKILL');
      await first.stop();
      expect(await hookFolders()).toEqual([]);
      const second = await start();
      await second.stop();
      expect(await hookFolders()).toEqual([]);
    },
    BIN_TEST_MS,
  );
});
