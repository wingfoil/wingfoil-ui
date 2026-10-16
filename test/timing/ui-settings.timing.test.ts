// C-07.3 at the real budget (TT-PERF-07, REQ-STATE-09; task-041, D41-11): on the bin with the
// default interval (60 s), turning `autoFetch` off with `PUT /api/settings` right after an automatic
// fetch ended leaves the console without any `git fetch` for 120 s, counted in the `GIT_TRACE` file
// of the bin's git processes (as task-034's TT-PERF-07 test). Timing suite (bug-001, RP-44): a quiet
// machine; the load is printed. `test:e2e` proves the same at 15 s through the page
// (`test/e2e/ui-settings.spec.ts`).
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies of the routes */
import type { StateFile, UiSettings } from '@wingfoil-ui/contracts';
import http from 'node:http';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { buildFixture, memberByName } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { TempWorkspace } from '../harness/temp-workspace.js';
import { startLauncher, type Launcher } from '../launcher/launcher.js';
import { report } from './load.js';

// `p_` + 12 Crockford base32 characters (spec-006 §2), or the routes answer 404.
const PID = 'p_setngs000000';
const QUIET_MS = 120_000;
const INTERVAL_MS = 60_000;
let ws: TempWorkspace;
const launchers: Launcher[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-041-timing-');
}, 60_000);

afterAll(async () => {
  for (const l of launchers) await l.kill();
  await ws.dispose();
});

/** One request to the bin with its token; resolves with the status and the parsed body. */
function request(l: Launcher, method: string, route: string, body?: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        host: '127.0.0.1',
        port: l.port,
        path: route,
        method,
        headers: {
          host: `127.0.0.1:${l.port}`,
          authorization: `Bearer ${l.token}`,
          ...(payload ? { 'content-type': 'application/json', origin: `http://127.0.0.1:${l.port}` } : {}),
        },
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c: string) => (text += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: text === '' ? undefined : JSON.parse(text) }));
      },
    );
    req.on('error', reject);
    req.end(payload);
  });
}

const fetches = async (trace: string) =>
  (await readFile(trace, 'utf8').catch(() => '')).split('\n').filter((l) => /built-in: git fetch\b/.test(l)).length;

it(
  `C-07.3 — autoFetch turned off at run time: no git fetch in ${QUIET_MS / 1000} s (default interval)`,
  async () => {
    const root = await realpath(ws.dir);
    const fx = await buildFixture('kanban', { root });
    await git(fx.dir, ['config', 'user.email', memberByName('Morgan').email], fx.env);
    const stateDir = path.join(root, 'state');
    await mkdir(stateDir, { recursive: true, mode: 0o700 });
    const state: StateFile = {
      version: 1,
      projects: [{ id: PID, path: fx.dir, name: fx.name, remote: '', addedAt: '2026-10-16T08:00:00Z', roleView: '' }],
      settings: {},
      actionLog: [],
    };
    await writeFile(path.join(stateDir, 'state.json'), JSON.stringify(state, null, 2), { mode: 0o600 });
    const trace = path.join(root, 'git-trace.log');
    const l = await startLauncher(
      ['--no-open'],
      { ...fx.env, WINGFOIL_UI_STATE_DIR: stateDir, GIT_TRACE: trace },
      30_000,
    );
    launchers.push(l);
    const lastFetch = async () => (await request(l, 'GET', `/api/p/${PID}`)).body.repository.sync.fetch.lastSuccessAt;
    // Open the project (the scheduler syncs opened projects, RP-18), then wait for a tick that ends
    // after a first one, so the change lands right after a tick.
    expect((await request(l, 'GET', `/api/p/${PID}`)).status).toBe(200);
    const until = async (done: () => Promise<boolean>) => {
      const t0 = performance.now();
      while (!(await done())) {
        if (performance.now() - t0 > INTERVAL_MS + 30_000) throw new Error('no automatic fetch');
        await new Promise((r) => setTimeout(r, 250));
      }
    };
    await until(async () => (await lastFetch()) !== null);
    const first = await lastFetch();
    await until(async () => (await lastFetch()) !== first);
    const settings = (await request(l, 'GET', '/api/settings')).body as UiSettings;
    expect(settings.autoFetch).toBe(true);
    expect((await request(l, 'PUT', '/api/settings', { ...settings, autoFetch: false })).status).toBe(200);
    const before = await fetches(trace);
    expect(before).toBeGreaterThan(0);
    const offset = (await readFile(trace, 'utf8')).length;
    await new Promise((r) => setTimeout(r, QUIET_MS));
    // Review R6: the trace is still written after the change (a read of the project runs
    // `git status`), so 0 fetches in the window is not a trace that stopped.
    expect((await request(l, 'GET', `/api/p/${PID}`)).status).toBe(200);
    const count = (await fetches(trace)) - before;
    report('C-07.3 git fetch in 120 s after autoFetch was turned off', String(count));
    expect(count).toBe(0);
    expect((await readFile(trace, 'utf8')).slice(offset)).toMatch(/built-in: git status\b/);
  },
  QUIET_MS + 3 * INTERVAL_MS + 60_000,
);
