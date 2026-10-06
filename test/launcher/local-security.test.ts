// e2e-smoke `local-security` (REQ-SEC-02, REQ-SEC-03; X-02.1 API side, X-02.2, X-04.1…X-04.3): the
// `wingfoil-ui` bin driven over HTTP. No project read route exists yet (task-008/012; `PUT …/role-view`
// is task-009): the guarded requests target `/api/` paths that, once past the guards, answer 404 —
// never 401 or 403. The event stream `GET /api/events` (task-010) answers 200 once past them.
import http from 'node:http';
import net from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { harnessEnv } from '../harness/fixtures/index.js';
import { startLauncher, type Launcher } from './launcher.js';

let root: string;
let env: NodeJS.ProcessEnv;
const started: Launcher[] = [];
const PROJECT_API = '/api/p/p_abcdefghijkl';

async function launch(): Promise<Launcher> {
  const l = await startLauncher(['--no-open'], env);
  started.push(l);
  return l;
}

interface Reply {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

/** A raw request: `fetch` does not let a test set `Host` or `Origin`. */
function request(
  l: Launcher,
  method: string,
  urlPath: string,
  headers: Record<string, string> = {},
  address = '127.0.0.1',
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: address, port: l.port, method, path: urlPath, headers: { host: `127.0.0.1:${l.port}`, ...headers } },
      (res) => {
        let body = '';
        res.on('data', (d: Buffer) => (body += String(d)));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
      },
    );
    req.on('error', reject);
    if (method === 'POST' || method === 'PUT') req.setHeader('content-type', 'application/json');
    req.end(method === 'POST' || method === 'PUT' ? '{}' : undefined);
  });
}

/** `GET /api/events`: resolves with the response head and the stream, which stays open. */
function openStream(
  l: Launcher,
  headers: Record<string, string>,
): Promise<{ status: number; type: string | undefined; ended: Promise<void>; close(): void }> {
  return new Promise((resolve, reject) => {
    const req = http.get(
      { host: '127.0.0.1', port: l.port, path: '/api/events', headers: { host: `127.0.0.1:${l.port}`, ...headers } },
      (res) => {
        const ended = new Promise<void>((r) => {
          res.on('close', () => r());
          res.resume();
        });
        resolve({ status: res.statusCode ?? 0, type: res.headers['content-type'], ended, close: () => req.destroy() });
      },
    );
    req.on('error', reject);
  });
}

/** `true` when the machine can listen on `::1` (the console then listens there too). */
const HAS_IPV6 = await new Promise<boolean>((resolve) => {
  const probe = net.createServer();
  probe.once('error', () => resolve(false));
  probe.listen({ host: '::1', port: 0 }, () => probe.close(() => resolve(true)));
});

/** A request written line by line on a socket: `http.request` cannot repeat `Host`. */
function rawRequest(l: Launcher, head: string[]): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: '127.0.0.1', port: l.port });
    let data = '';
    socket.on('data', (d: Buffer) => (data += String(d)));
    socket.on('error', reject);
    socket.on('end', () => {
      const status = Number(/^HTTP\/1\.1 (\d{3})/.exec(data)?.[1] ?? 0);
      resolve({ status, body: data.slice(data.indexOf('\r\n\r\n') + 4) });
    });
    socket.write(`${[...head, 'Connection: close'].join('\r\n')}\r\n\r\n`);
  });
}

beforeAll(async () => {
  // server/dist is built once by test/global-setup.ts.
  root = await mkdtemp(path.join(tmpdir(), 'wfui-security-'));
  env = { ...(await harnessEnv(root)).env, WINGFOIL_UI_STATE_DIR: path.join(root, 'state') };
}, 180_000);

afterAll(async () => {
  await Promise.all(started.map((l) => l.kill()));
  await rm(root, { recursive: true, force: true });
});

describe('X-02.1 (API side) — the session opened with the token', () => {
  it('serves the application without a session, exchanges the token for the cookie, and accepts it', async () => {
    const l = await launch();
    expect((await request(l, 'GET', '/')).status).not.toBe(401);
    const session = await request(l, 'POST', '/api/session', {
      origin: `http://127.0.0.1:${l.port}`,
      authorization: `Bearer ${l.token}`,
    });
    expect(session.status).toBe(204);
    const setCookie = String(session.headers['set-cookie']);
    expect(setCookie).toMatch(new RegExp(`^wfui_session_${l.port}=[A-Za-z0-9_-]{43}; `));
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).not.toContain('Max-Age');
    const cookie = setCookie.split(';')[0]!;
    expect((await request(l, 'GET', PROJECT_API, { cookie })).status).toBe(404);
    expect((await openStream(l, { cookie })).status).toBe(200);
    await l.stop();
    const sessionId = cookie.split('=')[1]!;
    expect(l.stderr()).not.toContain(l.token);
    expect(l.stderr()).not.toContain(sessionId);
  });
});

describe('X-02.2 — a new token at every start', () => {
  it("answers 401 to the previous start's token and session", async () => {
    const first = await launch();
    const session = await request(first, 'POST', '/api/session', { authorization: `Bearer ${first.token}` });
    const cookie = String(session.headers['set-cookie']).split(';')[0]!;
    await first.stop();
    const second = await launch();
    expect(second.token).not.toBe(first.token);
    const sameName = cookie.replace(`wfui_session_${first.port}`, `wfui_session_${second.port}`);
    expect((await request(second, 'GET', PROJECT_API, { authorization: `Bearer ${first.token}` })).status).toBe(401);
    expect((await request(second, 'GET', PROJECT_API, { cookie: sameName })).status).toBe(401);
    expect((await request(second, 'GET', PROJECT_API, { authorization: `Bearer ${second.token}` })).status).toBe(404);
  });
});

describe('X-04.1 — refuse requests without a valid session', () => {
  let l: Launcher;
  beforeAll(async () => {
    l = await launch();
  });

  it.each([
    ['GET', {}, 401, 'unauthenticated'],
    ['POST', {}, 401, 'unauthenticated'],
    ['GET', { origin: 'https://evil.test', auth: true }, 403, 'forbidden-origin'],
    ['POST', { origin: 'https://evil.test', auth: true }, 403, 'forbidden-origin'],
  ] as const)('%s %o → %i', async (method, condition, status, code) => {
    const headers: Record<string, string> = {};
    if ('origin' in condition) headers.origin = condition.origin;
    if ('auth' in condition) headers.authorization = `Bearer ${l.token}`;
    const res = await request(l, method, PROJECT_API, headers);
    expect(res.status).toBe(status);
    expect(JSON.parse(res.body)).toEqual({ error: { code, message: expect.any(String) } });
  });

  // task-009: `PUT /api/p/:pid/role-view` — refused by the guards; past them, an unknown id is 404.
  it.each([
    [{}, 401, 'unauthenticated'],
    [{ origin: 'https://evil.test', auth: true }, 403, 'forbidden-origin'],
    [{ auth: true }, 404, 'not-found'],
  ] as const)('PUT role-view %o → %i', async (condition, status, code) => {
    const headers: Record<string, string> = {};
    if ('origin' in condition) headers.origin = condition.origin;
    if ('auth' in condition) headers.authorization = `Bearer ${l.token}`;
    const res = await request(l, 'PUT', `${PROJECT_API}/role-view`, headers);
    expect(res.status).toBe(status);
    expect(JSON.parse(res.body)).toEqual({ error: { code, message: expect.any(String) } });
  });

  it('answers 401 to a malformed /api URL without a session (spec-004 §4 order)', async () => {
    expect((await rawRequest(l, ['GET /api/%zz HTTP/1.1', `Host: 127.0.0.1:${l.port}`])).status).toBe(401);
  });
});

describe('X-04.2 — refuse a DNS-rebinding request', () => {
  let l: Launcher;
  beforeAll(async () => {
    l = await launch();
  });

  it('answers 403 to the Host evil.test:<port>, on the API and the application', async () => {
    for (const urlPath of [PROJECT_API, '/']) {
      const res = await request(l, 'GET', urlPath, {
        host: `evil.test:${l.port}`,
        authorization: `Bearer ${l.token}`,
      });
      expect(res.status, urlPath).toBe(403);
    }
  });

  it('answers 403 to an API request from another local port (Sec-Fetch-Site: same-site)', async () => {
    const headers = { authorization: `Bearer ${l.token}`, 'sec-fetch-site': 'same-site' };
    const res = await request(l, 'GET', PROJECT_API, headers);
    expect(res.status).toBe(403);
    expect(JSON.parse(res.body)).toEqual({ error: { code: 'forbidden-origin', message: expect.any(String) } });
    expect((await request(l, 'GET', '/', headers)).status).not.toBe(403);
    const twice = await rawRequest(l, [
      `GET ${PROJECT_API} HTTP/1.1`,
      `Host: 127.0.0.1:${l.port}`,
      `Authorization: Bearer ${l.token}`,
      'Sec-Fetch-Site: same-origin',
      'Sec-Fetch-Site: same-origin',
    ]);
    expect(twice.status).toBe(403);
  });

  it('answers 403 to a second Host header, even after our own', async () => {
    for (const target of [PROJECT_API, '/', '/api/%zz']) {
      const res = await rawRequest(l, [
        `GET ${target} HTTP/1.1`,
        `Host: 127.0.0.1:${l.port}`,
        `Host: evil.test:${l.port}`,
        `Authorization: Bearer ${l.token}`,
      ]);
      expect(res.status, target).toBe(403);
      expect(res.body, target).toContain('forbidden-origin');
    }
  });
});

describe("X-04.3 — accept a request with the token from the console's own origin", () => {
  let l: Launcher;
  beforeAll(async () => {
    l = await launch();
  });

  it('lets the request through the guards on 127.0.0.1', async () => {
    const headers = { origin: `http://127.0.0.1:${l.port}`, authorization: `Bearer ${l.token}` };
    expect((await request(l, 'POST', '/api/session', headers)).status).toBe(204);
    expect((await request(l, 'GET', PROJECT_API, headers)).status).toBe(404);
  });

  // ::1 may be unavailable on the machine (IPv4-only start, spec-007 §3.3).
  it.skipIf(!HAS_IPV6)('lets the request through the guards on ::1', async () => {
    const headers = { host: `[::1]:${l.port}`, origin: `http://[::1]:${l.port}`, authorization: `Bearer ${l.token}` };
    expect((await request(l, 'POST', '/api/session', headers, '::1')).status).toBe(204);
    expect((await request(l, 'GET', PROJECT_API, headers, '::1')).status).toBe(404);
  });
});

describe('GET /api/events — the event stream on the bin (spec-004 §1–2, §6)', () => {
  it('refuses it without a session (401) and from another site or origin (403)', async () => {
    const l = await launch();
    const anonymous = await openStream(l, {});
    expect(anonymous.status).toBe(401);
    const sameSite = await openStream(l, { authorization: `Bearer ${l.token}`, 'sec-fetch-site': 'same-site' });
    expect(sameSite.status).toBe(403);
    const foreign = await openStream(l, { authorization: `Bearer ${l.token}`, origin: 'https://evil.test' });
    expect(foreign.status).toBe(403);
    // A foreign Host without any Origin (DNS rebinding), even with the token.
    const rebinding = await openStream(l, { authorization: `Bearer ${l.token}`, host: `evil.test:${l.port}` });
    expect(rebinding.status).toBe(403);
    // Two Host headers (raw socket: http.request cannot repeat one).
    const duplicate = await rawRequest(l, [
      'GET /api/events HTTP/1.1',
      `Host: 127.0.0.1:${l.port}`,
      'Host: evil.test',
      `Authorization: Bearer ${l.token}`,
    ]);
    expect(duplicate.status).toBe(403);
    // A wrong token.
    const wrong = await openStream(l, { authorization: `Bearer ${'x'.repeat(43)}` });
    expect(wrong.status).toBe(401);
  });

  it("refuses the previous start's token and session (401)", async () => {
    const first = await launch();
    const session = await request(first, 'POST', '/api/session', { authorization: `Bearer ${first.token}` });
    const cookie = String(session.headers['set-cookie']).split(';')[0]!;
    await first.stop();
    const second = await launch();
    expect((await openStream(second, { authorization: `Bearer ${first.token}` })).status).toBe(401);
    const sameName = cookie.replace(`wfui_session_${first.port}`, `wfui_session_${second.port}`);
    expect((await openStream(second, { cookie: sameName })).status).toBe(401);
  });

  it('opens it with the token, and ends it in the stop sequence (exit 0)', async () => {
    const l = await launch();
    const stream = await openStream(l, { authorization: `Bearer ${l.token}` });
    expect(stream.status).toBe(200);
    expect(stream.type).toMatch(/^text\/event-stream/);
    const code = await l.stop();
    await stream.ended;
    expect(code).toBe(0);
    expect(l.stdoutLines().at(-1)).toBe('WingFoil UI stopped');
  });
});
