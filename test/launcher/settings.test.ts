// REQ-STATE-09 on the bin (spec-006 §2, §4; spec-004 §3, §6; C-07.1, C-07.2 and Y-07.2 API side —
// the screens close in task-041 and task-040): the real console with a test-owned state directory.
// A first start and a v0.1 file read exactly the defaults; a stored invalid value reads as its
// default and is dropped at the next write; a PUT is kept across a restart and announced on the
// event stream.
import type { StateFile, UiSettings } from '@wingfoil-ui/contracts';
import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { harnessEnv } from '../harness/fixtures/index.js';
import { BIN_START_MS, BIN_TEST_MS } from '../harness/load.js';
import { TempWorkspace } from '../harness/temp-workspace.js';
import { openSse } from '../server/http/sse-client.js';
import { startLauncher, type Launcher } from './launcher.js';

vi.setConfig({ testTimeout: BIN_TEST_MS });

const DEFAULTS: UiSettings = {
  autoFetch: true,
  fetchIntervalSeconds: 60,
  autoUpdate: false,
  autoPush: false,
  theme: 'system',
  confirmAgentLaunch: true,
  actionLogCap: 5000,
};

let ws: TempWorkspace;
let baseEnv: NodeJS.ProcessEnv;
let n = 0;
const started: Launcher[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-030-settings-');
  baseEnv = (await harnessEnv(ws.dir)).env;
}, 180_000);

afterAll(async () => {
  for (const l of started) await l.kill();
  await ws.dispose();
});

/** A new state directory, seeded with `state` when given. */
async function stateDir(state?: unknown): Promise<string> {
  n += 1;
  const dir = path.join(ws.dir, `state-${n}`);
  if (state !== undefined) {
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(path.join(dir, 'state.json'), JSON.stringify(state), { mode: 0o600 });
  }
  return dir;
}

async function launch(dir: string): Promise<Launcher> {
  const l = await startLauncher(['--no-open'], { ...baseEnv, WINGFOIL_UI_STATE_DIR: dir }, BIN_START_MS);
  started.push(l);
  return l;
}

function call(l: Launcher, method: 'GET' | 'PUT', body?: unknown): Promise<{ status: number; json: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: l.port,
        method,
        path: '/api/settings',
        headers: {
          host: `127.0.0.1:${l.port}`,
          authorization: `Bearer ${l.token}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
      },
      (res) => {
        let text = '';
        res.on('data', (d: Buffer) => (text += String(d)));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, json: JSON.parse(text) as unknown }));
      },
    );
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

async function readState(dir: string): Promise<StateFile> {
  return JSON.parse(await readFile(path.join(dir, 'state.json'), 'utf8')) as StateFile;
}

describe('UI settings on the bin', () => {
  it('C-07.1, Y-07.2 — a first start answers exactly the defaults and writes nothing', async () => {
    const dir = await stateDir();
    const l = await launch(dir);
    expect(await call(l, 'GET')).toEqual({ status: 200, json: DEFAULTS });
    await expect(readFile(path.join(dir, 'state.json'))).rejects.toThrow();
  });

  it('C-07.1 — a v0.1 state file ({} and []) answers exactly the defaults', async () => {
    const dir = await stateDir({ version: 1, projects: [], settings: {}, actionLog: [] });
    const l = await launch(dir);
    expect(await call(l, 'GET')).toEqual({ status: 200, json: DEFAULTS });
  });

  it('RP-39 — a stored invalid value reads as its default; the next write keeps only known valid keys', async () => {
    const dir = await stateDir({
      version: 1,
      projects: [],
      settings: { autoPush: true, fetchIntervalSeconds: 3, newer: 'x' },
      actionLog: [],
    });
    const l = await launch(dir);
    expect((await call(l, 'GET')).json).toEqual({ ...DEFAULTS, autoPush: true });
    const next = { ...DEFAULTS, autoPush: true, theme: 'dark' };
    expect(await call(l, 'PUT', next)).toEqual({ status: 200, json: next });
    expect((await readState(dir)).settings).toEqual(next);
  });

  it('C-07.2 — a PUT is announced on the event stream and kept across a restart', async () => {
    const dir = await stateDir();
    const first = await launch(dir);
    const stream = await openSse(first.port, '/api/events', { authorization: `Bearer ${first.token}` });
    try {
      expect(stream.status).toBe(200);
      const next = { ...DEFAULTS, autoFetch: false, fetchIntervalSeconds: 15 };
      expect((await call(first, 'PUT', next)).status).toBe(200);
      await vi.waitFor(() => expect(stream.events()).toEqual([{ event: 'settings', data: {} }]), {
        timeout: BIN_START_MS,
      });
      expect(await call(first, 'PUT', { ...next, fetchIntervalSeconds: 14 })).toMatchObject({ status: 400 });
      await first.stop();
      const second = await launch(dir);
      expect((await call(second, 'GET')).json).toEqual(next);
    } finally {
      stream.close();
    }
  });

  it('D30-3 — a second console on the same state directory reads the change at its next GET', async () => {
    const dir = await stateDir();
    const a = await launch(dir);
    const b = await launch(dir);
    expect((await call(b, 'GET')).json).toEqual(DEFAULTS);
    const next = { ...DEFAULTS, theme: 'light' };
    expect((await call(a, 'PUT', next)).status).toBe(200);
    expect((await call(b, 'GET')).json).toEqual(next);
  });
});
