// e2e-smoke `local-security` (REQ-SEC-02, REQ-SEC-03; X-02.1 API side, X-02.2, X-04.1…X-04.3): the
// `wingfoil-ui` bin driven over HTTP. No project route exists yet (task-008/012): the guarded
// requests target `/api/` paths that, once past the guards, answer 404 — never 401 or 403.
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { harnessEnv } from '../harness/fixtures/index.js';
import { run } from '../harness/run.js';
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
    req.end(method === 'POST' || method === 'PUT' ? '{}' : undefined);
  });
}

beforeAll(async () => {
  await run(process.execPath, [path.join(REPO_ROOT, 'node_modules/typescript/bin/tsc'), '-b', 'server'], {
    cwd: REPO_ROOT,
    timeoutMs: 120_000,
  });
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
    expect((await request(l, 'GET', '/api/events', { cookie })).status).toBe(404);
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
  it.each([
    ['GET', {}, 401, 'unauthenticated'],
    ['POST', {}, 401, 'unauthenticated'],
    ['GET', { origin: 'https://evil.test', auth: true }, 403, 'forbidden-origin'],
    ['POST', { origin: 'https://evil.test', auth: true }, 403, 'forbidden-origin'],
  ] as const)('%s %o → %i', async (method, condition, status, code) => {
    const l = started.at(-1) ?? (await launch());
    const headers: Record<string, string> = {};
    if ('origin' in condition) headers.origin = condition.origin;
    if ('auth' in condition) headers.authorization = `Bearer ${l.token}`;
    const res = await request(l, method, PROJECT_API, headers);
    expect(res.status).toBe(status);
    expect(JSON.parse(res.body)).toEqual({ error: { code, message: expect.any(String) } });
  });
});

describe('X-04.2 — refuse a DNS-rebinding request', () => {
  it('answers 403 to the Host evil.test:<port>, on the API and the application', async () => {
    const l = started.at(-1) ?? (await launch());
    for (const urlPath of [PROJECT_API, '/']) {
      const res = await request(l, 'GET', urlPath, {
        host: `evil.test:${l.port}`,
        authorization: `Bearer ${l.token}`,
      });
      expect(res.status, urlPath).toBe(403);
    }
  });
});

describe("X-04.3 — accept a request with the token from the console's own origin", () => {
  it('lets the request through the guards on 127.0.0.1 and ::1', async () => {
    const l = started.at(-1) ?? (await launch());
    const headers = { origin: `http://127.0.0.1:${l.port}`, authorization: `Bearer ${l.token}` };
    expect((await request(l, 'POST', '/api/session', headers)).status).toBe(204);
    expect((await request(l, 'GET', PROJECT_API, headers)).status).toBe(404);
    const v6 = await request(l, 'GET', '/api/session', { ...headers, host: `[::1]:${l.port}` }, '::1').catch(
      () => undefined,
    );
    // ::1 may be unavailable on the machine (IPv4-only start, spec-007 §3.3).
    if (v6) expect(v6.status).toBe(404);
  });
});
