// spec-010 §4, §6 (REQ-PERF-07, REQ-INT-06, RP-14, RP-18, RP-20, RP-36, RP-40, RP-41; task-034
// D34-1 … D34-5, D34-7) — the automatic fetch and update of a scheduler tick on copies of the
// kanban fixture, each with its own bare `origin` that "another clone" moves (Y-02.1, Y-02.3, Y-05.2
// API side): the scope, what runs (arguments, no hook, no askpass), what is recorded, the update's
// refusals, a merge that never makes a merge commit, the skip rules, the 60 s limit of the fetch
// (lowered here) with its process group, one fetch per repository, the allow-list of every process
// and git's message never logged.
import type { FastifyInstance } from 'fastify';
import { access, chmod, mkdir, realpath, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { UiSettings } from '@wingfoil-ui/contracts';
import { GIT_ALLOWED_SUBCOMMANDS, gitSubcommand } from '../../../server/src/git/git.js';
import { fetchArgs, mergeArgs, noHooksArgs } from '../../../server/src/git/transport.js';
import { NO_HOOKS_PATH } from '../../../server/src/projects/clone.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { DEFAULT_SETTINGS } from '../../../server/src/state/settings.js';
import { AutoSync } from '../../../server/src/sync/auto-sync.js';
import { SyncScheduler } from '../../../server/src/sync/scheduler.js';
import { GitTransport } from '../../../server/src/writes/transport.js';
import { startGitHttpRemote } from '../../e2e/support/git-http.js';
import { buildFixture, type Fixture } from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';
import { processKind } from '../snapshot/support.js';
import { startGitConsole, type GitConsole, type GitConsoleOptions } from '../http/git-console.js';

const MARKER = 'marker-task-034-5521';

let ws: TempWorkspace;
let template: Fixture;
const registries: Snapshots[] = [];
const apps: FastifyInstance[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-034-auto-sync-');
  template = await buildFixture('kanban', { root: path.join(await realpath(ws.dir), 'kanban') });
}, 600_000);

afterEach(async () => {
  for (const a of apps.splice(0)) await a.close();
});

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await ws.dispose();
});

/** A logger recording what it is given. */
function recorder() {
  const lines: unknown[] = [];
  const log = (level: string) => (object: object, message: string) => lines.push({ level, ...object, message });
  return { lines, logger: { info: log('info'), warn: log('warn'), error: log('error') } };
}

interface Synced {
  c: GitConsole;
  scheduler: SyncScheduler;
  sync: AutoSync;
  log: ReturnType<typeof recorder>;
  /** One tick: the processes it started (`transport`: fetch, pull, push). */
  tick(): Promise<{ git: number; wingfoil: number; transport: number; commands: string[] }>;
}

async function start(
  settings: Partial<UiSettings> = {},
  options: GitConsoleOptions & { timeoutMs?: number; open?: boolean; hooksPath?: string } = {},
): Promise<Synced> {
  const c = await startGitConsole(template, ws.dir, apps, registries, options);
  await c.store.putSettings({ ...DEFAULT_SETTINGS, ...settings });
  const log = recorder();
  const sync = new AutoSync({
    store: c.store,
    snapshots: c.snapshots,
    transport: new GitTransport({ snapshots: c.snapshots, writeLock: c.writeLock, env: c.env }),
    logger: log.logger,
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    ...(options.hooksPath !== undefined ? { hooksPath: options.hooksPath } : {}),
  });
  const scheduler = new SyncScheduler({ store: c.store, work: sync, lock: c.writeLock, bus: c.bus });
  // The page has read the project: its snapshot is open (RP-18).
  if (options.open ?? true) await c.warm();
  const tick = () => c.processes(() => scheduler.tick());
  return { c, scheduler, sync, log, tick };
}

const header = async (c: GitConsole, pid = c.pid) => (await c.get(`/api/p/${pid}`)).body.repository;
const spawnedOf = (c: GitConsole, sub: string) => c.runner.spawned.filter((r) => gitSubcommand(r.args) === sub);
const parents = async (c: GitConsole) =>
  (await git(c.fx.dir, ['log', '-1', '--format=%p'], c.fx.env)).stdout.trim().split(' ').length;
const remoteHead = async (c: GitConsole) => (await git(c.fx.remoteDir, ['rev-parse', 'main'], c.fx.env)).stdout.trim();

describe('the automatic fetch (spec-010 §6; Y-02.1, Y-02.3 API side)', () => {
  it('Y-02.1: a commit pushed by someone else → after one tick the copy is 1 behind, with a repo event; no hook, no CLI process', async () => {
    const s = await start();
    await mkdir(path.join(s.c.fx.dir, '.git', 'hooks'), { recursive: true });
    const hook = path.join(s.c.fx.dir, '.git', 'hooks', 'reference-transaction');
    const marker = path.join(s.c.fx.dir, '..', `${MARKER}-hook`);
    await writeFile(hook, `#!/bin/sh\ncat >/dev/null 2>&1\ntouch '${marker}'\n`);
    await chmod(hook, 0o755);
    await s.c.remoteCommit('from-jordan.md', 'hi\n');
    const before = s.c.events.length;
    const p = await s.tick();
    expect(p.transport).toBe(1);
    expect(p.wingfoil).toBe(0);
    expect(spawnedOf(s.c, 'fetch').at(-1)!.args).toEqual([...noHooksArgs(NO_HOOKS_PATH), ...fetchArgs('origin')]);
    const repo = await header(s.c);
    expect(repo).toMatchObject({ copy: 'behind', behind: 1 });
    expect(repo.sync.fetch.lastSuccessAt).not.toBeNull();
    expect(repo.sync.fetch.lastError).toBeNull();
    expect(s.c.events.slice(before).some((e) => e.event === 'repo')).toBe(true);
    await expect(access(marker)).rejects.toThrow();
  });

  it('Y-02.3: autoFetch off → a tick starts no process at all', async () => {
    const s = await start({ autoFetch: false });
    await s.c.remoteCommit('from-jordan.md', 'hi\n');
    const p = await s.tick();
    expect(p.git + p.wingfoil).toBe(0);
    expect((await header(s.c)).copy).toBe('in-sync');
  });

  it('RP-18: a listed project whose snapshot was never opened, or a project no longer listed, is not fetched', async () => {
    const s = await start({}, { open: false });
    expect((await s.tick()).git).toBe(0);
    const t = await start();
    await t.c.store.remove(t.c.pid);
    expect((await t.tick()).git).toBe(0);
  });

  it('RP-36 / D34-5: no remote, no fetch target, or a refspec outside refs/remotes/ → skipped, no transport, nothing recorded, logged by code', async () => {
    const cases: [string, (fx: Fixture) => Promise<unknown>][] = [
      ['no-remote', (fx) => git(fx.dir, ['remote', 'remove', 'origin'], fx.env)],
      [
        'no-fetch-target',
        async (fx) => {
          await git(fx.dir, ['branch', '--unset-upstream'], fx.env);
          await git(fx.dir, ['remote', 'rename', 'origin', 'one'], fx.env);
          await git(fx.dir, ['remote', 'add', 'two', fx.remoteDir], fx.env);
        },
      ],
      [
        'refspec-outside-remotes',
        (fx) => git(fx.dir, ['config', '--add', 'remote.origin.fetch', '+refs/heads/*:refs/heads/*'], fx.env),
      ],
      [
        // W4-7 (security review S3): no URL in the configuration, a legacy `remotes/<r>` file.
        'refspec-outside-remotes',
        async (fx) => {
          await git(fx.dir, ['config', '--unset', 'remote.origin.url'], fx.env);
          await mkdir(path.join(fx.dir, '.git', 'remotes'), { recursive: true });
          await writeFile(
            path.join(fx.dir, '.git', 'remotes', 'origin'),
            `URL: ${fx.remoteDir}\nPull: +refs/heads/*:refs/heads/*\n`,
          );
        },
      ],
    ];
    for (const [code, prepare] of cases) {
      const s = await start({}, { prepare: (fx) => prepare(fx).then(() => undefined) });
      const p = await s.tick();
      expect(p.transport, code).toBe(0);
      expect((await header(s.c)).sync.fetch, code).toEqual({ lastSuccessAt: null, lastError: null });
      if (code !== 'no-remote') expect(JSON.stringify(s.log.lines), code).toContain(code);
    }
  });

  it('D34-3: no askpass program runs; git’s message is kept as lastError, never logged', async () => {
    const server: Server = createServer((_req, res) => {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="x"', 'Content-Length': '0' });
      res.end();
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    try {
      const port = (server.address() as AddressInfo).port;
      const asked = path.join(await realpath(ws.dir), `${MARKER}-asked`);
      const askpass = path.join(await realpath(ws.dir), 'task-034-askpass.sh');
      await writeFile(askpass, `#!/bin/sh\ntouch '${asked}'\nexit 1\n`);
      await chmod(askpass, 0o755);
      const s = await start(
        {},
        {
          prepare: (fx) =>
            git(fx.dir, ['remote', 'set-url', 'origin', `http://127.0.0.1:${port}/${MARKER}.git`], fx.env).then(
              () => undefined,
            ),
          env: (fx) => ({ ...fx.env, GIT_ASKPASS: askpass, SSH_ASKPASS: askpass }),
        },
      );
      await s.tick();
      await expect(access(asked)).rejects.toThrow();
      const error = (await header(s.c)).sync.fetch.lastError;
      expect(error.message).toMatch(/terminal prompts disabled/);
      expect(error.code).toBeUndefined();
      expect(JSON.stringify(s.log.lines)).not.toContain('terminal prompts');
      expect(JSON.stringify(s.log.lines)).not.toContain(MARKER);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('RP-20 / D34-9: a fetch that does not finish in time is killed with its process group → lastError code fetch-timeout, the lock free', async () => {
    const remote = await startGitHttpRemote(path.join(await realpath(ws.dir), 'http'), { hold: true });
    try {
      const s = await start(
        {},
        {
          timeoutMs: 1_000,
          prepare: (fx) =>
            git(fx.dir, ['remote', 'set-url', 'origin', `${remote.origin}/held.git`], fx.env).then(() => undefined),
        },
      );
      await s.tick();
      expect(remote.requests()).toBeGreaterThan(0);
      expect(s.c.runner.running).toBe(0);
      const fetch = spawnedOf(s.c, 'fetch').at(-1)!;
      const alive = () => {
        try {
          process.kill(-fetch.pid!, 0);
          return true;
        } catch {
          return false;
        }
      };
      await expect.poll(alive, { timeout: 15_000 }).toBe(false);
      const error = (await header(s.c)).sync.fetch.lastError;
      expect(error).toMatchObject({ code: 'fetch-timeout' });
      expect(s.c.writeLock.isBusy((await s.c.snapshots.open(s.c.pid, s.c.fx.dir)).lockKey)).toBe(false);
    } finally {
      remote.release();
      await remote.close();
    }
  });

  it('D34-4: two listed projects of one repository → one fetch, both recorded', async () => {
    const s = await start();
    const sub = path.join(s.c.fx.dir, 'docs');
    const second = await s.c.store.add({ path: sub, name: 'docs', remote: '' });
    await s.c.snapshots.open(second.id, sub);
    await s.c.remoteCommit('from-jordan.md', 'hi\n');
    const p = await s.tick();
    expect(p.transport).toBe(1);
    const copy = (await s.c.snapshots.get(second.id)!.state()).copy;
    expect(s.c.snapshots.sync.of(second.id, copy).fetch.lastSuccessAt).not.toBeNull();
    expect((await header(s.c)).sync.fetch.lastSuccessAt).not.toBeNull();
  });

  it('REQ-INT-06: every git process of a tick (fetch and update) is on the allow-list', async () => {
    const s = await start({ autoUpdate: true });
    await s.c.remoteCommit('from-jordan.md', 'hi\n');
    const from = s.c.runner.spawned.length;
    await s.tick();
    const gits = s.c.runner.spawned.slice(from).filter((r) => processKind(r) === 'git');
    expect(gits.length).toBeGreaterThan(0);
    for (const r of gits) expect(GIT_ALLOWED_SUBCOMMANDS).toContain(gitSubcommand(r.args));
    expect(gits.map((r) => gitSubcommand(r.args))).toContain('merge');
  });
});

describe('the automatic update (spec-010 §6, RP-41; Y-05.2 API side)', () => {
  it('Y-05.2: autoUpdate on → HEAD is the remote’s commit, one parent, with the merge arguments and no hook (D34-1, D34-2)', async () => {
    const s = await start(
      { autoUpdate: true },
      {
        prepare: async (fx) => {
          await git(fx.dir, ['config', 'branch.main.mergeOptions', '-s ours'], fx.env);
          await mkdir(path.join(fx.dir, '.git', 'hooks'), { recursive: true });
          const hook = path.join(fx.dir, '.git', 'hooks', 'post-merge');
          await writeFile(hook, `#!/bin/sh\ntouch '${path.join(fx.dir, '..', `${MARKER}-post-merge`)}'\n`);
          await chmod(hook, 0o755);
        },
      },
    );
    await s.c.remoteCommit('from-jordan.md', 'hi\n');
    await s.tick();
    expect(await s.c.head()).toBe(await remoteHead(s.c));
    expect(await parents(s.c)).toBe(1);
    expect(spawnedOf(s.c, 'merge').at(-1)!.args).toEqual([...noHooksArgs(NO_HOOKS_PATH), ...mergeArgs('main')]);
    const repo = await header(s.c);
    expect(repo).toMatchObject({ copy: 'in-sync', behind: 0 });
    expect(repo.sync.update.lastError).toBeNull();
    await expect(access(path.join(s.c.fx.dir, '..', `${MARKER}-post-merge`))).rejects.toThrow();
  });

  it('RP-14: an unidentified user → fetched, not updated, nothing recorded', async () => {
    const s = await start({ autoUpdate: true }, { as: null });
    await s.c.remoteCommit('from-jordan.md', 'hi\n');
    const head = await s.c.head();
    await s.tick();
    expect(spawnedOf(s.c, 'merge')).toHaveLength(0);
    expect(await s.c.head()).toBe(head);
    const repo = await header(s.c);
    expect(repo).toMatchObject({ copy: 'behind' });
    expect(repo.sync.update.lastError).toBeNull();
  });

  it('autoUpdate off (the default) → fetched, not updated', async () => {
    const s = await start();
    await s.c.remoteCommit('from-jordan.md', 'hi\n');
    await s.tick();
    expect(spawnedOf(s.c, 'merge')).toHaveLength(0);
    expect((await header(s.c)).copy).toBe('behind');
  });

  it('§5: local changes to an incoming file → update.lastError local-changes-in-the-way with the files, a repo event, HEAD kept', async () => {
    const s = await start({ autoUpdate: true });
    await s.c.remoteCommit('from-jordan.md', 'hi\n');
    await writeFile(path.join(s.c.fx.dir, 'from-jordan.md'), 'mine\n');
    const head = await s.c.head();
    await s.tick();
    expect(spawnedOf(s.c, 'merge')).toHaveLength(0);
    expect(await s.c.head()).toBe(head);
    expect((await header(s.c)).sync.update.lastError).toMatchObject({
      code: 'local-changes-in-the-way',
      detail: { files: ['from-jordan.md'] },
    });
  });

  it('§5: a diverged copy → update.lastError diverged, no merge', async () => {
    const s = await start({ autoUpdate: true });
    await s.c.remoteCommit('from-jordan.md', 'hi\n');
    await writeFile(path.join(s.c.fx.dir, 'mine.md'), 'mine\n');
    await git(s.c.fx.dir, ['add', 'mine.md'], s.c.fx.env);
    await git(s.c.fx.dir, ['commit', '-qm', 'mine'], s.c.fx.env);
    await s.tick();
    expect(spawnedOf(s.c, 'merge')).toHaveLength(0);
    expect((await header(s.c)).sync.update.lastError).toMatchObject({ code: 'diverged' });
  });

  it('D34-3: an operation in progress (a stopped `git am`) → no merge, nothing recorded, logged by code', async () => {
    const s = await start({ autoUpdate: true });
    await s.c.remoteCommit('from-jordan.md', 'hi\n');
    await mkdir(path.join(s.c.fx.dir, '.git', 'rebase-apply'));
    const head = await s.c.head();
    await s.tick();
    expect(spawnedOf(s.c, 'merge')).toHaveLength(0);
    expect(await s.c.head()).toBe(head);
    expect((await header(s.c)).sync.update.lastError).toBeNull();
    expect(JSON.stringify(s.log.lines)).toContain('operation-in-progress');
  });

  it('git refuses the merge (a held index.lock) → update.lastError git-refused, the repository path redacted, never logged', async () => {
    const s = await start({ autoUpdate: true });
    await s.c.remoteCommit('from-jordan.md', 'hi\n');
    await writeFile(path.join(s.c.fx.dir, '.git', 'index.lock'), '');
    await s.tick();
    expect(spawnedOf(s.c, 'merge')).toHaveLength(1);
    const error = (await header(s.c)).sync.update.lastError;
    expect(error).toMatchObject({ code: 'git-refused' });
    expect(error.message).toMatch(/index\.lock/);
    expect(error.message).not.toContain(s.c.fx.dir);
    expect(JSON.stringify(s.log.lines)).not.toContain('index.lock');
    expect(JSON.stringify(s.log.lines)).not.toContain(s.c.fx.dir);
  });
});

describe('review round 1 (R4, R5)', () => {
  it('R4: a hooks path that is not a regular file → nothing runs unattended, an error logged by code', async () => {
    const s = await start({ autoUpdate: true }, { hooksPath: await realpath(ws.dir) });
    await s.c.remoteCommit('from-jordan.md', 'hi\n');
    const p = await s.tick();
    expect(p.git + p.wingfoil).toBe(0);
    expect(s.log.lines).toContainEqual(expect.objectContaining({ level: 'error', code: 'hooks-path-unusable' }));
    expect(JSON.stringify(s.log.lines)).not.toContain(await realpath(ws.dir));
  });

  it('R4 / W4-9: a merge that exits 0 without fast-forwarding → merge-not-fast-forward at error level and as the update error', async () => {
    let fake = false;
    const s = await start(
      { autoUpdate: true },
      {
        intercept: async (request) =>
          fake && gitSubcommand(request.args) === 'merge'
            ? { exitCode: 0, signal: null, stdout: '', stderr: '', ended: 'exit', durationMs: 1 }
            : undefined,
      },
    );
    await s.c.remoteCommit('from-jordan.md', 'hi\n');
    await writeFile(path.join(s.c.fx.dir, '.git', 'index.lock'), '');
    await s.tick();
    expect((await header(s.c)).sync.update.lastError).toMatchObject({ code: 'git-refused' });
    const { rm } = await import('node:fs/promises');
    await rm(path.join(s.c.fx.dir, '.git', 'index.lock'));
    fake = true;
    await s.tick();
    expect(s.log.lines).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'merge-not-fast-forward', op: 'auto-update' }),
    );
    const repo = await header(s.c);
    expect(repo).toMatchObject({ copy: 'behind' });
    // W4-9 (security review S5): recorded as an update error of its own.
    expect(repo.sync.update.lastError).toMatchObject({ code: 'merge-not-fast-forward' });
  });

  it('R5: stopped during the fetch → no merge starts afterwards', async () => {
    const holder: { scheduler?: SyncScheduler } = {};
    const s = await start(
      { autoUpdate: true },
      {
        intercept: async (request, real) => {
          if (gitSubcommand(request.args) !== 'fetch') return undefined;
          const result = await real(request);
          holder.scheduler?.stop();
          return result;
        },
      },
    );
    holder.scheduler = s.scheduler;
    await s.c.remoteCommit('from-jordan.md', 'hi\n');
    await s.tick();
    expect(spawnedOf(s.c, 'fetch')).toHaveLength(1);
    expect(spawnedOf(s.c, 'merge')).toHaveLength(0);
  });

  it('R5: stopped → the projects left in the group are not synced', async () => {
    const s = await start();
    const sub = path.join(s.c.fx.dir, 'docs');
    const second = await s.c.store.add({ path: sub, name: 'docs', remote: '' });
    await s.c.snapshots.open(second.id, sub);
    const [group] = s.sync.groups();
    s.sync.stop();
    const p = await s.c.processes(() => s.sync.sync(group!));
    expect(p.git).toBe(0);
  });
});

describe('security review S1 (task-034 W4-5) — configuration from the working tree', () => {
  /** A config file inside the working tree, included by the repository's own configuration. */
  async function included(fx: Fixture, body: string, how: 'include' | 'gitdir' | 'onbranch'): Promise<void> {
    await writeFile(path.join(fx.dir, '.wfui-config'), body);
    const key =
      how === 'include'
        ? 'include.path'
        : how === 'gitdir'
          ? `includeIf.gitdir:${fx.dir}/.path`
          : 'includeIf.onbranch:main.path';
    await git(fx.dir, ['config', key, '../.wfui-config'], fx.env);
  }
  const marker = (name: string) => path.join(path.dirname(ws.dir), `${MARKER}-s1-${name}`);
  const exists = (file: string) =>
    access(file).then(
      () => true,
      () => false,
    );

  const cases: [string, 'include' | 'gitdir' | 'onbranch', (fx: Fixture, m: string) => Promise<string>][] = [
    [
      'remote.<r>.uploadpack',
      'include',
      async (_fx, m) => `[remote "origin"]\n\tuploadpack = touch '${m}'; git-upload-pack\n`,
    ],
    [
      'remote.<r>.uploadpack',
      'gitdir',
      async (_fx, m) => `[remote "origin"]\n\tuploadpack = touch '${m}'; git-upload-pack\n`,
    ],
    [
      'remote.<r>.uploadpack',
      'onbranch',
      async (_fx, m) => `[remote "origin"]\n\tuploadpack = touch '${m}'; git-upload-pack\n`,
    ],
    ['core.fsmonitor', 'include', async (_fx, m) => `[core]\n\tfsmonitor = touch '${m}'; echo\n`],
    [
      'filter.<x>.smudge',
      'include',
      async (fx, m) => {
        await writeFile(path.join(fx.dir, '.git', 'info', 'attributes'), '*.md filter=wfui\n');
        return `[filter "wfui"]\n\tsmudge = touch '${m}'; cat\n\tclean = cat\n`;
      },
    ],
    [
      'core.sshCommand',
      'include',
      async (fx, m) => {
        // No port: git's "simple" ssh variant refuses one before running the command.
        await git(fx.dir, ['remote', 'set-url', 'origin', 'ssh://127.0.0.1/x.git'], fx.env);
        return `[core]\n\tsshCommand = touch '${m}'; false\n`;
      },
    ],
    [
      'core.gitProxy',
      'include',
      async (fx, m) => {
        await git(fx.dir, ['remote', 'set-url', 'origin', 'git://127.0.0.1:9/x.git'], fx.env);
        // git execs the proxy without a shell: a program.
        await writeFile(`${m}.sh`, `#!/bin/sh\ntouch '${m}'\nexit 1\n`);
        await chmod(`${m}.sh`, 0o755);
        return `[core]\n\tgitProxy = ${m}.sh\n`;
      },
    ],
  ];

  it.each(cases)(
    '%s through %s → no automatic fetch nor update, nothing runs, logged by code',
    async (name, how, body) => {
      const m = marker(`${name.replace(/\W/g, '')}-${how}`);
      const s = await start({ autoUpdate: true }, { prepare: async (fx) => included(fx, await body(fx, m), how) });
      await s.c.remoteCommit('from-jordan.md', 'hi\n');
      const p = await s.tick();
      expect(await exists(m), 'the configured program ran').toBe(false);
      expect(p.transport).toBe(0);
      expect(spawnedOf(s.c, 'merge')).toHaveLength(0);
      expect(s.log.lines).toContainEqual(expect.objectContaining({ code: 'config-in-worktree' }));
      // W4-14: visible — recorded as the fetch's last error.
      expect((await header(s.c)).sync.fetch).toMatchObject({
        lastSuccessAt: null,
        lastError: { code: 'config-in-worktree', message: '' },
      });
    },
  );

  it('credential.helper "!cmd" through include → the automatic fetch does not run it', async () => {
    const server: Server = createServer((_req, res) => {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="x"', 'Content-Length': '0' });
      res.end();
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    try {
      const port = (server.address() as AddressInfo).port;
      const m = marker('credential');
      const s = await start(
        {},
        {
          prepare: async (fx) => {
            await git(fx.dir, ['remote', 'set-url', 'origin', `http://127.0.0.1:${port}/x.git`], fx.env);
            await included(fx, `[credential]\n\thelper = "!touch '${m}'; false"\n`, 'include');
          },
        },
      );
      const p = await s.tick();
      expect(await exists(m), 'the helper ran').toBe(false);
      expect(p.transport).toBe(0);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('an include in the global configuration (the user’s own file) does not stop the fetch', async () => {
    const outside = path.join(path.dirname(ws.dir), `${MARKER}-global.config`);
    await writeFile(outside, '[wfui]\n\tsetting = 1\n');
    const s = await start(
      {},
      { prepare: (fx) => git(fx.dir, ['config', '--global', 'include.path', outside], fx.env).then(() => undefined) },
    );
    await s.c.remoteCommit('from-jordan.md', 'hi\n');
    expect((await s.tick()).transport).toBe(1);
  });

  it('a repository include to any other file (outside the working tree too) → skipped, fail closed (W4-5 allow-list)', async () => {
    const outside = path.join(path.dirname(ws.dir), `${MARKER}-local.config`);
    await writeFile(outside, '[wfui]\n\tsetting = 1\n');
    const s = await start(
      {},
      { prepare: (fx) => git(fx.dir, ['config', 'include.path', outside], fx.env).then(() => undefined) },
    );
    expect((await s.tick()).transport).toBe(0);
    expect(s.log.lines).toContainEqual(expect.objectContaining({ code: 'config-in-worktree' }));
    expect((await header(s.c)).sync.fetch.lastError).toMatchObject({ code: 'config-in-worktree' });
  });

  it('the server’s own status reads run no fsmonitor program (included from the working tree)', async () => {
    const m = marker('fsmonitor-status');
    const s = await start(
      {},
      { prepare: (fx) => included(fx, `[core]\n\tfsmonitor = touch '${m}'; echo\n`, 'include') },
    );
    await writeFile(path.join(s.c.fx.dir, 'touched.md'), 'x\n');
    await s.c.check();
    await s.c.warm();
    expect(await exists(m)).toBe(false);
  });
});

describe('W4-10 (b) — the stop waits for a running automatic merge', () => {
  it('stop() resolves only once the running merge has ended; the merge completes', async () => {
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    let merging!: () => void;
    const started = new Promise<void>((r) => (merging = r));
    const s = await start(
      { autoUpdate: true },
      {
        intercept: async (request, real) => {
          if (gitSubcommand(request.args) !== 'merge') return undefined;
          merging();
          await held;
          return real(request);
        },
      },
    );
    await s.c.remoteCommit('from-jordan.md', 'hi\n');
    const tick = s.scheduler.tick();
    await started;
    let stopped = false;
    const stopping = s.scheduler.stop().then(() => (stopped = true));
    await new Promise((r) => setTimeout(r, 300));
    expect(stopped).toBe(false);
    release();
    await stopping;
    await tick;
    expect(await s.c.head()).toBe(await remoteHead(s.c));
  });
});

describe('W4-14 — the update skipped for its configuration is recorded', () => {
  it('configuration clean at the fetch, an include into the working tree before the merge → update.lastError config-in-worktree, no merge', async () => {
    let listings = 0;
    let dir = '';
    const s = await start(
      { autoUpdate: true },
      {
        intercept: async (request, real) => {
          if (gitSubcommand(request.args) !== 'config' || !request.args.includes('--show-origin')) return undefined;
          listings += 1;
          const answer = await real(request);
          if (listings < 2) return answer;
          // The second listing (before the merge) shows a setting from a file of the working tree.
          return { ...answer, stdout: `${answer.stdout}local\0file:${dir}/.wfui-config\0wfui.x\n1\0` };
        },
      },
    );
    dir = s.c.fx.dir;
    await writeFile(path.join(dir, '.wfui-config'), '[wfui]\n\tx = 1\n');
    await s.c.remoteCommit('from-jordan.md', 'hi\n');
    await s.tick();
    expect(listings).toBeGreaterThanOrEqual(2);
    expect(spawnedOf(s.c, 'merge')).toHaveLength(0);
    expect((await header(s.c)).sync.update.lastError).toMatchObject({ code: 'config-in-worktree' });
  });
});

describe('W4-11 (security review S2-1) — include directives whose file is missing or whose condition is false', () => {
  const cases: [string, (fx: Fixture) => Promise<unknown>][] = [
    ['include.path to a file not there yet', (fx) => git(fx.dir, ['config', 'include.path', '../.wfui-later'], fx.env)],
    [
      'includeIf.onbranch: of another branch',
      async (fx) => {
        await writeFile(path.join(fx.dir, '.wfui-config'), '[wfui]\n\tx = 1\n');
        await git(fx.dir, ['config', 'includeIf.onbranch:other.path', '../.wfui-config'], fx.env);
      },
    ],
    [
      'includeIf.hasconfig: not met',
      (fx) =>
        git(fx.dir, ['config', 'includeIf.hasconfig:remote.*.url:https://nowhere/**.path', '../.wfui-later'], fx.env),
    ],
    [
      'a global include of a missing file of the working tree',
      (fx) => git(fx.dir, ['config', '--global', 'include.path', path.join(fx.dir, '.wfui-later')], fx.env),
    ],
  ];

  it.each(cases)('%s → no automatic fetch, recorded config-in-worktree', async (_name, prepare) => {
    const s = await start({ autoUpdate: true }, { prepare: (fx) => prepare(fx).then(() => undefined) });
    await s.c.remoteCommit('from-jordan.md', 'hi\n');
    const p = await s.tick();
    expect(p.transport).toBe(0);
    expect((await header(s.c)).sync.fetch.lastError).toMatchObject({ code: 'config-in-worktree' });
  });
});

describe('W4-12 (security review S2-2) — the configuration names a path the incoming commits change', () => {
  it.each<[string, string]>([
    ['filter.wfui.smudge', './wfui-tool.sh'],
    ['credential.helper', '!wfui-tool.sh --store'],
    ['core.sshCommand', 'sh "wfui-tool.sh" -v'],
  ])('%s = %s → no automatic update, recorded config-uses-incoming-path', async (key, value) => {
    const s = await start(
      { autoUpdate: true },
      { prepare: (fx) => git(fx.dir, ['config', key, value], fx.env).then(() => undefined) },
    );
    await s.c.remoteCommit('wfui-tool.sh', '#!/bin/sh\nexit 0\n');
    const head = await s.c.head();
    await s.tick();
    expect(spawnedOf(s.c, 'merge')).toHaveLength(0);
    expect(await s.c.head()).toBe(head);
    expect((await header(s.c)).sync.update.lastError).toMatchObject({ code: 'config-uses-incoming-path' });
    expect(s.log.lines).toContainEqual(expect.objectContaining({ code: 'config-uses-incoming-path' }));
  });

  it('a configured path the incoming commits do not change → updated', async () => {
    const s = await start(
      { autoUpdate: true },
      {
        prepare: (fx) => git(fx.dir, ['config', 'filter.wfui.smudge', './other-tool.sh'], fx.env).then(() => undefined),
      },
    );
    await s.c.remoteCommit('wfui-tool.sh', '#!/bin/sh\nexit 0\n');
    await s.tick();
    expect(await s.c.head()).toBe(await remoteHead(s.c));
  });
});
