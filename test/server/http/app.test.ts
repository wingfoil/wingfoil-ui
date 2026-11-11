// spec-004 §1 — the application at `/`, the API under `/api/`, client-side routing fallback.
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import { buildApp } from '../../../server/src/http/app.js';
import { createLogger } from '../../../server/src/logging.js';

// light-my-request sends `Host: localhost:80`; the API needs the token (task-003 guards).
const security = { authentication: createTokenAuthentication('test-token'), port: () => 80 };
const AUTH = { authorization: 'Bearer test-token' };
let staticDir: string;
const lines: string[] = [];
const sink = new Writable({
  write(chunk, _enc, cb) {
    lines.push(String(chunk));
    cb();
  },
});

beforeAll(async () => {
  staticDir = await mkdtemp(path.join(tmpdir(), 'wfui-static-'));
  await writeFile(path.join(staticDir, 'index.html'), '<!doctype html><title>WingFoil UI</title>');
  await mkdir(path.join(staticDir, 'assets'));
  await writeFile(path.join(staticDir, 'assets', 'app.js'), 'console.log(1)');
});

afterAll(async () => {
  await rm(staticDir, { recursive: true, force: true });
});

describe('buildApp', () => {
  it('serves the application at /', async () => {
    const app = await buildApp({ staticDir, logger: createLogger(sink), security });
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toContain('<title>WingFoil UI</title>');
    await app.close();
  });

  it('serves static assets', async () => {
    const app = await buildApp({ staticDir, logger: createLogger(sink), security });
    const res = await app.inject({ method: 'GET', url: '/assets/app.js' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('console.log(1)');
    await app.close();
  });

  it.each(['/p/p_abcdefghijkl/memory', '/p/p_abcdefghijkl/releases/v0.1', '/p/x/docs/README.md'])(
    'returns the application for the client-side route %s',
    async (url) => {
      const app = await buildApp({ staticDir, logger: createLogger(sink), security });
      const res = await app.inject({ method: 'GET', url, headers: AUTH });
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('<title>WingFoil UI</title>');
      await app.close();
    },
  );

  it('answers an unknown /api/ path with the spec-004 error envelope', async () => {
    const app = await buildApp({ staticDir, logger: createLogger(sink), security });
    for (const url of ['/api/nothing', '/api/', '/API/nothing', '/%61pi/nothing']) {
      const res = await app.inject({ method: 'GET', url, headers: AUTH });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: { code: 'not-found', message: expect.any(String) } });
    }
    await app.close();
  });

  it('does not serve dotfiles nor fall back for a missing asset', async () => {
    await writeFile(path.join(staticDir, '.env'), 'SECRET=1');
    const app = await buildApp({ staticDir, logger: createLogger(sink), security });
    const dot = await app.inject({ method: 'GET', url: '/.env' });
    expect(dot.body).not.toContain('SECRET');
    const missing = await app.inject({ method: 'GET', url: '/assets/missing.js' });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: { code: 'not-found', message: expect.any(String) } });
    await app.close();
  });

  it('answers a malformed body with 400 invalid-request and a failure with 500 internal', async () => {
    const app = await buildApp({
      staticDir,
      logger: createLogger(sink),
      security,
      register: (a) => {
        a.post('/api/echo', async (req) => req.body);
        a.get('/api/gone', async () => {
          throw Object.assign(new Error('gone'), { statusCode: 404 });
        });
        a.get('/api/boom', async () => {
          throw new Error('adapter detail /home/secret');
        });
      },
    });
    const bad = await app.inject({
      method: 'POST',
      url: '/api/echo',
      headers: { ...AUTH, 'content-type': 'application/json' },
      payload: '{nope',
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toEqual({ error: { code: 'invalid-request', message: expect.any(String) } });
    const big = await app.inject({
      method: 'POST',
      url: '/api/echo',
      headers: { ...AUTH, 'content-type': 'application/json' },
      payload: JSON.stringify({ x: 'a'.repeat(1_100_000) }),
    });
    expect(big.statusCode).toBe(413);
    // task-063 D63-10 (Q3 a): a 4xx other than 400 and 404 gets a code matching its status.
    expect(big.json()).toEqual({ error: { code: 'payload-too-large', message: expect.any(String) } });
    const missing = await app.inject({ method: 'GET', url: '/api/gone', headers: AUTH });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('not-found');
    for (const url of ['/%', '/api/%']) {
      const badUrl = await app.inject({ method: 'GET', url, headers: AUTH });
      expect(badUrl.statusCode, url).toBe(400);
      expect(badUrl.json(), url).toEqual({ error: { code: 'invalid-request', message: expect.any(String) } });
    }
    const boom = await app.inject({ method: 'GET', url: '/api/boom', headers: AUTH });
    expect(boom.statusCode).toBe(500);
    expect(boom.json()).toEqual({ error: { code: 'internal', message: expect.any(String) } });
    expect(boom.body).not.toContain('secret');
    await app.close();
  });

  it('starts without a web build and says so for the application paths', async () => {
    const app = await buildApp({ staticDir: path.join(staticDir, 'missing'), logger: createLogger(sink), security });
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/x', headers: AUTH })).statusCode).toBe(404);
    await app.close();
  });

  it('redacts authorization and cookie in the request log', async () => {
    lines.length = 0;
    const app = await buildApp({ staticDir, logger: createLogger(sink), security });
    await app.inject({
      method: 'GET',
      url: '/api/nothing',
      headers: { authorization: 'Bearer SECRET-TOKEN', cookie: 'wfui_session_1=SECRET-SESSION' },
    });
    await app.close();
    const log = lines.join('');
    expect(log).toContain('"url":"/api/nothing"');
    expect(log).not.toContain('SECRET');
  });
});

// spec-011 §4 (task-057 AC-3, bug-019, C1): the router takes route parameters up to 255 UTF-16 code
// units of the decoded value (Q2-a); a longer one answers 404 `not-found` on every method, with and
// without a web build, after the Host/Origin and session checks. Routes of the five `:eid` shapes.
describe('the route parameter length (spec-011 §4)', () => {
  const ROUTES = [
    ['GET', '/api/p/p_x/elements/:eid'],
    ['GET', '/api/p/p_x/elements/:eid/history'],
    ['POST', '/api/p/p_x/elements/:eid/submit'],
    ['POST', '/api/p/p_x/elements/:eid/approve'],
    ['POST', '/api/p/p_x/elements/:eid/reject'],
  ] as const;
  const register = (app: import('fastify').FastifyInstance) => {
    for (const [method, url] of ROUTES) {
      app.route({
        method,
        url,
        handler: async (request) => ({ eid: (request.params as { eid: string }).eid }),
      });
    }
  };
  const id = (length: number) => `task-001-${'x'.repeat(length - 9)}`;
  const BUILDS = [
    ['with a web build', () => staticDir],
    ['without a web build', () => path.join(staticDir, 'missing')],
  ] as const;

  describe.each(BUILDS)('%s', (_name, dir) => {
    it.each(ROUTES)('%s %s: 255 code units reach the route, 256 answer 404 not-found', async (method, url) => {
      const app = await buildApp({ staticDir: dir(), logger: createLogger(sink), security, register });
      const call = (eid: string) =>
        app.inject({
          method,
          url: url.replace(':eid', eid),
          headers: AUTH,
          ...(method === 'POST' ? { payload: {} } : {}),
        });
      for (const length of [101, 252, 255]) {
        const ok = await call(id(length));
        expect(ok.statusCode, `${length}`).toBe(200);
        expect(ok.json()).toEqual({ eid: id(length) });
      }
      const long = await call(id(256));
      expect(long.statusCode).toBe(404);
      expect(long.json()).toEqual({ error: { code: 'not-found', message: expect.any(String) } });
      await app.close();
    });

    it('measures the decoded value in UTF-16 code units: ASCII, é and an astral character', async () => {
      const app = await buildApp({ staticDir: dir(), logger: createLogger(sink), security, register });
      const get = (raw: string) => app.inject({ method: 'GET', url: `/api/p/p_x/elements/${raw}`, headers: AUTH });
      const cases: [string, string, number][] = [
        ['255 ASCII, each percent-encoded', '%78'.repeat(255), 200],
        ['256 ASCII, each percent-encoded', '%78'.repeat(256), 404],
        ['255 é (1 530 bytes in the URL)', encodeURIComponent('é'.repeat(255)), 200],
        ['256 é', encodeURIComponent('é'.repeat(256)), 404],
        ['127 astral characters and one ASCII (255 units)', encodeURIComponent(`${'😀'.repeat(127)}x`), 200],
        ['128 astral characters (256 units)', encodeURIComponent('😀'.repeat(128)), 404],
      ];
      for (const [name, raw, status] of cases) expect((await get(raw)).statusCode, name).toBe(status);
      await app.close();
    });

    it('still refuses a foreign origin (403) and a missing session (401) first, on GET and POST', async () => {
      const app = await buildApp({ staticDir: dir(), logger: createLogger(sink), security, register });
      for (const [method, url] of [ROUTES[0], ROUTES[3]]) {
        const target = url.replace(':eid', id(256));
        const payload = method === 'POST' ? { payload: {} } : {};
        const noSession = await app.inject({ method, url: target, ...payload });
        expect(noSession.statusCode, `${method} no session`).toBe(401);
        expect(noSession.json().error.code).toBe('unauthenticated');
        const foreign = await app.inject({
          method,
          url: target,
          headers: { ...AUTH, origin: 'http://evil.test' },
          ...payload,
        });
        expect(foreign.statusCode, `${method} origin`).toBe(403);
        expect(foreign.json().error.code).toBe('forbidden-origin');
        const host = await app.inject({ method, url: target, headers: { ...AUTH, host: 'evil.test' }, ...payload });
        expect(host.statusCode, `${method} host`).toBe(403);
      }
      await app.close();
    });

    it('keeps every other framework error a 400 invalid-request', async () => {
      const app = await buildApp({ staticDir: dir(), logger: createLogger(sink), security, register });
      for (const url of ['/api/%', `/api/p/p_x/elements/%zz${'x'.repeat(300)}`]) {
        const res = await app.inject({ method: 'GET', url, headers: AUTH });
        expect(res.statusCode, url.slice(0, 30)).toBe(400);
        expect(res.json()).toEqual({ error: { code: 'invalid-request', message: expect.any(String) } });
      }
      await app.close();
    });
  });
});

// bug-031 (task-063 AC-7, D63-9, D63-10; the approver's Q3 a, Q4 a): a static path the file system
// refuses as too long is missing — 404 `not-found` under `/assets/`, the application for any other
// path — and every 4xx the error handler does not name gets a code that matches its status.
describe('bug-031 — names too long and the codes of the other client errors', () => {
  const NAME_MAX_PLUS_ONE = 'x'.repeat(256);
  const OVER_PATH_MAX = `${'x'.repeat(200)}/`.repeat(25) + 'app.js';

  it('bug-031 — an asset name the file system refuses answers 404 not-found', async () => {
    const app = await buildApp({ staticDir, logger: createLogger(sink), security });
    for (const url of [`/assets/${NAME_MAX_PLUS_ONE}`, `/assets/${OVER_PATH_MAX}`]) {
      for (const method of ['GET', 'HEAD'] as const) {
        const res = await app.inject({ method, url });
        expect(res.statusCode, `${method} ${url.length}`).toBe(404);
        if (method === 'GET') expect(res.json()).toEqual({ error: { code: 'not-found', message: expect.any(String) } });
      }
    }
    await app.close();
  });

  it('a client-side path with a name too long serves the application', async () => {
    const app = await buildApp({ staticDir, logger: createLogger(sink), security });
    for (const url of [`/${NAME_MAX_PLUS_ONE}`, `/${OVER_PATH_MAX}`]) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode, `${url.length}`).toBe(200);
      expect(res.body).toContain('<title>WingFoil UI</title>');
    }
    await app.close();
  });

  it('a non-canonical static path stays a 403, with the code forbidden', async () => {
    const app = await buildApp({ staticDir, logger: createLogger(sink), security });
    for (const url of ['/assets//app.js', `/assets//${NAME_MAX_PLUS_ONE}`]) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode, url.slice(0, 30)).toBe(403);
      expect(res.json(), url.slice(0, 30)).toEqual({ error: { code: 'forbidden', message: expect.any(String) } });
    }
    await app.close();
  });

  it('every 4xx gets a code matching its status', async () => {
    const app = await buildApp({
      staticDir,
      logger: createLogger(sink),
      security,
      register: (a) => {
        a.post('/api/echo', async (req) => req.body);
        for (const status of [403, 412, 418, 429]) {
          a.get(`/api/status/${status}`, async () => {
            throw Object.assign(new Error(`status ${status} /home/secret`), { statusCode: status });
          });
        }
      },
    });
    const media = await app.inject({
      method: 'POST',
      url: '/api/echo',
      headers: { ...AUTH, 'content-type': 'text/xml' },
      payload: '<x/>',
    });
    expect(media.statusCode).toBe(415);
    expect(media.json()).toEqual({ error: { code: 'unsupported-media-type', message: expect.any(String) } });
    const range = await app.inject({ method: 'GET', url: '/assets/app.js', headers: { range: 'bytes=900-999' } });
    expect(range.statusCode).toBe(416);
    expect(range.json()).toEqual({ error: { code: 'range-not-satisfiable', message: expect.any(String) } });
    const expected: Record<number, string> = {
      403: 'forbidden',
      412: 'precondition-failed',
      418: 'client-error',
      429: 'client-error',
    };
    for (const [status, code] of Object.entries(expected)) {
      const res = await app.inject({ method: 'GET', url: `/api/status/${status}`, headers: AUTH });
      expect(res.statusCode).toBe(Number(status));
      expect(res.json()).toEqual({ error: { code, message: expect.any(String) } });
      expect(res.body).not.toContain('secret');
    }
    await app.close();
  });
});
