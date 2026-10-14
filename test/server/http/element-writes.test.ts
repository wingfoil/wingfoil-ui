// spec-004 §3–§6, spec-006 §2 (task-032; TT-STATE-03, TT-SEC-10, REQ-SEC-05, REQ-ARC-03, REQ-INT-04) —
// `POST /api/p/:pid/elements/:eid/submit`, `/approve`, `/reject` on copies of the kanban fixture
// (pinned CLI, real git), with the real snapshot registry over an audited runner: the §4 refusals in
// their order with the processes each starts (0 for rows 1–6 on a warm state, D32-3; 0 `wingfoil`
// processes for rows 7–9), row 7 fresh under the write lock and through what hides an edit from
// `git status` (D32-1), row 9 and two writes racing, the CLI's refusals verbatim (and D32-5), the
// success body against `write.response.schema.json`, the commits (D32-4), the `write` event, the
// action log and its cap (D32-8), the shell probe and `:eid` injection (D32-10), the lock key
// (D32-2).
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies, each validated against its schema */
import { Ajv } from 'ajv';
import type { FastifyInstance } from 'fastify';
import { chmod, mkdir, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ServerEvent } from '@wingfoil-ui/contracts';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import type { EventBus } from '../../../server/src/events/bus.js';
import { GIT_ALLOWED_SUBCOMMANDS, gitSubcommand } from '../../../server/src/git/git.js';
import { buildApp } from '../../../server/src/http/app.js';
import { registerElementWriteRoutes } from '../../../server/src/http/element-writes.js';
import { registerProjectRoutes } from '../../../server/src/http/project-routes.js';
import { createLogger } from '../../../server/src/logging.js';
import type { ProcessRequest, ProcessResult } from '../../../server/src/process/runner.js';
import { InProcessWriteLock, type WriteLock } from '../../../server/src/process/write-lock.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { createMemoryStateStore } from '../../../server/src/state/memory-store.js';
import type { StateStore } from '../../../server/src/state/store.js';
import { pinnedCli, REPO_ROOT } from '../../harness/cli.js';
import {
  buildFixture,
  copyFixture,
  installCliStub,
  memberByName,
  OUTSIDER,
  type Fixture,
} from '../../harness/fixtures/index.js';
import { git, run } from '../../harness/run.js';
import { pwned, SHELL_PAYLOAD } from '../../harness/security.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';
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
function expectSchema(file: string, body: unknown): void {
  const validate = ajv.getSchema(`https://wingfoil-ui.local/contracts/api/${file}`)!;
  expect(validate(body), `${file}: ${JSON.stringify(validate.errors)}`).toBe(true);
}

const LOGIN = 'task-001-login-form'; // kanban: pending (gate)
const TIMEOUT = 'task-004-session-timeout'; // kanban: draft
const ISO_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

let ws: TempWorkspace;
let template: Fixture;
let n = 0;
const registries: Snapshots[] = [];
const apps: FastifyInstance[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-032-writes-');
  template = await buildFixture('kanban', { root: path.join(await realpath(ws.dir), 'kanban') });
}, 600_000);

afterEach(async () => {
  for (const a of apps.splice(0)) await a.close();
});

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await ws.dispose();
});

interface StartOptions {
  /** The user (`git config user.email`) of the copy. */
  as?: string;
  /** Changes to the copy before the console starts. */
  prepare?: (fx: Fixture) => Promise<void>;
  /** The store the routes use (default: a memory store). */
  store?: (store: StateStore) => StateStore;
  /** The write lock (default: a new in-process one). */
  lock?: WriteLock;
  /** A second project entry on the same folder (D32-2). */
  twin?: boolean;
  /** Replaces the runner's answer for some requests (`undefined`: the real process). */
  intercept?: (
    request: ProcessRequest,
    real: (request: ProcessRequest) => Promise<ProcessResult>,
  ) => Promise<ProcessResult | undefined>;
  /** More listed projects, on folders made by `prepare` (D32-2: a linked worktree). */
  more?: (fx: Fixture) => Promise<string[]>;
  /** Where the logger writes. */
  log?: string[];
}

interface Console {
  fx: Fixture;
  pid: string;
  twin: string | undefined;
  others: string[];
  runner: AuditedRunner;
  bus: EventBus;
  events: ServerEvent[];
  store: StateStore;
  snapshots: Snapshots;
  get(url: string): Promise<{ status: number; body: any }>;
  post(verb: string, eid: string, body: unknown, pid?: string): Promise<{ status: number; body: any }>;
  /** The page's reads of the current state (header and Memory list): the cache rows 5–6 read. */
  warm(): Promise<void>;
  become(email: string): Promise<void>;
  pathOf(id: string): Promise<string>;
  head(): Promise<string>;
  /** Processes started by `fn`, by kind. */
  processes(fn: () => Promise<unknown>): Promise<{ wingfoil: number; git: number; commands: string[] }>;
}

async function start(options: StartOptions = {}): Promise<Console> {
  n += 1;
  const fx = await copyFixture(template, path.join(await realpath(ws.dir), `copy-${n}`));
  await git(fx.dir, ['config', 'user.email', options.as ?? memberByName('Morgan').email], fx.env);
  await options.prepare?.(fx);
  const audited = auditedSnapshots(fx.env);
  if (options.intercept) {
    const real = audited.runner.run.bind(audited.runner);
    const intercept = options.intercept;
    audited.runner.run = async (request) => (await intercept(request, real)) ?? real(request);
  }
  registries.push(audited.snapshots);
  const memory = await createMemoryStateStore();
  const entry = await memory.add({ path: fx.dir, name: fx.name, remote: '' });
  const twin = options.twin ? (await memory.add({ path: fx.dir, name: fx.name, remote: '' })).id : undefined;
  const others: string[] = [];
  for (const dir of (await options.more?.(fx)) ?? []) {
    others.push((await memory.add({ path: dir, name: fx.name, remote: '' })).id);
  }
  const store = options.store ? options.store(memory) : memory;
  const sink = new Writable({
    write: (chunk: Buffer, _e, cb) => {
      options.log?.push(chunk.toString());
      cb();
    },
  });
  const app = await buildApp({
    staticDir: '/nonexistent',
    logger: createLogger(sink),
    security,
    register: (a) => {
      registerProjectRoutes(a, { store, snapshots: audited.snapshots });
      registerElementWriteRoutes(a, {
        store,
        snapshots: audited.snapshots,
        writeLock: options.lock ?? new InProcessWriteLock(),
        bus: audited.bus,
      });
    },
  });
  apps.push(app);
  const get = async (url: string) => {
    const res = await app.inject({ method: 'GET', url, headers: AUTH });
    return { status: res.statusCode, body: res.json() };
  };
  const post = async (verb: string, eid: string, body: unknown, pid = entry.id) => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/p/${pid}/elements/${eid}/${verb}`,
      headers: { ...AUTH, 'content-type': 'application/json' },
      payload: JSON.stringify(body),
    });
    return { status: res.statusCode, body: res.json() };
  };
  const warm = async () => {
    for (const pid of [entry.id, ...(twin ? [twin] : []), ...others]) {
      expect((await get(`/api/p/${pid}`)).status).toBe(200);
      expect((await get(`/api/p/${pid}/elements`)).status).toBe(200);
    }
  };
  const become = async (email: string) => {
    await git(fx.dir, ['config', 'user.email', email], fx.env);
    const snapshot = await audited.snapshots.open(entry.id, fx.dir);
    await snapshot.check();
    expect(snapshot.current()?.email).toBe(email);
  };
  const pathOf = async (id: string) => {
    const list = await get(`/api/p/${entry.id}/elements`);
    const found = (list.body.elements as { id: string; path: string }[]).find((e) => e.id === id);
    if (!found) throw new Error(`no ${id}`);
    return found.path;
  };
  const head = async () => (await git(fx.dir, ['rev-parse', 'HEAD'], fx.env)).stdout.trim();
  const processes = async (fn: () => Promise<unknown>) => {
    const from = audited.runner.spawned.length;
    await fn();
    const started = audited.runner.spawned.slice(from);
    return {
      wingfoil: started.filter((r) => processKind(r) === 'wingfoil').length,
      git: started.filter((r) => processKind(r) === 'git').length,
      commands: started.map((r) =>
        processKind(r) === 'git' ? `git ${gitSubcommand(r.args) ?? ''}` : r.args.join(' '),
      ),
    };
  };
  return {
    fx,
    pid: entry.id,
    twin,
    others,
    runner: audited.runner,
    bus: audited.bus,
    events: audited.events as ServerEvent[],
    store,
    snapshots: audited.snapshots,
    get,
    post,
    warm,
    become,
    pathOf,
    head,
    processes,
  };
}

const writes = (c: Console) => c.events.filter((e) => e.event === 'write');

async function appendTo(c: Console, id: string, text: string): Promise<string> {
  const rel = await c.pathOf(id);
  const file = path.join(c.fx.dir, rel);
  await writeFile(file, `${await readFile(file, 'utf8')}${text}`);
  return rel;
}

describe('spec-004 §4 rows 3–4 — the project and the body, before any process', () => {
  it('an unknown project → 404 before the body is read', async () => {
    const c = await start();
    const p = await c.processes(async () => {
      const res = await c.post('approve', LOGIN, { nonsense: true }, 'p_000000000000');
      expect(res).toEqual({ status: 404, body: { error: { code: 'not-found', message: 'Not found' } } });
    });
    expect(p.wingfoil + p.git).toBe(0);
  });

  it.each([
    ['submit', {}],
    ['submit', { expectedStatus: '' }],
    ['submit', { expectedStatus: 'draft', reason: 'not taken' }],
    ['submit', { expectedStatus: 5 }],
    ['approve', { expectedStatus: 'pending' }],
    ['approve', { expectedStatus: 'pending', reason: '' }],
    ['approve', { expectedStatus: 'pending', reason: '   \n\t ' }],
    ['reject', { expectedStatus: 'pending', reason: 'a\u0000b' }],
    ['reject', { expectedStatus: 'pending', reason: 'r'.repeat(10_001) }],
    ['reject', { expectedStatus: 'pending', reason: 'ok', extra: 1 }],
    ['reject', null],
    ['reject', ['pending', 'ok']],
  ])('%s with %j → 400 invalid-request, 0 processes (G-07.2, D32-6)', async (verb, body) => {
    const c = await start();
    const p = await c.processes(async () => {
      const res = await c.post(verb, LOGIN, body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('invalid-request');
    });
    expect(p.wingfoil + p.git).toBe(0);
    expect(writes(c)).toEqual([]);
  });

  it('an unknown verb is not a route', async () => {
    const c = await start();
    expect((await c.post('deprecate', LOGIN, { expectedStatus: 'pending' })).status).toBe(404);
  });
});

describe('spec-004 §4 rows 5–6 — identity and version, 0 processes on a warm state (D32-3, RP-48)', () => {
  it('row 5: a user not in the team → 403 not-in-team, 0 processes, nothing written', async () => {
    const c = await start({ as: OUTSIDER.email });
    await c.warm();
    const before = await c.head();
    for (const [verb, body] of [
      ['submit', { expectedStatus: 'draft' }],
      ['approve', { expectedStatus: 'pending', reason: 'ok' }],
      ['reject', { expectedStatus: 'pending', reason: 'no' }],
    ] as const) {
      const p = await c.processes(async () => {
        const res = await c.post(verb, verb === 'submit' ? TIMEOUT : LOGIN, body);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('not-in-team');
      });
      expect(p.wingfoil + p.git).toBe(0);
    }
    expect(await c.head()).toBe(before);
    expect(writes(c)).toEqual([]);
  });

  it('row 5: no identity (no user.email) → 403 not-in-team', async () => {
    const c = await start({ prepare: (fx) => git(fx.dir, ['config', '--unset', 'user.email'], fx.env).then(() => {}) });
    await c.warm();
    const res = await c.post('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('not-in-team');
  });

  it('row 6: a WingFoil version outside the range → 409 unsupported-version, 0 processes', async () => {
    const c = await start({ prepare: (fx) => installCliStub(fx, { version: '0.1.0' }).then(() => {}) });
    await c.warm();
    const p = await c.processes(async () => {
      const res = await c.post('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('unsupported-version');
    });
    expect(p.wingfoil + p.git).toBe(0);
  });

  it.each(['--version', '..%2F..%2Fetc%2Fpasswd', 'task-001-login-form%00', 'TASK-001-LOGIN-FORM', 'nope'])(
    'D32-10: the unknown element %s → 404 not-found, 0 processes',
    async (eid) => {
      const c = await start();
      await c.warm();
      const p = await c.processes(async () => {
        const res = await c.post('approve', eid, { expectedStatus: 'pending', reason: 'ok' });
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('not-found');
      });
      expect(p.wingfoil + p.git).toBe(0);
    },
  );
});

describe('spec-004 §4 row 7 — local changes, fresh under the lock (TT-STATE-03: G-11.1, G-11.2, X-07.3)', () => {
  const variants: [string, (c: Console, rel: string) => Promise<void>][] = [
    ['modified', async () => {}],
    ['staged', async (c, rel) => void (await git(c.fx.dir, ['add', '--', rel], c.fx.env))],
    [
      'hidden by assume-unchanged (D32-1)',
      async (c, rel) => void (await git(c.fx.dir, ['update-index', '--assume-unchanged', '--', rel], c.fx.env)),
    ],
    [
      'hidden by skip-worktree (D32-1)',
      async (c, rel) => void (await git(c.fx.dir, ['update-index', '--skip-worktree', '--', rel], c.fx.env)),
    ],
  ];

  it.each(variants)(
    'an element file %s after the last observed state → 409 local-changes, 0 wingfoil processes',
    async (_label, mark) => {
      for (const [verb, eid, body, as] of [
        ['submit', TIMEOUT, { expectedStatus: 'draft' }, 'Jordan'],
        ['approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' }, 'Morgan'],
        ['reject', LOGIN, { expectedStatus: 'pending', reason: 'no' }, 'Morgan'],
      ] as const) {
        const c = await start({ as: memberByName(as).email });
        await c.warm();
        const rel = await c.pathOf(eid);
        const before = await c.head();
        // The order matters for the hidden variants: the flag first, then the edit git no longer sees.
        if (_label.startsWith('hidden')) await mark(c, rel);
        await appendTo(c, eid, '\nedited outside the console\n');
        if (!_label.startsWith('hidden')) await mark(c, rel);
        const p = await c.processes(async () => {
          const res = await c.post(verb, eid, body);
          expect(res.status, JSON.stringify(res.body)).toBe(409);
          expect(res.body.error.code).toBe('local-changes');
        });
        expect(p.wingfoil).toBe(0);
        expect(p.git).toBeGreaterThan(0);
        expect(await c.head()).toBe(before);
        expect(writes(c)).toEqual([]);
      }
    },
  );

  it('core.ignoreStat hiding an edit → 409 local-changes (D32-1)', async () => {
    const c = await start();
    await c.warm();
    const rel = await c.pathOf(LOGIN);
    await git(c.fx.dir, ['config', 'core.ignoreStat', 'true'], c.fx.env);
    await git(c.fx.dir, ['rm', '--cached', '--quiet', '--', rel], c.fx.env);
    await git(c.fx.dir, ['add', '--', rel], c.fx.env);
    await appendTo(c, LOGIN, '\nhidden\n');
    expect((await git(c.fx.dir, ['status', '--porcelain'], c.fx.env)).stdout).toBe('');
    const res = await c.post('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('local-changes');
  });

  it('a deleted element file → 409 local-changes', async () => {
    const c = await start();
    await c.warm();
    await rm(path.join(c.fx.dir, await c.pathOf(LOGIN)));
    const res = await c.post('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('local-changes');
  });

  it('an untracked element file → 409 local-changes, 0 wingfoil processes', async () => {
    const c = await start({ as: memberByName('Jordan').email });
    const rel = await c.pathOf(TIMEOUT);
    const text = (await readFile(path.join(c.fx.dir, rel), 'utf8')).replaceAll(TIMEOUT, 'task-005-untracked-one');
    await writeFile(path.join(c.fx.dir, path.dirname(rel), 'task-005-untracked-one.md'), text);
    await (await c.snapshots.open(c.pid, c.fx.dir)).check();
    await c.warm();
    const p = await c.processes(async () => {
      const res = await c.post('submit', 'task-005-untracked-one', { expectedStatus: 'draft' });
      expect(res.status, JSON.stringify(res.body)).toBe(409);
      expect(res.body.error.code).toBe('local-changes');
    });
    expect(p.wingfoil).toBe(0);
  });

  it('G-11.3: a change to another file (modified and staged) does not refuse; the commit holds only the element', async () => {
    const c = await start();
    await c.warm();
    await writeFile(path.join(c.fx.dir, 'README.md'), 'changed elsewhere\n');
    await writeFile(path.join(c.fx.dir, 'staged.txt'), 'staged elsewhere\n');
    await git(c.fx.dir, ['add', 'staged.txt'], c.fx.env);
    const res = await c.post('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const files = await git(c.fx.dir, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], c.fx.env);
    expect(files.stdout.split('\n').filter(Boolean)).toEqual([await c.pathOf(LOGIN)]);
    expect((await git(c.fx.dir, ['status', '--porcelain'], c.fx.env)).stdout).toContain('A  staged.txt');
  });
});

describe('spec-004 §4 row 9 — the status the page showed (RP-12)', () => {
  it('expectedStatus differs → 409 element-changed, 0 wingfoil processes', async () => {
    const c = await start();
    await c.warm();
    const p = await c.processes(async () => {
      const res = await c.post('approve', LOGIN, { expectedStatus: 'draft', reason: 'ok' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('element-changed');
    });
    expect(p.wingfoil).toBe(0);
  });

  it('a commit made after the last observed state is seen: the stale page is refused', async () => {
    const c = await start();
    await c.warm();
    // Approved from a terminal; the console has not checked since.
    const cli = await run(
      process.execPath,
      [pinnedCli().script, '--format', 'json', 'memory', 'approve', '--reason', 'first', '--', LOGIN],
      { cwd: c.fx.dir, env: c.fx.env },
    );
    expect(cli.code).toBe(0);
    const res = await c.post('reject', LOGIN, { expectedStatus: 'pending', reason: 'second' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('element-changed');
  });

  it('two decisions racing: one 200, one 409 element-changed, one commit', async () => {
    const c = await start();
    await c.warm();
    const before = await c.head();
    const results = await Promise.all([
      c.post('approve', LOGIN, { expectedStatus: 'pending', reason: 'yes' }),
      c.post('reject', LOGIN, { expectedStatus: 'pending', reason: 'no' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409)!.body.error.code).toBe('element-changed');
    expect((await git(c.fx.dir, ['rev-list', `${before}..HEAD`], c.fx.env)).stdout.trim().split('\n')).toHaveLength(1);
    expect(writes(c)).toHaveLength(1);
  });
});

describe('the CLI decides: refusals verbatim (REQ-INT-04, D32-5)', () => {
  it('submit from a waiting state → 422 cli-refused with the CLI message', async () => {
    const c = await start({ as: memberByName('Jordan').email });
    await c.warm();
    const res = await c.post('submit', LOGIN, { expectedStatus: 'pending' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('cli-refused');
    expect(res.body.error.message).toMatch(/illegal transition pending/);
    expect(writes(c)).toEqual([]);
  });

  it('approve without the approver role (W-13) → 422 cli-refused; the role is the CLI’s', async () => {
    const c = await start({ as: memberByName('Jordan').email });
    await c.warm();
    const before = await c.head();
    const res = await c.post('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('cli-refused');
    expect(res.body.error.message.length).toBeGreaterThan(0);
    expect(await c.head()).toBe(before);
  });

  it('a reason the CLI refuses as a usage error → 422 cli-refused, its message verbatim (D32-5)', async () => {
    const c = await start();
    await c.warm();
    const res = await c.post('reject', LOGIN, { expectedStatus: 'pending', reason: 'fine\nApprover: someone' });
    expect(res.status).toBe(422);
    expect(res.body.error).toEqual({
      code: 'cli-refused',
      message: 'invalid flag value: --reason must not contain a line starting with "Approver:" or "Reason:"',
    });
  });

  it('CLI exit 0 without its commit → 502 cli-output, nothing logged, no write event (D32-4)', async () => {
    const c = await start({
      intercept: async (request) =>
        request.args.includes('approve')
          ? {
              exitCode: 0,
              signal: null,
              stdout: JSON.stringify({ id: LOGIN, path: 'x.md', from: 'pending', to: 'approved' }),
              stderr: '',
              ended: 'exit',
              durationMs: 1,
            }
          : undefined,
    });
    await c.warm();
    const res = await c.post('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('cli-output');
    expect(c.store.snapshot().actionLog).toEqual([]);
    expect(writes(c)).toEqual([]);
  });
});

describe('success (spec-004 §5–§6, spec-006 §2)', () => {
  it.each([
    ['submit', TIMEOUT, { expectedStatus: 'draft' }, 'Jordan', 'draft', 'pending', ''],
    [
      'approve',
      LOGIN,
      { expectedStatus: 'pending', reason: 'Looks good' },
      'Morgan',
      'pending',
      'approved',
      ' [pending → approved]',
    ],
    [
      'reject',
      LOGIN,
      { expectedStatus: 'pending', reason: 'Not yet' },
      'Morgan',
      'pending',
      'draft',
      ' [pending → draft]',
    ],
  ] as const)(
    '%s → 200 write.response, one wf(…) commit, push off, one write event after the state moved, the action log',
    async (verb, eid, body, as, from, to, transition) => {
      const c = await start({ as: memberByName(as).email });
      await c.warm();
      const snapshot = await c.snapshots.open(c.pid, c.fx.dir);
      // When the write event goes out, the snapshot already reads the new HEAD (a refetch is fresh).
      const seen: (string | undefined)[] = [];
      c.bus.subscribe((e) => {
        if (e.event === 'write') seen.push(snapshot.current()?.head);
      });
      const bus = c.events;
      const p = await c.processes(async () => {
        const res = await c.post(verb, eid, body);
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expectSchema('write.response.schema.json', res.body);
        const sha = await c.head();
        expect(res.body.result).toMatchObject({ id: eid, from, to });
        expect(res.body.commits).toEqual([{ sha, subject: `wf(task): ${verb} ${eid}${transition}` }]);
        expect(res.body.push).toEqual({ status: 'off' });
        expect(bus.filter((e) => e.event === 'write')).toEqual([
          { event: 'write', data: { pid: c.pid, eid, commit: sha } },
        ]);
        expect(seen).toEqual([sha]);
        const log = c.store.snapshot().actionLog;
        expect(log).toHaveLength(1);
        expect(log[0]!.sha).toBe(sha);
        expect(log[0]!.at).toMatch(ISO_SECONDS);
      });
      // REQ-ARC-03 / REQ-INT-06: exactly one wingfoil process (the verb); every git process allowed.
      expect(p.wingfoil).toBe(1);
      for (const command of p.commands.filter((x) => x.startsWith('git '))) {
        expect(GIT_ALLOWED_SUBCOMMANDS).toContain(command.slice(4));
      }
    },
  );

  it('the action log keeps the newest actionLogCap entries (RP-38)', async () => {
    const c = await start();
    await c.store.putSettings({ ...c.store.settings(), actionLogCap: 100 });
    await c.store.transaction((draft) => {
      for (let i = 0; i < 100; i += 1) {
        draft.actionLog.push({ sha: i.toString(16).padStart(40, '0'), at: '2026-10-01T00:00:00Z' });
      }
    });
    await c.warm();
    expect((await c.post('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' })).status).toBe(200);
    const log = c.store.snapshot().actionLog;
    expect(log).toHaveLength(100);
    expect(log[0]!.sha).toBe('1'.padStart(40, '0'));
    expect(log.at(-1)!.sha).toBe(await c.head());
  });

  it('D32-8: an action log that cannot be written never fails the write', async () => {
    const log: string[] = [];
    const c = await start({
      log,
      store: (s) =>
        new Proxy(s, {
          get(target, key, receiver) {
            if (key === 'transaction') return () => Promise.reject(new Error('EROFS: read-only file system'));
            const value = Reflect.get(target, key, receiver) as unknown;
            return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
          },
        }),
    });
    await c.warm();
    const res = await c.post('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' });
    expect(res.status).toBe(200);
    expect(res.body.commits).toHaveLength(1);
    expect(writes(c)).toHaveLength(1);
    expect(log.join('')).toMatch(/action log not written/);
    expect(log.join('')).not.toContain('EROFS');
  });

  it('REQ-SEC-05: the reason reaches the CLI as one argument — shell payload, leading dash, newlines', async () => {
    expect(pwned()).toBe(false);
    const c = await start();
    await c.warm();
    const reason = `--force ${SHELL_PAYLOAD} $(id) \`id\`\n'quoted' "double"`;
    const res = await c.post('reject', LOGIN, { expectedStatus: 'pending', reason });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(pwned()).toBe(false);
    const message = (await git(c.fx.dir, ['log', '-1', '--format=%B'], c.fx.env)).stdout;
    expect(message).toContain(SHELL_PAYLOAD);
    expect(message).toContain('$(id) `id`');
    expect(res.body.result.reason).toBe(reason);
  });

  it('the reason is never logged', async () => {
    const log: string[] = [];
    const c = await start({ log });
    await c.warm();
    await c.post('reject', LOGIN, { expectedStatus: 'pending', reason: 'secret-reason-text-4711' });
    await c.post('approve', LOGIN, { expectedStatus: 'draft', reason: 'secret-reason-text-4711' });
    expect(log.join('')).not.toContain('secret-reason-text-4711');
  });
});

describe('D32-2 — the write lock key is the repository', () => {
  it('two listed projects on one repository use one key, the git common directory', async () => {
    const keys: string[] = [];
    const inner = new InProcessWriteLock();
    const lock: WriteLock = { run: (key, task) => (keys.push(key), inner.run(key, task)) };
    const c = await start({ lock, twin: true });
    await c.warm();
    const results = await Promise.all([
      c.post('approve', LOGIN, { expectedStatus: 'pending', reason: 'a' }),
      c.post('reject', LOGIN, { expectedStatus: 'pending', reason: 'b' }, c.twin),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const common = await realpath(path.join(c.fx.dir, '.git'));
    expect(keys).toEqual([common, common]);
  });
});

describe('D32-2 — a linked worktree shares the lock (review F6)', () => {
  it('a project in a `git worktree` of the same repository: same key, the writes queue', async () => {
    const keys: string[] = [];
    let running = 0;
    let overlapped = false;
    const inner = new InProcessWriteLock();
    const lock: WriteLock = {
      run: (key, task) => {
        keys.push(key);
        return inner.run(key, async () => {
          running += 1;
          if (running > 1) overlapped = true;
          try {
            return await task();
          } finally {
            running -= 1;
          }
        });
      },
    };
    const c = await start({
      lock,
      more: async (fx) => {
        const wt = path.join(path.dirname(fx.dir), `${path.basename(fx.dir)}-wt`);
        await git(fx.dir, ['worktree', 'add', '--quiet', '-b', 'side', wt], fx.env);
        // The CLI of the worktree: the same pinned package (node_modules is not versioned).
        await mkdir(path.join(wt, 'node_modules'), { recursive: true });
        await symlink(
          await realpath(path.join(fx.dir, 'node_modules', 'wingfoil')),
          path.join(wt, 'node_modules', 'wingfoil'),
        );
        return [await realpath(wt)];
      },
    });
    await c.warm();
    const results = await Promise.all([
      c.post('approve', LOGIN, { expectedStatus: 'pending', reason: 'main' }),
      c.post('reject', LOGIN, { expectedStatus: 'pending', reason: 'side' }, c.others[0]),
    ]);
    // Two branches: both decisions are made, one after the other.
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    const common = await realpath(path.join(c.fx.dir, '.git'));
    expect(keys).toEqual([common, common]);
    expect(overlapped).toBe(false);
  });
});

describe('review S1 — the element as the fresh state lists it', () => {
  it('an untracked copy with the same id made within the watcher lag → 409 local-changes, nothing committed', async () => {
    const c = await start({ as: memberByName('Jordan').email });
    await c.warm();
    const rel = await c.pathOf(TIMEOUT);
    const before = await c.head();
    // Sorts before the real file; the console has not seen it (no check since).
    await writeFile(
      path.join(c.fx.dir, path.dirname(rel), 'task-000-a-copy.md'),
      await readFile(path.join(c.fx.dir, rel), 'utf8'),
    );
    const res = await c.post('submit', TIMEOUT, { expectedStatus: 'draft' });
    expect(res.status, JSON.stringify(res.body)).toBe(409);
    expect(res.body.error.code).toBe('local-changes');
    expect(await c.head()).toBe(before);
    expect((await git(c.fx.dir, ['status', '--porcelain'], c.fx.env)).stdout).toContain('?? ');
  });

  it('a committed duplicate id → 409 element-changed (the CLI would pick one by its order)', async () => {
    const c = await start({ as: memberByName('Jordan').email });
    const rel = await c.pathOf(TIMEOUT);
    const copy = path.join(path.dirname(rel), 'task-000-a-copy.md');
    await writeFile(path.join(c.fx.dir, copy), await readFile(path.join(c.fx.dir, rel), 'utf8'));
    await git(c.fx.dir, ['add', '--', copy], c.fx.env);
    await git(c.fx.dir, ['commit', '--quiet', '-m', 'docs: a copy', '--', copy], c.fx.env);
    await (await c.snapshots.open(c.pid, c.fx.dir)).check();
    await c.warm();
    const before = await c.head();
    const res = await c.post('submit', TIMEOUT, { expectedStatus: 'draft' });
    expect(res.status, JSON.stringify(res.body)).toBe(409);
    expect(res.body.error.code).toBe('element-changed');
    expect(await c.head()).toBe(before);
  });

  it('an element moved by a commit the console has not seen → the write acts on its new path', async () => {
    const c = await start();
    await c.warm();
    const rel = await c.pathOf(LOGIN);
    const moved = path.join(path.dirname(rel), 'task-001-login-form-moved.md');
    await git(c.fx.dir, ['mv', '--', rel, moved], c.fx.env);
    await git(c.fx.dir, ['commit', '--quiet', '-m', 'docs: move'], c.fx.env);
    const res = await c.post('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.result.path).toBe(moved);
  });

  it('the CLI answering for another path → 502 cli-output', async () => {
    const c = await start({
      intercept: async (request, real) => {
        if (!request.args.includes('approve')) return undefined;
        const result = await real(request);
        const data = JSON.parse(result.stdout) as Record<string, unknown>;
        return { ...result, stdout: JSON.stringify({ ...data, path: 'docs/elsewhere.md' }) };
      },
    });
    await c.warm();
    const res = await c.post('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('cli-output');
  });
});

describe('review S2 — the whole entry of the element file', () => {
  it('a mode change hidden by assume-unchanged → 409 local-changes', async () => {
    const c = await start();
    await c.warm();
    const rel = await c.pathOf(LOGIN);
    await git(c.fx.dir, ['update-index', '--assume-unchanged', '--', rel], c.fx.env);
    await chmod(path.join(c.fx.dir, rel), 0o755);
    expect((await git(c.fx.dir, ['status', '--porcelain'], c.fx.env)).stdout).toBe('');
    const res = await c.post('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('local-changes');
  });

  it('a symlink to an identical copy, hidden by assume-unchanged → 409 local-changes', async () => {
    const c = await start();
    await c.warm();
    const rel = await c.pathOf(LOGIN);
    const file = path.join(c.fx.dir, rel);
    const copy = path.join(path.dirname(c.fx.dir), `${path.basename(c.fx.dir)}-copy.md`);
    await writeFile(copy, await readFile(file, 'utf8'));
    await git(c.fx.dir, ['update-index', '--assume-unchanged', '--', rel], c.fx.env);
    await rm(file);
    await symlink(copy, file);
    const res = await c.post('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('local-changes');
  });
});

describe('reviews F4, S3 (part A), S4 — the commit the write made, whatever the CLI answers', () => {
  it('the CLI fails after its commit (exit 1) → 422, the commit logged and announced', async () => {
    const c = await start({
      intercept: async (request, real) =>
        request.args.includes('approve')
          ? { ...(await real(request)), exitCode: 1, stdout: '', stderr: '{"error":"failed after the commit"}' }
          : undefined,
    });
    await c.warm();
    const res = await c.post('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' });
    expect(res.status).toBe(422);
    expect(res.body.error).toEqual({ code: 'cli-refused', message: 'failed after the commit' });
    const head = await c.head();
    expect(c.store.snapshot().actionLog.map((e) => e.sha)).toEqual([head]);
    expect(writes(c)).toEqual([{ event: 'write', data: { pid: c.pid, eid: LOGIN, commit: head } }]);
  });

  it('the CLI killed after its commit (timeout) → 504, the commit logged', async () => {
    const c = await start({
      intercept: async (request, real) =>
        request.args.includes('reject')
          ? { ...(await real(request)), ended: 'timeout', exitCode: null, signal: 'SIGKILL' }
          : undefined,
    });
    await c.warm();
    const res = await c.post('reject', LOGIN, { expectedStatus: 'pending', reason: 'no' });
    expect(res.status).toBe(504);
    expect(c.store.snapshot().actionLog.map((e) => e.sha)).toEqual([await c.head()]);
  });

  it('a CLI refusal with no commit logs nothing and sends no event', async () => {
    const c = await start({ as: memberByName('Jordan').email });
    await c.warm();
    expect((await c.post('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' })).status).toBe(422);
    expect(c.store.snapshot().actionLog).toEqual([]);
    expect(writes(c)).toEqual([]);
  });

  it('a concurrent commit forging the subject is neither reported, logged nor announced', async () => {
    let forged = '';
    const c = await start({
      intercept: async (request, real) => {
        if (!request.args.includes('approve')) return undefined;
        const cwd = request.cwd!;
        await writeFile(path.join(cwd, 'forged.txt'), 'forged\n');
        await git(cwd, ['add', 'forged.txt'], c.fx.env);
        await git(cwd, ['commit', '--quiet', '-m', `wf(task): approve ${LOGIN} [pending → approved]`], c.fx.env);
        forged = (await git(cwd, ['rev-parse', 'HEAD'], c.fx.env)).stdout.trim();
        return real(request);
      },
    });
    await c.warm();
    const res = await c.post('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const head = await c.head();
    expect(forged).not.toBe('');
    expect(head).not.toBe(forged);
    expect(res.body.commits).toEqual([{ sha: head, subject: `wf(task): approve ${LOGIN} [pending → approved]` }]);
    expect(c.store.snapshot().actionLog.map((e) => e.sha)).toEqual([head]);
    expect(writes(c)).toEqual([{ event: 'write', data: { pid: c.pid, eid: LOGIN, commit: head } }]);
  });
});
