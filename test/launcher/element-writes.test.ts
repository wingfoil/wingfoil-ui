// The governed writes on the bin (task-032, spec-004 §3–§6, spec-006 §2): the kanban fixture seeded
// into the console's state directory; `POST …/approve` through the real launcher wiring (one write
// lock, the routes registered at start) makes the CLI's `wf(…)` commit, answers its sha and
// appends `{sha, at}` to `actionLog` in `state.json` (TT-SEC-10); `GET /api/events` carries one
// `write` event.
import type { StateFile } from '@wingfoil-ui/contracts';
import http from 'node:http';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildFixture, memberByName, type Fixture } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { TempWorkspace } from '../harness/temp-workspace.js';
import { startLauncher, type Launcher } from './launcher.js';

const KANBAN = 'p_kanbankanban';
let ws: TempWorkspace;
let stateDir: string;
let kanban: Fixture;
let l: Launcher;

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-032-bin-');
  const root = await realpath(ws.dir);
  kanban = await buildFixture('kanban', { root });
  await git(kanban.dir, ['config', 'user.email', memberByName('Morgan').email], kanban.env);
  stateDir = path.join(root, 'state');
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  const state: StateFile = {
    version: 1,
    projects: [
      { id: KANBAN, path: kanban.dir, name: kanban.name, remote: '', addedAt: '2026-10-14T08:00:00Z', roleView: '' },
    ],
    settings: {},
    actionLog: [],
  };
  await writeFile(path.join(stateDir, 'state.json'), JSON.stringify(state, null, 2), { mode: 0o600 });
  l = await startLauncher(['--no-open'], { ...kanban.env, WINGFOIL_UI_STATE_DIR: stateDir }, 30_000);
}, 600_000);

afterAll(async () => {
  await l?.kill();
  await ws.dispose();
});

function call(method: string, urlPath: string, body?: unknown): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: l.port,
        method,
        path: urlPath,
        headers: {
          host: `127.0.0.1:${l.port}`,
          authorization: `Bearer ${l.token}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c: string) => (text += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: text }));
      },
    );
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

/** The first `write` event of the stream, read until it arrives. */
function firstWriteEvent(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: l.port,
        path: '/api/events',
        headers: { host: `127.0.0.1:${l.port}`, authorization: `Bearer ${l.token}` },
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c: string) => {
          text += c;
          const match = /event: write\ndata: (.*)\n/.exec(text);
          if (match) {
            resolve(JSON.parse(match[1]!));
            req.destroy();
          }
        });
      },
    );
    req.on('error', (e) =>
      e.message.includes('aborted') || e.message.includes('socket hang up') ? undefined : reject(e),
    );
    req.end();
  });
}

describe('governed writes on the bin', () => {
  it('approve: the CLI commit, its sha answered and in the action log, one write event', async () => {
    // The page's reads first (the cache rows 5–6 use, D32-3).
    expect((await call('GET', `/api/p/${KANBAN}`)).status).toBe(200);
    expect((await call('GET', `/api/p/${KANBAN}/elements`)).status).toBe(200);
    const event = firstWriteEvent();
    const res = await call('POST', `/api/p/${KANBAN}/elements/task-001-login-form/approve`, {
      expectedStatus: 'pending',
      reason: 'Looks good',
    });
    expect(res.status, res.body).toBe(200);
    const head = (await git(kanban.dir, ['rev-parse', 'HEAD'], kanban.env)).stdout.trim();
    const body = JSON.parse(res.body) as { commits: { sha: string; subject: string }[]; push: unknown };
    expect(body.commits).toEqual([
      { sha: head, subject: 'wf(task): approve task-001-login-form [pending → approved]' },
    ]);
    expect(body.push).toEqual({ status: 'off' });
    expect(await event).toEqual({ pid: KANBAN, eid: 'task-001-login-form', commit: head });
    const state = JSON.parse(await readFile(path.join(stateDir, 'state.json'), 'utf8')) as StateFile;
    expect(state.actionLog).toEqual([{ sha: head, at: expect.stringMatching(/Z$/) }]);
  });
});
