// The project-list routes (spec-004 §3, spec-006 §2–§3): `GET/POST /api/projects`,
// `POST /api/projects/clone`, `DELETE /api/projects/:pid` on the real application, the file store
// in a temporary state directory, real git and the pinned CLI on copies of the kanban fixture.
// - TT-STATE-07 (REQ-STATE-07): S-03.2, S-04.3, S-05.1, S-05.2, S-06.1, S-06.2, S-07.1, S-07.2,
//   S-07.3, S-18.1, S-19.1, S-19.2, S-10.2 (API side; the screens close in task-014/015); after
//   each refusal the state file and the file system are unchanged.
// - TT-INT-06 (REQ-INT-06): every git process of this file runs an allowed subcommand (afterAll).
// - TT-ARC-03 (REQ-ARC-03): no endpoint writes an existing repository; a clone adds no commit.
// - REQ-SEC-05 probe through the clone route (task-001 hand-over), REQ-SEC-09 secret scan after a
//   refused clone with a credential URL (task-007 hand-over; bug-006: such a URL is refused, 422
//   `credentials-in-url`, before anything runs).
import { Ajv } from 'ajv';
import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import {
  appendFile,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import { InProcessEventBus } from '../../../server/src/events/bus.js';
import { GIT_ALLOWED_SUBCOMMANDS, gitSubcommand } from '../../../server/src/git/git.js';
import { buildApp } from '../../../server/src/http/app.js';
import { registerProjectListRoutes } from '../../../server/src/http/projects.js';
import { createLogger } from '../../../server/src/logging.js';
import { InProcessWriteLock } from '../../../server/src/process/write-lock.js';
import { ProjectList } from '../../../server/src/projects/project-list.js';
import { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { openFileStateStore, STATE_FILE } from '../../../server/src/state/file-store.js';
import { PINNED_PACKAGE_DIR, REPO_ROOT } from '../../harness/cli.js';
import {
  buildFixture,
  copyFixture,
  envWithoutWingfoil,
  installCliStub,
  removeCli,
  type Fixture,
} from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';
import { scanForSecrets } from '../../harness/secret-scan.js';
import { PWNED_PATH, pwned, SHELL_PAYLOAD } from '../../harness/security.js';
import { installGlobally, withPathFirst } from '../cli/fake-cli.js';
import { AuditedRunner, processKind } from '../snapshot/support.js';

const security = { authentication: createTokenAuthentication('test-token'), port: () => 80 };
const AUTH = { authorization: 'Bearer test-token' };
const INSTALL = 'npm install --save-dev wingfoil';
const ajv = new Ajv({ allErrors: true });
const schema = async (file: string): Promise<object> =>
  JSON.parse(await readFile(path.join(REPO_ROOT, 'contracts/api', file), 'utf8')) as object;
ajv.addSchema(await schema('projects.item.schema.json'));
const validList = ajv.compile(await schema('projects.list.response.schema.json'));
const validItem = ajv.getSchema('https://wingfoil-ui.local/contracts/api/projects.item.schema.json')!;
const validRefusal = ajv.compile(await schema('projects.refusal.schema.json'));

let root: string;
let template: Fixture;
let n = 0;
/** One runner for the whole file: the process audit of TT-INT-06 covers every request made here. */
const runner = new AuditedRunner();
const apps: FastifyInstance[] = [];
const registries: Snapshots[] = [];
const servers: http.Server[] = [];

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-projects-')));
  template = await buildFixture('kanban', { root: path.join(root, 'template') });
}, 600_000);

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
  for (const s of registries.splice(0)) await s.closeAll();
  for (const s of servers.splice(0)) {
    s.closeAllConnections();
    await new Promise((r) => s.close(r));
  }
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

interface World {
  dir: string;
  fx: Fixture;
  env: NodeJS.ProcessEnv;
  stateDir: string;
  home: string;
  events: string[];
  /** Every log line the application wrote (REQ-SEC-09 scan). */
  logs: string[];
  projects: ProjectList;
  snapshots: Snapshots;
  app: FastifyInstance;
}

/**
 * A fixture copy under its own folder, a state directory next to it, and the application. The
 * `PATH` holds no `wingfoil` but the pinned package installed globally (a fresh clone has no
 * `node_modules`), unless `cliOnPath` is false.
 */
async function world(
  options: { cliOnPath?: boolean; stateDir?: (fx: Fixture) => string; hooksPath?: string } = {},
): Promise<World> {
  n += 1;
  const dir = path.join(root, `w${n}`);
  const fx = await copyFixture(template, dir);
  let env = await envWithoutWingfoil(fx.env, path.join(dir, 'bin'));
  delete env.SSH_ASKPASS;
  if (options.cliOnPath ?? true) {
    env = withPathFirst(env, await installGlobally(path.join(dir, 'prefix'), PINNED_PACKAGE_DIR));
  }
  const stateDir = options.stateDir?.(fx) ?? path.join(dir, 'state');
  const store = await openFileStateStore({ dir: stateDir });
  const bus = new InProcessEventBus();
  const events: string[] = [];
  bus.subscribe((e) => events.push(e.event));
  const snapshots = new Snapshots({ runner, bus, env, watch: false, fallbackMs: 0 });
  registries.push(snapshots);
  const projects = new ProjectList({
    store,
    snapshots,
    bus,
    runner,
    writeLock: new InProcessWriteLock(),
    stateDir,
    env,
    homedir: fx.home,
    ...(options.hooksPath !== undefined ? { hooksPath: options.hooksPath } : {}),
  });
  const logs: string[] = [];
  const captured = new Writable({
    write: (chunk, _e, cb) => {
      logs.push(String(chunk));
      cb();
    },
  });
  const app = await buildApp({
    staticDir: '/nonexistent',
    logger: createLogger(captured),
    security,
    register: (a) => registerProjectListRoutes(a, { projects }),
  });
  apps.push(app);
  return { dir, fx, env, stateDir, home: fx.home, events, logs, projects, snapshots, app };
}

function post(w: World, url: string, body: unknown) {
  return w.app.inject({
    method: 'POST',
    url,
    headers: { 'content-type': 'application/json', ...AUTH },
    payload: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
/** A 201 answers a list item valid against `contracts/api/projects.item.schema.json`. */
async function created<T extends { statusCode: number; json(): unknown }>(answer: Promise<T>): Promise<T> {
  const res = await answer;
  if (res.statusCode === 201) expect(validItem(res.json()), JSON.stringify(validItem.errors)).toBe(true);
  return res;
}
const add = (w: World, p: string) => created(post(w, '/api/projects', { path: p }));
const clone = (w: World, body: { url: string; directory?: string }) => created(post(w, '/api/projects/clone', body));
const list = async (w: World) => {
  const res = await w.app.inject({ method: 'GET', url: '/api/projects', headers: AUTH });
  expect(res.statusCode).toBe(200);
  expect(validList(res.json()), JSON.stringify(validList.errors)).toBe(true);
  return (res.json() as { projects: { id: string; name: string; path: string; availability: string }[] }).projects;
};
const remove = (w: World, pid: string) =>
  w.app.inject({ method: 'DELETE', url: `/api/projects/${pid}`, headers: AUTH });

/** Every path under `dir` with its content hash (links: their target, never followed). */
async function tree(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  async function walk(rel: string): Promise<void> {
    const abs = path.join(dir, rel);
    const info = await lstat(abs).catch(() => undefined);
    if (!info) return;
    if (info.isSymbolicLink()) out[rel] = `link:${await readlink(abs)}`;
    else if (info.isDirectory()) {
      out[`${rel}/`] = 'dir';
      for (const name of (await readdir(abs)).sort()) await walk(path.join(rel, name));
    } else
      out[rel] = createHash('sha256')
        .update(await readFile(abs))
        .digest('hex');
  }
  await walk('.');
  return out;
}

async function log(dir: string, env: NodeJS.ProcessEnv): Promise<string> {
  return (await git(dir, ['log', '--all', '--format=%H %s'], env)).stdout;
}

/** A git repository without `.wingfoil/` (S-05.1), with one commit. */
async function plainRepo(dir: string, env: NodeJS.ProcessEnv): Promise<string> {
  await mkdir(dir, { recursive: true });
  await git(dir, ['init', '-q'], env);
  await writeFile(path.join(dir, 'README.md'), '# plain\n');
  await git(dir, ['add', '-A'], env);
  await git(dir, ['-c', 'user.name=T', '-c', 'user.email=t@example.test', 'commit', '-qm', 'init'], env);
  return dir;
}

/**
 * A git "dumb HTTP" server for the bare repositories under `base` (`git update-server-info` run on
 * each). With `credentials`, every request needs that Basic authorization, else 401.
 */
async function httpRemote(
  base: string,
  options: { credentials?: string; hang?: boolean; delayMs?: number } = {},
): Promise<string> {
  const { credentials, hang = false, delayMs = 0 } = options;
  const server = http.createServer(async (req, res) => {
    if (hang) return; // never answers: the clone waits until it is cancelled
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    if (credentials && req.headers.authorization !== `Basic ${Buffer.from(credentials).toString('base64')}`) {
      res.writeHead(401, { 'www-authenticate': 'Basic realm="test"' }).end();
      return;
    }
    const file = path.join(base, decodeURIComponent((req.url ?? '/').split('?')[0]!));
    if (!file.startsWith(base)) return void res.writeHead(404).end();
    readFile(file).then(
      (data) => res.writeHead(200, { 'content-type': 'application/octet-stream' }).end(data),
      () => res.writeHead(404).end(),
    );
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return `127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function refusal(
  res: { statusCode: number; json(): unknown },
  code: string,
): Promise<{ message: string; detail?: unknown }> {
  expect(res.statusCode, JSON.stringify(res.json())).toBe(422);
  const body = res.json() as { error: { code: string; message: string; detail?: unknown } };
  expect(body.error.code).toBe(code);
  expect(validRefusal(body), JSON.stringify(validRefusal.errors)).toBe(true);
  return body.error;
}

describe('GET /api/projects and POST /api/projects (local folder)', () => {
  it('S-03.1 lists nothing, adds the kanban fixture with its DNA name, origin and availability, and opens its snapshot', async () => {
    const w = await world();
    expect(await list(w)).toEqual([]);
    const res = await add(w, w.fx.dir);
    expect(res.statusCode).toBe(201);
    const item = res.json() as Record<string, string>;
    expect(item).toEqual({
      id: expect.stringMatching(/^p_[0-9a-z]{12}$/),
      name: 'kanban',
      path: await realpath(w.fx.dir),
      remote: w.fx.remoteUrl,
      availability: 'ok',
    });
    expect(await list(w)).toEqual([item]);
    expect(w.snapshots.get(item.id!)).toBeDefined();
    expect(w.events).toContain('projects');
    const state = JSON.parse(await readFile(path.join(w.stateDir, STATE_FILE), 'utf8')) as { projects: unknown[] };
    expect(state.projects).toHaveLength(1);
  });

  it('expands a leading ~ to the home directory', async () => {
    const w = await world();
    await cp(w.fx.dir, path.join(w.home, 'kanban'), { recursive: true, verbatimSymlinks: true });
    const res = await add(w, '~/kanban');
    expect(res.statusCode).toBe(201);
    expect((res.json() as { path: string }).path).toBe(path.join(w.home, 'kanban'));
  });

  it('S-03.2 refuses a path that does not exist, or a file: folder-not-found with the path as given', async () => {
    const w = await world();
    const before = await tree(w.dir);
    const missing = path.join(w.dir, 'does-not-exist');
    expect((await refusal(await add(w, `${missing} `), 'folder-not-found')).detail).toEqual({ path: missing });
    const file = path.join(w.fx.dir, 'package.json');
    expect((await refusal(await add(w, file), 'folder-not-found')).detail).toEqual({ path: file });
    expect(await list(w)).toEqual([]);
    expect(await tree(w.dir)).toEqual(before);
  });

  it('S-05.1 refuses a git repository without .wingfoil/: not-wingfoil', async () => {
    const w = await world();
    const plain = await plainRepo(path.join(w.dir, 'plain-repo'), w.env);
    const before = await tree(w.dir);
    expect((await refusal(await add(w, plain), 'not-wingfoil')).detail).toEqual({ path: plain });
    expect(await list(w)).toEqual([]);
    expect(await tree(w.dir)).toEqual(before);
  });

  it('S-06.1 refuses the same folder twice, also through a symbolic link: already-listed, not the same remote', async () => {
    const w = await world();
    const first = (await add(w, w.fx.dir)).json() as { id: string };
    const link = path.join(w.dir, 'kanban-link');
    await symlink(w.fx.dir, link);
    const before = await tree(w.dir);
    for (const p of [w.fx.dir, link, `${w.fx.dir}/`]) {
      expect((await refusal(await add(w, p), 'already-listed')).detail).toEqual({
        pid: first.id,
        name: 'kanban',
        sameRemote: false,
      });
    }
    expect(await list(w)).toHaveLength(1);
    expect(await tree(w.dir)).toEqual(before);
  });

  it('S-06.2 refuses a second working copy of a listed remote: already-listed, same remote', async () => {
    const w = await world();
    const first = (await add(w, w.fx.dir)).json() as { id: string };
    const second = path.join(w.dir, 'kanban-second');
    await git(w.dir, ['clone', '-q', w.fx.remoteDir, second], w.env);
    const before = await tree(w.dir);
    expect((await refusal(await add(w, second), 'already-listed')).detail).toEqual({
      pid: first.id,
      name: 'kanban',
      sameRemote: true,
    });
    expect(await list(w)).toHaveLength(1);
    expect(await tree(w.dir)).toEqual(before);
  });

  it('S-10.1 refuses a project with no CLI: cli-not-found with the install command', async () => {
    const w = await world({ cliOnPath: false });
    await removeCli(w.fx);
    const before = await tree(w.dir);
    const error = await refusal(await add(w, w.fx.dir), 'cli-not-found');
    // No absolute path in the body (bug-012, coordinator C2).
    expect(error.detail).toEqual({ command: INSTALL });
    expect(JSON.stringify(error)).not.toContain(w.fx.dir);
    expect(await list(w)).toEqual([]);
    expect(await tree(w.dir)).toEqual(before);
  });

  it('refuses a project whose working tree holds the state directory: state-dir-inside-project', async () => {
    const w = await world({ stateDir: (fx) => path.join(fx.dir, '.state') });
    const error = await refusal(await add(w, w.fx.dir), 'state-dir-inside-project');
    expect(error.detail).toEqual({ path: w.fx.dir, stateDir: path.join(w.fx.dir, '.state') });
    expect(await list(w)).toEqual([]);
  });

  it('refuses a folder with .wingfoil/ that is not a git repository: git-refused with git message', async () => {
    const w = await world();
    const loose = path.join(w.dir, 'loose');
    await cp(path.join(w.fx.dir, '.wingfoil'), path.join(loose, '.wingfoil'), { recursive: true });
    const error = await refusal(await add(w, loose), 'git-refused');
    expect(error.message).toMatch(/not a git repository/);
    expect(await list(w)).toEqual([]);
  });

  it('names the project after its folder when dna.project.name is absent', async () => {
    const w = await world();
    const named = path.join(w.dir, 'unnamed-board');
    await rename(w.fx.dir, named);
    const dna = path.join(named, '.wingfoil', 'dna.yaml');
    await writeFile(dna, (await readFile(dna, 'utf8')).replace(/^(\s+)name:\s*["']?kanban["']?\s*$/m, ''));
    const res = await add(w, named);
    expect(res.statusCode, res.body).toBe(201);
    expect((res.json() as { name: string }).name).toBe('unnamed-board');
  });

  it.each([
    ['no body field', {}],
    ['a number', { path: 3 }],
    ['an empty path', { path: '' }],
    ['a relative path', { path: 'projects/kanban' }],
    ['an extra field', { path: '/tmp', extra: true }],
    ['not JSON', 'nope'],
  ])('answers 400 invalid-request to %s', async (_name, body) => {
    const w = await world();
    const res = await post(w, '/api/projects', body);
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: { code: string } }).error.code).toBe('invalid-request');
  });
});

describe('availability and the projects event (S-10.2, S-19.1, S-19.2)', () => {
  it('S-19.1 / S-19.2 marks a moved folder folder-not-found without blocking the others, and recovers', async () => {
    const w = await world();
    const kanban = (await add(w, w.fx.dir)).json() as { id: string };
    const other = await copyFixture(template, path.join(w.dir, 'other'));
    await git(other.dir, ['remote', 'set-url', 'origin', 'https://example.test/other.git'], w.env);
    const custom = (await add(w, other.dir)).json() as { id: string };
    await list(w);
    const moved = `${w.fx.dir}-moved`;
    await rename(w.fx.dir, moved);
    w.events.length = 0;
    const byId = async () => Object.fromEntries((await list(w)).map((p) => [p.id, p.availability]));
    expect(await byId()).toEqual({ [kanban.id]: 'folder-not-found', [custom.id]: 'ok' });
    expect(w.events).toEqual(['projects']);
    w.events.length = 0;
    await w.projects.check();
    expect(w.events).toEqual([]);
    await rename(moved, w.fx.dir);
    await w.projects.check();
    expect(w.events).toEqual(['projects']);
    expect(await byId()).toEqual({ [kanban.id]: 'ok', [custom.id]: 'ok' });
  });

  it('marks a folder whose .wingfoil/ was removed not-wingfoil', async () => {
    const w = await world();
    const kanban = (await add(w, w.fx.dir)).json() as { id: string };
    await rename(path.join(w.fx.dir, '.wingfoil'), path.join(w.fx.dir, '.wingfoil-gone'));
    expect(await list(w)).toEqual([expect.objectContaining({ id: kanban.id, availability: 'not-wingfoil' })]);
  });

  it('S-10.2 marks a listed project whose CLI disappeared cli-not-found, with the install command', async () => {
    const w = await world({ cliOnPath: false });
    const kanban = (await add(w, w.fx.dir)).json() as { id: string };
    await removeCli(w.fx);
    w.events.length = 0;
    await w.projects.check();
    expect(w.events).toEqual(['projects']);
    expect(await list(w)).toEqual([
      expect.objectContaining({ id: kanban.id, availability: 'cli-not-found', command: INSTALL }),
    ]);
  });

  it('sees another console add to the same state directory, and publishes it', async () => {
    const w = await world();
    await list(w);
    const other = await openFileStateStore({ dir: w.stateDir });
    await other.add({ path: w.fx.dir, name: 'kanban', remote: '' });
    w.events.length = 0;
    await w.projects.check();
    expect(w.events).toEqual(['projects']);
    expect(await list(w)).toHaveLength(1);
  });

  it('runs the check periodically once started, and stops', async () => {
    const w = await world();
    let checks = 0;
    const original = w.projects.check.bind(w.projects);
    w.projects.check = async () => {
      checks += 1;
      await original();
    };
    w.projects.start(20);
    await expect.poll(() => checks, { timeout: 5_000 }).toBeGreaterThanOrEqual(2);
    w.projects.stop();
    const at = checks;
    await new Promise((r) => setTimeout(r, 100));
    expect(checks).toBe(at);
  });
});

describe('DELETE /api/projects/:pid (S-18.1)', () => {
  it('removes the entry, closes its snapshot and touches no file of the project', async () => {
    const w = await world();
    const kanban = (await add(w, w.fx.dir)).json() as { id: string };
    const before = await tree(w.fx.dir);
    const history = await log(w.fx.dir, w.env);
    w.events.length = 0;
    const res = await remove(w, kanban.id);
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    expect(await list(w)).toEqual([]);
    expect(w.snapshots.get(kanban.id)).toBeUndefined();
    expect(w.events).toContain('projects');
    expect(await tree(w.fx.dir)).toEqual(before);
    expect(await log(w.fx.dir, w.env)).toBe(history);
  });

  it('answers 404 not-found to an unknown or path-like id', async () => {
    const w = await world();
    const kanban = (await add(w, w.fx.dir)).json() as { id: string };
    for (const pid of [
      'p_zzzzzzzzzzzz',
      '..%2F..%2Fetc',
      kanban.id.toUpperCase(),
      encodeURIComponent(`${kanban.id} `),
    ]) {
      const res = await remove(w, pid);
      expect(res.statusCode, pid).toBe(404);
      expect((res.json() as { error: { code: string } }).error.code).toBe('not-found');
    }
    expect(await list(w)).toHaveLength(1);
  });
});

describe('POST /api/projects/clone (S-04, S-05.2, S-06, S-07)', () => {
  it('S-04.3 clones the remote into ~/projects/kanban and lists it; the clone adds no commit (TT-ARC-03)', async () => {
    const w = await world();
    const res = await clone(w, { url: w.fx.remoteUrl, directory: '~/projects/kanban' });
    expect(res.statusCode, res.body).toBe(201);
    const target = path.join(w.home, 'projects', 'kanban');
    expect(res.json()).toEqual({
      id: expect.stringMatching(/^p_/),
      name: 'kanban',
      path: target,
      remote: w.fx.remoteUrl,
      availability: 'ok',
    });
    expect((await git(target, ['rev-parse', 'HEAD'], w.env)).stdout).toBe(
      (await git(w.fx.remoteDir, ['rev-parse', 'HEAD'], w.env)).stdout,
    );
    expect((await git(target, ['log', '--format=%H'], w.env)).stdout).toBe(
      (await git(w.fx.remoteDir, ['log', '--format=%H'], w.env)).stdout,
    );
    expect((await git(target, ['status', '--porcelain'], w.env)).stdout).toBe('');
    expect((await git(target, ['remote', 'get-url', 'origin'], w.env)).stdout.trim()).toBe(w.fx.remoteUrl);
    expect(await list(w)).toHaveLength(1);
    expect(w.events).toContain('projects');
  });

  it('fills the working directory ~/projects/<repo> when none is given', async () => {
    const w = await world();
    const res = await clone(w, { url: w.fx.remoteUrl });
    expect(res.statusCode, res.body).toBe(201);
    expect((res.json() as { path: string }).path).toBe(path.join(w.home, 'projects', 'kanban'));
  });

  it('S-04.2 uses the working directory typed instead of the auto-filled one', async () => {
    const w = await world();
    const res = await clone(w, { url: w.fx.remoteUrl, directory: '~/work/kanban-copy' });
    expect(res.statusCode, res.body).toBe(201);
    expect((await lstat(path.join(w.home, 'work', 'kanban-copy', '.wingfoil'))).isDirectory()).toBe(true);
    await expect(lstat(path.join(w.home, 'projects', 'kanban'))).rejects.toThrow();
  });

  it('S-05.2 refuses a remote whose clone has no .wingfoil/ and removes the clone', async () => {
    const w = await world();
    const plain = await plainRepo(path.join(w.dir, 'plain-src'), w.env);
    const bare = path.join(w.dir, 'remotes', 'plain.git');
    await git(w.dir, ['clone', '-q', '--bare', plain, bare], w.env);
    const before = await tree(w.dir);
    const error = await refusal(
      await clone(w, { url: `file://${bare}`, directory: '~/projects/plain' }),
      'not-wingfoil',
    );
    expect(error.detail).toEqual({ source: 'clone' });
    expect(await tree(w.dir)).toEqual(before);
    expect(await list(w)).toEqual([]);
  });

  it('S-06 refuses a listed remote before cloning: already-listed, same remote, no git process', async () => {
    const w = await world();
    const kanban = (await add(w, w.fx.dir)).json() as { id: string };
    const before = await tree(w.dir);
    for (const url of [w.fx.remoteUrl, `${w.fx.remoteUrl.replace(/\.git$/, '')}/`, w.fx.remoteDir]) {
      const spawned = runner.spawned.length;
      const error = await refusal(await clone(w, { url, directory: '~/projects/again' }), 'already-listed');
      expect(error.detail).toEqual({ pid: kanban.id, name: 'kanban', sameRemote: true });
      expect(runner.spawned.length - spawned).toBe(0);
    }
    expect(await tree(w.dir)).toEqual(before);
  });

  it('S-07.1 reports an unreachable remote with git message and leaves nothing', async () => {
    const w = await world();
    const before = await tree(w.dir);
    const error = await refusal(
      await clone(w, { url: 'https://git.invalid/team/project.git', directory: '~/projects/project' }),
      'git-refused',
    );
    expect(error.message).toMatch(/git\.invalid/);
    expect(error.detail).toBeUndefined();
    expect(await tree(w.dir)).toEqual(before);
    expect(await list(w)).toEqual([]);
  }, 60_000);

  it('S-07.2 refuses a working directory that is not empty, starting no git process', async () => {
    const w = await world();
    await mkdir(path.join(w.home, 'projects', 'kanban'), { recursive: true });
    await writeFile(path.join(w.home, 'projects', 'kanban', 'notes.txt'), 'mine\n');
    const before = await tree(w.dir);
    const spawned = runner.spawned.length;
    const error = await refusal(
      await clone(w, { url: w.fx.remoteUrl, directory: '~/projects/kanban' }),
      'directory-not-empty',
    );
    expect(error.detail).toEqual({ path: '~/projects/kanban' });
    expect(runner.spawned.length).toBe(spawned);
    expect(await readdir(path.join(w.home, 'projects', 'kanban'))).toEqual(['notes.txt']);
    expect(await tree(w.dir)).toEqual(before);
  });

  it('clones into an existing empty folder, and leaves it empty when refused', async () => {
    const w = await world();
    const target = path.join(w.home, 'projects', 'empty');
    await mkdir(target, { recursive: true });
    const plain = await plainRepo(path.join(w.dir, 'plain-src'), w.env);
    const before = await tree(w.dir);
    await refusal(await clone(w, { url: plain, directory: target }), 'not-wingfoil');
    expect(await tree(w.dir)).toEqual(before);
    const res = await clone(w, { url: w.fx.remoteUrl, directory: target });
    expect(res.statusCode, res.body).toBe(201);
  });

  it('S-07.3 reports a refused authentication with git message, without prompting', async () => {
    const w = await world();
    const host = await httpRemote(path.join(w.dir, 'remotes'), { credentials: 'alex:right' });
    const before = await tree(w.dir);
    const error = await refusal(
      await clone(w, { url: `http://${host}/kanban.git`, directory: '~/projects/private' }),
      'git-refused',
    );
    expect(error.message).toMatch(/Authentication failed|could not read Username/);
    expect(await tree(w.dir)).toEqual(before);
    expect(await list(w)).toEqual([]);
  }, 60_000);

  it('S-06.2 refuses the same http remote written differently (scheme and host case, trailing /) before cloning', async () => {
    const w = await world();
    await git(w.fx.remoteDir, ['update-server-info'], w.env);
    const host = await httpRemote(path.join(w.dir, 'remotes'));
    const res = await clone(w, { url: `http://${host}/kanban.git`, directory: '~/projects/kanban' });
    expect(res.statusCode, res.body).toBe(201);
    expect((res.json() as { remote: string }).remote).toBe(`http://${host}/kanban.git`);
    const spawned = runner.spawned.length;
    await refusal(await clone(w, { url: `HTTP://${host.toUpperCase()}/kanban/`, directory: '~/x' }), 'already-listed');
    expect(runner.spawned.slice(spawned).filter((r) => r.args.includes('clone'))).toEqual([]);
  }, 60_000);

  // bug-006 (W5-14, W5-15, decided by the user 2026-10-10): a URL with userinfo in an http(s)/ftp(s)
  // URL is refused before anything runs, so no credential reaches a command line, a file or the state.
  it.each([
    ['a password', (host: string, secret: string) => `http://alex:${secret}@${host}/kanban.git`],
    ["a token in the user's place", (host: string, secret: string) => `http://${secret}@${host}/kanban.git`],
    // git's `<transport>::<address>` form (review round 1): the address is judged.
    ['the transport form', (host: string, secret: string) => `http::http://alex:${secret}@${host}/kanban.git`],
    // Review round 2: extra slashes after the scheme (curl still reads the userinfo).
    ['three slashes', (host: string, secret: string) => `http:///alex:${secret}@${host}/kanban.git`],
    // W5-18 (decided by the user 2026-10-11): a password in an ssh:// URL or a scp-like address.
    ['an ssh password', (host: string, secret: string) => `ssh://alex:${secret}@${host}/kanban.git`],
    ['a scp-like password', (_host: string, secret: string) => `alex:${secret}@git.invalid:acme/kanban.git`],
    // W5-19 (decided by the user 2026-10-11): any userinfo of a git:// URL.
    ['a git:// userinfo', (host: string, secret: string) => `git://alex:${secret}@${host}/kanban.git`],
  ])(
    'bug-006 refuses a clone URL holding %s: credentials-in-url, nothing run or written (REQ-SEC-09)',
    async (_name, urlOf) => {
      const w = await world();
      const secret = 's3cret-token-0123456789';
      await git(w.fx.remoteDir, ['update-server-info'], w.env);
      const host = await httpRemote(path.join(w.dir, 'remotes'), { credentials: `alex:${secret}` });
      const before = await tree(w.dir);
      const spawned = runner.spawned.length;
      const res = await clone(w, { url: urlOf(host, secret), directory: '~/projects/kanban' });
      const error = await refusal(res, 'credentials-in-url');
      expect(error.detail).toBeUndefined();
      expect(res.body).not.toContain(secret);
      // No git process (nor any other) started for the request: nothing on a command line.
      expect(runner.spawned.slice(spawned)).toEqual([]);
      expect(await tree(w.dir)).toEqual(before);
      expect(await list(w)).toEqual([]);
      expect(w.logs.length).toBeGreaterThan(0);
      expect(w.logs.join('')).not.toContain(secret);
      expect(await scanForSecrets([w.stateDir], [secret])).toEqual([]);
    },
    60_000,
  );

  it('refuses a clone URL with a control character: invalid-request, nothing run (review round 3)', async () => {
    const w = await world();
    const spawned = runner.spawned.length;
    const res = await post(w, '/api/projects/clone', { url: 'https\n://alex:pw@git.invalid/r.git', directory: '~/x' });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: { code: string } }).error.code).toBe('invalid-request');
    expect(res.body).not.toContain('alex:pw');
    expect(runner.spawned.slice(spawned)).toEqual([]);
  });

  it('bug-006 refuses credentials before any other check: an existing folder is not reported', async () => {
    const w = await world();
    const res = await clone(w, { url: 'https://alex:pw@git.invalid/team/project.git', directory: w.fx.dir });
    await refusal(res, 'credentials-in-url');
  });

  it.each(['ssh://git@git.invalid/team/project.git', 'git@git.invalid:team/project.git'])(
    'bug-006 keeps an SSH login (%s): the next check answers, not credentials-in-url',
    async (url) => {
      const w = await world();
      await refusal(await clone(w, { url, directory: w.fx.dir }), 'directory-not-empty');
    },
  );

  it.each([
    ['ext::', `ext::sh -c touch% ${PWNED_PATH}`],
    ['fd::', 'fd::17'],
  ])('refuses the %s transport: git-refused, nothing run', async (_name, url) => {
    expect(pwned(), `${PWNED_PATH} exists before the test: remove it and re-run`).toBe(false);
    const w = await world();
    const before = await tree(w.dir);
    const error = await refusal(await clone(w, { url, directory: '~/projects/x' }), 'git-refused');
    expect(error.message).toMatch(/not allowed/);
    expect(pwned()).toBe(false);
    expect(await tree(w.dir)).toEqual(before);
  });

  it('keeps a folder created next to the clone meanwhile when the clone is refused', async () => {
    const w = await world();
    const plain = await plainRepo(path.join(w.dir, 'plain-src'), w.env);
    const bare = path.join(w.dir, 'remotes', 'plain.git');
    await git(w.dir, ['clone', '-q', '--bare', plain, bare], w.env);
    await git(bare, ['update-server-info'], w.env);
    const host = await httpRemote(path.join(w.dir, 'remotes'), { delayMs: 300 });
    const running = runner.running;
    const answer = clone(w, { url: `http://${host}/plain.git`, directory: '~/projects/deep/plain' });
    await expect.poll(() => runner.running, { timeout: 10_000 }).toBeGreaterThan(running);
    await mkdir(path.join(w.home, 'projects'), { recursive: true });
    await writeFile(path.join(w.home, 'projects', 'sibling.txt'), 'mine\n');
    await refusal(await answer, 'not-wingfoil');
    expect(await readdir(path.join(w.home, 'projects'))).toEqual(['sibling.txt']);
  }, 60_000);

  it('REQ-SEC-05 clones a remote and a working directory whose paths hold a shell payload, literally', async () => {
    expect(pwned(), `${PWNED_PATH} exists before the test: remove it and re-run`).toBe(false);
    const w = await world();
    const remote = path.join(w.dir, `remote${SHELL_PAYLOAD}.git`);
    await cp(w.fx.remoteDir, remote, { recursive: true });
    const target = path.join(w.dir, `work${SHELL_PAYLOAD}dir`);
    const res = await clone(w, { url: `file://${remote}`, directory: target });
    expect(res.statusCode, res.body).toBe(201);
    expect((res.json() as { path: string }).path).toBe(target);
    expect((await lstat(path.join(target, '.wingfoil'))).isDirectory()).toBe(true);
    expect(pwned()).toBe(false);
  });

  it('keeps and lists a clone whose project has no CLI, marked cli-not-found (decided 2026-10-06)', async () => {
    const w = await world({ cliOnPath: false });
    const res = await clone(w, { url: w.fx.remoteUrl, directory: '~/projects/kanban' });
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json()).toEqual(
      expect.objectContaining({ name: 'kanban', availability: 'cli-not-found', command: INSTALL }),
    );
    expect((await lstat(path.join(w.home, 'projects', 'kanban', '.wingfoil'))).isDirectory()).toBe(true);
    expect(await list(w)).toEqual([expect.objectContaining({ availability: 'cli-not-found' })]);
  });

  it.skipIf(process.platform === 'win32')(
    "runs no hook of the cloned repository, even with a relative core.hooksPath in the user's git configuration",
    async () => {
      const w = await world();
      const marker = path.join(w.dir, 'hook-ran.txt');
      const src = await copyFixture(template, path.join(w.dir, 'hooked'));
      const hook = path.join(src.dir, '.githooks', 'post-checkout');
      await mkdir(path.dirname(hook), { recursive: true });
      await writeFile(hook, `#!/bin/sh\necho ran >> '${marker}'\n`, { mode: 0o755 });
      await git(src.dir, ['add', '.githooks'], w.env);
      await git(src.dir, ['-c', 'user.name=T', '-c', 'user.email=t@example.test', 'commit', '-qm', 'hooks'], w.env);
      await git(src.dir, ['push', '-q', 'origin', 'HEAD'], w.env);
      // The user's global configuration: hooks from the working tree (a husky-like set-up).
      await appendFile(w.env.GIT_CONFIG_GLOBAL!, '[core]\n\thooksPath = .githooks\n');
      const res = await clone(w, { url: `file://${src.remoteDir}`, directory: '~/projects/hooked' });
      expect(res.statusCode, res.body).toBe(201);
      expect((await lstat(path.join(w.home, 'projects', 'hooked', '.githooks', 'post-checkout'))).isFile()).toBe(true);
      await list(w);
      await w.projects.check();
      await expect(lstat(marker)).rejects.toThrow();
    },
  );

  it('answers internal (500) with no path and runs no git when the hooks path is unusable (task-026 F1)', async () => {
    const missing = path.join(root, 'no-such-hooks-file');
    const w = await world({ hooksPath: missing });
    const spawned = runner.spawned.length;
    const res = await post(w, '/api/projects/clone', {
      url: `file://${w.fx.remoteDir}`,
      directory: '~/projects/no-hooks',
    });
    expect(res.statusCode, res.body).toBe(500);
    expect(res.json()).toEqual({ error: { code: 'internal', message: 'Internal error' } });
    expect(res.body).not.toContain(missing);
    expect(res.body).not.toContain('hooks');
    expect(runner.spawned.slice(spawned).filter((r) => gitSubcommand(r.args) === 'clone')).toEqual([]);
    await expect(lstat(path.join(w.home, 'projects', 'no-hooks'))).rejects.toThrow();
    // The details go to the server log only.
    expect(w.logs.join('')).toContain(missing);
    expect(await list(w)).toEqual([]);
  });

  it('runs no CLI of the cloned repository: a committed node_modules/wingfoil never runs, name = folder', async () => {
    const w = await world();
    const marker = path.join(w.dir, 'cli-ran.txt');
    const src = await copyFixture(template, path.join(w.dir, 'hostile'));
    await rm(path.join(src.dir, 'node_modules'), { recursive: true, force: true });
    const pkg = path.join(src.dir, 'node_modules', 'wingfoil');
    await mkdir(pkg, { recursive: true });
    await writeFile(
      path.join(pkg, 'package.json'),
      JSON.stringify({ name: 'wingfoil', version: '0.2.2', bin: { wingfoil: 'bin.js' } }),
    );
    await writeFile(
      path.join(pkg, 'bin.js'),
      `require('node:fs').appendFileSync(${JSON.stringify(marker)}, 'ran\\n'); process.stdout.write('{}');\n`,
    );
    await git(src.dir, ['add', '-f', 'node_modules/wingfoil'], w.env);
    await git(
      src.dir,
      ['-c', 'user.name=T', '-c', 'user.email=t@example.test', 'commit', '-qm', 'vendored cli'],
      w.env,
    );
    await git(src.dir, ['push', '-q', 'origin', 'HEAD'], w.env);
    const res = await clone(w, { url: `file://${src.remoteDir}`, directory: '~/projects/board-x' });
    expect(res.statusCode, res.body).toBe(201);
    expect((res.json() as { name: string; availability: string }).name).toBe('board-x');
    expect((await lstat(path.join(w.home, 'projects', 'board-x', 'node_modules', 'wingfoil', 'bin.js'))).isFile()).toBe(
      true,
    );
    await list(w);
    await w.projects.check();
    await expect(lstat(marker)).rejects.toThrow();
  });

  it.each([
    ['inside a listed project .wingfoil/', (w: World) => path.join(w.fx.dir, '.wingfoil', 'nested')],
    ['inside a listed project docs/', (w: World) => path.join(w.fx.dir, 'docs', 'nested')],
    [
      'inside a listed project, through a symlinked parent',
      (w: World) => path.join(w.dir, 'alias', 'kanban', 'nested'),
    ],
  ])('refuses a clone target %s: directory-inside-project, nothing written', async (_name, target) => {
    const w = await world();
    await add(w, w.fx.dir);
    await symlink(w.dir, path.join(w.dir, 'alias'));
    const before = await tree(w.dir);
    const directory = target(w);
    const spawned = runner.spawned.length;
    const error = await refusal(
      await clone(w, { url: 'https://example.test/x.git', directory }),
      'directory-inside-project',
    );
    expect(error.detail).toEqual({ path: directory });
    expect(runner.spawned.length).toBe(spawned);
    expect(await tree(w.dir)).toEqual(before);
  });

  it.each([
    ['inside the state directory', (w: World) => path.join(w.stateDir, 'clone')],
    [
      'inside the state directory, through a symlinked parent',
      (w: World) => path.join(w.dir, 'alias', 'state', 'clone'),
    ],
  ])('refuses a clone target %s: inside-state-dir', async (_name, target) => {
    const w = await world();
    await add(w, w.fx.dir); // creates the state directory
    await symlink(w.dir, path.join(w.dir, 'alias'));
    const before = await tree(w.dir);
    const directory = target(w);
    const error = await refusal(await clone(w, { url: 'https://example.test/x.git', directory }), 'inside-state-dir');
    expect(error.detail).toEqual({ path: directory });
    expect(await tree(w.dir)).toEqual(before);
  });

  it('cancels a clone whose client is gone and leaves nothing', async () => {
    const w = await world();
    const before = await tree(w.dir);
    const gone = new AbortController();
    gone.abort();
    await expect(
      w.projects.clone({ url: w.fx.remoteUrl, directory: '~/projects/kanban' }, gone.signal),
    ).rejects.toThrow(/cancelled/);
    expect(await tree(w.dir)).toEqual(before);
  });

  it.each([
    ['no url', {}],
    ['an empty url', { url: ' ' }],
    ['a url starting with -', { url: '--upload-pack=touch /tmp/pwned' }],
    ['a relative directory', { url: 'file:///x.git', directory: 'projects/x' }],
    ['a relative local url', { url: 'remotes/kanban.git' }],
    ['a url with no folder name and no directory (.)', { url: 'https://h/.' }],
    ['a url with no folder name and no directory (..)', { url: 'https://h/..' }],
    ['a url with no folder name and no directory (file:///)', { url: 'file:///' }],
    ['an extra field', { url: 'file:///x.git', depth: 1 }],
  ])('answers 400 invalid-request to %s', async (_name, body) => {
    const w = await world();
    const res = await post(w, '/api/projects/clone', body);
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: { code: string } }).error.code).toBe('invalid-request');
  });
});

describe('the CLI and the client while adding', () => {
  it('S-27.1 adds a project whose dna show is refused, named after its folder', async () => {
    const w = await world();
    await installCliStub(w.fx, {
      failures: [{ command: ['dna', 'show'], exitCode: 1, stderr: '{"error":"E_YAML_PARSE_ERROR: invalid DNA"}' }],
    });
    const res = await add(w, w.fx.dir);
    expect(res.statusCode, res.body).toBe(201);
    expect((res.json() as { name: string }).name).toBe('kanban');
  });

  it('answers 500 internal when dna show fails as an adapter defect, and lists nothing', async () => {
    const w = await world();
    await installCliStub(w.fx, { failures: [{ command: ['dna', 'show'], exitCode: 2, stderr: 'error: boom' }] });
    const res = await add(w, w.fx.dir);
    expect(res.statusCode).toBe(500);
    expect((res.json() as { error: { code: string } }).error.code).toBe('internal');
    expect(await list(w)).toEqual([]);
  });

  it('cancels the clone when the client leaves, and leaves nothing', async () => {
    const w = await world();
    const host = await httpRemote(path.join(w.dir, 'remotes'), { hang: true });
    const before = await tree(w.dir);
    await w.app.listen({ port: 0, host: '127.0.0.1' });
    const port = (w.app.server.address() as AddressInfo).port;
    const running = runner.running;
    const req = http.request({
      host: '127.0.0.1',
      port,
      method: 'POST',
      path: '/api/projects/clone',
      headers: { host: 'localhost:80', 'content-type': 'application/json', ...AUTH },
    });
    req.on('error', () => undefined);
    req.end(JSON.stringify({ url: `http://${host}/kanban.git`, directory: '~/projects/slow' }));
    await expect.poll(() => runner.running, { timeout: 10_000 }).toBeGreaterThan(running);
    req.destroy();
    await expect.poll(() => runner.running, { timeout: 15_000 }).toBe(running);
    await expect.poll(async () => JSON.stringify(await tree(w.dir)), { timeout: 5_000 }).toBe(JSON.stringify(before));
    expect(await list(w)).toEqual([]);
  }, 60_000);
});

describe('concurrent adds, clones and removals (review round 1 item 4)', () => {
  /** A dumb-HTTP remote of the fixture answering each request after `delayMs`: a slow clone. */
  async function slowRemote(w: World, delayMs = 150): Promise<string> {
    await git(w.fx.remoteDir, ['update-server-info'], w.env);
    return `http://${await httpRemote(path.join(w.dir, 'remotes'), { delayMs })}/kanban.git`;
  }

  it('two concurrent adds of the same folder list it once', async () => {
    const w = await world();
    const answers = await Promise.all([add(w, w.fx.dir), add(w, w.fx.dir)]);
    expect(answers.map((a) => a.statusCode).sort()).toEqual([201, 422]);
    expect(await list(w)).toHaveLength(1);
  });

  it('two queued clones into the same folder: one is cloned, the other refused directory-not-empty', async () => {
    const w = await world();
    const url = await slowRemote(w);
    const [a, b] = await Promise.all([
      clone(w, { url, directory: '~/projects/kanban' }),
      clone(w, { url: w.fx.remoteUrl, directory: '~/projects/kanban' }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 422]);
    const refused = [a, b].find((r) => r.statusCode === 422)!;
    expect((refused.json() as { error: { code: string } }).error.code).toMatch(/directory-not-empty|already-listed/);
    expect(await list(w)).toHaveLength(1);
    expect((await lstat(path.join(w.home, 'projects', 'kanban', '.wingfoil'))).isDirectory()).toBe(true);
  }, 60_000);

  it('two queued clones of the same remote: one is cloned, the other refused already-listed', async () => {
    const w = await world();
    const url = await slowRemote(w);
    const [a, b] = await Promise.all([
      clone(w, { url, directory: '~/projects/one' }),
      clone(w, { url, directory: '~/projects/two' }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 422]);
    expect(((a.statusCode === 422 ? a : b).json() as { error: { code: string } }).error.code).toBe('already-listed');
    expect(await list(w)).toHaveLength(1);
    expect((await readdir(path.join(w.home, 'projects'))).length).toBe(1);
  }, 60_000);

  it('an add of the folder a clone is writing waits for the clone, then is refused already-listed', async () => {
    const w = await world();
    const url = await slowRemote(w);
    const running = runner.running;
    const cloning = clone(w, { url, directory: '~/projects/kanban' });
    await expect.poll(() => runner.running, { timeout: 10_000 }).toBeGreaterThan(running);
    const adding = add(w, '~/projects/kanban');
    const cloned = await cloning;
    expect(cloned.statusCode, cloned.body).toBe(201);
    const error = await refusal(await adding, 'already-listed');
    expect(error.detail).toEqual({ pid: (cloned.json() as { id: string }).id, name: 'kanban', sameRemote: false });
    expect(await list(w)).toHaveLength(1);
    expect((await lstat(path.join(w.home, 'projects', 'kanban', '.wingfoil'))).isDirectory()).toBe(true);
  }, 60_000);

  it('a remove during a clone is not held up by it, and both end listed as expected', async () => {
    const w = await world();
    const other = await copyFixture(template, path.join(w.dir, 'other'));
    await git(other.dir, ['remote', 'set-url', 'origin', 'https://example.test/other.git'], w.env);
    const listed = (await add(w, other.dir)).json() as { id: string };
    const url = await slowRemote(w);
    const running = runner.running;
    const cloning = clone(w, { url, directory: '~/projects/kanban' });
    await expect.poll(() => runner.running, { timeout: 10_000 }).toBeGreaterThan(running);
    expect((await remove(w, listed.id)).statusCode).toBe(204);
    expect(runner.running).toBeGreaterThan(running); // the clone was still running
    expect((await cloning).statusCode).toBe(201);
    expect((await list(w)).map((p) => p.name)).toEqual(['kanban']);
  }, 60_000);

  it('a clone through a symlinked parent into the folder of a missing listed project is refused, nothing re-pointed', async () => {
    const w = await world();
    const kanban = (await add(w, w.fx.dir)).json() as { id: string };
    await rename(w.fx.dir, `${w.fx.dir}-moved`);
    const alias = path.join(w.dir, 'alias');
    await symlink(w.dir, alias);
    const other = await plainRepo(path.join(w.dir, 'plain-src'), w.env);
    const error = await refusal(
      await clone(w, { url: other, directory: path.join(alias, path.basename(w.fx.dir)) }),
      'already-listed',
    );
    expect(error.detail).toEqual({ pid: kanban.id, name: 'kanban', sameRemote: false });
    await expect(lstat(w.fx.dir)).rejects.toThrow();
    expect(await list(w)).toEqual([expect.objectContaining({ id: kanban.id, availability: 'folder-not-found' })]);
  });

  it('an add of the real folder a clone typed through a symlinked parent is writing waits for the clone', async () => {
    const w = await world();
    const url = await slowRemote(w);
    const alias = path.join(w.dir, 'alias');
    await symlink(w.dir, alias);
    const running = runner.running;
    const cloning = clone(w, { url, directory: path.join(alias, 'kanban-c') });
    await expect.poll(() => runner.running, { timeout: 10_000 }).toBeGreaterThan(running);
    const adding = add(w, path.join(w.dir, 'kanban-c'));
    const cloned = await cloning;
    expect(cloned.statusCode, cloned.body).toBe(201);
    expect((cloned.json() as { path: string }).path).toBe(path.join(w.dir, 'kanban-c'));
    await refusal(await adding, 'already-listed');
    expect(await list(w)).toHaveLength(1);
    expect((await lstat(path.join(w.dir, 'kanban-c', '.wingfoil'))).isDirectory()).toBe(true);
  }, 60_000);

  it('a clone into the folder of a listed project that went missing is refused already-listed', async () => {
    const w = await world();
    const kanban = (await add(w, w.fx.dir)).json() as { id: string };
    await rename(w.fx.dir, `${w.fx.dir}-moved`);
    const other = await plainRepo(path.join(w.dir, 'plain-src'), w.env);
    const error = await refusal(await clone(w, { url: other, directory: w.fx.dir }), 'already-listed');
    expect(error.detail).toEqual({ pid: kanban.id, name: 'kanban', sameRemote: false });
    await expect(lstat(w.fx.dir)).rejects.toThrow();
  });
});

describe('the fixture repository is never written (TT-ARC-03)', () => {
  it('add, list, a refused add, a check and remove leave the fixture files and history unchanged', async () => {
    const w = await world();
    const before = await tree(w.fx.dir);
    const history = await log(w.fx.dir, w.env);
    const kanban = (await add(w, w.fx.dir)).json() as { id: string };
    await list(w);
    await add(w, w.fx.dir);
    await w.projects.check();
    await remove(w, kanban.id);
    expect(await tree(w.fx.dir)).toEqual(before);
    expect(await log(w.fx.dir, w.env)).toBe(history);
  });
});

describe('TT-INT-06 — process audit of this file', () => {
  it('every git process used a subcommand of the allowed list; the CLI ran only reads', async () => {
    // Self-contained when run alone (`-t`): an add, a clone and a list of its own first.
    const w = await world();
    expect((await add(w, w.fx.dir)).statusCode).toBe(201);
    const other = await copyFixture(template, path.join(w.dir, 'other'));
    await git(other.remoteDir, ['update-server-info'], w.env);
    expect((await clone(w, { url: `file://${other.remoteDir}`, directory: '~/projects/audit' })).statusCode).toBe(201);
    await list(w);
    const gits = runner.spawned.filter((r) => processKind(r) === 'git');
    expect(gits.length).toBeGreaterThan(0);
    const used = new Set(gits.map((r) => gitSubcommand(r.args)));
    for (const sub of used) expect(GIT_ALLOWED_SUBCOMMANDS).toContain(sub);
    // v0.1: reads and the clone only (no transport write, no commit).
    for (const sub of used) expect(['clone', 'config', 'remote', 'rev-parse', 'status']).toContain(sub);
    expect(used.has('clone')).toBe(true);
    expect(new Set(runner.wingfoilCommands())).toEqual(new Set(['dna show']));
  });
});

describe('bug-010 (task-033 D33-1) — a local repository of another user is never cloned', () => {
  it.runIf(process.platform !== 'win32' && process.getuid?.() !== 0)(
    'a file:// remote owned by another user → 422 remote-not-owned, nothing cloned or listed',
    async () => {
      const w = await world();
      const before = await tree(w.dir);
      // The file-system root belongs to root, not to the user running the tests.
      await refusal(
        await clone(w, { url: `file://${path.parse(w.dir).root}`, directory: '~/projects/rooted' }),
        'remote-not-owned',
      );
      expect(await tree(w.dir)).toEqual(before);
      expect(await list(w)).toEqual([]);
    },
  );

  it.runIf(process.platform !== 'win32' && process.getuid?.() !== 0)(
    'S1: a file:// URL with a host is a local path too → 422 remote-not-owned',
    async () => {
      const w = await world();
      await refusal(
        await clone(w, { url: `file://127.0.0.1${path.parse(w.dir).root}`, directory: '~/projects/rooted-2' }),
        'remote-not-owned',
      );
      expect(await list(w)).toEqual([]);
    },
  );
});
