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

  it('returns the application for any other path (client-side routing)', async () => {
    const app = await buildApp({ staticDir, logger: createLogger(sink) });
    const res = await app.inject({ method: 'GET', url: '/p/p_abcdefghijkl/memory' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<title>WingFoil UI</title>');
    await app.close();
  });

  it('answers an unknown /api/ path with the spec-004 error envelope', async () => {
    const app = await buildApp({ staticDir, logger: createLogger(sink) });
    for (const url of ['/api/nothing', '/api/']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: { code: 'not-found', message: expect.any(String) } });
    }
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
