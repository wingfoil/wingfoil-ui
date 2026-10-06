// bug-002 — an inherited `GIT_*` variable (a `GIT_DIR` left by a git hook, a `GIT_CONFIG_KEY_<n>`
// injection) must not redirect the `wingfoil` CLI, which runs git itself, nor any other child of
// the server: the process runner starts every child with `gitEnv(env)` (server/src/git/git.ts).
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WingfoilCli } from '../../../server/src/cli/adapter.js';
import { discoverCli } from '../../../server/src/cli/discovery.js';
import { LocalProcessRunner } from '../../../server/src/process/runner.js';
import { buildFixture, type Fixture } from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';

let root: string;
let fx: Fixture;
let other: string;
const runners: LocalProcessRunner[] = [];

function runner(): LocalProcessRunner {
  const r = new LocalProcessRunner();
  runners.push(r);
  return r;
}

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-gitenv-')));
  fx = await buildFixture('kanban', { root: path.join(root, 'fx') });
  other = path.join(root, 'other');
  await mkdir(other, { recursive: true });
  await git(other, ['init', '-q'], fx.env);
  await writeFile(path.join(other, 'x.md'), 'x\n');
  await git(other, ['add', 'x.md'], fx.env);
  await git(other, ['-c', 'user.name=O', '-c', 'user.email=o@example.test', 'commit', '-qm', 'other'], fx.env);
}, 600_000);

afterAll(async () => {
  for (const r of runners) await r.terminateAll();
  await rm(root, { recursive: true, force: true });
});

/** The fixture's environment as a git hook would leave it: pointing at another repository. */
function hostileEnv(): NodeJS.ProcessEnv {
  return {
    ...fx.env,
    GIT_DIR: path.join(other, '.git'),
    GIT_WORK_TREE: other,
    GIT_INDEX_FILE: path.join(other, '.git', 'index'),
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'user.email',
    GIT_CONFIG_VALUE_0: 'injected@example.test',
  };
}

describe('bug-002 — children never inherit a redirecting GIT_* variable', () => {
  it('the runner starts a child without them, whatever the request env holds', async () => {
    const result = await runner().run({
      file: process.execPath,
      args: [
        '-e',
        'process.stdout.write(JSON.stringify(Object.keys(process.env).filter((k) => k.startsWith("GIT_"))))',
      ],
      cwd: fx.dir,
      env: hostileEnv(),
    });
    const keys = JSON.parse(result.stdout) as string[];
    for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_KEY_0']) {
      expect(keys).not.toContain(name);
    }
    expect(keys).toEqual(expect.arrayContaining(['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM']));
  });

  it('the server env too, when a request gives none', async () => {
    const saved = process.env.GIT_DIR;
    process.env.GIT_DIR = path.join(other, '.git');
    try {
      const result = await runner().run({
        file: process.execPath,
        args: ['-e', 'process.stdout.write(String(process.env.GIT_DIR))'],
        cwd: fx.dir,
      });
      expect(result.stdout).toBe('undefined');
    } finally {
      if (saved === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = saved;
    }
  });

  it('the wingfoil CLI answers for its own project (memory history reads git)', async () => {
    const env = hostileEnv();
    const cli = new WingfoilCli({ cli: await discoverCli(fx.dir, { env }), runner: runner(), env });
    const history = await cli.run('memory history', { positionals: ['task-001-login-form'] });
    expect(history.data.entries.length).toBeGreaterThan(0);
    const search = await cli.run('memory search');
    expect(search.data.matches.map((m) => m.id)).toContain('task-001-login-form');
  });
});
