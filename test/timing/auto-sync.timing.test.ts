// REQ-PERF-07 (TT-PERF-07, task-034) — remote freshness on the bin with the default interval (60 s):
// a commit pushed to the fixture's bare remote by someone else shows as one more commit behind in
// `GET /api/p/:pid` within 65 s, in 10 out of 10 trials (Y-02.1 API side); with `autoFetch` off the
// console runs no `git fetch` in 120 s (Y-02.3), counted in the `GIT_TRACE` file of the bin's git
// processes. Timing suite (bug-001, RP-44): run on a quiet machine; every time is printed with the
// load average. The default suite proves the same behaviour at 15 s (`test/launcher/auto-sync.test.ts`).
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies of the routes */
import type { StateFile, UiSettings } from '@wingfoil-ui/contracts';
import http from 'node:http';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildFixture, memberByName, type Fixture } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { TempWorkspace } from '../harness/temp-workspace.js';
import { startLauncher, type Launcher } from '../launcher/launcher.js';
import { report } from './load.js';

const PID = 'p_freshness000';
const BUDGET_MS = 65_000;
const TRIALS = 10;
const QUIET_MS = 120_000;
let ws: TempWorkspace;
const launchers: Launcher[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-034-timing-');
}, 60_000);

afterAll(async () => {
  for (const l of launchers) await l.kill();
  await ws.dispose();
});

async function start(
  name: string,
  settings: Partial<UiSettings>,
): Promise<{ l: Launcher; fx: Fixture; trace: string }> {
  const root = path.join(await realpath(ws.dir), name);
  await mkdir(root, { recursive: true });
  const fx = await buildFixture('kanban', { root });
  await git(fx.dir, ['config', 'user.email', memberByName('Morgan').email], fx.env);
  const stateDir = path.join(root, 'state');
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  const state: StateFile = {
    version: 1,
    projects: [{ id: PID, path: fx.dir, name: fx.name, remote: '', addedAt: '2026-10-15T08:00:00Z', roleView: '' }],
    settings,
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
  return { l, fx, trace };
}

function header(l: Launcher): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: l.port,
        path: `/api/p/${PID}`,
        headers: { host: `127.0.0.1:${l.port}`, authorization: `Bearer ${l.token}` },
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c: string) => (text += c));
        res.on('end', () => resolve(JSON.parse(text)));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

let pushed = 0;
async function remoteCommit(fx: Fixture): Promise<void> {
  pushed += 1;
  const other = path.join(path.dirname(fx.dir), `other-${pushed}`);
  await git(path.dirname(fx.dir), ['clone', '-q', fx.remoteDir, other], fx.env);
  await git(other, ['config', 'user.email', 'jordan@example.test'], fx.env);
  await writeFile(path.join(other, `remote-${pushed}.md`), 'hi\n');
  await git(other, ['add', '--', `remote-${pushed}.md`], fx.env);
  await git(other, ['commit', '-qm', `outside ${pushed}`], fx.env);
  await git(other, ['push', '-q', 'origin', 'HEAD:main'], fx.env);
}

const fetches = async (trace: string) =>
  (await readFile(trace, 'utf8').catch(() => '')).split('\n').filter((l) => /built-in: git fetch\b/.test(l)).length;

describe('TT-PERF-07 — remote freshness (REQ-PERF-07)', () => {
  it(
    `a remote commit shows as behind within ${BUDGET_MS / 1000} s, ${TRIALS} out of ${TRIALS} (default interval)`,
    async () => {
      const { l, fx } = await start('fresh', {});
      expect((await header(l)).repository.behind).toBe(0);
      const times: number[] = [];
      for (let trial = 1; trial <= TRIALS; trial += 1) {
        await remoteCommit(fx);
        const t0 = performance.now();
        for (;;) {
          if ((await header(l)).repository.behind >= trial) break;
          if (performance.now() - t0 > BUDGET_MS + 30_000) break;
          await new Promise((r) => setTimeout(r, 250));
        }
        const ms = performance.now() - t0;
        times.push(ms);
        report(`TT-PERF-07 trial ${trial}`, `${Math.round(ms)} ms`);
      }
      expect(times.filter((ms) => ms > BUDGET_MS)).toEqual([]);
    },
    TRIALS * (BUDGET_MS + 40_000),
  );

  it(
    `autoFetch off: no git fetch in ${QUIET_MS / 1000} s`,
    async () => {
      const { l, trace } = await start('quiet', { autoFetch: false });
      expect((await header(l)).repository.copy).toBe('in-sync');
      const before = await fetches(trace);
      await new Promise((r) => setTimeout(r, QUIET_MS));
      const count = (await fetches(trace)) - before;
      report('Y-02.3 git fetch in 120 s with autoFetch off', String(count));
      // The trace is written: the header's own status read is in it.
      expect(await readFile(trace, 'utf8')).toMatch(/built-in: git status\b/);
      expect(count).toBe(0);
    },
    QUIET_MS + 60_000,
  );
});
