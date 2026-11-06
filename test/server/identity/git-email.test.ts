// REQ-STATE-05 — the effective `git config user.email` of a project (repository, else global),
// read through the process runner; `git` found on the PATH (the shared `resolveGit` and the
// shared environment cleaner `gitEnv` of server/src/git/git.ts, bug-002).
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GitNotFoundError, gitEnv, resolveGit } from '../../../server/src/git/git.js';
import { GitConfigError, readGitEmail } from '../../../server/src/identity/git-email.js';
import { LocalProcessRunner } from '../../../server/src/process/runner.js';
import { REPO_ROOT } from '../../harness/cli.js';
import { harnessEnv } from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';
import { FakeProcessRunner } from '../process/fake-runner.js';

let root: string;
let env: NodeJS.ProcessEnv;
let repo: string;
let gitFile: string;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'wfui-git-email-'));
  ({ env } = await harnessEnv(root));
  repo = path.join(root, 'repo');
  await mkdir(repo);
  await git(repo, ['init', '-q'], env);
  gitFile = await resolveGit(env);
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('readGitEmail — real git', () => {
  const runner = new LocalProcessRunner();

  it('S-14.1 is undefined when neither the repository nor the global configuration sets it', async () => {
    expect(await readGitEmail(repo, { runner, git: gitFile, env })).toBeUndefined();
  });

  it('S-14.2 uses the global email when the repository sets none', async () => {
    await git(repo, ['config', '--global', 'user.email', 'casey@example.test'], env);
    expect(await readGitEmail(repo, { runner, git: gitFile, env })).toBe('casey@example.test');
  });

  it("prefers the repository's email to the global one", async () => {
    await git(repo, ['config', 'user.email', 'Jordan@Example.TEST'], env);
    expect(await readGitEmail(repo, { runner, git: gitFile, env })).toBe('Jordan@Example.TEST');
    await git(repo, ['config', '--unset', 'user.email'], env);
    await git(repo, ['config', '--global', '--unset', 'user.email'], env);
  });
});

describe('readGitEmail — another repository named by the environment', () => {
  const runner = new LocalProcessRunner();

  it("ignores GIT_DIR / GIT_WORK_TREE pointing elsewhere: the project's own configuration is read", async () => {
    const other = path.join(root, 'other');
    await mkdir(other, { recursive: true });
    await git(other, ['init', '-q'], env);
    await git(other, ['config', 'user.email', 'riley@example.test'], env);
    await git(repo, ['config', 'user.email', 'jordan@example.test'], env);
    const leaked = {
      ...env,
      GIT_DIR: path.join(other, '.git'),
      GIT_WORK_TREE: other,
      GIT_COMMON_DIR: path.join(other, '.git'),
      GIT_CEILING_DIRECTORIES: root,
    };
    // Without the cleaning git would read the other repository (checked with the harness's git).
    expect((await git(repo, ['config', '--get', 'user.email'], leaked)).stdout.trim()).toBe('riley@example.test');
    expect(await readGitEmail(repo, { runner, git: gitFile, env: leaked })).toBe('jordan@example.test');
    await git(repo, ['config', '--unset', 'user.email'], env);
  });
});

describe('gitEnv (shared with the snapshot and the runner, bug-002)', () => {
  it('drops the repository-locating variables (any letter case) and keeps the rest', () => {
    const cleaned = gitEnv({
      HOME: '/h',
      GIT_CONFIG_GLOBAL: '/h/.gitconfig',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_DIR: '/x/.git',
      git_work_tree: '/x',
      GIT_INDEX_FILE: '/x/.git/index',
      GIT_OBJECT_DIRECTORY: '/x/o',
      GIT_NAMESPACE: 'n',
      GIT_COMMON_DIR: '/x/.git',
      GIT_CEILING_DIRECTORIES: '/x',
      PATH: '/bin',
    });
    expect(cleaned).toEqual({ HOME: '/h', GIT_CONFIG_GLOBAL: '/h/.gitconfig', GIT_CONFIG_NOSYSTEM: '1', PATH: '/bin' });
  });

  it('W4-13: an answer whose pipes were cut (drained) is refused, not read', async () => {
    const runner = new FakeProcessRunner().answer({ stdout: 'a@b\n', drained: true });
    await expect(readGitEmail('/p', { runner, git: '/g' })).rejects.toThrow();
  });

  it("is applied to the server's own environment by default", async () => {
    const runner = new FakeProcessRunner().answer({ stdout: 'a@b\n' });
    process.env.GIT_DIR = '/elsewhere/.git';
    try {
      await readGitEmail('/p', { runner, git: '/g' });
    } finally {
      delete process.env.GIT_DIR;
    }
    expect(runner.requests[0]!.env).toBeDefined();
    expect(runner.requests[0]!.env!.GIT_DIR).toBeUndefined();
  });
});

describe('readGitEmail — through the runner port', () => {
  it('runs `git config --get user.email` in the project folder, without a shell', async () => {
    const runner = new FakeProcessRunner().answer({ stdout: 'alex@example.test\n' });
    expect(await readGitEmail('/p/kanban', { runner, git: '/usr/bin/git' })).toBe('alex@example.test');
    expect(runner.requests).toHaveLength(1);
    expect(runner.requests[0]).toMatchObject({
      file: '/usr/bin/git',
      // Review round 5 s-nit-4: the read settings of GitReads first.
      args: ['-c', 'core.fsmonitor=false', '-c', 'protocol.allow=never', 'config', '--get', 'user.email'],
      cwd: '/p/kanban',
    });
  });

  it('treats exit 1 (unset) and a blank value as no email', async () => {
    expect(
      await readGitEmail('/p', { runner: new FakeProcessRunner().answer({ exitCode: 1 }), git: '/g' }),
    ).toBeUndefined();
    expect(
      await readGitEmail('/p', { runner: new FakeProcessRunner().answer({ stdout: '  \n' }), git: '/g' }),
    ).toBeUndefined();
  });

  it('fails on any other end (bad configuration, timeout), without the stderr text', async () => {
    const bad = new FakeProcessRunner().answer({ exitCode: 3, stderr: 'fatal: bad config line 1 secret' });
    const error = await readGitEmail('/p', { runner: bad, git: '/g' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GitConfigError);
    expect((error as Error).message).not.toContain('secret');
    const timeout = new FakeProcessRunner().answer({ ended: 'timeout', exitCode: null, signal: 'SIGKILL' });
    await expect(readGitEmail('/p', { runner: timeout, git: '/g' })).rejects.toBeInstanceOf(GitConfigError);
  });
});

describe('resolveGit (the shared resolver)', () => {
  it('finds an executable `git` on the absolute PATH entries only', async () => {
    const bin = path.join(root, 'bin');
    await mkdir(bin, { recursive: true });
    const fake = path.join(bin, 'git');
    await writeFile(fake, '#!/bin/sh\n');
    await chmod(fake, 0o755);
    expect(await resolveGit({ PATH: ['relative/bin', bin].join(':') }, 'linux')).toBe(fake);
    await expect(resolveGit({ PATH: 'relative/bin' }, 'linux')).rejects.toBeInstanceOf(GitNotFoundError);
    await expect(resolveGit({}, 'linux')).rejects.toBeInstanceOf(GitNotFoundError);
  });

  it('skips a non-executable file on POSIX', async () => {
    const bin = path.join(root, 'bin-noexec');
    await mkdir(bin, { recursive: true });
    await writeFile(path.join(bin, 'git'), '');
    await chmod(path.join(bin, 'git'), 0o644);
    await expect(resolveGit({ PATH: bin }, 'linux')).rejects.toBeInstanceOf(GitNotFoundError);
  });

  it('looks for git.exe on Windows (case-insensitive Path key)', async () => {
    const bin = path.join(root, 'bin-win');
    await mkdir(bin, { recursive: true });
    await writeFile(path.join(bin, 'git.exe'), '');
    expect(await resolveGit({ Path: bin }, 'win32')).toBe(path.join(bin, 'git.exe'));
  });
});

// Review round 5 s-nit-4: the identity read runs as the other server reads do — no fsmonitor, no
// transport (task-046 D46-6, D46-7).
describe('readGitEmail — the read settings of GitReads', () => {
  it('runs with -c core.fsmonitor=false -c protocol.allow=never and the no-transport variables', async () => {
    const runner = new FakeProcessRunner().answer({ stdout: 'a@example.test\n' });
    await readGitEmail('/p', { runner, git: '/usr/bin/git', env: { HOME: '/h', git_allow_protocol: 'file' } });
    expect(runner.requests[0]!.args).toEqual([
      '-c',
      'core.fsmonitor=false',
      '-c',
      'protocol.allow=never',
      'config',
      '--get',
      'user.email',
    ]);
    expect(runner.requests[0]!.env).toEqual({ HOME: '/h', GIT_ALLOW_PROTOCOL: 'none', GIT_NO_LAZY_FETCH: '1' });
  });
});

// bug-029 (SARD REQ-STATE-05, amended 2026-11-06, Q4-a): the identity is the author the WingFoil
// CLI authorises — `GIT_AUTHOR_EMAIL`, then `author.email`, then `user.email` — never `EMAIL` nor
// git's hostname guess. Each case is checked against the pinned CLI's own resolver
// (`dist/core/git-identity.js` `readGitIdentity`), run with the same environment.
describe('readGitEmail — the author the CLI authorises (bug-029)', () => {
  const runner = new LocalProcessRunner();
  const resolver = path.join(REPO_ROOT, 'node_modules', 'wingfoil', 'dist', 'core', 'git-identity.js');
  const cliEmail = (extra: NodeJS.ProcessEnv): string =>
    (
      JSON.parse(
        execFileSync(
          process.execPath,
          [
            '-e',
            `process.stdout.write(JSON.stringify(require(${JSON.stringify(resolver)}).readGitIdentity(${JSON.stringify(repo)})))`,
          ],
          {
            env: { ...env, ...extra },
          },
        ).toString(),
      ) as { email: string }
    ).email;
  const cases: [string, NodeJS.ProcessEnv, { user?: string; author?: string }][] = [
    ['only user.email', {}, { user: 'dev@example.test' }],
    [
      'GIT_AUTHOR_EMAIL over user.email',
      { GIT_AUTHOR_NAME: 'Agent', GIT_AUTHOR_EMAIL: 'agent@example.test' },
      { user: 'dev@example.test' },
    ],
    ['author.email over user.email', {}, { user: 'dev@example.test', author: 'approver@example.test' }],
    ['a blank GIT_AUTHOR_EMAIL is no email', { GIT_AUTHOR_EMAIL: '' }, { user: 'dev@example.test' }],
    ['GIT_AUTHOR_EMAIL trimmed', { GIT_AUTHOR_EMAIL: ' agent@example.test ' }, {}],
    ['EMAIL alone is not followed', { EMAIL: 'fromenv@example.test' }, {}],
    ['nothing configured', {}, {}],
  ];
  for (const [title, extra, config] of cases) {
    it(title, async () => {
      if (config.user) await git(repo, ['config', 'user.email', config.user], env);
      if (config.author) await git(repo, ['config', 'author.email', config.author], env);
      try {
        const expected = cliEmail(extra);
        const got = await readGitEmail(repo, { runner, git: gitFile, env: { ...env, ...extra } });
        expect(got ?? '').toBe(expected);
      } finally {
        await git(repo, ['config', '--unset-all', 'user.email'], env).catch(() => undefined);
        await git(repo, ['config', '--unset-all', 'author.email'], env).catch(() => undefined);
      }
    });
  }
});
