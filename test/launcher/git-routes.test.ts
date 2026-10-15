// The git routes on the bin (task-033, spec-010 §4): the kanban fixture seeded into the console's
// state directory; `POST …/git/fetch` and `/git/push` through the real launcher wiring (one write
// lock, the routes registered at start) reach the fixture's bare remote.
import type { StateFile } from '@wingfoil-ui/contracts';
import http from 'node:http';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildFixture, memberByName, type Fixture } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { TempWorkspace } from '../harness/temp-workspace.js';
import { startLauncher, type Launcher } from './launcher.js';

const KANBAN = 'p_kanbankanban';
let ws: TempWorkspace;
let kanban: Fixture;
let l: Launcher;

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-033-bin-');
  const root = await realpath(ws.dir);
  kanban = await buildFixture('kanban', { root });
  await git(kanban.dir, ['config', 'user.email', memberByName('Morgan').email], kanban.env);
  const stateDir = path.join(root, 'state');
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  const state: StateFile = {
    version: 1,
    projects: [
      { id: KANBAN, path: kanban.dir, name: kanban.name, remote: '', addedAt: '2026-10-15T08:00:00Z', roleView: '' },
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

function call(urlPath: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: l.port,
        method: 'POST',
        path: urlPath,
        headers: { host: `127.0.0.1:${l.port}`, authorization: `Bearer ${l.token}` },
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c: string) => (text += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: text }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('the git routes through the launcher (task-033)', () => {
  it('fetch answers the repository status; push publishes a local commit to the bare remote', async () => {
    const fetched = await call(`/api/p/${KANBAN}/git/fetch`);
    expect(fetched.status, fetched.body).toBe(200);
    expect(JSON.parse(fetched.body).repository).toMatchObject({ copy: 'in-sync', upstream: 'origin/main' });
    await writeFile(path.join(kanban.dir, 'bin-push.md'), 'x\n');
    await git(kanban.dir, ['add', 'bin-push.md'], kanban.env);
    await git(kanban.dir, ['commit', '-qm', 'bin push'], kanban.env);
    const pushed = await call(`/api/p/${KANBAN}/git/push`);
    expect(pushed.status, pushed.body).toBe(200);
    const head = (await git(kanban.dir, ['rev-parse', 'HEAD'], kanban.env)).stdout.trim();
    expect((await git(kanban.remoteDir, ['rev-parse', 'main'], kanban.env)).stdout.trim()).toBe(head);
  });
});
