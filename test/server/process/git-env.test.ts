// bug-002 — an inherited `GIT_*` variable (a `GIT_DIR` left by a git hook, a `GIT_CONFIG_KEY_<n>`
// injection) must not redirect the `wingfoil` CLI, which runs git itself, nor any other child of
// the server: the process runner starts every child with `gitEnv(env)` (server/src/git/git.ts).
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WingfoilCli } from '../../../server/src/cli/adapter.js';
import { discoverCli } from '../../../server/src/cli/discovery.js';
import { GitReads, resolveGit } from '../../../server/src/git/git.js';
import { LocalProcessRunner } from '../../../server/src/process/runner.js';
import { buildFixture, type Fixture } from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';

let root: string;
let fx: Fixture;
let other: string;
let legacyConfig: string;
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
  legacyConfig = path.join(other, 'legacy.gitconfig');
  await writeFile(legacyConfig, '[user]\n\temail = legacy@example.test\n');
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
    // Legacy: `git config` reads this file instead of the repository's (review R1).
    GIT_CONFIG: legacyConfig,
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
    for (const name of [
      'GIT_DIR',
      'GIT_WORK_TREE',
      'GIT_INDEX_FILE',
      'GIT_CONFIG_COUNT',
      'GIT_CONFIG_KEY_0',
      'GIT_CONFIG',
    ]) {
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

  it("GitReads.email() is the project's although a legacy GIT_CONFIG names another file (review R1)", async () => {
    const reads = new GitReads({
      git: await resolveGit(fx.env),
      runner: runner(),
      cwd: fx.dir,
      env: { ...fx.env, GIT_CONFIG: legacyConfig },
    });
    expect(await reads.email()).toBe('alex@example.test');
    expect(
      await new GitReads({ git: await resolveGit(fx.env), runner: runner(), cwd: fx.dir, env: hostileEnv() }).email(),
    ).toBe('alex@example.test');
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

// task-050 F1 (approver's decision Q1-A, W-39): `gitEnv` drops only the variables that redirect
// git; the identity variables are kept, so a console's children — the CLI and git — act as whoever
// started the console (an agent session's identity is refused at `memory approve`). Test consoles
// inherit none: `harnessEnv` deletes every `GIT_*` (`test/harness/git-identity.test.ts`).
describe('task-050 — children keep the identity of whoever started the server', () => {
  const identity = {
    GIT_AUTHOR_NAME: 'Agent Stand-in',
    GIT_AUTHOR_EMAIL: 'agent-stand-in@example.test',
    GIT_COMMITTER_NAME: 'Agent Stand-in',
    GIT_COMMITTER_EMAIL: 'agent-stand-in@example.test',
  };

  it('the four GIT_AUTHOR_*/GIT_COMMITTER_* variables reach a child unchanged, a redirecting one does not', async () => {
    const result = await runner().run({
      file: process.execPath,
      args: [
        '-e',
        'process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(process.env).filter(([k]) => /^GIT_(AUTHOR|COMMITTER)_|^GIT_DIR$/.test(k)))))',
      ],
      cwd: fx.dir,
      env: { ...hostileEnv(), ...identity },
    });
    expect(JSON.parse(result.stdout)).toEqual(identity);
  });

  it("git run by the runner resolves the author as the variables say, over the project's user.*", async () => {
    const result = await runner().run({
      file: await resolveGit(fx.env),
      args: ['var', 'GIT_AUTHOR_IDENT'],
      cwd: fx.dir,
      env: { ...fx.env, ...identity },
    });
    expect(result.stdout).toMatch(/^Agent Stand-in <agent-stand-in@example\.test> \d+ [+-]\d{4}\n$/);
  });
});
