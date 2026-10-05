// The local state seen from the bin (spec-006, spec-007 §3.2): TT-ARC-08 (S-17.1, S-17.2 — the
// list survives a restart, the fixture stays clean), TT-SEC-09 (secret scan of the state
// directory and the logs), exit 4 when the state directory lies inside a listed project.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildFixture, copyFixture, type Fixture } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { scanForSecrets, scanText } from '../harness/secret-scan.js';
import { openFileStateStore } from '../../server/src/state/file-store.js';
import { BIN, startLauncher } from './launcher.js';

let root: string;
let kanban: Fixture;
const PLANTED = 'planted-env-value-Zq81xT';

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-launch-state-')));
  kanban = await buildFixture('kanban', { root: path.join(root, 'build') });
}, 180_000);

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

/** Run the bin until it exits on its own. */
function runBin(
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [BIN, ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => (stdout += String(d)));
    child.stderr.on('data', (d: Buffer) => (stderr += String(d)));
    child.once('exit', (code) => resolve({ code, stdout, stderr }));
  });
}

describe('TT-ARC-08 — local state outside the repositories', () => {
  it('S-17.1, S-17.2 — the list survives two restarts unchanged and the fixture stays clean', async () => {
    const fx = await copyFixture(kanban, path.join(root, 'restart'));
    const stateDir = path.join(fx.home, '.config', 'wingfoil-ui');
    const store = await openFileStateStore({ dir: stateDir });
    const entry = await store.add({ path: await realpath(fx.dir), name: 'kanban', remote: fx.remoteUrl });
    await store.update(entry.id, { roleView: 'developer' });
    const before = await readFile(path.join(stateDir, 'state.json'), 'utf8');

    // The OS location of spec-006 §1 (XDG under the isolated home): no WINGFOIL_UI_STATE_DIR.
    const env = { ...fx.env, WINGFOIL_UI_STATE_DIR: '', WFUI_TEST_SECRET: PLANTED };
    const logs: string[] = [];
    for (let i = 0; i < 2; i++) {
      const l = await startLauncher(['--no-open'], env);
      expect(await l.stop()).toBe(0);
      logs.push(l.stderr(), l.stdoutLines().join('\n'));
      const tokenFree = await scanForSecrets([stateDir], [l.token, PLANTED]);
      expect(tokenFree).toEqual([]);
      // The server log (stderr) holds neither the token nor a credential nor the planted value.
      expect(scanText('logs', l.stderr(), [l.token, PLANTED])).toEqual([]);
    }
    expect(await readFile(path.join(stateDir, 'state.json'), 'utf8')).toBe(before);
    expect((await openFileStateStore({ dir: stateDir })).get(entry.id)?.roleView).toBe('developer');
    expect((await git(fx.dir, ['status', '--porcelain'], fx.env)).stdout).toBe('');
    // REQ-SEC-09: no planted environment value and no credential in the logs either.
    expect(logs.join('\n')).not.toContain(PLANTED);
  });
});

describe('spec-007 §3.2 — state directory inside a listed project', () => {
  it('reads the OS location when WINGFOIL_UI_STATE_DIR is not set (exit 4 found there)', async () => {
    const fx = await copyFixture(kanban, path.join(root, 'xdg'));
    // The XDG configuration folder itself is listed as a project: the state directory lies in it.
    const config = path.join(await realpath(fx.home), '.config');
    const stateDir = path.join(config, 'wingfoil-ui');
    const store = await openFileStateStore({ dir: stateDir });
    await store.add({ path: config, name: 'config', remote: '' });
    const result = await runBin(['--no-open'], { ...fx.env, WINGFOIL_UI_STATE_DIR: '' });
    expect(result.code).toBe(4);
    expect(result.stderr).toContain(stateDir);
  });

  it('exits 4 before listening, naming both paths', async () => {
    const fx = await copyFixture(kanban, path.join(root, 'inside'));
    const project = await realpath(fx.dir);
    const stateDir = path.join(project, 'state');
    const store = await openFileStateStore({ dir: stateDir });
    await store.add({ path: project, name: 'kanban', remote: '' });
    const result = await runBin(['--no-open'], { ...fx.env, WINGFOIL_UI_STATE_DIR: stateDir });
    expect(result.code).toBe(4);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(stateDir);
    expect(result.stderr).toContain(project);
  });
});
