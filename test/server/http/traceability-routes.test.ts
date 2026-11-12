// task-074 AC-1 … AC-4, AC-6 (D74-2 … D74-8, Q1 … Q3; spec-012 §4, §8 … §11) —
// `GET /api/p/:pid/traceability?scope=` through the routes on copies of the real fixtures (pinned
// CLI, real git) and the variants of `test/harness/fixtures/progress.ts`: every body valid against
// its schema, the figures behind each R-01 scenario's text, the errors of spec-012 §10, the
// processes (0 for a repeated request, each CLI command at most once on a cold state, none per
// element), an events failure not kept for the state, and K1.
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies, each validated against its schema */
import { Ajv } from 'ajv';
import type { FastifyInstance } from 'fastify';
import { readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as bodies from '../../../server/src/project-state/bodies.js';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import { gitSubcommand } from '../../../server/src/git/git.js';
import { buildApp } from '../../../server/src/http/app.js';
import { registerProjectRoutes } from '../../../server/src/http/project-routes.js';
import { createLogger } from '../../../server/src/logging.js';
import { nodeReadFs, type ReadFs } from '../../../server/src/reads/confine.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { createMemoryStateStore } from '../../../server/src/state/memory-store.js';
import { REPO_ROOT } from '../../harness/cli.js';
import {
  buildFixture,
  copyFixture,
  installCliStub,
  setFrontmatterValue,
  usePrePacksStates,
  usePresetUiConfig,
  type Fixture,
} from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';
import { auditedSnapshots, processKind, type AuditedRunner } from '../snapshot/support.js';

const security = { authentication: createTokenAuthentication('test-token'), port: () => 80 };
const AUTH = { authorization: 'Bearer test-token' };
const sink = new Writable({ write: (_c, _e, cb) => cb() });

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

// Review round 1 F-2: the computation of the body, counted (the route's memo reads only cached
// values, so the process audit cannot see whether it is kept).
vi.mock('../../../server/src/project-state/bodies.js', async (original) => {
  const actual = await original<typeof import('../../../server/src/project-state/bodies.js')>();
  return { ...actual, traceabilityParts: vi.fn(actual.traceabilityParts) };
});
const computations = vi.mocked(bodies.traceabilityParts);

const DL_001 = 'dl-001-initialise-wingfoil-before-inception';

/** Edit element `id`'s file with `edit` and commit it outside the UI. */
async function editElement(fx: Fixture, id: string, edit: (text: string) => string): Promise<void> {
  const files = (await git(fx.dir, ['ls-files', '-z'], fx.env)).stdout.split('\0');
  const rel = files.find((f) => path.basename(f) === `${id}.md`)!;
  const file = path.join(fx.dir, rel);
  await writeFile(file, edit(await readFile(file, 'utf8')));
  await git(fx.dir, ['commit', '-q', '-m', `docs: edit ${id}`, '--', rel], fx.env);
}

/** The variants, built once in `beforeAll` (bug-028); each test copies one. */
const VARIANTS = {
  // The custom fixture with the sw-life-cycle preset (conventions *Preset variant*).
  preset: async (fx: Fixture) => usePresetUiConfig(fx),
  // R-01.5: `ref: US-S-09` on dl-001, committed outside the UI, with the preset.
  usS09: async (fx: Fixture) => {
    await usePresetUiConfig(fx);
    await setFrontmatterValue(fx, DL_001, 'ref', 'US-S-09');
  },
  // R-01.7: `related: dl-001-…` on task-001, committed outside the UI, no ui.yaml.
  related: async (fx: Fixture) => setFrontmatterValue(fx, 'task-001-cli-adapter', 'related', DL_001),
  // R-01.2: the pre-packs states with the preset.
  prePacks: async (fx: Fixture) => {
    await usePrePacksStates(fx);
    await usePresetUiConfig(fx);
  },
  // spec-012 §10: an ignored ui.yaml.
  ignored: async (fx: Fixture) => {
    await writeFile(path.join(fx.dir, '.wingfoil/ui.yaml'), 'version: 1\nprogress: { mode: spiral }\n');
    await git(fx.dir, ['add', '.wingfoil/ui.yaml'], fx.env);
    await git(fx.dir, ['commit', '-q', '-m', 'chore(ui): a ui.yaml of the test'], fx.env);
  },
} satisfies Record<string, (fx: Fixture) => Promise<void>>;
type Variant = keyof typeof VARIANTS | 'unknown';

let ws: TempWorkspace;
const variants = {} as Record<Variant, Fixture>;
let n = 0;
const registries: Snapshots[] = [];
const apps: FastifyInstance[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-traceability-');
  const root = await realpath(ws.dir);
  const template = await buildFixture('custom', { root: path.join(root, 'custom') });
  for (const [name, prepare] of Object.entries(VARIANTS) as [Variant, (fx: Fixture) => Promise<void>][]) {
    variants[name] = await copyFixture(template, path.join(root, `variant-${name}`));
    await prepare(variants[name]);
  }
  variants.unknown = await buildFixture('unknown', { root: path.join(root, 'unknown') });
}, 900_000);

afterEach(async () => {
  for (const a of apps.splice(0)) await a.close();
});

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await ws.dispose();
});

interface StartOptions {
  prepare?: (fx: Fixture) => Promise<void>;
  /** Overrides of the direct reads (by the path's suffix). */
  fs?: (file: string) => Promise<string> | undefined;
  /** The Memory events' `git log` fails (killed on its timeout: a transient failure) while `failing()` holds. */
  failLog?: () => boolean;
}

async function start(variant: Variant, options: StartOptions = {}) {
  n += 1;
  const fx = await copyFixture(variants[variant], path.join(await realpath(ws.dir), `copy-${n}`));
  await options.prepare?.(fx);
  const fs: ReadFs = {
    ...nodeReadFs,
    readFile: async (file) => options.fs?.(file) ?? nodeReadFs.readFile(file),
  };
  const audited = auditedSnapshots(fx.env, { fs });
  if (options.failLog) {
    const failing = options.failLog;
    const run = audited.runner.run.bind(audited.runner);
    audited.runner.run = async (request) =>
      failing() && request.args.includes('log')
        ? { exitCode: null, signal: 'SIGKILL', stdout: '', stderr: '', ended: 'timeout', durationMs: 1 }
        : run(request);
  }
  registries.push(audited.snapshots);
  const store = await createMemoryStateStore();
  const entry = await store.add({ path: fx.dir, name: fx.name, remote: '' });
  const app = await buildApp({
    staticDir: '/nonexistent',
    logger: createLogger(sink),
    security,
    register: (a) => registerProjectRoutes(a, { store, snapshots: audited.snapshots }),
  });
  apps.push(app);
  const get = async (url: string) => {
    const res = await app.inject({ method: 'GET', url, headers: AUTH });
    return { status: res.statusCode, body: res.json(), state: res.headers['x-repo-state'] };
  };
  const snapshot = () => audited.snapshots.open(entry.id, fx.dir);
  return { fx, pid: entry.id, runner: audited.runner as AuditedRunner, get, snapshot };
}

type Console = Awaited<ReturnType<typeof start>>;

const traceability = async (c: Console, query = '') => {
  const res = await c.get(`/api/p/${c.pid}/traceability${query}`);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  expectSchema('traceability.schema.json', res.body);
  return res.body;
};

const row = (body: any, id: string, element?: boolean) =>
  body.references.find((r: any) => r.id === id && (element === undefined || r.element === element));

describe('GET /api/p/:pid/traceability — the R-01 scenarios (TT-STATE-08)', () => {
  it('R-01.1 List references with their completion — 25 %, coverage 3/5, US-M-01 50 % · 1/2, US-S-01 0 % · 0/1', async () => {
    const body = await traceability(await start('preset'));
    expect(body.scope).toMatchObject({ type: 'release', applied: 'current', current: { id: 'minor-v0.1' } });
    expect(body.figures.completion).toMatchObject({ state: 'shown', percent: 25 });
    expect(body.figures.coverage).toEqual({ state: 'shown', carrying: 3, total: 5, percent: 60 });
    expect(row(body, 'US-M-01')).toMatchObject({
      linked: ['task-002-memory-list', 'task-003-element-panel'],
      done: 1,
      total: 2,
      percent: 50,
    });
    expect(row(body, 'US-S-01')).toMatchObject({ linked: ['task-001-cli-adapter'], done: 0, total: 1, percent: 0 });
  }, 300_000);

  it('R-01.2 Show who must act on a reference’s open elements — the linked rows: task-002 done, task-003 waiting for the engine', async () => {
    const body = await traceability(await start('prePacks'));
    const el = (id: string) => body.elements.find((e: any) => e.id === id);
    expect(el('task-002-memory-list')).toMatchObject({
      shortId: 'task-002',
      title: 'Memory list',
      done: true,
      inScope: true,
    });
    expect(el('task-003-element-panel')).toMatchObject({ status: 'backlog', done: false });
    expect(el('task-003-element-panel').descriptor.kind).toBe('waiting');
  }, 300_000);

  it('R-01.3 Filter references by status — no row is completed', async () => {
    const body = await traceability(await start('preset'));
    expect(body.references.map((r: any) => r.status)).toEqual(['in-progress', 'not-started']);
  }, 300_000);

  it('R-01.4 Explain an empty traceability — unknown fixture: no reference, patterns false', async () => {
    const body = await traceability(await start('unknown'));
    expect(body.references).toEqual([]);
    expect(body.patterns).toBe(false);
    expect(body.figures.coverage).toEqual({ state: 'unavailable', reason: { code: 'no-requires' } });
    expect(body.figures.completion).toEqual({ state: 'unavailable', reason: { code: 'no-reference-categories' } });
  }, 300_000);

  it('R-01.5 Show the rows outside the current release under the whole project — US-S-09 with scope=project only', async () => {
    const c = await start('usS09');
    const current = await traceability(c);
    expect(row(current, 'US-S-09')).toBeUndefined();
    const project = await traceability(c, '?scope=project');
    expect(project.scope.applied).toBe('project');
    expect(row(project, 'US-S-09')).toMatchObject({ element: false, linked: [DL_001], category: 'requirement' });
    expect(project.elements.find((e: any) => e.id === DL_001)).toMatchObject({ shortId: 'dl-001', inScope: false });
  }, 300_000);

  it('R-01.6 Show a pattern reference by its id only — element false, no title', async () => {
    const body = await traceability(await start('preset'));
    const r = row(body, 'US-M-01');
    expect(r).toMatchObject({ category: 'requirement', element: false });
    expect(Object.keys(r).sort()).toEqual([
      'category',
      'done',
      'element',
      'id',
      'linked',
      'percent',
      'status',
      'total',
    ]);
    expect(body.elements.some((e: any) => e.id === 'US-M-01')).toBe(false);
  }, 300_000);

  it('R-01.7 List references between Memory elements without ui.yaml — patterns false, dl-001 decision, linked task-001', async () => {
    const body = await traceability(await start('related'));
    expect(body.ui).toEqual({ source: 'none' });
    expect(body.patterns).toBe(false);
    expect(body.references).toEqual([
      expect.objectContaining({ id: DL_001, category: 'decision', element: true, linked: ['task-001-cli-adapter'] }),
    ]);
    expect(body.elements.map((e: any) => e.id)).toEqual([DL_001, 'task-001-cli-adapter']);
  }, 300_000);

  it('R-01.8 Open the elements missing required references in Memory — missing = task-004-themes, adr-001-local-server', async () => {
    const body = await traceability(await start('preset'));
    expect(body.missing).toEqual([
      { id: 'adr-001-local-server', categories: ['requirement'] },
      { id: 'task-004-themes', categories: ['requirement'] },
    ]);
    expect(body.elements.map((e: any) => e.id)).toEqual(
      expect.arrayContaining(['adr-001-local-server', 'task-004-themes']),
    );
  }, 300_000);

  it('R-01.9 Filter references by category — the requirement rows US-M-01 and US-S-01', async () => {
    const body = await traceability(await start('preset'));
    expect(body.references.filter((r: any) => r.category === 'requirement').map((r: any) => r.id)).toEqual([
      'US-M-01',
      'US-S-01',
    ]);
  }, 300_000);
});

describe('GET /api/p/:pid/traceability — the body (AC-1)', () => {
  it('AC-1 the elements are the /elements rows plus done and inScope; phaseCompletion read-only', async () => {
    const c = await start('preset');
    const body = await traceability(c);
    const list = (await c.get(`/api/p/${c.pid}/elements`)).body;
    for (const e of body.elements) {
      const { done, inScope, ...rest } = e;
      const listed = list.elements.find((l: any) => l.id === e.id);
      const { missingCategories: _m, ...expected } = listed;
      expect(rest).toEqual(expected);
      expect(typeof done).toBe('boolean');
      expect(typeof inScope).toBe('boolean');
    }
    expect(body.figures.phaseCompletion.state).toBe('read-only');
    expect(body.unreadable).toEqual([]);
    expect(body).not.toHaveProperty('eventsError');
  }, 300_000);
});

describe('spec-012 §10 — errors (AC-2)', () => {
  it('unknown :pid → 404, also with a bad scope (404 before 400)', async () => {
    const c = await start('preset');
    expect((await c.get('/api/p/nope/traceability')).status).toBe(404);
    expect((await c.get('/api/p/nope/traceability?scope=bogus')).status).toBe(404);
  }, 300_000);

  it('a bad scope, another parameter, a repeated scope → 400 invalid-request', async () => {
    const c = await start('preset');
    for (const q of ['?scope=bogus', '?scope=', '?x=1', '?scope=current&x=1', '?scope=current&scope=project']) {
      const res = await c.get(`/api/p/${c.pid}/traceability${q}`);
      expect(res.status, q).toBe(400);
      expect(res.body.error.code).toBe('invalid-request');
    }
    expect((await c.get(`/api/p/${c.pid}/traceability?scope=current`)).status).toBe(200);
  }, 300_000);

  it.each([
    { exitCode: 1, stderr: '{"error":"E_BOOM: boom"}', code: 'cli-refused' },
    { exitCode: 2, stderr: 'error: boom', code: 'internal' },
  ])(
    'memory search fails (exit $exitCode) → the CLI envelope, no partial body (as /elements answers it)',
    async ({ code, ...failure }) => {
      const c = await start('preset', {
        prepare: (fx) =>
          installCliStub(fx, { failures: [{ command: ['memory', 'search'], ...failure }] }).then(() => {}),
      });
      const res = await c.get(`/api/p/${c.pid}/traceability`);
      const list = await c.get(`/api/p/${c.pid}/elements`);
      expect(res.status).toBe(list.status);
      expect(res.body).toEqual(list.body);
      expect(res.body.error.code).toBe(code);
    },
    300_000,
  );

  it('memory.yaml unreadable → 502 read-error', async () => {
    const c = await start('preset', {
      fs: (f) => (f.endsWith(`${path.sep}memory.yaml`) ? Promise.reject(new Error('EACCES')) : undefined),
    });
    const res = await c.get(`/api/p/${c.pid}/traceability`);
    expect(res.status).toBe(502);
    expect(res.body.error).toMatchObject({ code: 'read-error', detail: { file: '.wingfoil/memory.yaml' } });
  }, 300_000);

  it('ui.yaml ignored → 200 with ui.status and the inferred values', async () => {
    const body = await traceability(await start('ignored'));
    expect(body.ui).toMatchObject({ source: 'ignored', warning: { code: 'ui-config-ignored' } });
    expect(body.scope).toEqual({ type: null, current: null, applied: 'project' });
    expect(body.patterns).toBe(false);
    expect(body.figures.coverage).toEqual({ state: 'unavailable', reason: { code: 'no-requires' } });
  }, 300_000);

  it('ui.yaml missing → 200 with ui.status and the inferred values', async () => {
    const body = await traceability(await start('related'), '?scope=project');
    expect(body.ui).toEqual({ source: 'none' });
    expect(body.figures.completion).toEqual({ state: 'unavailable', reason: { code: 'no-reference-categories' } });
  }, 300_000);

  it('an unreadable element file and one with 201 values → unreadable / capped', async () => {
    const c = await start('preset', {
      prepare: async (fx) => {
        await setFrontmatterValue(fx, 'task-004-themes', 'notes', 'x'.repeat(70_000));
        const list = Array.from({ length: 201 }, (_, i) => `v-${i}`).join(', ');
        await editElement(fx, 'task-003-element-panel', (t) => t.replace(/^title: /m, `extra: [${list}]\ntitle: `));
      },
    });
    const body = await traceability(c, '?scope=project');
    expect(body.unreadable).toEqual(['task-004-themes']);
    expect(body.capped).toEqual(['task-003-element-panel']);
    // task-003's reference is past its first 200 values: indexed incompletely, it misses it (§1).
    expect(body.missing.map((m: any) => m.id)).toEqual(['adr-001-local-server', 'task-003-element-panel']);
    expect(body.figures.coverage).toMatchObject({ total: 4 });
  }, 300_000);

  it('events fail → eventsError, descriptors computed without events', async () => {
    const body = await traceability(await start('preset', { failLog: () => true }));
    expect(body.eventsError).toEqual({ code: 'internal', message: expect.any(String) });
    expect(body.elements.every((e: any) => e.descriptor !== undefined)).toBe(true);
  }, 300_000);

  it('dna show fails → 200 with no field; member actors fall back', async () => {
    const c = await start('preset', {
      prepare: (fx) =>
        installCliStub(fx, { failures: [{ command: ['dna', 'show'], exitCode: 2, stderr: 'error: boom' }] }).then(
          () => {},
        ),
    });
    const body = await traceability(c);
    expect(body).not.toHaveProperty('dnaError');
    const task004 = body.elements.find((e: any) => e.id === 'task-004-themes');
    expect(JSON.stringify(task004.descriptor)).toContain('author-not-in-team');
  }, 300_000);
});

describe('caching and processes (AC-3, spec-012 §8)', () => {
  it('a repeated /traceability (both scopes) starts 0 processes; X-Repo-State on each answer', async () => {
    const c = await start('preset');
    const first = await c.get(`/api/p/${c.pid}/traceability`);
    const project = await c.get(`/api/p/${c.pid}/traceability?scope=project`);
    const before = c.runner.spawned.length;
    expect((await c.get(`/api/p/${c.pid}/traceability`)).body).toEqual(first.body);
    expect((await c.get(`/api/p/${c.pid}/traceability?scope=project`)).body).toEqual(project.body);
    expect(c.runner.spawned.length).toBe(before);
    expect(first.state).toBeTruthy();
    expect(project.state).toBe(first.state);
  }, 300_000);

  it('a cold Traceability: each CLI command at most once, one ls-tree, none per element', async () => {
    const c = await start('preset');
    await traceability(c);
    await traceability(c, '?scope=project');
    const commands = c.runner.wingfoilCommands();
    expect(new Set(commands).size).toBe(commands.length);
    const kinds = c.runner.spawned.filter((r) => processKind(r) === 'git').map((r) => gitSubcommand(r.args));
    expect(kinds.filter((k) => k === 'ls-tree')).toHaveLength(1);
    // No process per element: none names an element file, and fewer processes than elements read.
    expect(c.runner.spawned.filter((r) => r.args.some((a) => a.endsWith('.md')))).toEqual([]);
    expect(c.runner.spawned.length).toBeLessThan(20);
  }, 300_000);

  it('an events failure is not kept: the next request reads the events again, its descriptors with them', async () => {
    let failing = true;
    const c = await start('preset', { failLog: () => failing });
    const first = await traceability(c);
    expect(first.eventsError).toBeDefined();
    failing = false;
    const second = await traceability(c);
    expect(second).not.toHaveProperty('eventsError');
    // task-004 (backlog) requires its creator, known from the events only (spec-003 §4).
    const actor = (body: any) => body.elements.find((e: any) => e.id === 'task-004-themes').descriptor.actor;
    expect(actor(second)).not.toEqual(actor(first));
    expect(actor(second)).toMatchObject({ kind: 'member' });
  }, 300_000);
});

describe('review round 1 F-2 — the body computed once per state and scope', () => {
  it('two requests of one scope compute once, another scope once more; an events failure computes on every request', async () => {
    let failing = false;
    const c = await start('preset', { failLog: () => failing });
    computations.mockClear();
    await traceability(c);
    await traceability(c);
    expect(computations).toHaveBeenCalledTimes(1);
    await traceability(c, '?scope=project');
    await traceability(c, '?scope=project');
    expect(computations).toHaveBeenCalledTimes(2);
    // A new state (an edit outside the UI), the events failing: computed for each request, kept for none …
    await setFrontmatterValue(c.fx, 'task-004-themes', 'ref', 'US-X-08');
    await (await c.snapshot()).check();
    failing = true;
    computations.mockClear();
    expect((await traceability(c)).eventsError).toBeDefined();
    expect((await traceability(c)).eventsError).toBeDefined();
    expect(computations).toHaveBeenCalledTimes(2);
    // … and once the events read again, computed once and kept.
    failing = false;
    computations.mockClear();
    expect(await traceability(c)).not.toHaveProperty('eventsError');
    await traceability(c);
    expect(computations).toHaveBeenCalledTimes(1);
  }, 300_000);
});

describe('K1 — repository text escaped (AC-4, spec-012 §9)', () => {
  it('a bidi and a C1 control in a title and in a reference value come back escaped', async () => {
    const c = await start('preset', {
      prepare: async (fx) => {
        await editElement(fx, 'minor-v0.1', (t) => t.replace(/^title: .*$/m, 'title: "Minor ‮ v0.1\u0085"'));
        await editElement(fx, 'task-002-memory-list', (t) => t.replace(/^title: .*$/m, 'title: "Memory ‮ list\u0085"'));
        await setFrontmatterValue(fx, 'task-004-themes', 'ref', 'US-‮X\u0085');
      },
    });
    const body = await traceability(c);
    expect(body.scope.current.title).toBe('Minor \\u202e v0.1\\x85');
    expect(body.elements.find((e: any) => e.id === 'task-002-memory-list').title).toBe('Memory \\u202e list\\x85');
    expect(body.references.map((r: any) => r.id)).toContain('US-\\u202eX\\x85');
    expect(body.figures.completion.references.map((r: any) => r.id)).toContain('US-\\u202eX\\x85');
    expect(JSON.stringify(body)).not.toMatch(/[‮\u0085]/);
  }, 300_000);
});
