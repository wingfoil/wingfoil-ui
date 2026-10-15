// spec-010 §6 auto-push, spec-004 §5 `push` (RP-22, RP-33, REQ-INT-06; task-034 D34-6, D34-10,
// D34-11) — the auto-push after a governed write on copies of the kanban fixture with their bare
// `origin` (Y-07.3, Y-08.1, G-13.1 API side): `off` / `pushed` / `failed` with git's message, a §5
// code or `push-timeout` (the 60 s limit lowered here, process group killed); a failed push never
// fails the write; no push without `autoPush`; the commit a failed CLI left is not pushed by itself
// and leaves with the next push of HEAD; the user's own unpushed commits go with HEAD.
import type { FastifyInstance } from 'fastify';
import { realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { UiSettings } from '@wingfoil-ui/contracts';
import { GIT_ALLOWED_SUBCOMMANDS, gitSubcommand } from '../../../server/src/git/git.js';
import { pushArgs } from '../../../server/src/git/transport.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { DEFAULT_SETTINGS } from '../../../server/src/state/settings.js';
import { startGitHttpRemote } from '../../e2e/support/git-http.js';
import { buildFixture, type Fixture } from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';
import { processKind } from '../snapshot/support.js';
import { expectSchema, startGitConsole, type GitConsole, type GitConsoleOptions } from './git-console.js';

const LOGIN = 'task-001-login-form'; // kanban: pending (gate); Morgan holds approver
const TIMEOUT = 'task-004-session-timeout'; // kanban: draft

let ws: TempWorkspace;
let template: Fixture;
const registries: Snapshots[] = [];
const apps: FastifyInstance[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-034-auto-push-');
  template = await buildFixture('kanban', { root: path.join(await realpath(ws.dir), 'kanban') });
}, 600_000);

afterEach(async () => {
  for (const a of apps.splice(0)) await a.close();
});

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await ws.dispose();
});

async function start(
  settings: Partial<UiSettings> = { autoPush: true },
  options: GitConsoleOptions = {},
): Promise<GitConsole> {
  const c = await startGitConsole(template, ws.dir, apps, registries, { autoPush: {}, ...options });
  await c.store.putSettings({ ...DEFAULT_SETTINGS, ...settings });
  await c.warm();
  return c;
}

const approve = async (c: GitConsole) => {
  const res = await c.write('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' });
  if (res.status === 200) expectSchema('write.response.schema.json', res.body);
  return res;
};
const remoteHead = async (c: GitConsole) => (await git(c.fx.remoteDir, ['rev-parse', 'main'], c.fx.env)).stdout.trim();
const pushes = (c: GitConsole) => c.runner.spawned.filter((r) => gitSubcommand(r.args) === 'push');

describe('auto-push (spec-010 §6; Y-07.3, G-13.1 API side)', () => {
  it('autoPush off (the default, Y-07.2) → push {status: off}, no push process', async () => {
    const c = await start({});
    const res = await approve(c);
    expect(res.status).toBe(200);
    expect(res.body.push).toEqual({ status: 'off' });
    expect(pushes(c)).toHaveLength(0);
  });

  it('Y-07.3: autoPush on → pushed: the remote’s branch is at the approval commit, the §4 arguments, the copy in sync', async () => {
    const c = await start();
    const res = await approve(c);
    expect(res.status).toBe(200);
    expect(res.body.push).toEqual({ status: 'pushed' });
    expect(await remoteHead(c)).toBe(res.body.commits[0].sha);
    expect(pushes(c).at(-1)!.args).toEqual(pushArgs('origin', 'refs/heads/main'));
    const repo = (await c.get(`/api/p/${c.pid}`)).body.repository;
    expect(repo).toMatchObject({ copy: 'in-sync', ahead: 0 });
    for (const r of c.runner.spawned.filter((x) => processKind(x) === 'git')) {
      expect(GIT_ALLOWED_SUBCOMMANDS).toContain(gitSubcommand(r.args));
    }
  });

  it('Y-08.1: the remote moved (not fetched) → failed with git’s rejection; the write is 200, the commit stays local', async () => {
    const c = await start();
    await c.remoteCommit('from-jordan.md', 'hi\n');
    const res = await approve(c);
    expect(res.status).toBe(200);
    expect(res.body.push.status).toBe('failed');
    expect(res.body.push.code).toBeUndefined();
    expect(res.body.push.message).toMatch(/rejected|fetch first|non-fast-forward/);
    expect(res.body.push.message).not.toContain(c.fx.dir);
    expect(await c.head()).toBe(res.body.commits[0].sha);
    expect(await remoteHead(c)).not.toBe(res.body.commits[0].sha);
  });

  it('RP-22: no upstream → failed with code no-upstream, no push process', async () => {
    const c = await start(
      { autoPush: true },
      {
        prepare: (fx) => git(fx.dir, ['branch', '--unset-upstream'], fx.env).then(() => undefined),
      },
    );
    const res = await approve(c);
    expect(res.status).toBe(200);
    expect(res.body.push).toEqual({ status: 'failed', code: 'no-upstream' });
    expect(pushes(c)).toHaveLength(0);
  });

  it('no remote (has-remote does not hold) → off', async () => {
    const c = await start(
      { autoPush: true },
      {
        prepare: (fx) => git(fx.dir, ['remote', 'remove', 'origin'], fx.env).then(() => undefined),
      },
    );
    const res = await approve(c);
    expect(res.status).toBe(200);
    expect(res.body.push).toEqual({ status: 'off' });
  });

  it('RP-33: a push that does not finish in time → failed push-timeout, its process group killed, the write 200', async () => {
    const remote = await startGitHttpRemote(path.join(await realpath(ws.dir), 'http'), { hold: true });
    try {
      const c = await start({ autoPush: true }, { autoPush: { timeoutMs: 1_000 } });
      await git(c.fx.dir, ['remote', 'set-url', '--push', 'origin', `${remote.origin}/held.git`], c.fx.env);
      await c.check();
      await c.warm();
      const res = await approve(c);
      expect(res.status).toBe(200);
      expect(res.body.push).toMatchObject({ status: 'failed', code: 'push-timeout' });
      expect(c.runner.running).toBe(0);
      const push = pushes(c).at(-1)!;
      const alive = () => {
        try {
          process.kill(-push.pid!, 0);
          return true;
        } catch {
          return false;
        }
      };
      await expect.poll(alive, { timeout: 15_000 }).toBe(false);
    } finally {
      remote.release();
      await remote.close();
    }
  });

  it('D34-11: the push is HEAD — the user’s own unpushed commit goes with the write', async () => {
    const c = await start();
    await writeFile(path.join(c.fx.dir, 'mine.md'), 'mine\n');
    await git(c.fx.dir, ['add', 'mine.md'], c.fx.env);
    await git(c.fx.dir, ['commit', '-qm', 'mine'], c.fx.env);
    const mine = await c.head();
    await c.check();
    await c.warm();
    const res = await approve(c);
    expect(res.body.push).toEqual({ status: 'pushed' });
    await git(c.fx.remoteDir, ['merge-base', '--is-ancestor', mine, 'main'], c.fx.env);
  });

  it('D34-6: a commit left by a failed CLI (W2-5) is not pushed by itself; the next successful write pushes it', async () => {
    let fail = true;
    const c = await start(
      { autoPush: true },
      {
        intercept: async (request, real) =>
          fail && request.args.includes('approve')
            ? { ...(await real(request)), exitCode: 1, stdout: '', stderr: '{"error":"failed after the commit"}' }
            : undefined,
      },
    );
    const res = await approve(c);
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('write-incomplete');
    const left = res.body.error.detail.commit as string;
    expect(pushes(c)).toHaveLength(0);
    expect(await remoteHead(c)).not.toBe(left);
    fail = false;
    await c.check();
    await c.warm();
    const next = await c.write('submit', TIMEOUT, { expectedStatus: 'draft' });
    expect(next.status).toBe(200);
    expect(next.body.push).toEqual({ status: 'pushed' });
    await git(c.fx.remoteDir, ['merge-base', '--is-ancestor', left, 'main'], c.fx.env);
  });
});

describe('review round 1 (R3)', () => {
  it('a git read of the push plan fails → the write is 200, push failed, the log holds the kind only', async () => {
    const MARKER = 'marker-task-034-r3';
    const log: string[] = [];
    let root = '';
    const c = await start(
      { autoPush: true },
      {
        log,
        intercept: async (request) =>
          gitSubcommand(request.args) === 'remote' && request.args.includes('--push')
            ? {
                exitCode: 128,
                signal: null,
                stdout: '',
                stderr: `fatal: ${MARKER} ${root}`,
                ended: 'exit',
                durationMs: 1,
              }
            : undefined,
      },
    );
    root = c.fx.dir;
    const res = await approve(c);
    expect(res.status).toBe(200);
    expect(res.body.push).toEqual({ status: 'failed', code: 'internal' });
    expect(pushes(c)).toHaveLength(0);
    const text = log.join('');
    expect(text).toMatch(/auto-push failed/);
    expect(text).not.toContain(MARKER);
    expect(text).not.toContain(root);
  });
});

describe('security review S2 (task-034 W4-6)', () => {
  it('two values of branch.<b>.merge → push failed no-upstream, no push process, the write 200', async () => {
    const c = await start(
      { autoPush: true },
      {
        prepare: (fx) =>
          git(fx.dir, ['config', '--add', 'branch.main.merge', 'refs/heads/production'], fx.env).then(() => undefined),
      },
    );
    const res = await approve(c);
    expect(res.status).toBe(200);
    expect(res.body.push).toEqual({ status: 'failed', code: 'no-upstream' });
    expect(pushes(c)).toHaveLength(0);
  });
});
