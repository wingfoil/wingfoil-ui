/**
 * Launch smoke (e2e-smoke `launch`; task-025 AC-3, bug-007; decisions ES-12, ES-13): pack the
 * repository as `npm pack` does (its `prepack` builds), install the tarball into an empty folder as
 * a user would, and run `npx wingfoil-ui` there with an isolated home and state directory.
 * `npm run test:smoke` only (`vitest.smoke.config.ts`): the build rewrites `server/dist` and
 * `web/dist`, which the default suite reads. The install uses the user's npm cache with
 * `--prefer-offline`: no network when the cache holds the packages and their metadata.
 * Each phase's duration is printed. task-026 (bug-008, D26-1): the installed console clones a
 * repository with a committed hook — the hooks path of the packed `server/dist` is a regular file,
 * the clone succeeds and runs no hook. task-029 (D29-3): the helpers live in `support.ts`, shared
 * with the staging publish smoke.
 */
import { appendFile, chmod, lstat, mkdir, mkdtemp, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { harnessEnv } from '../harness/fixtures/index.js';
import { git, run } from '../harness/run.js';
import {
  developmentBuildFiles,
  forbiddenReason,
  isAllowed,
  npm,
  parsePackReport,
  readManifest,
  serverModules,
  type PackReport,
} from '../package/allow-list.js';
import {
  expectGroupGone,
  killGroups,
  npxArgs,
  serverProcess,
  start as startIn,
  timed as timedIn,
  withoutNpmVars,
  type Started,
} from './support.js';

let tmp: string;
let app: string;
let report: PackReport;
let runEnv: NodeJS.ProcessEnv;
const version = readManifest().version;
const timings: Record<string, number> = {};
/** Process groups started by this file, killed in `afterAll` whatever happened. */
const groups = new Set<number>();

const timed = <T>(name: string, work: () => Promise<T>): Promise<T> => timedIn(timings, 'launch smoke', name, work);
const start = (): Promise<Started> => startIn(app, runEnv, groups);

beforeAll(async () => {
  tmp = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-smoke-')));
  const base = withoutNpmVars(process.env);
  const cache = (await npm(['config', 'get', 'cache'], { env: base })).stdout.trim();
  // 1. Pack: `prepack` runs the full build.
  const pack = await timed('pack (prepack build + npm pack)', () =>
    npm(['pack', '--pack-destination', tmp, '--json'], { env: base, timeoutMs: 600_000 }),
  );
  report = parsePackReport(pack.stdout);
  // 2. Install into an empty folder.
  app = path.join(tmp, 'app');
  await mkdir(app);
  await writeFile(path.join(app, 'package.json'), '{ "name": "wfui-smoke-app", "private": true }\n');
  await timed('install (npm install <tarball> --prefer-offline)', () =>
    npm(['install', path.join(tmp, report.filename), '--prefer-offline', '--no-audit', '--no-fund', '--cache', cache], {
      cwd: app,
      env: base,
      timeoutMs: 600_000,
    }),
  );
  // 3. The user's environment: isolated home, XDG and git configuration, a state directory of its own.
  const { env } = await harnessEnv(path.join(tmp, 'user'));
  runEnv = {
    ...withoutNpmVars(env),
    WINGFOIL_UI_STATE_DIR: path.join(tmp, 'state'),
    npm_config_cache: cache,
    npm_config_update_notifier: 'false',
  };
}, 900_000);

afterAll(async () => {
  killGroups(groups);
  console.log(`launch smoke timings (ms): ${JSON.stringify(timings)}`);
  if (tmp) await rm(tmp, { recursive: true, force: true });
});

describe('launch smoke: the packed package installs and starts (bug-007)', () => {
  it('AC-1 the tarball built by prepack holds only allowed paths and is installed with its bin', async () => {
    expect(report.files.map((f) => f.path).filter((file) => !isAllowed(file) || forbiddenReason(file))).toEqual([]);
    expect(report.files.map((f) => f.path)).toEqual(
      expect.arrayContaining(['server/dist/main.js', 'web/dist/index.html']),
    );
    // `prepack` builds from a clean tree: exactly one module per server source, no stale file.
    expect(new Set(report.files.map((f) => f.path).filter((file) => file.startsWith('server/dist/')))).toEqual(
      new Set(serverModules()),
    );
    // A production web build: no React development bundle (review round 1).
    const installed = path.join(app, 'node_modules', 'wingfoil-ui');
    expect(developmentBuildFiles(path.join(installed, 'web', 'dist'))).toEqual([]);
    const bin = await stat(path.join(installed, 'bin', 'wingfoil-ui.cjs'));
    expect(bin.mode & 0o111).not.toBe(0);
    console.log(
      `launch smoke: tarball ${report.entryCount} files, ${report.size} B packed, ${report.unpackedSize} B unpacked`,
    );
  });

  it('AC-3 the installed package prints its version and help', async () => {
    const v = await timed('npx wingfoil-ui --version', () =>
      run(process.execPath, npxArgs(['--version']), { cwd: app, env: runEnv }),
    );
    expect(v.code).toBe(0);
    expect(v.stdout.trim()).toBe(version);
    const help = await run(process.execPath, npxArgs(['--help']), { cwd: app, env: runEnv });
    expect(help.code).toBe(0);
    expect(help.stdout).toMatch(/^Usage: wingfoil-ui \[--port <n>\] \[--no-open\] \[--version\] \[--help\]/);
  });

  it('AC-3 npx wingfoil-ui --no-open serves the UI and the API with the token, clones with no hook (bug-008); SIGINT to the server: exit 0, no process left', async () => {
    const c = await timed('start (spawn → running line)', () => start());
    // The UI: the page and the application script it loads.
    const page = await fetch(`${c.origin}/`);
    expect(page.status).toBe(200);
    const html = await page.text();
    const script = /<script[^>]+src="(\/assets\/[^"]+\.js)"/.exec(html)?.[1];
    expect(script, html).toBeDefined();
    const asset = await fetch(`${c.origin}${script}`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get('content-type')).toMatch(/javascript/);
    // The API needs the token.
    expect((await fetch(`${c.origin}/api/server`)).status).toBe(401);
    const api = await fetch(`${c.origin}/api/server`, { headers: { authorization: `Bearer ${c.token}` } });
    expect(api.status).toBe(200);
    expect(((await api.json()) as { version: string }).version).toBe(version);
    // A clone through the installed console (bug-008): a committed hook, a relative
    // `core.hooksPath` in the user's configuration; the clone succeeds and the hook never runs.
    const marker = path.join(tmp, 'hook-ran.txt');
    const src = path.join(tmp, 'hooked-src');
    await mkdir(path.join(src, '.wingfoil'), { recursive: true });
    await mkdir(path.join(src, '.githooks'));
    await writeFile(path.join(src, '.wingfoil', 'dna.yaml'), 'version: 1\n');
    await writeFile(path.join(src, '.githooks', 'post-checkout'), `#!/bin/sh\necho ran >> '${marker}'\n`);
    await chmod(path.join(src, '.githooks', 'post-checkout'), 0o755);
    await git(tmp, ['init', '--quiet', src], runEnv);
    await git(src, ['add', '.'], runEnv);
    await git(src, ['-c', 'user.name=T', '-c', 'user.email=t@example.test', 'commit', '-qm', 'hooks'], runEnv);
    await git(tmp, ['clone', '--quiet', '--bare', src, path.join(tmp, 'hooked.git')], runEnv);
    await appendFile(runEnv['GIT_CONFIG_GLOBAL']!, '[core]\n\thooksPath = .githooks\n');
    const cloned = await timed('clone through the installed console', () =>
      fetch(`${c.origin}/api/projects/clone`, {
        method: 'POST',
        headers: { authorization: `Bearer ${c.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ url: `file://${path.join(tmp, 'hooked.git')}`, directory: '~/projects/hooked' }),
      }),
    );
    expect(cloned.status, await cloned.clone().text()).toBe(201);
    expect((await lstat(path.join(runEnv['HOME']!, 'projects', 'hooked', '.githooks', 'post-checkout'))).isFile()).toBe(
      true,
    );
    await expect(lstat(marker)).rejects.toThrow();
    // Stop: SIGINT to the bin's own process; its exit status 0 reaches `npx`.
    const server = await serverProcess(c.pgid);
    expect(server.args).toMatch(/wingfoil-ui/);
    process.kill(server.pid, 'SIGINT');
    expect(await c.exited, c.stderr()).toEqual({ code: 0, signal: null });
    expect(c.stdout()).toMatch(/\nWingFoil UI stopped\n/);
    await expectGroupGone(c.pgid);
  });

  it('AC-3 Ctrl-C (SIGINT to the process group) stops the console, npx reports the signal, no process left', async () => {
    const c = await start();
    process.kill(-c.pgid, 'SIGINT');
    // npm re-raises the signal its child got (ES-13): status 130 in a shell.
    expect(await c.exited).toEqual({ code: null, signal: 'SIGINT' });
    await expectGroupGone(c.pgid);
  });
});
