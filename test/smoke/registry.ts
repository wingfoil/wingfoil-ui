/**
 * The local registry of the staging publish smoke (task-029 AC-3; D29-1, D29-2): Verdaccio, the
 * exact-pinned devDependency, started from `node_modules` on a free loopback port with its config,
 * storage and user file in the test's own folder, and **no uplink** — it can only serve what this
 * file seeds into it: the run-time dependency closure of `wingfoil-ui`, read from
 * `package-lock.json` and packed offline from the npm cache (`npm pack <resolved URL> --offline`),
 * then put with the registry's publish API. A throwaway user is registered for the run; its token
 * lives only in a user config of the test's folder, removed with it. Every process runs with
 * {@link deadProxyEnv}, so nothing reaches past the loopback.
 */
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { REPO_ROOT } from '../harness/cli.js';
import { run } from '../harness/run.js';
import { npmCli } from '../package/allow-list.js';
import { killGroupOnExit } from './registry-cleanup.js';

const START_MS = 60_000;
const STOP_MS = 10_000;

/** A running local registry. */
export interface LocalRegistry {
  /** `http://127.0.0.1:<port>/`. */
  url: string;
  /** The registry's process group (its process leads it). */
  pgid: number;
  /** The throwaway user's token, as a user-config line for {@link url}. */
  authLine: string;
  /** The throwaway user's token. */
  token: string;
  /** Verdaccio's own output so far (shown when something fails). */
  log: () => string;
  /** Stop the registry (SIGTERM, then SIGKILL of its group); idempotent. */
  stop: () => Promise<void>;
}

/** A package version of the run-time closure. */
export interface LockedPackage {
  name: string;
  version: string;
  resolved: string;
  integrity: string;
}

/**
 * Proxy settings that send every request outside the loopback to a closed loopback port (9), for
 * npm (`npm_config_proxy`, `npm_config_https_proxy`, `npm_config_noproxy`) and for any tool that
 * reads the usual variables: a request to the public registry then fails instead of passing.
 */
export function deadProxyEnv(): NodeJS.ProcessEnv {
  const proxy = 'http://127.0.0.1:9/';
  const loopback = '127.0.0.1,localhost';
  return {
    npm_config_proxy: proxy,
    npm_config_https_proxy: proxy,
    npm_config_noproxy: loopback,
    HTTP_PROXY: proxy,
    HTTPS_PROXY: proxy,
    NO_PROXY: loopback,
    http_proxy: proxy,
    https_proxy: proxy,
    no_proxy: loopback,
  };
}

interface LockEntry {
  name?: string;
  version?: string;
  resolved?: string;
  integrity?: string;
  link?: boolean;
  os?: string[];
  cpu?: string[];
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/** Whether an `os` / `cpu` list of the lockfile admits this machine (`!x` excludes `x`). */
function admits(list: string[] | undefined, value: string): boolean {
  if (!list || list.length === 0) return true;
  if (list.some((v) => v === `!${value}`)) return false;
  const positive = list.filter((v) => !v.startsWith('!'));
  return positive.length === 0 || positive.includes(value);
}

/**
 * The run-time dependency closure of the root package in `package-lock.json`: from the root's
 * `dependencies`, each dependency located as Node.js finds it (the nearest `node_modules` up the
 * tree), with its `dependencies`, the `optionalDependencies` this machine installs and the
 * `peerDependencies` the lockfile holds. One entry per name and version.
 */
export function runtimeClosure(lockFile = path.join(REPO_ROOT, 'package-lock.json')): LockedPackage[] {
  const packages = (JSON.parse(readFileSync(lockFile, 'utf8')) as { packages: Record<string, LockEntry> }).packages;
  const locate = (from: string, name: string): string | undefined => {
    let base = from;
    for (;;) {
      const key = base ? `${base}/node_modules/${name}` : `node_modules/${name}`;
      if (packages[key]) return key;
      if (!base) return undefined;
      const i = base.lastIndexOf('/node_modules/');
      base = i < 0 ? '' : base.slice(0, i);
    }
  };
  const seen = new Set<string>();
  const found = new Map<string, LockedPackage>();
  const visit = (from: string, deps: Record<string, string> | undefined, required: boolean): void => {
    for (const name of Object.keys(deps ?? {})) {
      const key = locate(from, name);
      if (!key) {
        if (required) throw new Error(`package-lock.json: ${name} (needed by ${from || 'the root'}) not found`);
        continue;
      }
      const entry = packages[key]!;
      if (!admits(entry.os, process.platform) || !admits(entry.cpu, process.arch)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!entry.resolved || !entry.integrity || !entry.version) {
        throw new Error(`package-lock.json: ${key} has no resolved/integrity`);
      }
      found.set(`${name}@${entry.version}`, {
        name,
        version: entry.version,
        resolved: entry.resolved,
        integrity: entry.integrity,
      });
      visit(key, entry.dependencies, true);
      visit(key, entry.optionalDependencies, false);
      visit(key, entry.peerDependencies, false);
    }
  };
  visit('', packages['']!.dependencies, true);
  return [...found.values()];
}

/** A free TCP port on the loopback (the registry binds it right after; a race is unlikely). */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

async function answers(url: string): Promise<boolean> {
  try {
    return (await fetch(`${url}-/ping`)).ok;
  } catch {
    return false;
  }
}

/** Start Verdaccio with no uplink, its files in `dir`, and register a throwaway user. */
export async function startRegistry(dir: string, env: NodeJS.ProcessEnv): Promise<LocalRegistry> {
  await mkdir(dir, { recursive: true });
  const port = await freePort();
  const url = `http://127.0.0.1:${port}/`;
  const config = path.join(dir, 'config.yaml');
  await writeFile(
    config,
    [
      `storage: ${JSON.stringify(path.join(dir, 'storage'))}`,
      'auth:',
      '  htpasswd:',
      `    file: ${JSON.stringify(path.join(dir, 'htpasswd'))}`,
      '    max_users: 1',
      '# No uplink: the registry serves only what the smoke publishes or seeds (task-029 D29-2).',
      'uplinks: {}',
      'packages:',
      "  '@*/*':",
      '    access: $all',
      '    publish: $authenticated',
      "  '**':",
      '    access: $all',
      '    publish: $authenticated',
      'web:',
      '  enable: false',
      'publish:',
      '  allow_offline: true',
      'log: { type: stdout, format: pretty, level: warn }',
      '',
    ].join('\n'),
  );
  const bin = path.join(REPO_ROOT, 'node_modules', 'verdaccio', 'bin', 'verdaccio');
  const child = spawn(process.execPath, [bin, '--config', config, '--listen', `127.0.0.1:${port}`], {
    cwd: dir,
    env: { ...env, ...deadProxyEnv() },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const pgid = child.pid!;
  // An interrupted run (Ctrl-C, SIGTERM, SIGHUP, exit) kills the detached registry too (review R5).
  const removeCleanup = killGroupOnExit(pgid);
  let out = '';
  child.stdout.on('data', (d: Buffer) => (out += String(d)));
  child.stderr.on('data', (d: Buffer) => (out += String(d)));
  let exited = false;
  const gone = new Promise<void>((resolve) =>
    child.once('exit', () => {
      exited = true;
      // Gone on its own: take the handlers off, so a later exit never signals a reused group id.
      removeCleanup();
      resolve();
    }),
  );
  const stop = async (): Promise<void> => {
    if (exited) {
      removeCleanup();
      return;
    }
    try {
      process.kill(-pgid, 'SIGTERM');
    } catch {
      // already gone
    }
    const timer = new Promise<'late'>((resolve) => setTimeout(() => resolve('late'), STOP_MS));
    if ((await Promise.race([gone.then(() => 'done' as const), timer])) === 'late') {
      try {
        process.kill(-pgid, 'SIGKILL');
      } catch {
        // already gone
      }
      await gone;
    }
    removeCleanup();
  };
  try {
    const t0 = Date.now();
    while (!(await answers(url))) {
      if (exited || Date.now() - t0 > START_MS) throw new Error(`Verdaccio did not answer on ${url}: ${out}`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const user = 'wfui-smoke';
    const res = await fetch(`${url}-/user/org.couchdb.user:${user}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: user, password: randomBytes(18).toString('base64url'), type: 'user', roles: [] }),
    });
    const body = (await res.json()) as { token?: string };
    if (!res.ok || !body.token) throw new Error(`Verdaccio refused the throwaway user (${res.status}): ${out}`);
    const token = body.token;
    return { url, pgid, token, authLine: `//127.0.0.1:${port}/:_authToken=${token}`, log: () => out, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

/** The `package.json` at the top folder of a `.tgz` (tar headers read directly, no `tar` process). */
export function tarballManifest(tgz: Buffer): Record<string, unknown> {
  const tar = gunzipSync(tgz);
  let best: { depth: number; data: Buffer } | undefined;
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const field = (start: number, length: number): string =>
      header
        .subarray(start, start + length)
        .toString('utf8')
        .replace(/\0.*$/s, '');
    const prefix = field(345, 155);
    const name = prefix ? `${prefix}/${field(0, 100)}` : field(0, 100);
    const size = parseInt(field(124, 12).trim() || '0', 8);
    const type = field(156, 1);
    const parts = name.split('/').filter(Boolean);
    if ((type === '0' || type === '') && parts.length === 2 && parts[1] === 'package.json') {
      const data = tar.subarray(offset + 512, offset + 512 + size);
      if (!best || parts.length < best.depth) best = { depth: parts.length, data };
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  if (!best) throw new Error('tarball holds no top-level package.json');
  return JSON.parse(best.data.toString('utf8')) as Record<string, unknown>;
}

/**
 * Pack `closure` offline from the npm `cache` into `dir` (one `npm pack` for all), check each
 * tarball against the lockfile's integrity, and put it into `registry` with its publish API.
 * Returns the number of versions seeded.
 */
export async function seedRegistry(
  registry: LocalRegistry,
  closure: readonly LockedPackage[],
  options: { dir: string; env: NodeJS.ProcessEnv; cache: string },
): Promise<number> {
  await mkdir(options.dir, { recursive: true });
  const pack = await run(
    process.execPath,
    [
      npmCli(),
      'pack',
      ...closure.map((p) => p.resolved),
      '--offline',
      '--ignore-scripts',
      '--json',
      '--pack-destination',
      options.dir,
      '--cache',
      options.cache,
    ],
    { cwd: options.dir, env: { ...options.env, ...deadProxyEnv() }, timeoutMs: 300_000 },
  );
  const packed = JSON.parse(pack.stdout) as { name: string; version: string; filename: string; integrity: string }[];
  for (const p of closure) {
    const report = packed.find((r) => r.name === p.name && r.version === p.version);
    if (!report) throw new Error(`npm pack gave no tarball for ${p.name}@${p.version}`);
    const data = await readFile(path.join(options.dir, report.filename));
    const integrity = `sha512-${createHash('sha512').update(data).digest('base64')}`;
    if (integrity !== p.integrity) throw new Error(`${p.name}@${p.version}: integrity differs from package-lock.json`);
    const manifest = tarballManifest(data);
    const unscoped = p.name.replace(/^@[^/]+\//, '');
    const doc = {
      ...manifest,
      _id: `${p.name}@${p.version}`,
      dist: {
        tarball: `${registry.url}${p.name}/-/${unscoped}-${p.version}.tgz`,
        shasum: createHash('sha1').update(data).digest('hex'),
        integrity,
      },
    };
    const res = await fetch(`${registry.url}${p.name.replace('/', '%2f')}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${registry.token}` },
      body: JSON.stringify({
        _id: p.name,
        name: p.name,
        'dist-tags': { latest: p.version },
        versions: { [p.version]: doc },
        _attachments: {
          [`${p.name}-${p.version}.tgz`]: {
            content_type: 'application/octet-stream',
            data: data.toString('base64'),
            length: data.length,
          },
        },
      }),
    });
    if (!res.ok) throw new Error(`seeding ${p.name}@${p.version} refused (${res.status}): ${await res.text()}`);
  }
  return closure.length;
}
