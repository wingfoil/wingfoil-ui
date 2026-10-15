// The scheduler and the auto-push on the bin (task-034, spec-010 §6): the kanban fixture seeded into
// the console's state directory with `fetchIntervalSeconds` = 15 (its minimum, RP-53; the real 60 s
// budgets are the timing suite's), `autoUpdate` and `autoPush` on. A commit pushed by someone else is
// fetched and fast-forwarded by itself (Y-02.1, Y-05.2 at 15 s), an approval is pushed (Y-07.3), and
// the stop sequence leaves no unattended git process running (a fetch held by the remote).
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies of the routes */
import type { StateFile, UiSettings } from '@wingfoil-ui/contracts';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startGitHttpRemote } from '../e2e/support/git-http.js';
import { buildFixture, memberByName, type Fixture } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { TempWorkspace } from '../harness/temp-workspace.js';
import { startLauncher, type Launcher } from './launcher.js';

const KANBAN = 'p_kanbankanban';
const LOGIN = 'task-001-login-form'; // kanban: pending (gate); Morgan holds approver
/** A tick every 15 s: one tick, its fetch and the refetch fit well within this budget at any load. */
const BUDGET_MS = 120_000;
let ws: TempWorkspace;
const launchers: Launcher[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-034-bin-');
}, 60_000);

afterAll(async () => {
  for (const l of launchers) await l.kill();
  await ws.dispose();
});

/** The bin on a new kanban copy with `settings` seeded; Morgan is the git user. */
async function console_(name: string, settings: Partial<UiSettings>): Promise<{ l: Launcher; fx: Fixture }> {
  const root = path.join(await realpath(ws.dir), name);
  await mkdir(root, { recursive: true });
  const fx = await buildFixture('kanban', { root });
  await git(fx.dir, ['config', 'user.email', memberByName('Morgan').email], fx.env);
  const stateDir = path.join(root, 'state');
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  const state: StateFile = {
    version: 1,
    projects: [{ id: KANBAN, path: fx.dir, name: fx.name, remote: '', addedAt: '2026-10-15T08:00:00Z', roleView: '' }],
    settings: { fetchIntervalSeconds: 15, ...settings },
    actionLog: [],
  };
  await writeFile(path.join(stateDir, 'state.json'), JSON.stringify(state, null, 2), { mode: 0o600 });
  const l = await startLauncher(['--no-open'], { ...fx.env, WINGFOIL_UI_STATE_DIR: stateDir }, 30_000);
  launchers.push(l);
  return { l, fx };
}

function call(l: Launcher, method: string, urlPath: string, body?: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        host: '127.0.0.1',
        port: l.port,
        method,
        path: urlPath,
        headers: {
          host: `127.0.0.1:${l.port}`,
          authorization: `Bearer ${l.token}`,
          ...(payload ? { 'content-type': 'application/json' } : {}),
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

/** Push a commit to the fixture's bare remote from another clone. */
async function remoteCommit(fx: Fixture, file: string): Promise<string> {
  const other = path.join(path.dirname(fx.dir), `other-${file}`);
  await git(path.dirname(fx.dir), ['clone', '-q', fx.remoteDir, other], fx.env);
  await git(other, ['config', 'user.email', 'jordan@example.test'], fx.env);
  await writeFile(path.join(other, file), 'hi\n');
  await git(other, ['add', '--', file], fx.env);
  await git(other, ['commit', '-qm', `outside: ${file}`], fx.env);
  await git(other, ['push', '-q', 'origin', 'HEAD:main'], fx.env);
  return (await git(other, ['rev-parse', 'HEAD'], fx.env)).stdout.trim();
}

describe('the scheduler through the launcher (spec-010 §6; Y-02.1, Y-05.2 at 15 s)', () => {
  it('a commit pushed by someone else is fetched and fast-forwarded by itself', async () => {
    const { l, fx } = await console_('update', { autoUpdate: true });
    // The page reads the project: its snapshot is open (RP-18).
    expect((await call(l, 'GET', `/api/p/${KANBAN}`)).status).toBe(200);
    const remote = await remoteCommit(fx, 'from-jordan.md');
    await expect
      .poll(async () => (await git(fx.dir, ['rev-parse', 'HEAD'], fx.env)).stdout.trim(), {
        timeout: BUDGET_MS,
        interval: 1_000,
      })
      .toBe(remote);
    const repository = (await call(l, 'GET', `/api/p/${KANBAN}`)).body.repository;
    expect(repository).toMatchObject({ copy: 'in-sync', behind: 0 });
    expect(repository.sync.fetch.lastSuccessAt).not.toBeNull();
  }, 200_000);
});

describe('the auto-push through the launcher (Y-07.3)', () => {
  it('an approval with autoPush on is pushed to the remote', async () => {
    const { l, fx } = await console_('push', { autoPush: true, autoFetch: false });
    expect((await call(l, 'GET', `/api/p/${KANBAN}/elements`)).status).toBe(200);
    const res = await call(l, 'POST', `/api/p/${KANBAN}/elements/${LOGIN}/approve`, {
      expectedStatus: 'pending',
      reason: 'ok',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.push).toEqual({ status: 'pushed' });
    expect((await git(fx.remoteDir, ['rev-parse', 'main'], fx.env)).stdout.trim()).toBe(res.body.commits[0].sha);
  }, 200_000);
});

describe('the stop sequence (unattended processes)', () => {
  it.runIf(process.platform !== 'win32')(
    'a stop while an automatic fetch is held by the remote leaves no git process running',
    async () => {
      const remote = await startGitHttpRemote(path.join(await realpath(ws.dir), 'http'), { hold: true });
      try {
        const { l, fx } = await console_('stop', {});
        await git(fx.dir, ['remote', 'set-url', 'origin', `${remote.origin}/held.git`], fx.env);
        expect((await call(l, 'GET', `/api/p/${KANBAN}`)).status).toBe(200);
        await expect.poll(() => remote.requests(), { timeout: BUDGET_MS, interval: 500 }).toBeGreaterThan(0);
        const held = () =>
          execFileSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8' })
            .split('\n')
            .filter((line) => line.includes(remote.origin) && !line.includes('ps -eo'))
            .map((line) => Number(line.trim().split(/\s+/)[0]));
        const pids = held();
        expect(pids.length).toBeGreaterThan(0);
        expect(await l.stop()).toBe(0);
        const alive = (pid: number) => {
          try {
            process.kill(pid, 0);
            return true;
          } catch {
            return false;
          }
        };
        await expect.poll(() => pids.filter(alive), { timeout: 15_000 }).toEqual([]);
      } finally {
        remote.release();
        await remote.close();
      }
    },
    200_000,
  );
});
