/**
 * Staging publish smoke (task-029 AC-1 staging step, AC-3; D29-1, D29-2, D29-3): the package goes
 * through a registry the way a user gets it — published to a local Verdaccio (the pinned
 * devDependency), installed by name into an empty folder, started with `npx wingfoil-ui`. The local
 * registry has NO uplink: it is seeded with the package's run-time dependency closure, packed
 * offline from the npm cache at the versions of `package-lock.json`. Every npm process runs with
 * a dead proxy for anything outside the loopback, so a request to the public registry fails the
 * run instead of passing unseen (AC-3: it never contacts the public registry).
 *
 * `npm run test:publish-smoke` only (`vitest.publish-smoke.config.ts`). The tarball is
 * `WFUI_PUBLISH_TARBALL` when set (the publish pipeline's stage job passes the gate's tarball),
 * otherwise this file packs the repository (`prepack` builds, as in the launch smoke).
 */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { harnessEnv } from '../harness/fixtures/index.js';
import { run } from '../harness/run.js';
import { npm, npmCli, parsePackReport, readManifest } from '../package/allow-list.js';
import { deadProxyEnv, runtimeClosure, seedRegistry, startRegistry, type LocalRegistry } from './registry.js';
import {
  expectGroupGone,
  killGroups,
  npxArgs,
  serverProcess,
  start,
  timed as timedIn,
  withoutNpmVars,
} from './support.js';

const PACKAGE = 'wingfoil-ui';
const version = readManifest().version;
const timings: Record<string, number> = {};
const groups = new Set<number>();
let tmp: string;
let tarball: string;
let registry: LocalRegistry | undefined;
/** The environment of every npm / npx run against the local registry. */
let regEnv: NodeJS.ProcessEnv;
let app: string;
let seeded: number;

const timed = <T>(name: string, work: () => Promise<T>): Promise<T> =>
  timedIn(timings, 'publish smoke', name, work);

/** `npm <args>` with the local registry's environment; resolves on failure too. */
function npmReg(args: readonly string[], cwd = tmp) {
  return run(process.execPath, [npmCli(), ...args], { cwd, env: regEnv, allowFailure: true, timeoutMs: 600_000 });
}

/** `sha512-<base64>` of a file: the integrity npm records for a tarball. */
async function integrity(file: string): Promise<string> {
  return `sha512-${createHash('sha512')
    .update(await readFile(file))
    .digest('base64')}`;
}

beforeAll(async () => {
  tmp = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-publish-smoke-')));
  const base = withoutNpmVars(process.env);
  const cache = (await npm(['config', 'get', 'cache'], { env: base })).stdout.trim();
  // 1. The tarball: the gate's (pipeline) or a fresh pack (`prepack` builds).
  const given = process.env['WFUI_PUBLISH_TARBALL'];
  if (given) {
    tarball = path.join(tmp, path.basename(given));
    await copyFile(given, tarball);
  } else {
    const pack = await timed('pack (prepack build + npm pack)', () =>
      npm(['pack', '--pack-destination', tmp, '--json'], { env: base, timeoutMs: 600_000 }),
    );
    tarball = path.join(tmp, parsePackReport(pack.stdout).filename);
  }
  // 2. The local registry, seeded offline with the run-time dependency closure.
  registry = await timed('registry start', () => startRegistry(path.join(tmp, 'registry'), base));
  seeded = await timed('registry seed (run-time closure, offline)', () =>
    seedRegistry(registry!, runtimeClosure(), { dir: path.join(tmp, 'seed'), env: base, cache }),
  );
  // 3. The user's side: isolated home, a fresh npm cache (every tarball comes from the local
  // registry), the registry's throwaway token in a user config of the test's own folder.
  const { env } = await harnessEnv(path.join(tmp, 'user'));
  const npmrc = path.join(tmp, 'npmrc');
  await writeFile(npmrc, `${registry.authLine}\n`, { mode: 0o600 });
  regEnv = {
    ...withoutNpmVars(env),
    ...deadProxyEnv(),
    npm_config_registry: registry.url,
    npm_config_userconfig: npmrc,
    npm_config_cache: path.join(tmp, 'cache'),
    npm_config_update_notifier: 'false',
    npm_config_fund: 'false',
    npm_config_audit: 'false',
    WINGFOIL_UI_STATE_DIR: path.join(tmp, 'state'),
  };
  app = path.join(tmp, 'app');
  await mkdir(app);
  await writeFile(path.join(app, 'package.json'), '{ "name": "wfui-publish-smoke-app", "private": true }\n');
}, 900_000);

afterAll(async () => {
  killGroups(groups);
  await registry?.stop();
  console.log(`publish smoke timings (ms): ${JSON.stringify(timings)}`);
  if (tmp) await rm(tmp, { recursive: true, force: true });
});

describe('staging publish smoke: publish to a local registry, install by name, start (task-029)', () => {
  it('AC-3 the local registry serves only what was seeded and npm cannot reach the public registry', async () => {
    console.log(`publish smoke: ${seeded} run-time dependencies seeded`);
    expect(seeded).toBeGreaterThan(0);
    // No uplink: a package nobody seeded is unknown to the local registry.
    const absent = await npmReg(['view', 'left-pad', 'version']);
    expect(absent.code).not.toBe(0);
    expect(absent.stderr).toMatch(/E404|404 Not Found/);
    // The dead proxy bites: the public registry is unreachable from this environment.
    const outside = await npmReg(['view', 'yaml', 'version', '--registry', 'https://registry.npmjs.org/', '--fetch-retries', '0']);
    expect(outside.code).not.toBe(0);
    expect(outside.stderr).toMatch(/ECONNREFUSED|proxy|EPROXY/i);
  });

  it('AC-1 / AC-3 npm publish puts the tarball on the local registry, byte for byte', async () => {
    const pub = await timed('npm publish (local registry)', () =>
      npmReg(['publish', tarball, '--provenance=false', '--access', 'public']),
    );
    expect(pub.code, pub.stderr).toBe(0);
    const view = await npmReg(['view', `${PACKAGE}@${version}`, 'dist.integrity']);
    expect(view.code, view.stderr).toBe(0);
    expect(view.stdout.trim()).toBe(await integrity(tarball));
  });

  it('AC-1 / AC-3 npm install wingfoil-ui@<version> from the local registry into an empty folder', async () => {
    const install = await timed('npm install (local registry, fresh cache)', () =>
      npmReg(['install', `${PACKAGE}@${version}`], app),
    );
    expect(install.code, install.stderr).toBe(0);
    const installed = path.join(app, 'node_modules', PACKAGE);
    expect((JSON.parse(await readFile(path.join(installed, 'package.json'), 'utf8')) as { version: string }).version).toBe(
      version,
    );
    expect((await stat(path.join(installed, 'bin', 'wingfoil-ui.cjs'))).mode & 0o111).not.toBe(0);
    // Every installed tarball came from the local registry.
    const lock = JSON.parse(await readFile(path.join(app, 'package-lock.json'), 'utf8')) as {
      packages: Record<string, { resolved?: string }>;
    };
    const elsewhere = Object.entries(lock.packages)
      .filter(([, p]) => p.resolved && !p.resolved.startsWith(registry!.url))
      .map(([k, p]) => `${k} ${p.resolved}`);
    expect(elsewhere).toEqual([]);
  });

  it('AC-1 / AC-3 npx wingfoil-ui --version and a --no-open start; SIGINT stops it, no process left', async () => {
    const v = await timed('npx wingfoil-ui --version', () =>
      run(process.execPath, npxArgs(['--version']), { cwd: app, env: regEnv }),
    );
    expect(v.code).toBe(0);
    expect(v.stdout.trim()).toBe(version);
    const c = await timed('start (spawn → running line)', () => start(app, regEnv, groups));
    expect((await fetch(`${c.origin}/`)).status).toBe(200);
    const api = await fetch(`${c.origin}/api/server`, { headers: { authorization: `Bearer ${c.token}` } });
    expect(api.status).toBe(200);
    expect(((await api.json()) as { version: string }).version).toBe(version);
    const server = await serverProcess(c.pgid);
    process.kill(server.pid, 'SIGINT');
    expect(await c.exited, c.stderr()).toEqual({ code: 0, signal: null });
    await expectGroupGone(c.pgid);
  });

  it('the local registry stops and leaves no process behind', async () => {
    const r = registry!;
    await r.stop();
    await expectGroupGone(r.pgid);
    await expect(fetch(`${r.url}-/ping`)).rejects.toThrow();
  });
});
