// spec-004 §3 v0.1 read routes over the snapshot (task-012): `GET /api/server`, `/api/p/:pid`,
// `/config`, `/elements[?archived=true]`, `/elements/:eid`, `/elements/:eid/history`,
// `/directives`, `/directives/:did`, `/docs`, `/files/tree`, `/files/content` — on copies of the
// kanban and custom fixtures (pinned CLI, real git), every body checked against its schema in
// `contracts/api/`, `X-Repo-State` on every read, 404 for unknown ids, a failed direct read scoped
// to its element (502 `read-error`), an unreadable `memory.yaml` degrading the type-dependent
// features only, a failed `dna show` confined to the DNA (S-27.1), and the identity read from the
// watched state (0 processes for `GET /api/p/:pid` and `PUT role-view` on a warm cache).
// The bodies are read as untyped JSON: each is validated against its schema first.
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies, each validated against its schema */
import { Ajv } from 'ajv';
import type { FastifyInstance } from 'fastify';
import { appendFile, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import { buildApp } from '../../../server/src/http/app.js';
import { registerProjectRoutes } from '../../../server/src/http/project-routes.js';
import { registerRoleViewRoute } from '../../../server/src/http/role-view.js';
import { registerServerRoute } from '../../../server/src/http/server-route.js';
import { createSnapshotIdentitySource } from '../../../server/src/identity/snapshot-identity.js';
import { createLogger } from '../../../server/src/logging.js';
import { nodeReadFs, type ReadFs } from '../../../server/src/reads/confine.js';
import { REPO_STATE_HEADER } from '../../../server/src/snapshot/state.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { createMemoryStateStore } from '../../../server/src/state/memory-store.js';
import type { StateStore } from '../../../server/src/state/store.js';
import { REPO_ROOT } from '../../harness/cli.js';
import { buildFixture, copyFixture, type Fixture } from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';
import { auditedSnapshots, type AuditedRunner } from '../snapshot/support.js';

const security = { authentication: createTokenAuthentication('test-token'), port: () => 80 };
const AUTH = { authorization: 'Bearer test-token' };
const sink = new Writable({ write: (_c, _e, cb) => cb() });
const STATE = /^[0-9a-f]{40}\.[0-9a-f]{16}$/;

// Every schema of contracts/ the API schemas refer to, by $id, so that `$ref`s resolve.
const ajv = new Ajv({ allErrors: true });
const CONTRACTS = path.join(REPO_ROOT, 'contracts');
for (const dir of ['api', 'cli', 'files']) {
  for (const file of await readdir(path.join(CONTRACTS, dir))) {
    ajv.addSchema(JSON.parse(await readFile(path.join(CONTRACTS, dir, file), 'utf8')) as object);
  }
}
ajv.addSchema(JSON.parse(await readFile(path.join(CONTRACTS, 'capabilities.schema.json'), 'utf8')) as object);
function expectSchema(file: string, body: unknown): void {
  const validate = ajv.getSchema(`https://wingfoil-ui.local/contracts/api/${file}`);
  expect(validate, file).toBeDefined();
  expect(validate!(body), `${file}: ${JSON.stringify(validate!.errors)}`).toBe(true);
}

let root: string;
let kanbanTemplate: Fixture;
let customTemplate: Fixture;
let n = 0;
const registries: Snapshots[] = [];
let app: FastifyInstance | undefined;

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-routes-')));
  kanbanTemplate = await buildFixture('kanban', { root: path.join(root, 'kanban') });
  customTemplate = await buildFixture('custom', { root: path.join(root, 'custom') });
}, 600_000);

afterEach(async () => {
  await app?.close();
  app = undefined;
});

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await rm(root, { recursive: true, force: true });
});

interface Console {
  fx: Fixture;
  pid: string;
  store: StateStore;
  runner: AuditedRunner;
  get(url: string): Promise<{ status: number; state: string | undefined; body: any }>;
}

async function start(
  template: Fixture,
  options: { fs?: ReadFs; prepare?: (fx: Fixture) => Promise<void>; failLog?: boolean } = {},
): Promise<Console> {
  n += 1;
  const fx = await copyFixture(template, path.join(root, `copy-${n}`));
  await options.prepare?.(fx);
  const audited = auditedSnapshots(fx.env, options.fs ? { fs: options.fs } : {});
  if (options.failLog) {
    // A git log that ends badly (its output over the runner's limit), every other process real.
    const run = audited.runner.run.bind(audited.runner);
    audited.runner.run = async (request) =>
      request.args.includes('log')
        ? { exitCode: null, signal: 'SIGKILL', stdout: '', stderr: '', ended: 'overflow', durationMs: 1 }
        : run(request);
  }
  registries.push(audited.snapshots);
  const store = await createMemoryStateStore();
  const entry = await store.add({ path: fx.dir, name: fx.name, remote: '' });
  const logger = createLogger(sink);
  app = await buildApp({
    staticDir: '/nonexistent',
    logger,
    security,
    register: (a) => {
      const identity = createSnapshotIdentitySource(audited.snapshots);
      registerServerRoute(a, { store, version: '9.9.9-test' });
      registerProjectRoutes(a, { store, snapshots: audited.snapshots });
      registerRoleViewRoute(a, { store, identity });
    },
  });
  const get = async (url: string) => {
    const res = await app!.inject({ method: 'GET', url, headers: AUTH });
    const header = res.headers[REPO_STATE_HEADER.toLowerCase()];
    return { status: res.statusCode, state: typeof header === 'string' ? header : undefined, body: res.json() };
  };
  return { fx, pid: entry.id, store, runner: audited.runner, get };
}

describe('GET /api/server', () => {
  it('answers the UI version, the supported range, the capability table and the state warnings', async () => {
    const c = await start(kanbanTemplate);
    const res = await c.get('/api/server');
    expect(res.status).toBe(200);
    expectSchema('server.schema.json', res.body);
    expect(res.body).toMatchObject({ version: '9.9.9-test', range: { min: '0.2.2', max: '0.2.x' }, warnings: [] });
    expect(res.body.range).toEqual({ min: '0.2.2', max: '0.2.x' });
    expect(res.body.capabilities.map((x: { id: string }) => x.id)).toContain('field-editing');
    expect(c.runner.spawned).toEqual([]);
  });
});

describe('GET /api/p/:pid — the project header', () => {
  it('names the project, its version in range, the identity and the repository state', async () => {
    const c = await start(kanbanTemplate);
    const res = await c.get(`/api/p/${c.pid}`);
    expect(res.status).toBe(200);
    expectSchema('project.schema.json', res.body);
    expect(res.state).toMatch(STATE);
    expect(res.body).toMatchObject({
      id: c.pid,
      name: 'kanban',
      wingfoil: { text: '0.2.2', version: '0.2.2', state: 'in-range', inRange: true, source: 'project' },
      identity: { kind: 'member', name: 'Alex' },
      readOnly: [],
      repository: { state: res.state, localChanges: 0 },
    });
    expect(res.body.capabilities.missing).toEqual([]);
    expect(res.body).not.toHaveProperty('dnaError');
  });

  it('starts 0 processes on a warm cache, also for PUT role-view (spec-004 §4 rows 1–6)', async () => {
    const c = await start(kanbanTemplate);
    await c.get(`/api/p/${c.pid}`);
    const before = c.runner.spawned.length;
    expect((await c.get(`/api/p/${c.pid}`)).status).toBe(200);
    const put = await app!.inject({
      method: 'PUT',
      url: `/api/p/${c.pid}/role-view`,
      headers: { ...AUTH, 'content-type': 'application/json' },
      payload: { role: 'developer' },
    });
    expect(put.statusCode).toBe(204);
    expect(c.runner.spawned.length).toBe(before);
    expect((await c.get(`/api/p/${c.pid}`)).body.roleView).toBe('developer');
    expect(c.runner.spawned.length).toBe(before);
  });

  it('marks the project read-only for a user who is not in the team', async () => {
    const c = await start(kanbanTemplate, {
      prepare: async (fx) => {
        await git(fx.dir, ['config', 'user.email', 'riley@example.test'], fx.env);
      },
    });
    const res = await c.get(`/api/p/${c.pid}`);
    expect(res.body.identity).toEqual({ kind: 'not-in-team', email: 'riley@example.test' });
    expect(res.body.readOnly).toEqual([{ code: 'not-in-team' }]);
    const elements = await c.get(`/api/p/${c.pid}/elements`);
    const verbs = elements.body.elements.flatMap((e: any) => e.descriptor.verbs);
    expect(verbs.length).toBeGreaterThan(0);
    expect(verbs.every((v: any) => v.enabled === false && v.reason.code === 'not-in-team')).toBe(true);
  });

  it('S-27.1: a failed dna show is reported, the header still answers', async () => {
    const c = await start(kanbanTemplate, {
      prepare: (fx) => appendFile(path.join(fx.dir, '.wingfoil', 'dna.yaml'), 'project: [unclosed\n  : :\n'),
    });
    const res = await c.get(`/api/p/${c.pid}`);
    expect(res.status).toBe(200);
    expectSchema('project.schema.json', res.body);
    expect(res.body.dnaError).toMatchObject({
      code: 'cli-refused',
      message: expect.stringMatching(/E_YAML_PARSE_ERROR/),
    });
    expect(res.body.name).toBe('kanban');
    const config = await c.get(`/api/p/${c.pid}/config`);
    expect(config.status).toBe(200);
    expectSchema('config.schema.json', config.body);
    expect(config.body.dna.error.code).toBe('cli-refused');
    expect(config.body.types.data.types).toHaveProperty('task');
    const elements = await c.get(`/api/p/${c.pid}/elements`);
    expect(elements.status).toBe(200);
    expect(elements.body.elements).toHaveLength(5);
  });
});

describe('GET /api/p/:pid/config', () => {
  it('answers the DNA, the paths, the workflows and the types with their resolved states', async () => {
    const c = await start(kanbanTemplate);
    const res = await c.get(`/api/p/${c.pid}/config`);
    expect(res.status).toBe(200);
    expectSchema('config.schema.json', res.body);
    expect(res.state).toMatch(STATE);
    expect(res.body.dna.data.project.name).toBe('kanban');
    expect(res.body.paths.data).toHaveProperty('config');
    expect(res.body.workflows.data.workflows.length).toBeGreaterThan(0);
    for (const type of Object.values(res.body.types.data.types) as { states: { sequence: string[] } }[]) {
      expect(type.states.sequence.length).toBeGreaterThan(0);
    }
  });
});

describe('GET /api/p/:pid/elements', () => {
  it('lists every element with its marker and descriptor (M-01.1, M-01.2)', async () => {
    const c = await start(kanbanTemplate);
    const res = await c.get(`/api/p/${c.pid}/elements`);
    expect(res.status).toBe(200);
    expectSchema('elements.schema.json', res.body);
    expect(res.state).toMatch(STATE);
    const elements = res.body.elements as any[];
    expect(elements.filter((e) => e.type === 'task')).toHaveLength(4);
    expect(elements.filter((e) => e.type === 'bug')).toHaveLength(1);
    expect(elements.every((e) => e.localChanges === false && e.descriptor.id === e.id)).toBe(true);
    expect(
      elements
        .filter((e) => e.descriptor.bucket === 'to-approve')
        .map((e) => e.id)
        .sort(),
    ).toEqual(['bug-001-crash-on-save', 'task-001-login-form']);
    const rejected = elements.find((e) => e.id === 'task-002-password-reset').descriptor;
    expect(rejected.rejection).toMatchObject({ by: 'Morgan', reason: 'Missing acceptance criteria' });
  });

  it('adds the archived elements with ?archived=true', async () => {
    const c = await start(kanbanTemplate);
    const plain = await c.get(`/api/p/${c.pid}/elements`);
    const all = await c.get(`/api/p/${c.pid}/elements?archived=true`);
    expect(all.status).toBe(200);
    expectSchema('elements.schema.json', all.body);
    expect(all.body.elements.length).toBeGreaterThanOrEqual(plain.body.elements.length);
    expect((await c.get(`/api/p/${c.pid}/elements?archived=maybe`)).status).toBe(400);
  });

  it('marks an element with local changes and disables its verbs', async () => {
    const c = await start(kanbanTemplate, {
      prepare: async (fx) => {
        const file = path.join(fx.dir, 'docs/memory/task/task-001-login-form.md');
        await writeFile(file, (await readFile(file, 'utf8')).replace('title: "Login form"', 'title: "Login form v2"'));
      },
    });
    const res = await c.get(`/api/p/${c.pid}/elements`);
    const task = res.body.elements.find((e: any) => e.id === 'task-001-login-form');
    expect(task).toMatchObject({ title: 'Login form v2', localChanges: true });
    expect(task.descriptor.verbs.every((v: any) => v.reason?.code === 'local-changes')).toBe(true);
    expect((await c.get(`/api/p/${c.pid}`)).body.repository.localChanges).toBe(1);
  });
});

describe('GET /api/p/:pid/elements/:eid and /history', () => {
  it('answers one element with its frontmatter, body, descriptor and required fields', async () => {
    const c = await start(kanbanTemplate);
    const res = await c.get(`/api/p/${c.pid}/elements/task-002-password-reset`);
    expect(res.status).toBe(200);
    expectSchema('element.schema.json', res.body);
    expect(res.state).toMatch(STATE);
    expect(res.body.element).toMatchObject({ id: 'task-002-password-reset', localChanges: false });
    expect(res.body.frontmatter).toMatchObject({ id: 'task-002-password-reset', status: 'draft' });
    expect(typeof res.body.body).toBe('string');
    expect(res.body.descriptor.rejection.by).toBe('Morgan');
    expect(Array.isArray(res.body.required)).toBe(true);
  });

  it('answers the memory history of an element', async () => {
    const c = await start(kanbanTemplate);
    const res = await c.get(`/api/p/${c.pid}/elements/task-002-password-reset/history`);
    expect(res.status).toBe(200);
    expectSchema('history.schema.json', res.body);
    expect(res.body.entries.map((e: any) => e.operation)).toEqual(['add', 'submit', 'reject']);
  });

  it('answers 404 to an unknown element, also on /history, starting no history process', async () => {
    const c = await start(kanbanTemplate);
    for (const url of ['task-999-nothing', 'task-999-nothing/history', '..%2F..%2Fetc%2Fhosts']) {
      const res = await c.get(`/api/p/${c.pid}/elements/${url}`);
      expect(res.status, url).toBe(404);
      expect(res.body.error.code).toBe('not-found');
    }
    expect(c.runner.wingfoilCommands().filter((x) => x.startsWith('memory history'))).toEqual([]);
  });

  it('scopes a failed direct read to its element: 502 read-error, the others readable', async () => {
    const c = await start(kanbanTemplate, {
      prepare: (fx) =>
        appendFile(path.join(fx.dir, 'docs/memory/task/task-003-logout.md'), `\n${'x'.repeat(5 * 1024 * 1024 + 10)}\n`),
    });
    const res = await c.get(`/api/p/${c.pid}/elements/task-003-logout`);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({
      error: {
        code: 'read-error',
        message: expect.stringContaining('docs/memory/task/task-003-logout.md'),
        detail: { file: 'docs/memory/task/task-003-logout.md', kind: 'shape' },
      },
    });
    expect((await c.get(`/api/p/${c.pid}/elements/task-001-login-form`)).status).toBe(200);
    expect((await c.get(`/api/p/${c.pid}/elements`)).status).toBe(200);
  });
});

describe('an unreadable memory.yaml degrades the type-dependent features only (spec-004 §5)', () => {
  it('serves the elements without descriptor, the element without required fields', async () => {
    const fs: ReadFs = {
      ...nodeReadFs,
      readFile: (f) =>
        f.endsWith(`${path.sep}memory.yaml`) ? Promise.reject(new Error('EACCES')) : nodeReadFs.readFile(f),
    };
    const c = await start(kanbanTemplate, { fs });
    const list = await c.get(`/api/p/${c.pid}/elements`);
    expect(list.status).toBe(200);
    expectSchema('elements.schema.json', list.body);
    expect(list.body.elements).toHaveLength(5);
    expect(list.body.elements.every((e: any) => e.descriptor === undefined)).toBe(true);
    expect(list.body.typesError).toEqual({
      code: 'read-error',
      message: expect.any(String),
      detail: { file: '.wingfoil/memory.yaml', kind: 'missing' },
    });
    const one = await c.get(`/api/p/${c.pid}/elements/task-001-login-form`);
    expect(one.status).toBe(200);
    expect(one.body).not.toHaveProperty('descriptor');
    expect(one.body).not.toHaveProperty('required');
    expect((await c.get(`/api/p/${c.pid}/config`)).body.types.error.detail.kind).toBe('missing');
  });
});

describe('a failed Memory event read degrades the actors only (review round 1, finding 5)', () => {
  it('serves the elements with descriptors computed without events, and eventsError', async () => {
    const c = await start(kanbanTemplate, { failLog: true });
    const list = await c.get(`/api/p/${c.pid}/elements`);
    expect(list.status).toBe(200);
    expectSchema('elements.schema.json', list.body);
    expect(list.body.elements).toHaveLength(5);
    expect(list.body.elements.every((e: any) => e.descriptor !== undefined)).toBe(true);
    expect(list.body.eventsError).toEqual({ code: 'internal', message: expect.any(String) });
    const one = await c.get(`/api/p/${c.pid}/elements/task-002-password-reset`);
    expect(one.status).toBe(200);
    expectSchema('element.schema.json', one.body);
    expect(one.body.descriptor).not.toHaveProperty('rejection');
    expect(one.body.eventsError.code).toBe('internal');
  });
});

describe('one odd commit loses at most its own event (review round 2, finding A)', () => {
  it('a NUL past 8000 bytes and a bad ident: events kept, the refusal or skip cached for the HEAD', async () => {
    const c = await start(kanbanTemplate, {
      prepare: async (fx) => {
        // A text file past git's 8000-byte binary check, with a NUL: the patch holds a NUL.
        await writeFile(path.join(fx.dir, 'docs/memory/task/blob.md'), `${'a'.repeat(9000)}\0z\n`);
        await git(fx.dir, ['add', '-A'], fx.env);
        await git(fx.dir, ['commit', '-qm', 'wf(task): add blob'], fx.env);
        // A wf commit whose author date git cannot print (`%aI` stays literal).
        const file = path.join(fx.dir, 'docs/memory/task/task-003-logout.md');
        await appendFile(file, '\nedited\n');
        await git(fx.dir, ['add', '-A'], fx.env);
        const tree = (await git(fx.dir, ['write-tree'], fx.env)).stdout.trim();
        const parent = (await git(fx.dir, ['rev-parse', 'HEAD'], fx.env)).stdout.trim();
        const raw = `tree ${tree}\nparent ${parent}\nauthor Mallory <m@x.test> notadate\ncommitter Mallory <m@x.test> 1700000000 +0000\n\nwf(task): submit task-003-logout\n`;
        const objects = path.join(fx.dir, '.git', 'raw-commit');
        await writeFile(objects, raw);
        const sha = (
          await git(fx.dir, ['hash-object', '-t', 'commit', '-w', '--literally', objects], fx.env)
        ).stdout.trim();
        await rm(objects);
        await git(fx.dir, ['update-ref', 'HEAD', sha], fx.env);
      },
    });
    const first = await c.get(`/api/p/${c.pid}/elements`);
    expect(first.status).toBe(200);
    expect(first.body).not.toHaveProperty('eventsError');
    const rejected = first.body.elements.find((e: any) => e.id === 'task-002-password-reset');
    expect(rejected.descriptor.rejection.by).toBe('Morgan');
    const before = c.runner.spawned.length;
    expect((await c.get(`/api/p/${c.pid}/elements`)).body).toEqual(first.body);
    expect(c.runner.spawned.length).toBe(before);
  });
});

describe('GET /api/p/:pid/directives', () => {
  it('lists the directives with "only mine" for the role view, and answers one with its body', async () => {
    const c = await start(customTemplate);
    const list = await c.get(`/api/p/${c.pid}/directives`);
    expect(list.status).toBe(200);
    expectSchema('directives.schema.json', list.body);
    expect(list.state).toMatch(STATE);
    const first = list.body.entries[0];
    const one = await c.get(`/api/p/${c.pid}/directives/${first.frontmatter.id}`);
    expect(one.status).toBe(200);
    expectSchema('directive.schema.json', one.body);
    expect(one.body.frontmatter.id).toBe(first.frontmatter.id);
    expect(typeof one.body.body).toBe('string');
    expect(list.body.entries.some((e: any) => e.mine === true)).toBe(true);
    expect((await c.get(`/api/p/${c.pid}/directives/nothing-here`)).status).toBe(404);
  });
});

describe('GET /api/p/:pid/docs and /files (R-08.1, REQ-SEC-06)', () => {
  it('indexes paths.docs without the Memory and plan files', async () => {
    const c = await start(customTemplate);
    const res = await c.get(`/api/p/${c.pid}/docs`);
    expect(res.status).toBe(200);
    expectSchema('docs.schema.json', res.body);
    const paths = res.body.documents.map((d: { path: string }) => d.path);
    expect(paths).toContain('docs/01_vision/02_product-vision.md');
    expect(paths.filter((p: string) => p.startsWith('docs/04_memory/') || p.startsWith('docs/05_plans/'))).toEqual([]);
  });

  it('answers a document, refuses traversal as outside with 0 bytes of the target', async () => {
    const c = await start(customTemplate);
    const ok = await c.get(
      `/api/p/${c.pid}/files/content?path=${encodeURIComponent('docs/01_vision/02_product-vision.md')}`,
    );
    expect(ok.status).toBe(200);
    expectSchema('file-content.schema.json', ok.body);
    const hosts = await readFile('/etc/hosts', 'utf8').catch(() => 'no-hosts-file-here');
    for (const p of ['../../../etc/hosts', '%2e%2e%2f%2e%2e%2fetc%2fhosts', '/etc/hosts', 'docs/../../x']) {
      const res = await c.get(`/api/p/${c.pid}/files/content?path=${p.includes('%') ? p : encodeURIComponent(p)}`);
      expect(res.status, p).toBe(404);
      expect(res.body.error).toMatchObject({ code: 'not-found', detail: { kind: 'outside' } });
      expect(JSON.stringify(res.body)).not.toContain(hosts.trim().split('\n')[0]);
    }
    const memory = await c.get(`/api/p/${c.pid}/files/content?path=${encodeURIComponent('.wingfoil/dna.yaml')}`);
    expect(memory.body.error.detail.kind).toBe('not-allowed');
    expect((await c.get(`/api/p/${c.pid}/files/content`)).status).toBe(400);
  });

  it('lists the working tree one level at a time, confined', async () => {
    const c = await start(customTemplate);
    // v0.1: the documentation folders only (spec-004 §3 "v0.1 (docs)").
    const res = await c.get(`/api/p/${c.pid}/files/tree?path=docs`);
    expect(res.status).toBe(200);
    expectSchema('file-tree.schema.json', res.body);
    expect(res.body.entries.map((e: any) => e.name)).toEqual(['01_vision']);
    const top = await c.get(`/api/p/${c.pid}/files/tree`);
    expect(top.status).toBe(404);
    expect(top.body.error.detail.kind).toBe('not-allowed');
    const out = await c.get(`/api/p/${c.pid}/files/tree?path=..`);
    expect(out.status).toBe(404);
    expect(out.body.error.detail.kind).toBe('outside');
  });
});

describe('unknown project ids', () => {
  it.each([
    '',
    '/config',
    '/elements',
    '/elements/task-001-login-form',
    '/elements/task-001-login-form/history',
    '/directives',
    '/directives/x',
    '/docs',
    '/files/tree',
    '/files/content?path=docs',
  ])('GET /api/p/<unknown>%s → 404 not-found, no process', async (suffix) => {
    const c = await start(kanbanTemplate);
    for (const pid of ['p_zzzzzzzzzzzz', '..%2F..%2Fetc', c.pid.toUpperCase()]) {
      const res = await c.get(`/api/p/${pid}${suffix}`);
      expect(res.status, pid).toBe(404);
      expect(res.body).toEqual({ error: { code: 'not-found', message: expect.any(String) } });
    }
    expect(c.runner.spawned).toEqual([]);
  });
});
