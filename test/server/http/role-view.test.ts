// `PUT /api/p/:pid/role-view` `{role}` (spec-004 §3, spec-006 §3; REQ-STATE-06, S-22.1, S-22.3):
// the route over the in-memory store and a scripted identity source. Refusals in the spec-004 §4
// order: 404 unknown project → 400 body → 403 not identified → 400 role not held.
import type { ProjectEntry } from '@wingfoil-ui/contracts';
import type { FastifyInstance } from 'fastify';
import { Writable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import { CliRefusedError } from '../../../server/src/cli/adapter.js';
import { buildApp } from '../../../server/src/http/app.js';
import { registerRoleViewRoute } from '../../../server/src/http/role-view.js';
import type { IdentitySource } from '../../../server/src/identity/project-identity.js';
import { createLogger } from '../../../server/src/logging.js';
import { createMemoryStateStore } from '../../../server/src/state/memory-store.js';
import type { StateStore } from '../../../server/src/state/store.js';
import type { Identity } from '@wingfoil-ui/contracts';

const security = { authentication: createTokenAuthentication('test-token'), port: () => 80 };
const AUTH = { authorization: 'Bearer test-token' };
const sink = new Writable({ write: (_c, _e, cb) => cb() });

const ALEX: Identity = {
  kind: 'member',
  email: 'alex@example.test',
  name: 'Alex',
  roles: ['tech-lead', 'architect', 'developer', 'reviewer', 'product-owner', 'approver', 'qa'],
};

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

/** A source that answers `identity` (or throws it) and counts its calls. */
function scripted(
  identity: Identity | Error,
): IdentitySource & { calls: string[]; signals: (AbortSignal | undefined)[] } {
  const calls: string[] = [];
  const signals: (AbortSignal | undefined)[] = [];
  return {
    calls,
    signals,
    identify: async (project: ProjectEntry, signal?: AbortSignal) => {
      calls.push(project.id);
      signals.push(signal);
      if (identity instanceof Error) throw identity;
      return identity;
    },
  };
}

async function setUp(identity: Identity | Error): Promise<{
  store: StateStore;
  kanban: ProjectEntry;
  custom: ProjectEntry;
  source: ReturnType<typeof scripted>;
}> {
  const store = await createMemoryStateStore();
  const kanban = await store.add({ path: '/p/kanban', name: 'kanban', remote: '' });
  const custom = await store.add({ path: '/p/custom', name: 'custom', remote: '' });
  const source = scripted(identity);
  app = await buildApp({
    staticDir: '/nonexistent',
    logger: createLogger(sink),
    security,
    register: (a) => registerRoleViewRoute(a, { store, identity: source }),
  });
  return { store, kanban, custom, source };
}

function put(pid: string, body: unknown, headers: Record<string, string> = AUTH) {
  return app!.inject({
    method: 'PUT',
    url: `/api/p/${pid}/role-view`,
    headers: { 'content-type': 'application/json', ...headers },
    payload: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('PUT /api/p/:pid/role-view', () => {
  it('S-22.1 remembers the role view: 204, no body, roleView stored', async () => {
    const { store, kanban } = await setUp(ALEX);
    const res = await put(kanban.id, { role: 'developer' });
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    expect(store.get(kanban.id)?.roleView).toBe('developer');
  });

  it('S-22.3 keeps the role view per project', async () => {
    const { store, kanban, custom } = await setUp(ALEX);
    expect((await put(kanban.id, { role: 'developer' })).statusCode).toBe(204);
    expect((await put(custom.id, { role: 'approver' })).statusCode).toBe(204);
    expect(store.get(kanban.id)?.roleView).toBe('developer');
    expect(store.get(custom.id)?.roleView).toBe('approver');
  });

  it('answers 404 not-found to an unknown or path-like project id, before the body and the identity', async () => {
    const { kanban, source } = await setUp(ALEX);
    for (const pid of [
      'p_zzzzzzzzzzzz',
      '..%2F..%2Fetc',
      kanban.id.toUpperCase(),
      encodeURIComponent(`${kanban.id} `),
      encodeURIComponent(` ${kanban.id}`),
    ]) {
      const res = await put(pid, 'not json');
      expect(res.statusCode, pid).toBe(404);
      expect(res.json()).toEqual({ error: { code: 'not-found', message: expect.any(String) } });
    }
    expect(source.calls).toEqual([]);
  });

  it('passes a cancellation signal to the identity read', async () => {
    const { kanban, source } = await setUp(ALEX);
    expect((await put(kanban.id, { role: 'developer' })).statusCode).toBe(204);
    expect(source.signals[0]).toBeInstanceOf(AbortSignal);
    expect(source.signals[0]!.aborted).toBe(false);
  });

  it.each([
    ['malformed JSON', 'application/json', '{"role": "developer"', 400],
    ['a __proto__ key', 'application/json', '{"__proto__": {"role": "developer"}, "role": "developer"}', 400],
    ['a content type without a parser', 'application/xml', '<role>developer</role>', 415],
    ['a text body', 'text/plain', 'developer', 400],
  ])('answers %s with a known project before the identity (characterization)', async (_name, type, payload, status) => {
    const { store, kanban, source } = await setUp(ALEX);
    const res = await app!.inject({
      method: 'PUT',
      url: `/api/p/${kanban.id}/role-view`,
      headers: { 'content-type': type, ...AUTH },
      payload,
    });
    expect(res.statusCode).toBe(status);
    expect(res.json()).toEqual({ error: { code: 'invalid-request', message: expect.any(String) } });
    expect(source.calls).toEqual([]);
    expect(store.get(kanban.id)?.roleView).toBe('');
  });

  it.each([
    ['no role', {}],
    ['an empty role', { role: '' }],
    ['a non-string role', { role: 3 }],
    ['another property', { role: 'developer', extra: true }],
    ['not an object', ['developer']],
  ])('answers 400 invalid-request to %s, before the identity', async (_name, body) => {
    const { store, kanban, source } = await setUp(ALEX);
    const res = await put(kanban.id, body);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: { code: 'invalid-request', message: expect.any(String) } });
    expect(source.calls).toEqual([]);
    expect(store.get(kanban.id)?.roleView).toBe('');
  });

  it.each<[string, Identity]>([
    ['not in team', { kind: 'not-in-team', email: 'riley@example.test' }],
    ['no identity', { kind: 'no-identity' }],
    ['ambiguous', { kind: 'ambiguous', email: 'shared@example.test', members: ['Jordan', 'Sam'] }],
  ])('answers 403 not-in-team when the user is %s', async (_name, identity) => {
    const { store, kanban } = await setUp(identity);
    const res = await put(kanban.id, { role: 'developer' });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: { code: 'not-in-team', message: expect.any(String) } });
    expect(store.get(kanban.id)?.roleView).toBe('');
  });

  it('answers 400 invalid-request to a role the member does not hold (S-22.2), nothing stored', async () => {
    const jordan: Identity = { kind: 'member', email: 'jordan@example.test', name: 'Jordan', roles: ['developer'] };
    const { store, kanban } = await setUp(jordan);
    const res = await put(kanban.id, { role: 'approver' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: { code: 'invalid-request', message: expect.any(String) } });
    expect(store.get(kanban.id)?.roleView).toBe('');
  });

  it('maps a CLI failure of the identity read with the CLI envelope (422 cli-refused)', async () => {
    const refused = new CliRefusedError({ words: ['dna', 'show'], options: [] }, 'invalid DNA');
    const { kanban } = await setUp(refused);
    const res = await put(kanban.id, { role: 'developer' });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: { code: 'cli-refused', message: 'invalid DNA' } });
  });

  it('answers 500 internal to any other failure', async () => {
    const { kanban } = await setUp(new Error('boom'));
    const res = await put(kanban.id, { role: 'developer' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: { code: 'internal', message: 'Internal error' } });
  });

  it('is guarded: 401 without a session, 403 from a foreign origin', async () => {
    const { kanban, source } = await setUp(ALEX);
    expect((await put(kanban.id, { role: 'developer' }, {})).statusCode).toBe(401);
    expect((await put(kanban.id, { role: 'developer' }, { ...AUTH, origin: 'https://evil.test' })).statusCode).toBe(
      403,
    );
    expect(source.calls).toEqual([]);
  });
});
