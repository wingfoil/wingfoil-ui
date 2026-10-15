// spec-010 §4–§5, §8, spec-004 §4 v0.2 (task-033; TT-STATE-04, TT-SEC-08, REQ-INT-06, RP-14, RP-34,
// RP-36, RP-37, RP-40; D33-1, D33-2, D33-3, D33-5, D33-8, D33-9, D33-11, D33-12; bug-010, bug-012,
// bug-013) — `POST /api/p/:pid/git/fetch`, `/git/update`, `/git/push` on copies of the kanban
// fixture, each with its own bare `origin` that "another clone" moves: every refusal with its code
// and 0 transport processes, nothing to do without a transport process, the commands that run, the
// sync status and its `repo` events, git's message redacted and never logged, cancellation, the
// identity rule over the five write routes, and the allow-list of every git process.
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies, each validated against its schema */
import type { FastifyInstance } from 'fastify';
import { access, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { GIT_ALLOWED_SUBCOMMANDS, gitSubcommand } from '../../../server/src/git/git.js';
import { fetchArgs, pullArgs, pushArgs } from '../../../server/src/git/transport.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { GitTransport } from '../../../server/src/writes/transport.js';
import { buildFixture, OUTSIDER, type Fixture } from '../../harness/fixtures/index.js';
import { git, run } from '../../harness/run.js';
import { pinnedCli } from '../../harness/cli.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';
import { startGitHttpRemote } from '../../e2e/support/git-http.js';
import { processKind } from '../snapshot/support.js';
import { startGitConsole, type GitConsole, type GitConsoleOptions } from './git-console.js';

const LOGIN = 'task-001-login-form'; // kanban: pending (gate); Morgan holds approver
const TIMEOUT = 'task-004-session-timeout'; // kanban: draft
const SECRET = 'marker-reason-task-033-9137';

let ws: TempWorkspace;
let template: Fixture;
const registries: Snapshots[] = [];
const apps: FastifyInstance[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-033-git-routes-');
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

const repoEvents = (c: GitConsole) => c.events.filter((e) => e.event === 'repo');
const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

/** Run the pinned CLI in the fixture, as a user would in a terminal. */
async function wingfoil(fx: Fixture, args: readonly string[]): Promise<void> {
  await run(process.execPath, [pinnedCli().script, ...args, '--format', 'json', '--no-interactive'], {
    cwd: fx.dir,
    env: fx.env,
  });
}

describe('spec-004 §4 rows 3–4 — the project and the body (D33-9)', () => {
  it('an unknown project → 404 before the body, 0 processes', async () => {
    const c = await start();
    for (const op of ['fetch', 'update', 'push']) {
      const p = await c.processes(async () => {
        const res = await c.op(op, { pid: 'p_000000000000', payload: '{"x":1}', contentType: 'application/json' });
        expect(res).toEqual({ status: 404, body: { error: { code: 'not-found', message: 'Not found' } } });
      });
      expect(p.git + p.wingfoil).toBe(0);
    }
  });

  it('a body other than none or {} → 400 invalid-request, 0 processes; none and {} are accepted', async () => {
    const c = await start();
    for (const payload of ['{"remote":"origin"}', '[]', '"x"', '1']) {
      const p = await c.processes(async () => {
        const res = await c.op('fetch', { payload, contentType: 'application/json' });
        expect(res.status, payload).toBe(400);
        expect(res.body.error.code).toBe('invalid-request');
      });
      expect(p.git + p.wingfoil).toBe(0);
    }
    expect((await c.op('fetch')).status).toBe(200);
    expect((await c.op('fetch', { payload: '{}', contentType: 'application/json' })).status).toBe(200);
  });
});

describe('fetch (spec-010 §4, §5, RP-36, RP-40)', () => {
  it('an up-to-date copy: 200, one fetch with the §4 arguments, lastSuccessAt set, no repo event for it alone', async () => {
    const c = await start();
    await c.warm();
    const before = repoEvents(c).length;
    const at = Date.now();
    const p = await c.processes(async () => {
      const res = await c.op('fetch');
      expect(res.status).toBe(200);
      expect(res.body.repository).toMatchObject({
        copy: 'in-sync',
        branch: 'main',
        upstream: 'origin/main',
        ahead: 0,
        behind: 0,
      });
      expect(Date.parse(res.body.repository.sync.fetch.lastSuccessAt)).toBeGreaterThanOrEqual(
        Math.floor(at / 1000) * 1000,
      );
      expect(res.body.repository.sync.fetch.lastError).toBeNull();
    });
    expect(p.transport).toBe(1);
    const fetch = c.runner.spawned.find((r) => gitSubcommand(r.args) === 'fetch')!;
    expect(fetch.args).toEqual(fetchArgs('origin'));
    expect(repoEvents(c).length).toBe(before);
    const header = await c.get(`/api/p/${c.pid}`);
    expect(header.body.repository.sync.fetch.lastSuccessAt).not.toBeNull();
  });

  it('the remote moved: the fetch makes the copy behind and the key moves (repo event, spec-010 §2)', async () => {
    const c = await start();
    await c.warm();
    const state = (await c.get(`/api/p/${c.pid}`)).body.repository.state as string;
    await c.remoteCommit('notes-from-jordan.md', 'hello\n');
    const res = await c.op('fetch');
    expect(res.body.repository).toMatchObject({ copy: 'behind', behind: 1, ahead: 0 });
    expect(res.body.repository.state).not.toBe(state);
    expect(repoEvents(c).at(-1)).toEqual({ event: 'repo', data: { pid: c.pid, state: res.body.repository.state } });
  });

  it('no remote → 409 no-remote; several remotes, none origin, no upstream → 409 no-fetch-target; 0 transport', async () => {
    const c = await start({ prepare: (fx) => git(fx.dir, ['remote', 'remove', 'origin'], fx.env).then(() => {}) });
    let p = await c.processes(async () => {
      expect((await c.op('fetch')).body.error.code).toBe('no-remote');
    });
    expect(p.transport).toBe(0);
    await git(c.fx.dir, ['remote', 'add', 'a', c.fx.remoteUrl], c.fx.env);
    await git(c.fx.dir, ['remote', 'add', 'b', c.fx.remoteUrl], c.fx.env);
    p = await c.processes(async () => {
      const res = await c.op('fetch');
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('no-fetch-target');
    });
    expect(p.transport).toBe(0);
  });

  it('RP-36: with no upstream, the only remote (whatever its name)', async () => {
    const c = await start({
      prepare: async (fx) => {
        await git(fx.dir, ['remote', 'rename', 'origin', 'mine'], fx.env);
        await git(fx.dir, ['branch', '--unset-upstream'], fx.env);
      },
    });
    expect((await c.op('fetch')).status).toBe(200);
    expect(c.runner.spawned.find((r) => gitSubcommand(r.args) === 'fetch')!.args).toEqual(fetchArgs('mine'));
  });

  it('git refuses → 422 git-refused, the message redacted (D33-5) and kept as lastError, never logged; one repo event per change', async () => {
    const log: string[] = [];
    const c = await start({ log });
    await c.warm();
    const missing = path.join(c.fx.dir, `${SECRET}.git`);
    await git(c.fx.dir, ['remote', 'set-url', 'origin', missing], c.fx.env);
    await c.check();
    const before = repoEvents(c).length;
    const res = await c.op('fetch');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('git-refused');
    expect(res.body.error.message).toContain(`<project>/${SECRET}.git`);
    expect(res.body.error.message).not.toContain(c.fx.dir);
    const header = (await c.get(`/api/p/${c.pid}`)).body;
    expect(header.repository.sync.fetch.lastError).toEqual({ message: res.body.error.message, at: expect.any(String) });
    expect(repoEvents(c).length).toBe(before + 1);
    // The same failure again: no change, no event.
    expect((await c.op('fetch')).status).toBe(422);
    expect(repoEvents(c).length).toBe(before + 1);
    // Fixed: the error is cleared, one event.
    await git(c.fx.dir, ['remote', 'set-url', 'origin', c.fx.remoteUrl], c.fx.env);
    await c.check();
    const cleared = repoEvents(c).length;
    expect((await c.op('fetch')).body.repository.sync.fetch.lastError).toBeNull();
    expect(repoEvents(c).length).toBe(cleared + 1);
    const text = log.join('');
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain(c.fx.dir);
    expect(text).toContain('"op":"fetch"');
  });

  it('D33-2 (bug-013): GIT_ALLOW_PROTOCOL=ext in the server environment does not let an ext:: remote run', async () => {
    const marker = path.join(await realpath(ws.dir), `ext-marker-${Date.now()}`);
    const c = await start({ env: (fx) => ({ ...fx.env, GIT_ALLOW_PROTOCOL: 'ext:file' }) });
    await git(c.fx.dir, ['remote', 'set-url', 'origin', `ext::sh -c touch% ${marker}`], c.fx.env);
    const res = await c.op('fetch');
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/transport 'ext' not allowed/);
    expect(await exists(marker)).toBe(false);
  });

  it.runIf(process.platform !== 'win32' && process.getuid?.() !== 0)(
    'D33-1 (bug-010): a local remote owned by another user → 409 remote-not-owned, 0 transport',
    async () => {
      const c = await start();
      // The file-system root belongs to root, not to the user running the tests.
      await git(c.fx.dir, ['remote', 'set-url', 'origin', `file://${path.parse(c.fx.dir).root}`], c.fx.env);
      const p = await c.processes(async () => {
        const res = await c.op('fetch');
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('remote-not-owned');
      });
      expect(p.transport).toBe(0);
    },
  );

  it('RP-37: a fetch is cancelled when the client leaves — the process group is killed, no lastError', async () => {
    const remote = await startGitHttpRemote(path.join(await realpath(ws.dir), 'http'), { hold: true });
    try {
      const c = await start();
      await git(c.fx.dir, ['remote', 'set-url', 'origin', `${remote.origin}/held.git`], c.fx.env);
      const entry = c.store.get(c.pid)!;
      const transport = new GitTransport({ snapshots: c.snapshots, writeLock: c.writeLock, env: c.fx.env });
      const abort = new AbortController();
      const log = { info: () => {}, warn: () => {} };
      const outcome = transport.run(entry, 'fetch', log, abort.signal);
      await expect.poll(() => remote.requests(), { timeout: 60_000 }).toBeGreaterThan(0);
      abort.abort();
      const answered = await outcome;
      expect(answered.status).toBe(500);
      expect(c.runner.running).toBe(0);
      expect((await c.get(`/api/p/${c.pid}`)).body.repository.sync.fetch.lastError).toBeNull();
    } finally {
      remote.release();
      await remote.close();
    }
  });
});

describe('update (spec-010 §4–§5; TT-STATE-04; Y-05.1, Y-06.1, Y-06.2, G-12.x API side)', () => {
  it('in sync or only ahead: 200 with nothing to do, 0 transport processes (D33-9)', async () => {
    const c = await start();
    await c.warm();
    let p = await c.processes(async () => expect((await c.op('update')).status).toBe(200));
    expect(p.transport).toBe(0);
    await writeFile(path.join(c.fx.dir, 'local.md'), 'x\n');
    await git(c.fx.dir, ['add', 'local.md'], c.fx.env);
    await git(c.fx.dir, ['commit', '-qm', 'local'], c.fx.env);
    await c.check();
    p = await c.processes(async () => {
      const res = await c.op('update');
      expect(res.body.repository.copy).toBe('ahead');
    });
    expect(p.transport).toBe(0);
  });

  it('G-12.1/Y-05.1: behind → a governed write is refused 409 stale-copy; the update fast-forwards; the write then succeeds', async () => {
    const c = await start();
    await c.remoteCommit('from-jordan.md', 'hi\n');
    expect((await c.op('fetch')).body.repository.copy).toBe('behind');
    await c.warm();
    const p = await c.processes(async () => {
      const res = await c.write('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('stale-copy');
    });
    expect(p.wingfoil).toBe(0);
    const remoteHead = (await git(c.fx.remoteDir, ['rev-parse', 'main'], c.fx.env)).stdout.trim();
    const u = await c.processes(async () => {
      const res = await c.op('update');
      expect(res.status).toBe(200);
      expect(res.body.repository).toMatchObject({ copy: 'in-sync', behind: 0 });
    });
    expect(u.transport).toBe(1);
    expect(c.runner.spawned.find((r) => gitSubcommand(r.args) === 'pull')!.args).toEqual(pullArgs());
    expect(await c.head()).toBe(remoteHead);
    expect(await readFile(path.join(c.fx.dir, 'from-jordan.md'), 'utf8')).toBe('hi\n');
    await c.warm();
    expect((await c.write('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' })).status).toBe(200);
  });

  it('Y-06.1: diverged → 409 diverged, 0 transport, kept as update.lastError; HEAD unchanged', async () => {
    const c = await start();
    await c.remoteCommit('theirs.md', 'a\n');
    await writeFile(path.join(c.fx.dir, 'mine.md'), 'b\n');
    await git(c.fx.dir, ['add', 'mine.md'], c.fx.env);
    await git(c.fx.dir, ['commit', '-qm', 'mine'], c.fx.env);
    expect((await c.op('fetch')).body.repository).toMatchObject({ copy: 'diverged', ahead: 1, behind: 1 });
    const head = await c.head();
    const p = await c.processes(async () => {
      const res = await c.op('update');
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('diverged');
    });
    expect(p.transport).toBe(0);
    expect(await c.head()).toBe(head);
    expect((await c.get(`/api/p/${c.pid}`)).body.repository.sync.update.lastError).toMatchObject({ code: 'diverged' });
    // A governed write is refused too (row 8).
    await c.warm();
    expect((await c.write('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' })).body.error.code).toBe(
      'stale-copy',
    );
  });

  it('Y-06.2: local changes to an incoming file → 409 local-changes-in-the-way with the relative files; others do not refuse (Y-05.3)', async () => {
    const c = await start();
    await c.remoteCommit('incoming.md', 'theirs\n');
    await writeFile(path.join(c.fx.dir, 'incoming.md'), 'mine\n');
    await writeFile(path.join(c.fx.dir, 'unrelated.md'), 'mine too\n');
    await c.op('fetch');
    const p = await c.processes(async () => {
      const res = await c.op('update');
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({ code: 'local-changes-in-the-way', detail: { files: ['incoming.md'] } });
    });
    expect(p.transport).toBe(0);
    expect(await readFile(path.join(c.fx.dir, 'incoming.md'), 'utf8')).toBe('mine\n');
    const header = (await c.get(`/api/p/${c.pid}`)).body;
    expect(header.repository.sync.update.lastError).toMatchObject({
      code: 'local-changes-in-the-way',
      detail: { files: ['incoming.md'] },
    });
    // The file in the way removed: the update runs, the unrelated change stays, the error is cleared.
    await rm(path.join(c.fx.dir, 'incoming.md'));
    await c.check();
    const res = await c.op('update');
    expect(res.status).toBe(200);
    expect(res.body.repository.sync.update.lastError).toBeNull();
    expect(await readFile(path.join(c.fx.dir, 'unrelated.md'), 'utf8')).toBe('mine too\n');
  });

  it('Y-01.3: detached HEAD → 409 detached-head; no upstream → 409 no-upstream (update and push), 0 transport', async () => {
    const c = await start({ prepare: (fx) => git(fx.dir, ['checkout', '-q', '--detach'], fx.env).then(() => {}) });
    const header = (await c.get(`/api/p/${c.pid}`)).body;
    expect(header.repository).toMatchObject({ copy: 'detached', branch: null, upstream: null });
    for (const op of ['update', 'push']) {
      const p = await c.processes(async () => expect((await c.op(op)).body.error.code).toBe('detached-head'));
      expect(p.transport).toBe(0);
    }
    await git(c.fx.dir, ['checkout', '-q', 'main'], c.fx.env);
    await git(c.fx.dir, ['branch', '--unset-upstream'], c.fx.env);
    await c.check();
    for (const op of ['update', 'push']) {
      const p = await c.processes(async () => expect((await c.op(op)).body.error.code).toBe('no-upstream'));
      expect(p.transport).toBe(0);
    }
  });

  it('RP-37: an update is not cancelled when the client leaves — it runs to completion', async () => {
    const c = await start();
    await c.remoteCommit('late.md', 'x\n');
    await c.op('fetch');
    const transport = new GitTransport({ snapshots: c.snapshots, writeLock: c.writeLock, env: c.fx.env });
    const abort = new AbortController();
    abort.abort();
    const outcome = await transport.run(
      c.store.get(c.pid)!,
      'update',
      { info: () => {}, warn: () => {} },
      abort.signal,
    );
    expect(outcome.status).toBe(200);
    expect(await exists(path.join(c.fx.dir, 'late.md'))).toBe(true);
  });
});

describe('push (spec-010 §4–§5, D33-8)', () => {
  it('ahead → 200 with the §4 arguments, the remote holds the commit, the copy in sync; ahead = 0 → 0 transport', async () => {
    const c = await start();
    await writeFile(path.join(c.fx.dir, 'pushed.md'), 'x\n');
    await git(c.fx.dir, ['add', 'pushed.md'], c.fx.env);
    await git(c.fx.dir, ['commit', '-qm', 'to push'], c.fx.env);
    await c.check();
    const res = await c.op('push');
    expect(res.status).toBe(200);
    expect(res.body.repository).toMatchObject({ copy: 'in-sync', ahead: 0 });
    expect(c.runner.spawned.find((r) => gitSubcommand(r.args) === 'push')!.args).toEqual(
      pushArgs('origin', 'refs/heads/main'),
    );
    expect((await git(c.fx.remoteDir, ['rev-parse', 'main'], c.fx.env)).stdout.trim()).toBe(await c.head());
    const p = await c.processes(async () => expect((await c.op('push')).status).toBe(200));
    expect(p.transport).toBe(0);
  });

  it('never forced: diverged → git refuses (422 git-refused), the remote is unchanged', async () => {
    const c = await start();
    await c.remoteCommit('theirs.md', 'a\n');
    await writeFile(path.join(c.fx.dir, 'mine.md'), 'b\n');
    await git(c.fx.dir, ['add', 'mine.md'], c.fx.env);
    await git(c.fx.dir, ['commit', '-qm', 'mine'], c.fx.env);
    await c.op('fetch');
    const remoteHead = (await git(c.fx.remoteDir, ['rev-parse', 'main'], c.fx.env)).stdout.trim();
    const res = await c.op('push');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('git-refused');
    expect((await git(c.fx.remoteDir, ['rev-parse', 'main'], c.fx.env)).stdout.trim()).toBe(remoteHead);
  });

  it('a merge ref git could read as two refs or a forced update → no upstream, 0 transport', async () => {
    const c = await start();
    await git(c.fx.dir, ['config', 'branch.main.merge', '+refs/heads/main:refs/heads/other'], c.fx.env);
    await c.check();
    const p = await c.processes(async () => expect((await c.op('push')).body.error.code).toBe('no-upstream'));
    expect(p.transport).toBe(0);
  });
});

describe('TT-SEC-08 — the five write routes for unidentified users (RP-14, RP-34, RP-48; S-13.2, S-15.2, T-01.2, C-08.x, C-09.x API side)', () => {
  const kinds: [string, GitConsoleOptions][] = [
    ['not-in-team', { as: OUTSIDER.email }],
    ['no-identity', { as: null }],
    [
      'ambiguous',
      {
        as: 'shared@example.test',
        prepare: async (fx) => {
          for (const [name, roles] of [
            ['Jordan', 'developer'],
            ['Sam', 'reviewer'],
          ] as const) {
            await wingfoil(fx, ['dna', 'remove', 'team.members', '--value', name]);
            await wingfoil(fx, [
              'dna',
              'add',
              'team.members',
              '--value',
              name,
              '--entry-email',
              'shared@example.test',
              '--entry-roles',
              roles,
            ]);
          }
          // `dna add` / `dna remove` commit themselves: published so the copy stays in sync.
          await git(fx.dir, ['push', '-q', 'origin', 'HEAD:main'], fx.env);
        },
      },
    ],
  ];

  it.each(kinds)(
    '%s: update, push, submit, approve, reject → 403 not-in-team with 0 processes; fetch → 200',
    async (kind, options) => {
      const c = await start(options);
      await c.warm();
      expect((await c.get(`/api/p/${c.pid}`)).body.identity.kind).toBe(kind);
      const before = await c.head();
      for (const op of ['update', 'push']) {
        const p = await c.processes(async () => {
          const res = await c.op(op);
          expect(res.status).toBe(403);
          expect(res.body.error.code).toBe('not-in-team');
        });
        expect(p.git + p.wingfoil, op).toBe(0);
      }
      for (const [verb, eid, body] of [
        ['submit', TIMEOUT, { expectedStatus: 'draft' }],
        ['approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' }],
        ['reject', LOGIN, { expectedStatus: 'pending', reason: 'no' }],
      ] as const) {
        const p = await c.processes(async () => {
          const res = await c.write(verb, eid, body);
          expect(res.status).toBe(403);
          expect(res.body.error.code).toBe('not-in-team');
        });
        expect(p.git + p.wingfoil, verb).toBe(0);
      }
      expect(await c.head()).toBe(before);
      expect((await c.op('fetch')).status).toBe(200);
    },
  );

  it('the identity is checked again under the lock on the fresh state (D33-12)', async () => {
    const c = await start();
    await c.warm();
    // The user changes between the page's read and the write: the fresh state decides.
    await git(c.fx.dir, ['config', 'user.email', OUTSIDER.email], c.fx.env);
    const res = await c.op('update');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('not-in-team');
  });
});

describe('REQ-INT-06 — every git process of the git routes uses an allowed subcommand', () => {
  it('fetch, update and push on a behind and then ahead copy', async () => {
    const c = await start();
    await c.remoteCommit('a.md', 'a\n');
    await c.op('fetch');
    await c.op('update');
    await writeFile(path.join(c.fx.dir, 'b.md'), 'b\n');
    await git(c.fx.dir, ['add', 'b.md'], c.fx.env);
    await git(c.fx.dir, ['commit', '-qm', 'b'], c.fx.env);
    await c.check();
    await c.op('push');
    const gits = c.runner.spawned.filter((r) => processKind(r) === 'git');
    expect(gits.filter((r) => ['fetch', 'pull', 'push'].includes(gitSubcommand(r.args)!))).toHaveLength(3);
    for (const r of gits) expect(GIT_ALLOWED_SUBCOMMANDS, r.args.join(' ')).toContain(gitSubcommand(r.args));
  });
});

describe('bug-012 (D33-5) — no local absolute path in a cli-refused body, per route family', () => {
  const refusing = (words: string) => async (request: { args: readonly string[]; cwd: string }) => {
    if (!request.args.join(' ').includes(words)) return undefined;
    const stderr = JSON.stringify({
      error: `Command failed: git -C ${request.cwd} commit -m x\nfatal: ${request.cwd}/.git/index.lock`,
    });
    return { exitCode: 1, signal: null, stdout: '', stderr, ended: 'exit' as const, durationMs: 1 };
  };

  it('a read route (GET …/config, dna show refused)', async () => {
    const c = await start({ intercept: refusing('dna show') });
    const res = await c.get(`/api/p/${c.pid}/config`);
    expect(res.status).toBe(200);
    expect(res.body.dna.error).toMatchObject({ code: 'cli-refused' });
    expect(res.body.dna.error.message).toContain('git -C <project> commit');
    expect(JSON.stringify(res.body)).not.toContain(c.fx.dir);
  });

  it('a governed write (approve refused)', async () => {
    const c = await start({ intercept: refusing('memory approve') });
    await c.warm();
    const res = await c.write('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('cli-refused');
    expect(res.body.error.message).toContain('<project>/.git/index.lock');
    expect(JSON.stringify(res.body)).not.toContain(c.fx.dir);
  });
});
