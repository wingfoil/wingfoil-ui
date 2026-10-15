/**
 * Shared set-up of the git-route API tests (task-033): a copy of a fixture with its own bare
 * `origin` (`copyFixture`), the project, element-write and git routes over the real snapshot
 * registry on an audited runner, a recording event bus and a log sink; helpers that move the remote
 * from "another clone" and count the processes a request starts.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies, each validated against its schema */
import { Ajv } from 'ajv';
import type { FastifyInstance } from 'fastify';
import { readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Writable } from 'node:stream';
import { expect } from 'vitest';
import type { ServerEvent } from '@wingfoil-ui/contracts';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import { gitSubcommand } from '../../../server/src/git/git.js';
import { buildApp } from '../../../server/src/http/app.js';
import { registerElementWriteRoutes } from '../../../server/src/http/element-writes.js';
import { registerGitRoutes } from '../../../server/src/http/git-routes.js';
import { registerProjectRoutes } from '../../../server/src/http/project-routes.js';
import { createLogger } from '../../../server/src/logging.js';
import type { ProcessRequest, ProcessResult } from '../../../server/src/process/runner.js';
import { InProcessWriteLock } from '../../../server/src/process/write-lock.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { AutoPush } from '../../../server/src/writes/auto-push.js';
import { GitTransport } from '../../../server/src/writes/transport.js';
import type { EventBus } from '../../../server/src/events/bus.js';
import { createMemoryStateStore } from '../../../server/src/state/memory-store.js';
import type { StateStore } from '../../../server/src/state/store.js';
import { REPO_ROOT } from '../../harness/cli.js';
import { copyFixture, memberByName, type Fixture } from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';
import { auditedSnapshots, processKind, type AuditedRunner } from '../snapshot/support.js';

const security = { authentication: createTokenAuthentication('test-token'), port: () => 80 };
const AUTH = { authorization: 'Bearer test-token' };

const ajv = new Ajv({ allErrors: true });
const CONTRACTS = path.join(REPO_ROOT, 'contracts');
for (const dir of ['api', 'cli', 'files']) {
  for (const file of await readdir(path.join(CONTRACTS, dir))) {
    ajv.addSchema(JSON.parse(await readFile(path.join(CONTRACTS, dir, file), 'utf8')) as object);
  }
}
ajv.addSchema(JSON.parse(await readFile(path.join(CONTRACTS, 'capabilities.schema.json'), 'utf8')) as object);

/** Assert `body` against `contracts/api/<file>`. */
export function expectSchema(file: string, body: unknown): void {
  const validate = ajv.getSchema(`https://wingfoil-ui.local/contracts/api/${file}`)!;
  expect(validate(body), `${file}: ${JSON.stringify(validate.errors)}`).toBe(true);
}

/** Options of {@link startGitConsole}. */
export interface GitConsoleOptions {
  /** The user (`git config user.email`) of the copy; `null`: none. Default Morgan. */
  as?: string | null;
  /** Changes to the copy before the console starts. */
  prepare?: (fx: Fixture) => Promise<void>;
  /** Replaces the runner's answer for some requests (`undefined`: the real process). */
  intercept?: (
    request: ProcessRequest,
    real: (request: ProcessRequest) => Promise<ProcessResult>,
  ) => Promise<ProcessResult | undefined>;
  /** Where the logger writes. */
  log?: string[];
  /** The server's environment (default: the fixture's): of every git and CLI process. */
  env?: (fx: Fixture) => NodeJS.ProcessEnv;
  /** task-034: the governed writes get the auto-push (reading `autoPush` from the store), with this time limit. */
  autoPush?: { timeoutMs?: number };
}

/** A started console on one fixture copy. */
export interface GitConsole {
  fx: Fixture;
  pid: string;
  runner: AuditedRunner;
  events: ServerEvent[];
  store: StateStore;
  snapshots: Snapshots;
  app: FastifyInstance;
  writeLock: InProcessWriteLock;
  /** The registry's event bus (task-034). */
  bus: EventBus;
  /** The server's environment of the console (task-034). */
  env: NodeJS.ProcessEnv;
  get(url: string): Promise<{ status: number; body: any; headers: Record<string, unknown> }>;
  /** `POST /api/p/:pid/git/<op>` (no body); every refusal checked against `git.refusal.schema.json`, every 200 against `git.response.schema.json`. */
  op(
    op: string,
    options?: { pid?: string; payload?: string; contentType?: string },
  ): Promise<{ status: number; body: any }>;
  write(verb: string, eid: string, body: unknown): Promise<{ status: number; body: any }>;
  /** The page's reads of the current state (header and Memory list). */
  warm(): Promise<void>;
  /** Processes started by `fn`, by kind; `transport`: the git fetch/pull/push among them. */
  processes(
    fn: () => Promise<unknown>,
  ): Promise<{ wingfoil: number; git: number; transport: number; commands: string[] }>;
  /** Commit `file` = `content` on the remote's `main` from another clone (the copy becomes behind once fetched). */
  remoteCommit(file: string, content: string): Promise<void>;
  head(): Promise<string>;
  /** The snapshot moved to the state now (a check). */
  check(): Promise<void>;
}

let consoles = 0;

/** Start a console on a copy of `template` under `root`. */
export async function startGitConsole(
  template: Fixture,
  root: string,
  apps: FastifyInstance[],
  registries: Snapshots[],
  options: GitConsoleOptions = {},
): Promise<GitConsole> {
  consoles += 1;
  const base = path.join(await realpath(root), `copy-${consoles}`);
  const fx = await copyFixture(template, base);
  if (options.as === null) await git(fx.dir, ['config', '--unset', 'user.email'], fx.env);
  else await git(fx.dir, ['config', 'user.email', options.as ?? memberByName('Morgan').email], fx.env);
  await options.prepare?.(fx);
  const env = options.env?.(fx) ?? fx.env;
  const audited = auditedSnapshots(env);
  if (options.intercept) {
    const real = audited.runner.run.bind(audited.runner);
    const intercept = options.intercept;
    audited.runner.run = async (request) => (await intercept(request, real)) ?? real(request);
  }
  registries.push(audited.snapshots);
  const store = await createMemoryStateStore();
  const entry = await store.add({ path: fx.dir, name: fx.name, remote: '' });
  const sink = new Writable({
    write: (chunk: Buffer, _e, cb) => {
      options.log?.push(chunk.toString());
      cb();
    },
  });
  const writeLock = new InProcessWriteLock();
  const logger = createLogger(sink);
  const push = options.autoPush
    ? new AutoPush({
        store,
        transport: new GitTransport({ snapshots: audited.snapshots, writeLock, env }),
        logger,
        ...(options.autoPush.timeoutMs !== undefined ? { timeoutMs: options.autoPush.timeoutMs } : {}),
      })
    : undefined;
  const app = await buildApp({
    staticDir: '/nonexistent',
    logger,
    security,
    register: (a) => {
      registerProjectRoutes(a, { store, snapshots: audited.snapshots });
      registerElementWriteRoutes(a, {
        store,
        snapshots: audited.snapshots,
        writeLock,
        bus: audited.bus,
        ...(push ? { push } : {}),
      });
      registerGitRoutes(a, { store, snapshots: audited.snapshots, writeLock, env });
    },
  });
  apps.push(app);
  const get = async (url: string) => {
    const res = await app.inject({ method: 'GET', url, headers: AUTH });
    return { status: res.statusCode, body: res.json(), headers: res.headers };
  };
  const op = async (name: string, o: { pid?: string; payload?: string; contentType?: string } = {}) => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/p/${o.pid ?? entry.id}/git/${name}`,
      headers: { ...AUTH, ...(o.contentType ? { 'content-type': o.contentType } : {}) },
      ...(o.payload !== undefined ? { payload: o.payload } : {}),
    });
    const answer = { status: res.statusCode, body: res.json() };
    expectSchema(answer.status === 200 ? 'git.response.schema.json' : 'git.refusal.schema.json', answer.body);
    return answer;
  };
  const write = async (verb: string, eid: string, body: unknown) => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/p/${entry.id}/elements/${eid}/${verb}`,
      headers: { ...AUTH, 'content-type': 'application/json' },
      payload: JSON.stringify(body),
    });
    const answer = { status: res.statusCode, body: res.json() };
    if (answer.status !== 200) expectSchema('write.refusal.schema.json', answer.body);
    return answer;
  };
  const warm = async () => {
    expect((await get(`/api/p/${entry.id}`)).status).toBe(200);
    expect((await get(`/api/p/${entry.id}/elements`)).status).toBe(200);
  };
  const processes = async (fn: () => Promise<unknown>) => {
    const from = audited.runner.spawned.length;
    await fn();
    const started = audited.runner.spawned.slice(from);
    const gits = started.filter((r) => processKind(r) === 'git');
    return {
      wingfoil: started.filter((r) => processKind(r) === 'wingfoil').length,
      git: gits.length,
      transport: gits.filter((r) => ['fetch', 'pull', 'push'].includes(gitSubcommand(r.args) ?? '')).length,
      commands: started.map((r) =>
        processKind(r) === 'git' ? `git ${gitSubcommand(r.args) ?? ''}` : r.args.join(' '),
      ),
    };
  };
  let other = 0;
  const remoteCommit = async (file: string, content: string) => {
    other += 1;
    const dir = path.join(base, `other-${other}`);
    await git(base, ['clone', '-q', fx.remoteDir, dir], fx.env);
    await git(dir, ['config', 'user.email', 'jordan@example.test'], fx.env);
    await writeFile(path.join(dir, file), content);
    await git(dir, ['add', '--', file], fx.env);
    await git(dir, ['commit', '-qm', `outside: ${file}`], fx.env);
    await git(dir, ['push', '-q', 'origin', 'HEAD:main'], fx.env);
  };
  const head = async () => (await git(fx.dir, ['rev-parse', 'HEAD'], fx.env)).stdout.trim();
  const check = async () => {
    await (await audited.snapshots.open(entry.id, fx.dir)).check();
  };
  return {
    fx,
    pid: entry.id,
    runner: audited.runner,
    events: audited.events as ServerEvent[],
    store,
    snapshots: audited.snapshots,
    app,
    writeLock,
    bus: audited.bus,
    env,
    get,
    op,
    write,
    warm,
    processes,
    remoteCommit,
    head,
    check,
  };
}
