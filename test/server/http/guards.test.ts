// spec-004 §1–2, §4 rows 1–2 (REQ-SEC-02, REQ-SEC-03; X-02.1 API side, X-04.1, X-04.2, X-04.3):
// Host/Origin checks (403) before the session (401), `POST /api/session` and its cookie.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import { buildApp } from '../../../server/src/http/app.js';
import { hasOwnOrigin, isAllowedHost, isAllowedOrigin, sessionCookieName } from '../../../server/src/http/guards.js';
import { createLogger } from '../../../server/src/logging.js';

const PORT = 54321;
const TOKEN = 'T0ken_'.padEnd(43, 'x');
const HOST = `127.0.0.1:${PORT}`;
const OWN_ORIGIN = `http://127.0.0.1:${PORT}`;
const COOKIE = `wfui_session_${PORT}`;

let staticDir: string;
const lines: string[] = [];
const sink = new Writable({
  write(chunk, _enc, cb) {
    lines.push(String(chunk));
    cb();
  },
});
const apps: FastifyInstance[] = [];
/** The project-API handler stand-in: called only when the guards let a request through. */
const handler = vi.fn(async () => ({ ok: true }));

beforeAll(async () => {
  staticDir = await mkdtemp(path.join(tmpdir(), 'wfui-guards-'));
  await writeFile(path.join(staticDir, 'index.html'), '<!doctype html><title>WingFoil UI</title>');
});

afterEach(async () => {
  handler.mockClear();
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

afterAll(async () => {
  await rm(staticDir, { recursive: true, force: true });
});

async function app(port = PORT, token = TOKEN): Promise<FastifyInstance> {
  const a = await buildApp({
    staticDir,
    logger: createLogger(sink),
    security: { authentication: createTokenAuthentication(token), port: () => port },
    register: (r) => {
      r.get('/api/p/:pid', handler);
      r.post('/api/p/:pid', handler);
      r.put('/api/p/:pid', handler);
      r.delete('/api/p/:pid', handler);
      r.get('/api/events', handler);
    },
  });
  apps.push(a);
  return a;
}

/** Exchange the token for the session cookie; returns the `Set-Cookie` header. */
async function openSession(a: FastifyInstance): Promise<string> {
  const res = await a.inject({
    method: 'POST',
    url: '/api/session',
    headers: { host: HOST, origin: OWN_ORIGIN, authorization: `Bearer ${TOKEN}` },
  });
  expect(res.statusCode).toBe(204);
  return String(res.headers['set-cookie']);
}

const UNAUTHENTICATED = { error: { code: 'unauthenticated', message: expect.any(String) } };
const FORBIDDEN = { error: { code: 'forbidden-origin', message: expect.any(String) } };

describe('X-02.1 (API side) — POST /api/session', () => {
  it('exchanges the Bearer token for the session cookie with its name and flags', async () => {
    const a = await app();
    const setCookie = await openSession(a);
    const [pair, ...attributes] = setCookie.split(';').map((s) => s.trim());
    const [name, value] = pair!.split('=');
    expect(name).toBe(COOKIE);
    expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(value).not.toBe(TOKEN);
    expect(attributes.sort()).toEqual(['HttpOnly', 'Path=/', 'SameSite=Strict']);
  });

  it('lets the cookie (or the Bearer token) open the API', async () => {
    const a = await app();
    const pair = (await openSession(a)).split(';')[0]!;
    const byCookie = await a.inject({ method: 'GET', url: '/api/p/p1', headers: { host: HOST, cookie: pair } });
    expect(byCookie.statusCode).toBe(200);
    const byBoth = await a.inject({
      method: 'GET',
      url: '/api/p/p1',
      headers: { host: HOST, cookie: `other=1; ${pair}; last=2` },
    });
    expect(byBoth.statusCode).toBe(200);
    const byToken = await a.inject({
      method: 'POST',
      url: '/api/p/p1',
      headers: { host: HOST, authorization: `Bearer ${TOKEN}` },
    });
    expect(byToken.statusCode).toBe(200);
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['no authorization', {}],
    ['a wrong token', { authorization: 'Bearer wrong' }],
    ['another scheme', { authorization: `Basic ${TOKEN}` }],
  ])('refuses %s with 401 and no cookie', async (_label, headers: Record<string, string>) => {
    const a = await app();
    const res = await a.inject({ method: 'POST', url: '/api/session', headers: { host: HOST, ...headers } });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual(UNAUTHENTICATED);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('does not mint a session from a session cookie alone', async () => {
    const a = await app();
    const pair = (await openSession(a)).split(';')[0]!;
    const res = await a.inject({ method: 'POST', url: '/api/session', headers: { host: HOST, cookie: pair } });
    expect(res.statusCode).toBe(401);
  });
});

describe('X-04.1 / REQ-SEC-02 — 401 without a valid session, before any handler', () => {
  it.each(['GET', 'POST', 'PUT', 'DELETE'] as const)('%s on the project API without the token', async (method) => {
    const a = await app();
    const res = await a.inject({ method, url: '/api/p/p1', headers: { host: HOST } });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual(UNAUTHENTICATED);
    expect(handler).not.toHaveBeenCalled();
  });

  it.each([
    ['a wrong token', { authorization: 'Bearer nope' }],
    ['an empty Bearer', { authorization: 'Bearer ' }],
    ['an unknown session id', { cookie: `${COOKIE}=${'s'.repeat(43)}` }],
    ['the token as the cookie value', { cookie: `${COOKIE}=${TOKEN}` }],
    ["another port's cookie name", { cookie: `wfui_session_1234=${'s'.repeat(43)}` }],
  ])('with %s', async (_label, headers: Record<string, string>) => {
    const a = await app();
    const res = await a.inject({ method: 'GET', url: '/api/p/p1', headers: { host: HOST, ...headers } });
    expect(res.statusCode).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("refuses a previous start's token and session (X-02.2)", async () => {
    const first = await app();
    const pair = (await openSession(first)).split(';')[0]!;
    const second = await app(PORT, 'N'.repeat(43));
    for (const headers of [{ cookie: pair }, { authorization: `Bearer ${TOKEN}` }]) {
      const res = await second.inject({ method: 'GET', url: '/api/p/p1', headers: { host: HOST, ...headers } });
      expect(res.statusCode).toBe(401);
    }
  });

  it('guards the event stream and unknown /api/ paths too', async () => {
    const a = await app();
    for (const url of ['/api/events', '/api/nothing', '/api', '/api/', '/api?x=1', '/%61pi/p/p1', '/API/p/p1']) {
      const res = await a.inject({ method: 'GET', url, headers: { host: HOST } });
      expect(res.statusCode, url).toBe(401);
    }
    expect(handler).not.toHaveBeenCalled();
    const known = await a.inject({
      method: 'GET',
      url: '/api/nothing',
      headers: { host: HOST, authorization: `Bearer ${TOKEN}` },
    });
    expect(known.statusCode).toBe(404);
  });

  it('serves the static application and client-side routes without a session', async () => {
    const a = await app();
    for (const url of ['/', '/index.html', '/p/p1/memory', '/apix']) {
      const res = await a.inject({ method: 'GET', url, headers: { host: HOST } });
      expect(res.statusCode, url).toBe(200);
      expect(res.body).toContain('<title>WingFoil UI</title>');
    }
  });
});

describe('REQ-SEC-03 — Host and Origin, 403 before any other work', () => {
  it.each(['GET', 'POST', 'PUT', 'DELETE'] as const)(
    'X-04.1 — %s with the token and the Origin https://evil.test',
    async (method) => {
      const a = await app();
      const res = await a.inject({
        method,
        url: '/api/p/p1',
        headers: { host: HOST, origin: 'https://evil.test', authorization: `Bearer ${TOKEN}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual(FORBIDDEN);
      expect(handler).not.toHaveBeenCalled();
    },
  );

  it('X-04.2 — refuses a DNS-rebinding Host with the token', async () => {
    const a = await app();
    const res = await a.inject({
      method: 'GET',
      url: '/api/p/p1',
      headers: { host: `evil.test:${PORT}`, authorization: `Bearer ${TOKEN}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual(FORBIDDEN);
    expect(handler).not.toHaveBeenCalled();
  });

  it('checks Host and Origin before the session and on static files', async () => {
    const a = await app();
    const noToken = await a.inject({ method: 'GET', url: '/api/p/p1', headers: { host: `evil.test:${PORT}` } });
    expect(noToken.statusCode).toBe(403);
    for (const url of ['/', '/p/p1/memory']) {
      const res = await a.inject({ method: 'GET', url, headers: { host: HOST, origin: 'https://evil.test' } });
      expect(res.statusCode, url).toBe(403);
      expect(res.body).not.toContain('WingFoil UI');
    }
    const session = await a.inject({
      method: 'POST',
      url: '/api/session',
      headers: { host: HOST, origin: 'https://evil.test', authorization: `Bearer ${TOKEN}` },
    });
    expect(session.statusCode).toBe(403);
    expect(session.headers['set-cookie']).toBeUndefined();
  });

  it('refuses a malformed URL with a foreign Host with 403, not 400', async () => {
    const a = await app();
    const res = await a.inject({ method: 'GET', url: '/api/%', headers: { host: `evil.test:${PORT}` } });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual(FORBIDDEN);
  });

  it('keeps the spec-004 §4 order on a malformed /api URL: 401 without a session, 400 with one', async () => {
    const a = await app();
    for (const url of ['/api/%zz', '/api/%', '/%61pi/%zz', '/API/%zz']) {
      const res = await a.inject({ method: 'GET', url, headers: { host: HOST } });
      expect(res.statusCode, url).toBe(401);
      expect(res.json(), url).toEqual(UNAUTHENTICATED);
      const authed = await a.inject({ method: 'GET', url, headers: { host: HOST, authorization: `Bearer ${TOKEN}` } });
      expect(authed.statusCode, url).toBe(400);
    }
    const pair = (await openSession(a)).split(';')[0]!;
    const byCookie = await a.inject({ method: 'GET', url: '/api/%zz', headers: { host: HOST, cookie: pair } });
    expect(byCookie.statusCode).toBe(400);
    // Outside /api, a malformed URL is a plain 400: no session is involved.
    expect((await a.inject({ method: 'GET', url: '/%zz', headers: { host: HOST } })).statusCode).toBe(400);
  });

  it('X-04.3 — accepts the token from the console origin, for each of the three host forms', async () => {
    const a = await app();
    for (const host of ['127.0.0.1', 'localhost', '[::1]']) {
      const res = await a.inject({
        method: 'GET',
        url: '/api/p/p1',
        headers: { host: `${host}:${PORT}`, origin: `http://${host}:${PORT}`, authorization: `Bearer ${TOKEN}` },
      });
      expect(res.statusCode, host).toBe(200);
    }
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('refuses every request while the port is unknown', async () => {
    const a = await buildApp({
      staticDir,
      logger: createLogger(sink),
      security: { authentication: createTokenAuthentication(TOKEN), port: () => undefined },
    });
    apps.push(a);
    expect((await a.inject({ method: 'GET', url: '/', headers: { host: HOST } })).statusCode).toBe(403);
    const session = await a.inject({
      method: 'POST',
      url: '/api/session',
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(session.statusCode).toBe(403);
  });
});

describe('spec-004 §1 (amended 2026-10-05) — Sec-Fetch-Site on the API', () => {
  it.each([
    ['same-site', 403],
    ['cross-site', 403],
    ['SAME-SITE', 403],
    ['same-origin', 200],
    ['none', 200],
    [undefined, 200],
  ] as const)('Sec-Fetch-Site %s with the token → %i', async (site, status) => {
    const a = await app();
    const headers: Record<string, string> = { host: HOST, authorization: `Bearer ${TOKEN}` };
    if (site !== undefined) headers['sec-fetch-site'] = site;
    for (const url of ['/api/p/p1', '/api/events']) {
      const res = await a.inject({ method: 'GET', url, headers });
      expect(res.statusCode, url).toBe(status);
      if (status === 403) expect(res.json()).toEqual(FORBIDDEN);
    }
  });

  it('is checked before the session, on POST /api/session and on malformed /api URLs', async () => {
    const a = await app();
    const noToken = await a.inject({
      method: 'GET',
      url: '/api/p/p1',
      headers: { host: HOST, 'sec-fetch-site': 'same-site' },
    });
    expect(noToken.statusCode).toBe(403);
    const session = await a.inject({
      method: 'POST',
      url: '/api/session',
      headers: { host: HOST, 'sec-fetch-site': 'same-site', authorization: `Bearer ${TOKEN}` },
    });
    expect(session.statusCode).toBe(403);
    expect(session.headers['set-cookie']).toBeUndefined();
    const malformed = await a.inject({
      method: 'GET',
      url: '/api/%zz',
      headers: { host: HOST, 'sec-fetch-site': 'cross-site', authorization: `Bearer ${TOKEN}` },
    });
    expect(malformed.statusCode).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('leaves the static application and client-side routes alone', async () => {
    const a = await app();
    for (const url of ['/', '/p/p1/memory']) {
      const res = await a.inject({ method: 'GET', url, headers: { host: HOST, 'sec-fetch-site': 'cross-site' } });
      expect(res.statusCode, url).toBe(200);
    }
    const malformed = await a.inject({
      method: 'GET',
      url: '/%zz',
      headers: { host: HOST, 'sec-fetch-site': 'cross-site' },
    });
    expect(malformed.statusCode).toBe(400);
  });

  it('refuses more than one Sec-Fetch-Site header', () => {
    expect(isAllowedFetchSite([])).toBe(true);
    expect(isAllowedFetchSite(['Sec-Fetch-Site', 'same-origin'])).toBe(true);
    expect(isAllowedFetchSite(['Sec-Fetch-Site', 'none'])).toBe(true);
    expect(isAllowedFetchSite(['Sec-Fetch-Site', 'same-site'])).toBe(false);
    expect(isAllowedFetchSite(['Sec-Fetch-Site', 'same-origin', 'sec-fetch-site', 'same-origin'])).toBe(false);
    expect(isAllowedFetchSite(['X-Sec-Fetch-Site', 'cross-site', 'Host', HOST])).toBe(true);
  });
});

describe('isAllowedHost / isAllowedOrigin', () => {
  it.each([
    ['127.0.0.1:54321', true],
    ['localhost:54321', true],
    ['LOCALHOST:54321', true],
    ['[::1]:54321', true],
    [undefined, false],
    ['', false],
    ['127.0.0.1', false],
    ['127.0.0.1:1234', false],
    ['localhost:54321.evil.test', false],
    ['evil.test:54321', false],
    ['::1:54321', false],
    ['127.0.0.1:54321@evil.test', false],
  ])('Host %s → %s', (host, expected) => {
    expect(isAllowedHost(host, PORT)).toBe(expected);
  });

  it.each([
    ['http://127.0.0.1:54321', true],
    ['http://localhost:54321', true],
    ['http://[::1]:54321', true],
    ['https://127.0.0.1:54321', false],
    ['http://127.0.0.1:1234', false],
    ['http://127.0.0.1', false],
    ['null', false],
    ['', false],
    ['https://evil.test', false],
    ['http://127.0.0.1:54321/', false],
  ])('Origin %s → %s', (origin, expected) => {
    expect(isAllowedOrigin(origin, PORT)).toBe(expected);
  });

  it('refuses a request carrying more than one Host header, even when the first is ours', () => {
    const headers = { host: HOST };
    expect(hasOwnOrigin(headers, ['Host', HOST], PORT)).toBe(true);
    expect(hasOwnOrigin(headers, ['Host', HOST, 'host', `evil.test:${PORT}`], PORT)).toBe(false);
    expect(hasOwnOrigin(headers, ['Host', HOST, 'HOST', HOST], PORT)).toBe(false);
    expect(hasOwnOrigin(headers, ['X-Host', 'a', 'Host', HOST], PORT)).toBe(true);
  });

  it('names the cookie after the port', () => {
    expect(sessionCookieName(PORT)).toBe(COOKIE);
  });
});

describe('REQ-SEC-02 — the token and the session id appear in 0 log lines', () => {
  it('after a session exchange, authenticated, refused and failing requests', async () => {
    lines.length = 0;
    const a = await app();
    const setCookie = await openSession(a);
    const pair = setCookie.split(';')[0]!;
    const sessionId = pair.split('=')[1]!;
    await a.inject({ method: 'GET', url: '/api/p/p1', headers: { host: HOST, cookie: pair } });
    await a.inject({ method: 'GET', url: '/api/p/p1', headers: { host: HOST, authorization: `Bearer ${TOKEN}` } });
    await a.inject({
      method: 'GET',
      url: '/api/p/p1',
      headers: { host: 'evil.test', authorization: `Bearer ${TOKEN}` },
    });
    await a.inject({ method: 'GET', url: '/api/%', headers: { host: HOST, cookie: pair } });
    await a.close();
    const log = lines.join('');
    expect(log).toContain('/api/session');
    expect(log).not.toContain(TOKEN);
    expect(log).not.toContain(sessionId);
  });
});
