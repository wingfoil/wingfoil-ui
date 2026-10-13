// `GET /api/settings`, `PUT /api/settings` (spec-004 §3, §4 rows 1, 2, 4, §6; spec-006 §2;
// REQ-STATE-09, RP-28, RP-38, RP-39; C-07.1, C-07.3 and Y-07.2 API side): the routes over the
// in-memory store and the in-process bus. Every 200 body is checked against
// `contracts/api/settings.schema.json`. Process audit: the routes start no process.
import { Ajv } from 'ajv';
import type { ActionLogEntry, UiSettings } from '@wingfoil-ui/contracts';
import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import { InProcessEventBus } from '../../../server/src/events/bus.js';
import { buildApp } from '../../../server/src/http/app.js';
import { registerSettingsRoutes, SETTINGS_PATH } from '../../../server/src/http/settings.js';
import { createLogger } from '../../../server/src/logging.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { createMemoryStateStore } from '../../../server/src/state/memory-store.js';
import type { StateStore } from '../../../server/src/state/store.js';
import type { StateFile } from '@wingfoil-ui/contracts';
import { REPO_ROOT } from '../../harness/cli.js';
import { buildFixture, type Fixture } from '../../harness/fixtures/index.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';
import { auditedSnapshots, type AuditedRunner } from '../snapshot/support.js';

const security = { authentication: createTokenAuthentication('test-token'), port: () => 80 };
const AUTH = { authorization: 'Bearer test-token' };
const sink = new Writable({ write: (_c, _e, cb) => cb() });
const validSettings = new Ajv({ allErrors: true }).compile(
  JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts/api/settings.schema.json'), 'utf8')) as object,
);

const DEFAULTS: UiSettings = {
  autoFetch: true,
  fetchIntervalSeconds: 60,
  autoUpdate: false,
  autoPush: false,
  theme: 'system',
  confirmAgentLaunch: true,
  actionLogCap: 5000,
};
const CHANGED: UiSettings = {
  autoFetch: false,
  fetchIntervalSeconds: 15,
  autoUpdate: true,
  autoPush: true,
  theme: 'dark',
  confirmAgentLaunch: false,
  actionLogCap: 100,
};

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function setUp(initial?: StateFile): Promise<{ store: StateStore; events: unknown[]; bus: InProcessEventBus }> {
  const store = await createMemoryStateStore(initial ? { initial } : {});
  const bus = new InProcessEventBus();
  const events: unknown[] = [];
  bus.subscribe((e) => events.push(e));
  app = await buildApp({
    staticDir: '/nonexistent',
    logger: createLogger(sink),
    security,
    register: (a) => registerSettingsRoutes(a, { store, bus }),
  });
  return { store, events, bus };
}

function get(headers: Record<string, string> = AUTH) {
  return app!.inject({ method: 'GET', url: SETTINGS_PATH, headers });
}

function put(body: unknown, headers: Record<string, string> = AUTH) {
  return app!.inject({
    method: 'PUT',
    url: SETTINGS_PATH,
    headers: { 'content-type': 'application/json', ...headers },
    payload: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('GET /api/settings', () => {
  it('C-07.1, Y-07.2 — a first start answers exactly the spec-006 §2 defaults', async () => {
    await setUp();
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(DEFAULTS);
    expect(validSettings(res.json())).toBe(true);
  });

  it('RP-39 — a stored invalid value reads as its default; an unknown key is not returned', async () => {
    await setUp({
      version: 1,
      projects: [],
      settings: { autoPush: true, fetchIntervalSeconds: 5, theme: 'blue', newer: 'x' },
      actionLog: [],
    });
    const res = await get();
    expect(res.json()).toEqual({ ...DEFAULTS, autoPush: true });
    expect(validSettings(res.json())).toBe(true);
  });

  it('D30-3 — re-reads the state before answering', async () => {
    const { store } = await setUp();
    let reloads = 0;
    const reload = store.reload.bind(store);
    store.reload = () => {
      reloads += 1;
      return reload();
    };
    await get();
    expect(reloads).toBe(1);
  });

  it('needs a session (spec-004 §4 row 2)', async () => {
    await setUp();
    const res = await get({});
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: { code: 'unauthenticated', message: expect.any(String) } });
  });
});

describe('PUT /api/settings', () => {
  it('C-07.3 — stores the whole object: 200 with the stored settings and one settings event', async () => {
    const { store, events } = await setUp();
    const res = await put(CHANGED);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(CHANGED);
    expect(validSettings(res.json())).toBe(true);
    expect(store.settings()).toEqual(CHANGED);
    expect(events).toEqual([{ event: 'settings', data: {} }]);
    expect((await get()).json()).toEqual(CHANGED);
  });

  it('sends one event per valid PUT, also when nothing changed', async () => {
    const { events } = await setUp();
    expect((await put(DEFAULTS)).statusCode).toBe(200);
    expect((await put(DEFAULTS)).statusCode).toBe(200);
    expect(events).toHaveLength(2);
  });

  it('RP-38 — lowering actionLogCap trims the oldest action-log entries in the same write', async () => {
    const log: ActionLogEntry[] = Array.from({ length: 120 }, (_, i) => ({
      sha: i.toString(16).padStart(40, '0'),
      at: '2026-10-12T09:30:02Z',
    }));
    const { store } = await setUp({ version: 1, projects: [], settings: {}, actionLog: log });
    expect((await put(CHANGED)).statusCode).toBe(200);
    expect(store.snapshot().actionLog).toEqual(log.slice(20));
  });

  const INVALID: [string, unknown][] = [
    ...Object.keys(DEFAULTS).map((key): [string, unknown] => {
      const body: Record<string, unknown> = { ...CHANGED };
      delete body[key];
      return [`without ${key}`, body];
    }),
    ['fetchIntervalSeconds 14', { ...CHANGED, fetchIntervalSeconds: 14 }],
    ['fetchIntervalSeconds 3601', { ...CHANGED, fetchIntervalSeconds: 3601 }],
    ['fetchIntervalSeconds 60.5', { ...CHANGED, fetchIntervalSeconds: 60.5 }],
    ['fetchIntervalSeconds "60" (no coercion)', { ...CHANGED, fetchIntervalSeconds: '60' }],
    ['actionLogCap 99', { ...CHANGED, actionLogCap: 99 }],
    ['actionLogCap 100001', { ...CHANGED, actionLogCap: 100_001 }],
    ['actionLogCap null', { ...CHANGED, actionLogCap: null }],
    ['theme "blue"', { ...CHANGED, theme: 'blue' }],
    ['autoFetch "false" (no coercion)', { ...CHANGED, autoFetch: 'false' }],
    ['autoPush 1 (no coercion)', { ...CHANGED, autoPush: 1 }],
    ['an unknown key', { ...CHANGED, newer: true }],
    ['an empty object', {}],
    ['an array', [CHANGED]],
    ['null', null],
    ['not JSON', '{"autoFetch":'],
  ];

  it.each(INVALID)('answers 400 invalid-request to a body %s: nothing stored, no event', async (_label, body) => {
    const { store, events } = await setUp();
    const res = await put(body);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: { code: 'invalid-request', message: expect.any(String) } });
    expect(store.settings()).toEqual(DEFAULTS);
    expect(store.snapshot().settings).toEqual({});
    expect(events).toEqual([]);
  });

  it('needs a session before the body is read (spec-004 §4 row 2 before row 4)', async () => {
    const { events } = await setUp();
    const res = await put('not json', {});
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: { code: 'unauthenticated', message: expect.any(String) } });
    expect(events).toEqual([]);
  });
});

// Process audit (test/server/snapshot/support.ts): with a project open in an audited registry,
// the settings routes and their event start no process (spec-004 §4: rows 1, 2, 4 only).
describe('process audit', () => {
  let ws: TempWorkspace;
  let fx: Fixture;
  let snapshots: Snapshots;
  let runner: AuditedRunner;
  let busEvents: unknown[];
  let auditedBus: InProcessEventBus;

  beforeAll(async () => {
    ws = await TempWorkspace.create('wfui-task-030-audit-');
    fx = await buildFixture('kanban', { root: ws.dir });
    const audited = auditedSnapshots(fx.env);
    ({ snapshots, runner, bus: auditedBus, events: busEvents } = audited);
  }, 600_000);

  afterAll(async () => {
    await snapshots.closeAll();
    await ws.dispose();
  });

  it('GET and PUT /api/settings start 0 processes', async () => {
    const snapshot = await snapshots.open('p_000000000001', fx.dir);
    await snapshot.state();
    const store = await createMemoryStateStore();
    app = await buildApp({
      staticDir: '/nonexistent',
      logger: createLogger(sink),
      security,
      register: (a) => registerSettingsRoutes(a, { store, bus: auditedBus }),
    });
    const before = runner.spawned.length;
    // Precondition: opening the project did start processes, so the registry is audited.
    expect(before).toBeGreaterThan(0);
    busEvents.length = 0;
    expect((await get()).statusCode).toBe(200);
    expect((await put(CHANGED)).statusCode).toBe(200);
    expect((await put({})).statusCode).toBe(400);
    expect(busEvents).toEqual([{ event: 'settings', data: {} }]);
    expect(runner.spawned.length).toBe(before);
  });
});
