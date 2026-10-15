// Characterization (task-033): the git facts the transport design relies on, on the git of the
// machine (probed on 2.43.0) — D33-2 / bug-013 (`GIT_ALLOW_PROTOCOL` overrides `-c protocol.allow`),
// D33-3 (automatic maintenance under fetch and pull), spec-010 §1 (a local upstream prints
// `branch.ab`), §4 (`pull --ff-only` never merges a diverged copy).
import { access, mkdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CLONE_SETTINGS } from '../../../server/src/git/git.js';
import { fetchArgs, pullArgs, transportEnv, TRANSPORT_SETTINGS } from '../../../server/src/git/transport.js';
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
    for (const args of [fetchArgs('origin'), pullArgs()]) {
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
    const result = await run('git', pullArgs(), {
      cwd: work(),
      env: { ...env, ...transportEnv(true) },
      allowFailure: true,
    });
    expect(result.code).not.toBe(0);
    expect((await git(work(), ['rev-parse', 'HEAD'], env)).stdout.trim()).toBe(head);
  });
});
