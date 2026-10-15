// spec-010 §2–§3, §7, spec-003 §6 rule 4, spec-004 §4 row 8 (task-033; REQ-STATE-02, REQ-STATE-04,
// RP-25, RP-32, RP-40; D33-6, D33-14) — the repository status and the conditions of `GET /api/p/:pid`,
// the copy reasons of the descriptors, the key and its events, and row 8 evaluated on the FRESH
// state under the write lock.
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies, each validated against its schema */
import type { FastifyInstance } from 'fastify';
import { realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { buildFixture, type Fixture } from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';
import { expectSchema, startGitConsole, type GitConsole, type GitConsoleOptions } from './git-console.js';

const LOGIN = 'task-001-login-form'; // kanban: pending (gate); Morgan holds approver

let ws: TempWorkspace;
let template: Fixture;
const registries: Snapshots[] = [];
const apps: FastifyInstance[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-033-repository-');
  template = await buildFixture('kanban', { root: path.join(await realpath(ws.dir), 'kanban') });
}, 600_000);

afterEach(async () => {
  for (const a of apps.splice(0)) await a.close();
});

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await ws.dispose();
});

const start = (options: GitConsoleOptions = {}): Promise<GitConsole> =>
  startGitConsole(template, ws.dir, apps, registries, options);

async function header(c: GitConsole): Promise<any> {
  const res = await c.get(`/api/p/${c.pid}`);
  expect(res.status).toBe(200);
  expectSchema('project.schema.json', res.body);
  return res.body;
}

async function approveVerb(c: GitConsole): Promise<any> {
  const res = await c.get(`/api/p/${c.pid}/elements`);
  const element = (res.body.elements as any[]).find((e) => e.id === LOGIN);
  return (element.descriptor.verbs as any[]).find((v) => v.verb === 'approve');
}

async function localCommit(c: GitConsole, file: string): Promise<void> {
  await writeFile(path.join(c.fx.dir, file), `${file}\n`);
  await git(c.fx.dir, ['add', '--', file], c.fx.env);
  await git(c.fx.dir, ['commit', '-qm', file], c.fx.env);
}

describe('GET /api/p/:pid — repository and conditions (spec-010 §3, §7)', () => {
  it('a copy in sync with its remote: branch, upstream, counts, sync status, has-remote', async () => {
    const c = await start();
    const body = await header(c);
    expect(body.repository).toEqual({
      state: expect.stringMatching(/^[0-9a-f]{40}\.[0-9a-f]{16}$/),
      head: await c.head(),
      localChanges: 0,
      branch: 'main',
      copy: 'in-sync',
      ahead: 0,
      behind: 0,
      upstream: 'origin/main',
      sync: { fetch: { lastSuccessAt: null, lastError: null }, update: { lastError: null } },
    });
    expect(body.conditions).toEqual(['has-remote']);
  });

  it('no remote: copy no-remote, no condition (the sync controls are hidden, RP-25)', async () => {
    const c = await start({ prepare: (fx) => git(fx.dir, ['remote', 'remove', 'origin'], fx.env).then(() => {}) });
    const body = await header(c);
    expect(body.repository).toMatchObject({ copy: 'no-remote', upstream: null, branch: 'main' });
    expect(body.conditions).toEqual([]);
  });

  it('RP-32: an upstream whose tracking ref is missing reads no-upstream and is still named', async () => {
    const c = await start({
      prepare: (fx) => git(fx.dir, ['update-ref', '-d', 'refs/remotes/origin/main'], fx.env).then(() => {}),
    });
    expect((await header(c)).repository).toMatchObject({
      copy: 'no-upstream',
      upstream: 'origin/main',
      ahead: 0,
      behind: 0,
    });
  });

  it('a local upstream (branch.<b>.remote = .) counts as none', async () => {
    const c = await start({
      prepare: async (fx) => {
        await git(fx.dir, ['branch', '-q', 'base'], fx.env);
        await git(fx.dir, ['branch', '-q', '--set-upstream-to=base', 'main'], fx.env);
      },
    });
    expect((await header(c)).repository).toMatchObject({ copy: 'no-upstream', upstream: null });
  });
});

describe('the copy reasons of the descriptors (spec-003 §6 rule 4)', () => {
  it('behind {commits}, diverged, detached; ahead and in sync leave the verb enabled', async () => {
    const c = await start();
    expect(await approveVerb(c)).toMatchObject({ enabled: true });
    await localCommit(c, 'one.md');
    await c.check();
    expect(await approveVerb(c)).toMatchObject({ enabled: true });
    await git(c.fx.dir, ['reset', '-q', '--hard', 'origin/main'], c.fx.env);
    await c.remoteCommit('r1.md', '1\n');
    await c.remoteCommit('r2.md', '2\n');
    await c.op('fetch');
    expect(await approveVerb(c)).toMatchObject({ enabled: false, reason: { code: 'copy-behind', commits: 2 } });
    const today = await c.get(`/api/p/${c.pid}/today`);
    expect(JSON.stringify(today.body)).toContain('copy-behind');
    await localCommit(c, 'two.md');
    await c.check();
    expect(await approveVerb(c)).toMatchObject({ enabled: false, reason: { code: 'copy-diverged' } });
    await git(c.fx.dir, ['checkout', '-q', '--detach'], c.fx.env);
    await c.check();
    expect(await approveVerb(c)).toMatchObject({ enabled: false, reason: { code: 'copy-detached' } });
  });
});

describe('the key and the CLI cache (spec-010 §2, D33-6)', () => {
  it('moves on a fetch that moves the tracking ref, an upstream change, a branch switch, a remote add or remove; not on a re-read', async () => {
    const c = await start();
    const keys = [(await header(c)).repository.state as string];
    const step = async (label: string, change: () => Promise<unknown>) => {
      await change();
      await c.check();
      const key = (await header(c)).repository.state as string;
      // Another state than the previous one (removing the remote again returns to an earlier state).
      expect(key, label).not.toBe(keys.at(-1));
      keys.push(key);
    };
    await c.check();
    expect((await header(c)).repository.state, 're-read').toBe(keys[0]);
    await step('fetch', async () => {
      await c.remoteCommit('k.md', 'k\n');
      await git(c.fx.dir, ['fetch', '-q', 'origin'], c.fx.env);
    });
    await step('remote add', () => git(c.fx.dir, ['remote', 'add', 'other', c.fx.remoteUrl], c.fx.env));
    await step('remote remove', () => git(c.fx.dir, ['remote', 'remove', 'other'], c.fx.env));
    await step('upstream change', () => git(c.fx.dir, ['branch', '--unset-upstream'], c.fx.env));
    await step('branch switch', () => git(c.fx.dir, ['checkout', '-q', '-b', 'feature'], c.fx.env));
  });

  it('a fetch that moves only a tracking ref re-runs no CLI read; the descriptors follow the copy', async () => {
    const c = await start();
    await c.warm();
    await c.remoteCommit('n.md', 'n\n');
    await git(c.fx.dir, ['fetch', '-q', 'origin'], c.fx.env);
    await c.check();
    const p = await c.processes(async () => {
      expect(await approveVerb(c)).toMatchObject({ reason: { code: 'copy-behind', commits: 1 } });
      await header(c);
    });
    expect(p.wingfoil).toBe(0);
  });
});

describe('spec-004 §4 row 8 on the FRESH state (TT-STATE-04)', () => {
  it('the copy moved behind after the last observed state: the write is refused 409 stale-copy, 0 wingfoil processes', async () => {
    const c = await start();
    await c.warm();
    // The tracking ref moves without the watcher (off in these tests) or a check seeing it.
    await c.remoteCommit('fresh.md', 'f\n');
    await git(c.fx.dir, ['fetch', '-q', 'origin'], c.fx.env);
    const head = await c.head();
    const p = await c.processes(async () => {
      const res = await c.write('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        error: { code: 'stale-copy', message: 'The copy is behind, diverged or on a detached HEAD' },
      });
    });
    // Row 8 is decided on the fresh state before the element is listed again: no wingfoil process
    // at all (review round 1 F3).
    expect(p.wingfoil).toBe(0);
    expect(await c.head()).toBe(head);
  });
});
