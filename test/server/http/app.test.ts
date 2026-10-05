// spec-004 §1 — the application at `/`, the API under `/api/`, client-side routing fallback.
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../server/src/http/app.js';
import { createLogger } from '../../../server/src/logging.js';

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
    const app = await buildApp({ staticDir, logger: createLogger(sink) });
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toContain('<title>WingFoil UI</title>');
    await app.close();
  });

  it('serves static assets', async () => {
    const app = await buildApp({ staticDir, logger: createLogger(sink) });
    const res = await app.inject({ method: 'GET', url: '/assets/app.js' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('console.log(1)');
    await app.close();
  });

  it.each(['/p/p_abcdefghijkl/memory', '/p/p_abcdefghijkl/releases/v0.1', '/p/x/docs/README.md'])(
    'returns the application for the client-side route %s',
    async (url) => {
      const app = await buildApp({ staticDir, logger: createLogger(sink) });
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('<title>WingFoil UI</title>');
      await app.close();
    },
  );

  it('answers an unknown /api/ path with the spec-004 error envelope', async () => {
    const app = await buildApp({ staticDir, logger: createLogger(sink) });
    for (const url of ['/api/nothing', '/api/']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: { code: 'not-found', message: expect.any(String) } });
    }
    await app.close();
  });

  it('does not serve dotfiles nor fall back for a missing asset', async () => {
    await writeFile(path.join(staticDir, '.env'), 'SECRET=1');
    const app = await buildApp({ staticDir, logger: createLogger(sink) });
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
      headers: { 'content-type': 'application/json' },
      payload: '{nope',
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toEqual({ error: { code: 'invalid-request', message: expect.any(String) } });
    const big = await app.inject({
      method: 'POST',
      url: '/api/echo',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ x: 'a'.repeat(1_100_000) }),
    });
    expect(big.statusCode).toBe(413);
    expect(big.json()).toEqual({ error: { code: 'invalid-request', message: expect.any(String) } });
    const missing = await app.inject({ method: 'GET', url: '/api/gone' });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('not-found');
    for (const url of ['/%', '/api/%']) {
      const badUrl = await app.inject({ method: 'GET', url });
      expect(badUrl.statusCode, url).toBe(400);
      expect(badUrl.json(), url).toEqual({ error: { code: 'invalid-request', message: expect.any(String) } });
    }
    const boom = await app.inject({ method: 'GET', url: '/api/boom' });
    expect(boom.statusCode).toBe(500);
    expect(boom.json()).toEqual({ error: { code: 'internal', message: expect.any(String) } });
    expect(boom.body).not.toContain('secret');
    await app.close();
  });

  it('starts without a web build and says so for the application paths', async () => {
    const app = await buildApp({ staticDir: path.join(staticDir, 'missing'), logger: createLogger(sink) });
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/x' })).statusCode).toBe(404);
    await app.close();
  });

  it('redacts authorization and cookie in the request log', async () => {
    lines.length = 0;
    const app = await buildApp({ staticDir, logger: createLogger(sink) });
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
