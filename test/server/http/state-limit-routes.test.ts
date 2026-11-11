// task-073 AC-2 (D73-2 … D73-5; spec-003 §6 rule 5) — `state-limit` through the routes, on copies of
// the custom fixture (pinned CLI, real git) with the Sprints of S-24.7 moved by WingFoil's verbs:
// `GET /elements`, `GET /elements/:eid` and `GET /today` serve `sprint-002`'s submit disabled with
// `state-limit {state: active, limit: 1}`, every body valid against its schema, with no CLI process
// added; an archived holder is not counted (design probe P2); a CLI that answers 0.2.2 applies no
// limit (P11); and where the count differs from WingFoil's — a holder recorded on another branch
// only (P6) — the submit is offered and the CLI's refusal answers 422 `cli-refused`
// (characterization: no server guard, D73-5).
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies, each validated against its schema */
import { Ajv } from 'ajv';
import type { FastifyInstance } from 'fastify';
import { readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import { buildApp } from '../../../server/src/http/app.js';
import { registerElementWriteRoutes } from '../../../server/src/http/element-writes.js';
import { registerProjectRoutes } from '../../../server/src/http/project-routes.js';
import { createLogger } from '../../../server/src/logging.js';
import { InProcessWriteLock } from '../../../server/src/process/write-lock.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { createMemoryStateStore } from '../../../server/src/state/memory-store.js';
import { REPO_ROOT } from '../../harness/cli.js';
import {
  ACTIVE_SPRINT,
  buildFixture,
  copyFixture,
  fillSprints,
  installCliStub,
  memberByName,
  PLANNED_SPRINT,
  planSprints,
  stateLimitProject,
  type Fixture,
} from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';
import { auditedSnapshots, type AuditedRunner } from '../snapshot/support.js';

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

const LIMITED = { code: 'state-limit', state: 'active', limit: 1 };

/** The fixture variants, built once with the CLI in `beforeAll` (bug-028); each test copies one. */
const VARIANTS = {
  // S-24.7: `sprint-001` in `active` (the one slot), `sprint-002` in `planned`.
  full: fillSprints,
  // P2: the holder deprecated (archived): the slot is free again.
  archived: async (fx: Fixture) => {
    await fillSprints(fx);
    await stateLimitProject(fx, 80).deprecate('Alex', ACTIVE_SPRINT, 'Closed early');
  },
  // P6: both `planned` on `main`; `sprint-001` submitted to `active` on the local branch `side` only.
  branch: async (fx: Fixture) => {
    await planSprints(fx);
    await git(fx.dir, ['checkout', '-q', '-b', 'side'], fx.env);
    await stateLimitProject(fx, 80).submit('Alex', ACTIVE_SPRINT);
    await git(fx.dir, ['checkout', '-q', 'main'], fx.env);
  },
} satisfies Record<string, (fx: Fixture) => Promise<void>>;
type Variant = keyof typeof VARIANTS;

let ws: TempWorkspace;
const variants = {} as Record<Variant, Fixture>;
let n = 0;
const registries: Snapshots[] = [];
const apps: FastifyInstance[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-limit-');
  const root = await realpath(ws.dir);
  const template = await buildFixture('custom', { root: path.join(root, 'custom') });
  for (const [name, prepare] of Object.entries(VARIANTS) as [Variant, (fx: Fixture) => Promise<void>][]) {
    variants[name] = await copyFixture(template, path.join(root, `variant-${name}`));
    await prepare(variants[name]);
  }
}, 600_000);

afterEach(async () => {
  for (const a of apps.splice(0)) await a.close();
});

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await ws.dispose();
});

async function start(variant: Variant, prepare?: (fx: Fixture) => Promise<void>, member: 'Morgan' | 'Alex' = 'Morgan') {
  n += 1;
  const fx = await copyFixture(variants[variant], path.join(await realpath(ws.dir), `copy-${n}`));
  await git(fx.dir, ['config', 'user.email', memberByName(member).email], fx.env);
  await prepare?.(fx);
  const audited = auditedSnapshots(fx.env);
  registries.push(audited.snapshots);
  const store = await createMemoryStateStore();
  const entry = await store.add({ path: fx.dir, name: fx.name, remote: '' });
  const app = await buildApp({
    staticDir: '/nonexistent',
    logger: createLogger(sink),
    security,
    register: (a) => {
      registerProjectRoutes(a, { store, snapshots: audited.snapshots });
      registerElementWriteRoutes(a, {
        store,
        snapshots: audited.snapshots,
        writeLock: new InProcessWriteLock(),
        bus: audited.bus,
      });
    },
  });
  apps.push(app);
  const get = async (url: string) => {
    const res = await app.inject({ method: 'GET', url, headers: AUTH });
    return { status: res.statusCode, body: res.json() };
  };
  const post = async (verb: string, eid: string, body: unknown) => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/p/${entry.id}/elements/${eid}/${verb}`,
      headers: { ...AUTH, 'content-type': 'application/json' },
      payload: JSON.stringify(body),
    });
    return { status: res.statusCode, body: res.json() };
  };
  return { fx, pid: entry.id, runner: audited.runner as AuditedRunner, get, post };
}

const descriptorOf = (list: any, id: string) => list.elements.find((e: any) => e.id === id)?.descriptor;

describe('state-limit through the routes (spec-003 §6 rule 5)', () => {
  it('S-24.7 — /elements, /elements/:eid and /today serve sprint-002’s submit disabled with state-limit', async () => {
    const c = await start('full');
    const list = await c.get(`/api/p/${c.pid}/elements`);
    expect(list.status, JSON.stringify(list.body)).toBe(200);
    expectSchema('elements.schema.json', list.body);
    // TT-PERF-05: the count comes from the cached `memory search`: no CLI process added (at most 6).
    expect(c.runner.count('wingfoil')).toBeLessThanOrEqual(6);
    const planned = descriptorOf(list.body, PLANNED_SPRINT);
    expect(planned.verbs).toEqual([{ verb: 'submit', to: 'active', role: null, enabled: false, reason: LIMITED }]);
    // The holder itself moves on: `active → done` declares no limit.
    expect(descriptorOf(list.body, ACTIVE_SPRINT).verbs).toEqual([
      { verb: 'submit', to: 'done', role: null, enabled: true },
    ]);

    const one = await c.get(`/api/p/${c.pid}/elements/${PLANNED_SPRINT}`);
    expect(one.status).toBe(200);
    expectSchema('element.schema.json', one.body);
    expect(one.body.descriptor).toEqual(planned);
    // D73-4: the resolved states carry the limit (additive).
    expect(one.body.states.limits).toEqual({ active: 1 });
  }, 300_000);

  it('S-24.7 — /today: the Sprint stays in its submitter’s Requires you, with the disabled submit (Q4 (a))', async () => {
    const c = await start('full', undefined, 'Alex');
    const today = await c.get(`/api/p/${c.pid}/today`);
    expect(today.status, JSON.stringify(today.body)).toBe(200);
    expectSchema('today.schema.json', today.body);
    const row = today.body.requiresYou.find((r: any) => r.element.id === PLANNED_SPRINT);
    expect(row?.descriptor.verbs).toEqual([
      { verb: 'submit', to: 'active', role: null, enabled: false, reason: LIMITED },
    ]);
  }, 300_000);

  it('P2 — an archived holder is not counted: the submit is enabled', async () => {
    const c = await start('archived');
    const list = await c.get(`/api/p/${c.pid}/elements`);
    expect(descriptorOf(list.body, PLANNED_SPRINT).verbs).toEqual([
      { verb: 'submit', to: 'active', role: null, enabled: true },
    ]);
    // Listing the archived elements too does not change the count.
    const all = await c.get(`/api/p/${c.pid}/elements?archived=true`);
    expect(descriptorOf(all.body, PLANNED_SPRINT).verbs[0].enabled).toBe(true);
    expect(descriptorOf(all.body, ACTIVE_SPRINT).status).toBe('deprecated');
  }, 300_000);

  it('P11 — on a CLI that answers 0.2.2 no limit is applied', async () => {
    const c = await start('full', async (fx) => {
      await installCliStub(fx, { version: '0.2.2' });
    });
    const list = await c.get(`/api/p/${c.pid}/elements`);
    expect(list.status).toBe(200);
    expect(descriptorOf(list.body, PLANNED_SPRINT).verbs).toEqual([
      { verb: 'submit', to: 'active', role: null, enabled: true },
    ]);
  }, 300_000);

  it('P6 — a holder on another branch only: the submit is offered and the CLI’s refusal is 422 cli-refused', async () => {
    const c = await start('branch');
    const list = await c.get(`/api/p/${c.pid}/elements`);
    expect(descriptorOf(list.body, PLANNED_SPRINT).verbs).toEqual([
      { verb: 'submit', to: 'active', role: null, enabled: true },
    ]);
    const res = await c.post('submit', PLANNED_SPRINT, { expectedStatus: 'planned' });
    expect(res.status).toBe(422);
    expectSchema('write.refusal.schema.json', res.body);
    expect(res.body.error.code).toBe('cli-refused');
    expect(res.body.error.message).toMatch(/WIP limit reached for 'active' on type 'sprint' \(limit 1\)/);
  }, 300_000);
});
