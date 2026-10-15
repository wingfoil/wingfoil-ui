// spec-010 §4–§5, §8, spec-004 §4 v0.2 (task-033; TT-STATE-04, TT-SEC-08, REQ-INT-06, RP-14, RP-34,
// RP-36, RP-37, RP-40; D33-1, D33-2, D33-3, D33-5, D33-8, D33-9, D33-11, D33-12; bug-010, bug-012,
// bug-013) — `POST /api/p/:pid/git/fetch`, `/git/update`, `/git/push` on copies of the kanban
// fixture, each with its own bare `origin` that "another clone" moves: every refusal with its code
// and 0 transport processes, nothing to do without a transport process, the commands that run, the
// sync status and its `repo` events, git's message redacted and never logged, cancellation, the
// identity rule over the five write routes, and the allow-list of every git process.
import type { FastifyInstance } from 'fastify';
import { access, chmod, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
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

const posix = process.platform !== 'win32' && process.getuid?.() !== 0;
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
    // A folder of the user's that is not a repository (a missing local path fails closed, D33-1).
    const missing = path.join(c.fx.dir, `${SECRET}.git`);
    await mkdir(missing);
    await git(c.fx.dir, ['remote', 'set-url', 'origin', missing], c.fx.env);
    await c.check();
    const before = repoEvents(c).length;
    const res = await c.op('fetch');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('git-refused');
    // R1: a local remote's path is shown as <remote>, wherever it is.
    expect(res.body.error.message).toContain('<remote>');
    expect(res.body.error.message).not.toContain(c.fx.dir);
    expect(res.body.error.message).not.toContain(SECRET);
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
      await expectGroupGone(c, 'fetch');
      expect((await c.get(`/api/p/${c.pid}`)).body.repository.sync.fetch.lastError).toBeNull();
    } finally {
      remote.release();
      await remote.close();
    }
  });
});

/** Review round 1 F4: no process of the transport's group survives (the git-remote-http child included). */
async function expectGroupGone(c: GitConsole, op: string): Promise<void> {
  const record = c.runner.spawned.find((r) => gitSubcommand(r.args) === op)!;
  expect(record.pid).toBeDefined();
  const alive = () => {
    try {
      process.kill(-record.pid!, 0);
      return true;
    } catch {
      return false;
    }
  };
  await expect.poll(alive, { timeout: 15_000 }).toBe(false);
}

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

  it('F6: a reason WingFoil refuses as a usage error (exit 2) is answered without the local folders', async () => {
    const c = await start({
      intercept: async (request) => {
        if (!request.args.join(' ').includes('memory approve')) return undefined;
        const stderr = JSON.stringify({
          error: `invalid flag value: --reason (see ${request.cwd}/.wingfoil/memory.yaml)`,
        });
        return { exitCode: 2, signal: null, stdout: '', stderr, ended: 'exit' as const, durationMs: 1 };
      },
    });
    await c.warm();
    const res = await c.write('approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toContain('<project>/.wingfoil/memory.yaml');
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

describe('review round 1', () => {
  it.runIf(posix)('S1: a file:// URL with a host to another user’s folder → 409 remote-not-owned (fetch)', async () => {
    const c = await start();
    await git(c.fx.dir, ['remote', 'set-url', 'origin', `file://127.0.0.1${path.parse(c.fx.dir).root}`], c.fx.env);
    const p = await c.processes(async () => expect((await c.op('fetch')).body.error.code).toBe('remote-not-owned'));
    expect(p.transport).toBe(0);
  });

  it.runIf(posix)(
    'S2: a second push URL to another user’s folder → 409 remote-not-owned (push), the first one ours',
    async () => {
      const c = await start();
      await git(c.fx.dir, ['remote', 'set-url', '--add', '--push', 'origin', c.fx.remoteDir], c.fx.env);
      await git(c.fx.dir, ['remote', 'set-url', '--add', '--push', 'origin', path.parse(c.fx.dir).root], c.fx.env);
      await writeFile(path.join(c.fx.dir, 'p.md'), 'p\n');
      await git(c.fx.dir, ['add', 'p.md'], c.fx.env);
      await git(c.fx.dir, ['commit', '-qm', 'p'], c.fx.env);
      await c.check();
      const p = await c.processes(async () => expect((await c.op('push')).body.error.code).toBe('remote-not-owned'));
      expect(p.transport).toBe(0);
    },
  );

  it.runIf(posix)(
    'S3/S5: a remote written without .git, or through a link and .., to another user’s folder → refused',
    async () => {
      const c = await start();
      const base = path.dirname(c.fx.dir);
      await symlink(path.parse(base).root, path.join(base, 'theirs.git'));
      await symlink(path.parse(base).root, path.join(base, 'link'));
      for (const url of [path.join(base, 'theirs'), `${path.join(base, 'link')}/..`]) {
        await git(c.fx.dir, ['remote', 'set-url', 'origin', url], c.fx.env);
        await c.check();
        expect((await c.op('fetch')).body.error.code, url).toBe('remote-not-owned');
      }
    },
  );

  it.runIf(posix)(
    'S4/F1: a relative remote of a project in a sub-folder is resolved against the repository’s top level',
    async () => {
      const top = path.join(await realpath(ws.dir), 'sub-folder-repo');
      const env = template.env;
      await mkdir(path.join(top, 'proj'), { recursive: true });
      await git(top, ['init', '-q', '-b', 'main'], env);
      await writeFile(path.join(top, 'proj', 'a.md'), 'a\n');
      await git(top, ['add', '-A'], env);
      await git(top, ['-c', 'user.email=a@example.test', '-c', 'user.name=A', 'commit', '-qm', 'a'], env);
      // `rel.git` next to the project is ours; at the top level it is another user's folder.
      await git(path.join(top, 'proj'), ['init', '-q', '--bare', 'rel.git'], env);
      await symlink(path.parse(top).root, path.join(top, 'rel.git'));
      await git(top, ['remote', 'add', 'origin', 'rel.git'], env);
      const { InProcessWriteLock } = await import('../../../server/src/process/write-lock.js');
      const { createMemoryStateStore } = await import('../../../server/src/state/memory-store.js');
      const { auditedSnapshots } = await import('../snapshot/support.js');
      const audited = auditedSnapshots(env);
      registries.push(audited.snapshots);
      const store = await createMemoryStateStore();
      const entry = await store.add({ path: path.join(top, 'proj'), name: 'proj', remote: '' });
      const transport = new GitTransport({ snapshots: audited.snapshots, writeLock: new InProcessWriteLock(), env });
      const outcome = await transport.run(entry, 'fetch', { info: () => {}, warn: () => {} });
      expect(outcome.body).toMatchObject({ error: { code: 'remote-not-owned' } });
      expect(audited.runner.spawned.filter((r) => gitSubcommand(r.args) === 'fetch')).toEqual([]);
    },
  );

  it('F2: a git read failing under the lock → 500 internal, git’s message never logged', async () => {
    const log: string[] = [];
    let armed = false;
    const c = await start({
      log,
      intercept: async (request) => {
        if (!armed || gitSubcommand(request.args) !== 'remote') return undefined;
        return {
          exitCode: 128,
          signal: null,
          stdout: '',
          stderr: `fatal: ${SECRET} in ${request.cwd}`,
          ended: 'exit',
          durationMs: 1,
        };
      },
    });
    await c.warm();
    armed = true;
    const res = await c.op('fetch');
    expect(res).toEqual({ status: 500, body: { error: { code: 'internal', message: 'Internal error' } } });
    const text = log.join('');
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain(c.fx.dir);
    expect(text).toContain('"project"');
  });

  it.each([
    [
      'behind',
      async (c: GitConsole) => {
        await c.remoteCommit('b.md', 'b\n');
        await git(c.fx.dir, ['fetch', '-q', 'origin'], c.fx.env);
      },
    ],
    [
      'diverged',
      async (c: GitConsole) => {
        await c.remoteCommit('b.md', 'b\n');
        await git(c.fx.dir, ['fetch', '-q', 'origin'], c.fx.env);
        await writeFile(path.join(c.fx.dir, 'm.md'), 'm\n');
        await git(c.fx.dir, ['add', 'm.md'], c.fx.env);
        await git(c.fx.dir, ['commit', '-qm', 'm'], c.fx.env);
      },
    ],
    ['detached', (c: GitConsole) => git(c.fx.dir, ['checkout', '-q', '--detach'], c.fx.env)],
  ] as const)('F3: %s × submit, approve, reject → 409 stale-copy, 0 wingfoil processes', async (_copy, make) => {
    const c = await start();
    await make(c);
    await c.check();
    await c.warm();
    for (const [verb, eid, body] of [
      ['submit', TIMEOUT, { expectedStatus: 'draft' }],
      ['approve', LOGIN, { expectedStatus: 'pending', reason: 'ok' }],
      ['reject', LOGIN, { expectedStatus: 'pending', reason: 'no' }],
    ] as const) {
      const p = await c.processes(async () => {
        const res = await c.write(verb, eid, body);
        expect(res.status, verb).toBe(409);
        expect(res.body.error.code).toBe('stale-copy');
      });
      expect(p.wingfoil, verb).toBe(0);
    }
  });

  it('F4: a push is cancelled when the client leaves — no process of its group survives', async () => {
    const remote = await startGitHttpRemote(path.join(await realpath(ws.dir), 'http-push'), { hold: true });
    try {
      const c = await start();
      await git(c.fx.dir, ['remote', 'set-url', 'origin', `${remote.origin}/held.git`], c.fx.env);
      await writeFile(path.join(c.fx.dir, 'held.md'), 'h\n');
      await git(c.fx.dir, ['add', 'held.md'], c.fx.env);
      await git(c.fx.dir, ['commit', '-qm', 'held'], c.fx.env);
      const transport = new GitTransport({ snapshots: c.snapshots, writeLock: c.writeLock, env: c.fx.env });
      const abort = new AbortController();
      const outcome = transport.run(c.store.get(c.pid)!, 'push', { info: () => {}, warn: () => {} }, abort.signal);
      await expect.poll(() => remote.requests(), { timeout: 60_000 }).toBeGreaterThan(0);
      abort.abort();
      expect((await outcome).status).toBe(500);
      expect(c.runner.running).toBe(0);
      await expectGroupGone(c, 'push');
    } finally {
      remote.release();
      await remote.close();
    }
  });

  it('S9: a JSON null body → 400 invalid-request', async () => {
    const c = await start();
    const res = await c.op('fetch', { payload: 'null', contentType: 'application/json' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid-request');
  });

  it.runIf(posix)(
    'R3: a relative PATH entry never reaches the transport (an `ssh` in the repository does not run)',
    async () => {
      const marker = path.join(await realpath(ws.dir), `ssh-ran-${Date.now()}`);
      const c = await start({ env: (fx) => ({ ...fx.env, PATH: `.:${fx.env.PATH ?? ''}` }) });
      await writeFile(path.join(c.fx.dir, 'ssh'), `#!/bin/sh\ntouch '${marker}'\nexit 1\n`);
      await chmod(path.join(c.fx.dir, 'ssh'), 0o755);
      await git(c.fx.dir, ['remote', 'set-url', 'origin', 'ssh://git@example.invalid/x.git'], c.fx.env);
      await c.check();
      expect((await c.op('fetch')).status).toBe(422);
      expect(await exists(marker)).toBe(false);
    },
  );
});

describe('review round 2', () => {
  it('F9: a local remote with no folder git could read → 409 remote-unreadable, never the "another user" text', async () => {
    const c = await start();
    await git(c.fx.dir, ['remote', 'set-url', 'origin', path.join(c.fx.dir, 'no-such-remote.git')], c.fx.env);
    await c.check();
    const p = await c.processes(async () => {
      const res = await c.op('fetch');
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('remote-unreadable');
      expect(res.body.error.message).not.toMatch(/another user/);
    });
    expect(p.transport).toBe(0);
  });

  it("F10: an own `~/…` remote (the git environment's home) → 200", async () => {
    const c = await start();
    await symlink(c.fx.remoteDir, path.join(c.fx.home, 'kanban-home.git'));
    await git(c.fx.dir, ['remote', 'set-url', 'origin', '~/kanban-home.git'], c.fx.env);
    await c.check();
    const res = await c.op('fetch');
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  });

  it.runIf(posix)(
    'S11: `~root` → 409 remote-not-owned; a committed `~root/x.git` folder in the repository does not bypass it',
    async () => {
      const c = await start();
      await git(c.fx.dir, ['remote', 'set-url', 'origin', '~root'], c.fx.env);
      await c.check();
      expect((await c.op('fetch')).body.error.code).toBe('remote-not-owned');
      await git(c.fx.dir, ['init', '-q', '--bare', path.join(c.fx.dir, '~root', 'x.git')], c.fx.env);
      await git(c.fx.dir, ['remote', 'set-url', 'origin', '~root/x.git'], c.fx.env);
      await c.check();
      const p = await c.processes(async () => {
        const res = await c.op('fetch');
        expect(res.status).toBe(409);
        expect(['remote-not-owned', 'remote-unreadable']).toContain(res.body.error.code);
      });
      expect(p.transport).toBe(0);
    },
  );

  it.runIf(posix)('S10: a relative remote `own/u::sr` is a path (not a remote helper) and is checked', async () => {
    const c = await start();
    await mkdir(path.join(c.fx.dir, 'own'));
    await symlink(path.parse(c.fx.dir).root, path.join(c.fx.dir, 'own', 'u::sr'));
    await git(c.fx.dir, ['remote', 'set-url', 'origin', 'own/u::sr'], c.fx.env);
    await c.check();
    expect((await c.op('fetch')).body.error.code).toBe('remote-not-owned');
  });
});
