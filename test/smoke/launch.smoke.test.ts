/**
 * Launch smoke (e2e-smoke `launch`; task-025 AC-3, bug-007; decisions ES-12, ES-13): pack the
 * repository as `npm pack` does (its `prepack` builds), install the tarball into an empty folder as
 * a user would, and run `npx wingfoil-ui` there with an isolated home and state directory.
 * `npm run test:smoke` only (`vitest.smoke.config.ts`): the build rewrites `server/dist` and
 * `web/dist`, which the default suite reads. The install uses the user's npm cache with
 * `--prefer-offline`: no network when the cache holds the packages and their metadata.
 * Each phase's duration is printed.
 */
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { harnessEnv } from '../harness/fixtures/index.js';
import { run } from '../harness/run.js';
import {
  developmentBuildFiles,
  forbiddenReason,
  isAllowed,
  npm,
  npmCli,
  parsePackReport,
  readManifest,
  serverModules,
  type PackReport,
} from '../package/allow-list.js';

const RUNNING = /^WingFoil UI is running at (http:\/\/127\.0\.0\.1:(\d+)\/)#token=([A-Za-z0-9_-]+)$/;
const START_MS = 30_000;

let tmp: string;
let app: string;
let report: PackReport;
let runEnv: NodeJS.ProcessEnv;
const version = readManifest().version;
const timings: Record<string, number> = {};
/** Process groups started by this file, killed in `afterAll` whatever happened. */
const groups = new Set<number>();

/** `env` without the variables `npm run` adds (`npm_config_*`, `npm_package_*`, `npm_lifecycle_*`). */
function withoutNpmVars(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  // Vitest's `NODE_ENV=test` goes too: `prepack`'s Vite build would make React's development
  // bundle (review round 1).
  return Object.fromEntries(Object.entries(env).filter(([key]) => !/^npm_/i.test(key) && key !== 'NODE_ENV'));
}

async function timed<T>(name: string, work: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  try {
    return await work();
  } finally {
    timings[name] = Math.round(performance.now() - t0);
    console.log(`launch smoke: ${name} ${timings[name]} ms`);
  }
}

/** `npx` of this npm, run with this Node.js (no shell). */
const NPX = path.join(path.dirname(npmCli()), 'npx-cli.js');

/** `npx --no -- wingfoil-ui …` in the install folder: never a registry fallback. */
function npxArgs(args: readonly string[]): string[] {
  return [NPX, '--no', '--', 'wingfoil-ui', ...args];
}

interface Proc {
  pid: number;
  ppid: number;
  pgid: number;
  args: string;
}

async function processes(): Promise<Proc[]> {
  const { stdout } = await run('ps', ['-e', '-o', 'pid=,ppid=,pgid=,args=']);
  return stdout
    .split('\n')
    .map((line) => /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), pgid: Number(m[3]), args: m[4]! }));
}

/** Processes still alive in the group led by `pgid`. */
async function group(pgid: number): Promise<Proc[]> {
  return (await processes()).filter((p) => p.pgid === pgid);
}

/** The bin's own process: the leaf of the `npx` group (npm → `sh -c` → node). */
async function serverProcess(pgid: number): Promise<Proc> {
  const members = await group(pgid);
  const leaves = members.filter((p) => !members.some((q) => q.ppid === p.pid));
  expect(leaves, JSON.stringify(members)).toHaveLength(1);
  return leaves[0]!;
}

async function expectGroupGone(pgid: number): Promise<void> {
  await expect.poll(async () => (await group(pgid)).map((p) => p.args), { timeout: 10_000 }).toEqual([]);
}

interface Started {
  pgid: number;
  origin: string;
  token: string;
  stdout: () => string;
  stderr: () => string;
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

/** Start `npx wingfoil-ui --no-open` in its own process group and wait for the running line. */
function start(): Promise<Started> {
  const child = spawn(process.execPath, npxArgs(['--no-open']), {
    cwd: app,
    env: runEnv,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const pgid = child.pid!;
  groups.add(pgid);
  let out = '';
  let err = '';
  child.stderr.on('data', (d: Buffer) => (err += String(d)));
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) =>
    child.once('exit', (code, signal) => resolve({ code, signal })),
  );
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no running line after ${START_MS} ms: ${out} ${err}`)), START_MS);
    void exited.then(({ code, signal }) => {
      clearTimeout(timer);
      reject(new Error(`npx ended (${String(code ?? signal)}) before the running line: ${out} ${err}`));
    });
    child.stdout.on('data', (d: Buffer) => {
      out += String(d);
      const first = out.split('\n')[0]!;
      const m = out.includes('\n') ? RUNNING.exec(first) : null;
      if (!m) return;
      clearTimeout(timer);
      resolve({ pgid, origin: m[1]!.replace(/\/$/, ''), token: m[3]!, stdout: () => out, stderr: () => err, exited });
    });
  });
}

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
  for (const pgid of groups) {
    try {
      process.kill(-pgid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
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

  it('AC-3 npx wingfoil-ui --no-open serves the UI and the API with the token; SIGINT to the server: exit 0, no process left', async () => {
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
