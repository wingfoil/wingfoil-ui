// Characterization (task-033): the git facts the transport design relies on, on the git of the
// machine (probed on 2.43.0) — D33-2 / bug-013 (`GIT_ALLOW_PROTOCOL` overrides `-c protocol.allow`),
// D33-3 (automatic maintenance under fetch and pull), spec-010 §1 (a local upstream prints
// `branch.ab`), §4 (`pull --ff-only` never merges a diverged copy). task-034: the probes of its
// design — bug-014 (a merge commit or a staged squash behind `--ff-only`, tags and branches deleted
// by `--prune`), the hooks and askpass programs of unattended runs (D34-1, D34-3), a merge under a
// stopped `git am` (D34-3) — reproduced with git's defaults, then held by the arguments used.
import { access, chmod, mkdir, readdir, realpath, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CLONE_SETTINGS } from '../../../server/src/git/git.js';
import {
  fetchArgs,
  mergeArgs,
  noHooksArgs,
  pullArgs,
  transportEnv,
  TRANSPORT_SETTINGS,
  unattendedEnv,
} from '../../../server/src/git/transport.js';
import { NO_HOOKS_PATH } from '../../../server/src/projects/clone.js';
import { harnessEnv } from '../../harness/fixtures/index.js';
import { git, run } from '../../harness/run.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';

let ws: TempWorkspace;
let root: string;
let env: NodeJS.ProcessEnv;
const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-033-facts-');
  root = await realpath(ws.dir);
  env = (await harnessEnv(root)).env;
  await git(root, ['init', '-q', '-b', 'main', 'src'], env);
  const src = path.join(root, 'src');
  await git(src, ['config', 'user.email', 'a@example.test'], env);
  await git(src, ['config', 'user.name', 'A'], env);
  await writeFile(path.join(src, 'a.md'), 'a\n');
  await git(src, ['add', 'a.md'], env);
  await git(src, ['commit', '-qm', 'a'], env);
  await git(root, ['clone', '-q', '--bare', src, 'remote.git'], env);
  await git(root, ['clone', '-q', `file://${path.join(root, 'remote.git')}`, 'work'], env);
  const work = path.join(root, 'work');
  await git(work, ['config', 'user.email', 'b@example.test'], env);
  await git(work, ['config', 'user.name', 'B'], env);
  await git(src, ['push', '-q', path.join(root, 'remote.git'), 'main'], env);
}, 120_000);

afterAll(() => ws.dispose());

const work = () => path.join(root, 'work');

async function remoteCommit(file: string): Promise<void> {
  const src = path.join(root, 'src');
  await writeFile(path.join(src, file), `${file}\n`);
  await git(src, ['add', file], env);
  await git(src, ['commit', '-qm', file], env);
  await git(src, ['push', '-q', path.join(root, 'remote.git'), 'main'], env);
}

describe('bug-013 / D33-2', () => {
  it('GIT_ALLOW_PROTOCOL in the environment overrides -c protocol.allow=never: an ext:: clone runs its command', async () => {
    const marker = path.join(root, 'ext-ran');
    const args = [...CLONE_SETTINGS, 'clone', '-q', '--', `ext::sh -c touch% ${marker}`, path.join(root, 'ext-target')];
    await run('git', args, { cwd: root, env: { ...env, GIT_ALLOW_PROTOCOL: 'ext' }, allowFailure: true });
    expect(await exists(marker)).toBe(true);
  });

  it('with the transport environment the same command is refused and runs nothing', async () => {
    const marker = path.join(root, 'ext-refused');
    const args = [
      ...CLONE_SETTINGS,
      'clone',
      '-q',
      '--',
      `ext::sh -c touch% ${marker}`,
      path.join(root, 'ext-target-2'),
    ];
    const result = await run('git', args, {
      cwd: root,
      env: { ...env, GIT_ALLOW_PROTOCOL: 'ext', ...transportEnv(true) },
      allowFailure: true,
    });
    expect(result.stderr).toMatch(/transport 'ext' not allowed/);
    expect(await exists(marker)).toBe(false);
  });
});

describe('D33-3 — automatic maintenance', () => {
  it('fetch and pull start `git maintenance run --auto` unless maintenance.auto=false', async () => {
    await remoteCommit('m1.md');
    const plain = await run('git', ['fetch', '-q', '--', 'origin'], { cwd: work(), env: { ...env, GIT_TRACE: '1' } });
    expect(plain.stderr).toMatch(/run_command: git maintenance run --auto/);
    await remoteCommit('m2.md');
    for (const args of [fetchArgs('origin'), pullArgs('main', 'origin')]) {
      const traced = await run('git', args, { cwd: work(), env: { ...env, GIT_TRACE: '1', ...transportEnv(true) } });
      expect(traced.stderr, args.join(' ')).not.toMatch(/maintenance|\bgc\b/);
    }
    expect(TRANSPORT_SETTINGS).toContain('maintenance.auto=false');
  });
});

describe('spec-010 §1, §4', () => {
  it('a local upstream prints branch.upstream and branch.ab: only branch.<b>.remote tells it from a remote one', async () => {
    await git(work(), ['branch', '-q', 'loc'], env);
    await git(work(), ['checkout', '-q', 'loc'], env);
    await git(work(), ['branch', '-q', '--set-upstream-to=main'], env);
    const status = (await git(work(), ['status', '--porcelain=v2', '--branch'], env)).stdout;
    expect(status).toMatch(/^# branch\.upstream main$/m);
    expect(status).toMatch(/^# branch\.ab \+0 -0$/m);
    expect((await git(work(), ['config', '--get', 'branch.loc.remote'], env)).stdout.trim()).toBe('.');
    await git(work(), ['checkout', '-q', 'main'], env);
  });

  it('pull --ff-only on a diverged copy fails and leaves HEAD where it was', async () => {
    await remoteCommit('theirs.md');
    await mkdir(path.join(work(), 'd'), { recursive: true });
    await writeFile(path.join(work(), 'd', 'mine.md'), 'mine\n');
    await git(work(), ['add', '-A'], env);
    await git(work(), ['commit', '-qm', 'mine'], env);
    const head = (await git(work(), ['rev-parse', 'HEAD'], env)).stdout.trim();
    const result = await run('git', pullArgs('main', 'origin'), {
      cwd: work(),
      env: { ...env, ...transportEnv(true) },
      allowFailure: true,
    });
    expect(result.code).not.toBe(0);
    expect((await git(work(), ['rev-parse', 'HEAD'], env)).stdout.trim()).toBe(head);
  });
});

describe('task-034 — bug-014, D34-1 … D34-3: what git does, and the arguments that hold', () => {
  let n = 0;
  const transport = () => ({ ...env, ...transportEnv(true) });
  /** A new clone of the remote, 1 commit behind it (the incoming commit changes `in-<n>.md` only). */
  async function behind(branch = 'main'): Promise<string> {
    n += 1;
    await remoteCommit(`in-${n}.md`);
    const dir = path.join(root, `behind-${n}`);
    await git(root, ['clone', '-q', `file://${path.join(root, 'remote.git')}`, dir], env);
    await git(dir, ['config', 'user.email', 'b@example.test'], env);
    await git(dir, ['config', 'user.name', 'B'], env);
    await git(dir, ['reset', '-q', '--hard', 'HEAD~1'], env);
    if (branch !== 'main') {
      await git(dir, ['branch', '-q', '-m', branch], env);
      await git(dir, ['branch', '-q', '--set-upstream-to=origin/main'], env);
    }
    return dir;
  }
  const out = async (dir: string, args: string[]) => (await git(dir, args, env)).stdout.trim();
  /** HEAD's parents, whether HEAD is the upstream, the status. */
  async function outcome(dir: string) {
    return {
      parents: (await out(dir, ['log', '-1', '--format=%p'])).split(' ').filter(Boolean).length,
      atUpstream: (await out(dir, ['rev-parse', 'HEAD'])) === (await out(dir, ['rev-parse', 'origin/main'])),
      status: await out(dir, ['status', '--porcelain']),
    };
  }
  /** The manual update and the automatic update as task-033 / spec-010 §4 first wrote them. */
  const LITERAL_PULL = [
    ...TRANSPORT_SETTINGS,
    'pull',
    '--ff-only',
    '--no-rebase',
    '--no-autostash',
    '--no-recurse-submodules',
    '--quiet',
  ];
  const LITERAL_MERGE = [
    ...TRANSPORT_SETTINGS,
    'merge',
    '--ff-only',
    '--no-edit',
    '--no-stat',
    '--no-autostash',
    '--quiet',
    '--',
    '@{u}',
  ];

  it.each<[string, string, string[]]>([
    ['branch.main.mergeOptions', '-s ours', LITERAL_PULL],
    ['pull.twohead', 'ours', LITERAL_PULL],
    ['branch.main.mergeOptions', '-s ours', LITERAL_MERGE],
    ['pull.twohead', 'ours', LITERAL_MERGE],
  ])('bug-014: with %s = %s, `--ff-only` makes a merge commit that keeps the local tree', async (key, value, args) => {
    const dir = await behind();
    await git(dir, ['config', key, value], env);
    await run('git', args, { cwd: dir, env: transport() });
    expect(await outcome(dir)).toMatchObject({ parents: 2, atUpstream: false });
  });

  it('bug-014: with branch.<b>.mergeOptions = --squash, `pull --ff-only` exits 0, HEAD stays, the incoming change is staged', async () => {
    const dir = await behind();
    await git(dir, ['config', 'branch.main.mergeOptions', '--squash'], env);
    await run('git', LITERAL_PULL, { cwd: dir, env: transport() });
    const after = await outcome(dir);
    expect(after.atUpstream).toBe(false);
    expect(after.status).toMatch(/^A {2}in-\d+\.md$/m);
  });

  it('bug-014: `-c branch.<b>.mergeOptions=` does not override for a branch named a=b (git splits -c at the first =)', async () => {
    const dir = await behind('a=b');
    await git(dir, ['config', 'branch.a=b.mergeOptions', '-s ours'], env);
    await run(
      'git',
      [...TRANSPORT_SETTINGS, '-c', 'branch.a=b.mergeOptions=', ...LITERAL_MERGE.slice(TRANSPORT_SETTINGS.length)],
      {
        cwd: dir,
        env: transport(),
      },
    );
    expect((await outcome(dir)).parents).toBe(2);
  });

  it.each<[string, string, string]>([
    ['main', 'branch.main.mergeOptions', '-s ours'],
    ['main', 'branch.main.mergeOptions', '--squash'],
    ['main', 'branch.main.mergeOptions', '--no-ff'],
    ['main', 'pull.twohead', 'ours'],
    ['main', 'merge.ff', 'false'],
    ['main', 'merge.autoStash', 'true'],
    ['a=b', 'branch.a=b.mergeOptions', '-s ours'],
  ])(
    'D34-2 / bug-014: on branch %s with %s = %s, pullArgs and mergeArgs fast-forward: one parent, HEAD = upstream, nothing staged',
    async (branch, key, value) => {
      for (const args of [pullArgs(branch, 'origin'), mergeArgs(branch)]) {
        const dir = await behind(branch);
        await git(dir, ['config', key, value], env);
        await run('git', args, { cwd: dir, env: transport() });
        expect(await outcome(dir), `${args[TRANSPORT_SETTINGS.length + 1]} ${key}=${value}`).toEqual({
          parents: 1,
          atUpstream: true,
          status: '',
        });
      }
    },
  );

  it('D34-2: on a diverged copy mergeArgs fails and HEAD stays (also with branch.<b>.mergeOptions = -s ours)', async () => {
    const dir = await behind();
    await git(dir, ['config', 'branch.main.mergeOptions', '-s ours'], env);
    await writeFile(path.join(dir, 'mine.md'), 'mine\n');
    await git(dir, ['add', 'mine.md'], env);
    await git(dir, ['commit', '-qm', 'mine'], env);
    const head = await out(dir, ['rev-parse', 'HEAD']);
    const result = await run('git', mergeArgs('main'), { cwd: dir, env: transport(), allowFailure: true });
    expect(result.code).not.toBe(0);
    expect(await out(dir, ['rev-parse', 'HEAD'])).toBe(head);
  });

  it('bug-014: `fetch --prune` deletes a local tag when fetch.pruneTags or remote.<r>.pruneTags is set; fetchArgs keeps it', async () => {
    for (const key of ['fetch.pruneTags', 'remote.origin.pruneTags']) {
      const dir = await behind();
      await git(dir, ['config', key, 'true'], env);
      await git(dir, ['tag', 'mine'], env);
      await run('git', [...TRANSPORT_SETTINGS, 'fetch', '--quiet', '--prune', '--', 'origin'], {
        cwd: dir,
        env: transport(),
      });
      expect(await out(dir, ['tag', '--list', 'mine']), key).toBe('');
      await git(dir, ['tag', 'mine'], env);
      await run('git', fetchArgs('origin'), { cwd: dir, env: transport() });
      expect(await out(dir, ['tag', '--list', 'mine']), key).toBe('mine');
    }
  });

  it('bug-014: with a refspec into refs/heads and a detached HEAD, `fetch --prune` deletes local branches (the guard is the refusal)', async () => {
    const dir = await behind();
    await git(dir, ['branch', '-q', 'local-only'], env);
    await git(dir, ['checkout', '-q', '--detach'], env);
    await git(dir, ['config', '--add', 'remote.origin.fetch', '+refs/heads/*:refs/heads/*'], env);
    await run('git', fetchArgs('origin'), { cwd: dir, env: transport() });
    expect(await out(dir, ['branch', '--list', 'local-only'])).toBe('');
  });

  it('D34-1: fetch and merge run reference-transaction and post-merge hooks, also those the incoming commits bring; none with noHooksArgs', async () => {
    const marker = (name: string) => path.join(root, `hook-${n}-${name}`);
    const dir = await behind();
    await mkdir(path.join(dir, '.git', 'hooks'), { recursive: true });
    for (const hook of ['reference-transaction', 'post-merge']) {
      await writeFile(
        path.join(dir, '.git', 'hooks', hook),
        `#!/bin/sh\ncat >/dev/null 2>&1\ntouch '${marker(hook)}'\n`,
      );
      await chmod(path.join(dir, '.git', 'hooks', hook), 0o755);
    }
    await run('git', [...noHooksArgs(NO_HOOKS_PATH), ...fetchArgs('origin')], { cwd: dir, env: transport() });
    await run('git', [...noHooksArgs(NO_HOOKS_PATH), ...mergeArgs('main')], { cwd: dir, env: transport() });
    expect(await exists(marker('reference-transaction'))).toBe(false);
    expect(await exists(marker('post-merge'))).toBe(false);
    expect((await outcome(dir)).atUpstream).toBe(true);
    // Reproduced: the same with the repository's hooks.
    const again = await behind();
    await mkdir(path.join(again, '.git', 'hooks'), { recursive: true });
    for (const hook of ['reference-transaction', 'post-merge']) {
      await writeFile(
        path.join(again, '.git', 'hooks', hook),
        `#!/bin/sh\ncat >/dev/null 2>&1\ntouch '${marker(hook)}'\n`,
      );
      await chmod(path.join(again, '.git', 'hooks', hook), 0o755);
    }
    await run('git', mergeArgs('main'), { cwd: again, env: transport() });
    expect(await exists(marker('post-merge'))).toBe(true);
    expect(await exists(marker('reference-transaction'))).toBe(true);
  });

  it('D34-3: git runs the askpass programs although GIT_TERMINAL_PROMPT=0; none with unattendedEnv', async () => {
    const server: Server = createServer((_req, res) => {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="x"', 'Content-Length': '0' });
      res.end();
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    try {
      const port = (server.address() as AddressInfo).port;
      const dir = path.join(root, 'askpass');
      await git(root, ['init', '-q', dir], env);
      await git(dir, ['remote', 'add', 'origin', `http://127.0.0.1:${port}/r.git`], env);
      const log = path.join(root, 'askpass.log');
      const askpass = path.join(root, 'askpass.sh');
      await writeFile(askpass, `#!/bin/sh\necho asked >> '${log}'\nexit 1\n`);
      await chmod(askpass, 0o755);
      const asked = { GIT_ASKPASS: askpass, SSH_ASKPASS: askpass };
      const manual = await run('git', fetchArgs('origin'), {
        cwd: dir,
        env: { ...env, ...asked, ...transportEnv(true) },
        allowFailure: true,
      });
      expect(manual.code).not.toBe(0);
      expect(await exists(log)).toBe(true);
      const logAfter = path.join(root, 'askpass-unattended.log');
      await writeFile(askpass, `#!/bin/sh\necho asked >> '${logAfter}'\nexit 1\n`);
      const unattended = await run('git', ['-c', `core.askPass=${askpass}`, ...fetchArgs('origin')], {
        cwd: dir,
        env: { ...env, ...asked, ...unattendedEnv(true) },
        allowFailure: true,
      });
      expect(unattended.code).not.toBe(0);
      expect(unattended.stderr).toMatch(/terminal prompts disabled/);
      expect(await exists(logAfter)).toBe(false);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('D34-3: a merge under a stopped `git am` fast-forwards the branch (the automatic update must skip it)', async () => {
    const dir = await behind();
    const patchDir = path.join(root, `patches-${n}`);
    // A patch that does not apply (it changes a file main does not have): `am` stops with HEAD on
    // the branch and no unmerged entry.
    await git(dir, ['checkout', '-q', '-b', 'tmp'], env);
    await writeFile(path.join(dir, 'p.md'), 'one\n');
    await git(dir, ['add', 'p.md'], env);
    await git(dir, ['commit', '-qm', 'one'], env);
    await writeFile(path.join(dir, 'p.md'), 'two\n');
    await git(dir, ['commit', '-qam', 'two'], env);
    await git(dir, ['format-patch', '-q', '-1', '-o', patchDir], env);
    await git(dir, ['checkout', '-q', 'main'], env);
    const [patch = 'missing'] = await readdir(patchDir);
    await run('git', ['am', path.join(patchDir, patch)], {
      cwd: dir,
      env,
      allowFailure: true,
    });
    expect(await exists(path.join(dir, '.git', 'rebase-apply'))).toBe(true);
    await run('git', mergeArgs('main'), { cwd: dir, env: transport() });
    expect((await outcome(dir)).atUpstream).toBe(true);
  });
});
