// spec-003 §5, spec-004 §3 — `GET /api/p/:pid/today?view=` and `GET /api/p/:pid/events/memory`
// (task-031) on copies of the kanban, custom and unknown fixtures (pinned CLI, real git): every body
// checked against `contracts/api/today.schema.json` / `memory-events.schema.json`; for every member
// and every role view, Requires you and Waiting on others are the rows `placement()` gives for the
// descriptors of `GET /elements` (same state), in the §5 order (D31-4); the scenario rows by hand
// (T-01.1, T-11.1, T-11.3, S-23.1); `?view=` refusals and the unidentified user (RP-27, D31-5);
// no partial Today (D31-3); the events newest first in git's order, `limit` and `before`
// (D31-1, D31-2); an unknown project 404 before any 400.
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies, each validated against its schema */
import { Ajv } from 'ajv';
import type { FastifyInstance } from 'fastify';
import { appendFile, readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ActionDescriptor } from '@wingfoil-ui/contracts';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import { compareRequiresYou, placement } from '../../../server/src/descriptor/placement.js';
import { buildApp } from '../../../server/src/http/app.js';
import { registerProjectRoutes } from '../../../server/src/http/project-routes.js';
import { createLogger } from '../../../server/src/logging.js';
import { nodeReadFs, type ReadFs } from '../../../server/src/reads/confine.js';
import { REPO_STATE_HEADER } from '../../../server/src/snapshot/state.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { createMemoryStateStore } from '../../../server/src/state/memory-store.js';
import { REPO_ROOT } from '../../harness/cli.js';
import {
  buildFixture,
  copyFixture,
  memberByName,
  OUTSIDER,
  STANDARD_TEAM,
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

let ws: TempWorkspace;
const templates: Partial<Record<'kanban' | 'custom' | 'unknown', Fixture>> = {};
let n = 0;
const registries: Snapshots[] = [];
const apps: FastifyInstance[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-today-');
  const root = await realpath(ws.dir);
  for (const kind of ['kanban', 'custom', 'unknown'] as const) {
    templates[kind] = await buildFixture(kind, { root: path.join(root, kind) });
  }
}, 600_000);

afterEach(async () => {
  for (const a of apps.splice(0)) await a.close();
});

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await ws.dispose();
});

interface Console {
  fx: Fixture;
  pid: string;
  runner: AuditedRunner;
  get(url: string): Promise<{ status: number; state: string | undefined; body: any }>;
  /** Become the user `email` (`git config user.email` in the copy), then check the state. */
  become(email: string): Promise<void>;
}

async function start(
  kind: 'kanban' | 'custom' | 'unknown',
  options: { fs?: ReadFs; prepare?: (fx: Fixture) => Promise<void>; failLog?: boolean } = {},
): Promise<Console> {
  n += 1;
  const fx = await copyFixture(templates[kind]!, path.join(await realpath(ws.dir), `copy-${n}`));
  await options.prepare?.(fx);
  const audited = auditedSnapshots(fx.env, options.fs ? { fs: options.fs } : {});
  if (options.failLog) {
    const run = audited.runner.run.bind(audited.runner);
    audited.runner.run = async (request) =>
      request.args.includes('log')
        ? { exitCode: null, signal: 'SIGKILL', stdout: '', stderr: '', ended: 'overflow', durationMs: 1 }
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
    const header = res.headers[REPO_STATE_HEADER.toLowerCase()];
    return { status: res.statusCode, state: typeof header === 'string' ? header : undefined, body: res.json() };
  };
  const become = async (email: string) => {
    await git(fx.dir, ['config', 'user.email', email], fx.env);
    const snapshot = await audited.snapshots.open(entry.id, fx.dir);
    await snapshot.check();
    // Fresh read (D26-3): the state the next request reads is the new user's.
    expect(snapshot.current()?.email).toBe(email);
  };
  return { fx, pid: entry.id, runner: audited.runner, get, become };
}

const ids = (rows: any[] | null) => rows?.map((r) => r.element.id);

describe('GET /api/p/:pid/today — every member and role view (spec-003 §5)', () => {
  it.each(['kanban', 'custom', 'unknown'] as const)(
    '%s: the rows placement() gives for the descriptors of GET /elements, in the §5 order',
    async (kind) => {
      const c = await start(kind);
      for (const m of STANDARD_TEAM) {
        await c.become(m.email);
        const list = await c.get(`/api/p/${c.pid}/elements`);
        expect(list.status).toBe(200);
        const descriptors: ActionDescriptor[] = list.body.elements.map((e: any) => e.descriptor);
        const user = { email: m.email, roles: m.roles };
        for (const view of m.roles) {
          const res = await c.get(`/api/p/${c.pid}/today?view=${view}`);
          expect(res.status, JSON.stringify(res.body)).toBe(200);
          expect(res.state).toBe(list.state);
          expectSchema('today.schema.json', res.body);
          const placed = (which: string) =>
            descriptors
              .filter((d) => placement(d, user, view).list === which)
              .sort(compareRequiresYou)
              .map((d) => d.id);
          expect(res.body.view).toBe(view);
          expect(ids(res.body.requiresYou)).toEqual(placed('requires-you'));
          expect(ids(res.body.waitingOnOthers)).toEqual(placed('waiting-on-others'));
          // Each row carries the descriptor the element list serves, and its element.
          for (const row of [...res.body.requiresYou, ...res.body.waitingOnOthers]) {
            const listed = list.body.elements.find((e: any) => e.id === row.element.id);
            expect(row.descriptor).toEqual(listed.descriptor);
            expect(row.element).toEqual({
              id: listed.id,
              type: listed.type,
              title: listed.title,
              status: listed.status,
              localChanges: listed.localChanges,
            });
          }
          expect(res.body.summary === undefined).toBe(m.roles.length < 2);
        }
      }
    },
    300_000,
  );
});

describe('GET /api/p/:pid/today — the scenarios', () => {
  it('T-01.1, T-11.1, T-11.3: Morgan with the default role view (approver) on kanban', async () => {
    const c = await start('kanban');
    await c.become(memberByName('Morgan').email);
    const res = await c.get(`/api/p/${c.pid}/today`);
    expect(res.status).toBe(200);
    expectSchema('today.schema.json', res.body);
    expect(res.body.view).toBe('approver');
    expect(res.body.requiresYou.map((r: any) => [r.element.id, r.action]).sort()).toEqual([
      ['bug-001-crash-on-save', 'approve'],
      ['task-001-login-form', 'approve'],
    ]);
    expect(
      res.body.waitingOnOthers.map((r: any) => [
        r.element.id,
        r.descriptor.actor.member?.name,
        r.descriptor.actor.basis,
      ]),
    ).toEqual([
      ['task-002-password-reset', 'Jordan', 'submitter'],
      ['task-004-session-timeout', 'Jordan', 'creator'],
    ]);
    // S-21.1: the bell's count is the length of Requires you.
    expect(res.body.requiresYou).toHaveLength(2);
  });

  it('S-23.1: Alex — one summary line per role, approver · 2, developer · 0', async () => {
    const c = await start('kanban');
    await c.become(memberByName('Alex').email);
    const res = await c.get(`/api/p/${c.pid}/today?view=developer`);
    expectSchema('today.schema.json', res.body);
    expect(res.body.summary.map((l: any) => [l.role, l.count])).toEqual(
      memberByName('Alex').roles.map((r) => [r, r === 'approver' || r === 'reviewer' ? 2 : 0]),
    );
    expect(res.body.summary.every((l: any) => l.items.length <= 3 && l.more === Math.max(0, l.count - 3))).toBe(true);
  });

  it('RP-27: an unidentified user — view and Requires you null, Waiting on others computed, no summary', async () => {
    const c = await start('kanban');
    await c.become(OUTSIDER.email);
    const res = await c.get(`/api/p/${c.pid}/today`);
    expect(res.status).toBe(200);
    expectSchema('today.schema.json', res.body);
    expect(res.body).toMatchObject({ view: null, requiresYou: null });
    expect(res.body).not.toHaveProperty('summary');
    expect(new Set(ids(res.body.waitingOnOthers))).toEqual(
      new Set(['task-001-login-form', 'bug-001-crash-on-save', 'task-002-password-reset', 'task-004-session-timeout']),
    );
    // D31-5: no role view to choose.
    expect((await c.get(`/api/p/${c.pid}/today?view=developer`)).body.error.code).toBe('invalid-request');
  });

  it('refuses a role view the member does not hold, a repeated or an empty view (400)', async () => {
    const c = await start('kanban');
    await c.become(memberByName('Jordan').email);
    for (const query of ['view=approver', 'view=developer&view=developer', 'view=', 'view=nope']) {
      const res = await c.get(`/api/p/${c.pid}/today?${query}`);
      expect(res.status, query).toBe(400);
      expect(res.body).toEqual({ error: { code: 'invalid-request', message: expect.any(String) } });
    }
  });

  it('answers 404 to an unknown project before any 400', async () => {
    const c = await start('kanban');
    for (const url of ['/today?view=nope', '/today', '/events/memory?limit=0', '/events/memory?before=x']) {
      const res = await c.get(`/api/p/p_abcdefghijkl${url}`);
      expect(res.status, url).toBe(404);
      expect(res.body.error.code).toBe('not-found');
    }
    expect(c.runner.spawned).toHaveLength(0);
  });
});

describe('no partial Today (D31-3)', () => {
  it('an unreadable memory.yaml: 502 read-error, for Today and the events', async () => {
    const fs: ReadFs = {
      ...nodeReadFs,
      readFile: (f) =>
        f.endsWith(`${path.sep}memory.yaml`) ? Promise.reject(new Error('EACCES')) : nodeReadFs.readFile(f),
    };
    const c = await start('kanban', { fs });
    for (const url of ['/today', '/events/memory']) {
      const res = await c.get(`/api/p/${c.pid}${url}`);
      expect(res.status, url).toBe(502);
      expect(res.body.error).toMatchObject({
        code: 'read-error',
        detail: { file: '.wingfoil/memory.yaml', kind: 'missing' },
      });
    }
  });

  it('a failed Memory event read: 500 internal, for Today and the events', async () => {
    const c = await start('kanban', { failLog: true });
    for (const url of ['/today', '/events/memory']) {
      const res = await c.get(`/api/p/${c.pid}${url}`);
      expect(res.status, url).toBe(500);
      expect(res.body).toEqual({ error: { code: 'internal', message: 'Internal error' } });
    }
  });

  it('a failed dna show: the CLI refusal', async () => {
    const c = await start('kanban', {
      prepare: (fx) => appendFile(path.join(fx.dir, '.wingfoil', 'dna.yaml'), 'project: [unclosed\n  : :\n'),
    });
    const res = await c.get(`/api/p/${c.pid}/today`);
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: 'cli-refused', message: expect.stringMatching(/E_YAML_PARSE_ERROR/) });
  });
});

describe('GET /api/p/:pid/events/memory (spec-004 §3, D31-1, D31-2)', () => {
  it('the last 10 events newest first in git order, then the next page after before', async () => {
    const c = await start('custom');
    const all = await c.get(`/api/p/${c.pid}/events/memory?limit=100`);
    expect(all.status).toBe(200);
    expectSchema('memory-events.schema.json', all.body);
    expect(all.body.more).toBe(false);
    const events = all.body.events;
    expect(events.length).toBeGreaterThan(10);
    // Newest first: in the order of `git log` (spec-002 §3 sha list).
    const log = (await git(c.fx.dir, ['log', '--format=%H'], c.fx.env)).stdout.trim().split('\n');
    const at = events.map((e: any) => log.indexOf(e.sha));
    expect(at.every((i: number) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);

    const first = await c.get(`/api/p/${c.pid}/events/memory`);
    expectSchema('memory-events.schema.json', first.body);
    expect(first.state).toMatch(/^[0-9a-f]{40}\./);
    expect(first.body).toEqual({ events: events.slice(0, 10), more: true });
    const next = await c.get(`/api/p/${c.pid}/events/memory?before=${events[9].sha}&limit=10`);
    expect(next.body).toEqual({ events: events.slice(10, 20), more: events.length > 20 });
    expect((await c.get(`/api/p/${c.pid}/events/memory?limit=1`)).body.events).toEqual([events[0]]);
  });

  it('refuses a limit out of 1…100 or not an integer, and a before that is no event (400)', async () => {
    const c = await start('kanban');
    for (const query of [
      'limit=0',
      'limit=101',
      'limit=abc',
      'limit=1.5',
      'limit=-1',
      'limit=',
      'limit=1&limit=2',
      `before=${'f'.repeat(40)}`,
      'before=',
    ]) {
      const res = await c.get(`/api/p/${c.pid}/events/memory?${query}`);
      expect(res.status, query).toBe(400);
      expect(res.body).toEqual({ error: { code: 'invalid-request', message: expect.any(String) } });
    }
    expect((await c.get(`/api/p/${c.pid}/events/memory?limit=100`)).status).toBe(200);
  });
});
