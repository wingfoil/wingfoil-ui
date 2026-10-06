// REQ-PERF-06 — server start (S-01.1): spawn of the package `bin`, as `npx wingfoil-ui` runs it,
// to the printed URL, ≤ 3.0 s in 10 out of 10 runs. Timing suite (bug-001): run on a quiet
// machine; the times are printed with the load average.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { harnessEnv } from '../harness/fixtures/index.js';
import { startLauncher, type Launcher } from '../launcher/launcher.js';
import { report } from './load.js';

let root: string;
let env: NodeJS.ProcessEnv;
const started: Launcher[] = [];

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'wfui-launch-timing-'));
  env = { ...(await harnessEnv(root)).env, WINGFOIL_UI_STATE_DIR: path.join(root, 'state') };
}, 180_000);

afterAll(async () => {
  await Promise.all(started.map((l) => l.kill()));
  await rm(root, { recursive: true, force: true });
});

describe('REQ-PERF-06 — server start', () => {
  it('prints the URL within 3.0 s in 10 out of 10 runs', async () => {
    const times: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const l = await startLauncher(['--no-open'], env);
      started.push(l);
      times.push(l.startMs);
      await l.stop();
    }
    report('REQ-PERF-06 spawn → URL (ms)', times.map((t) => Math.round(t)).join(', '));
    expect(Math.max(...times)).toBeLessThanOrEqual(3_000);
  }, 60_000);
});
