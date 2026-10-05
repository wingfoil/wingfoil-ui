// REQ-STATE-05 — the effective `git config user.email` of a project (repository, else global),
// read through the process runner; `git` found on the PATH.
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findGit, GitConfigError, gitConfigEnv, readGitEmail } from '../../../server/src/identity/git-email.js';
import { LocalProcessRunner } from '../../../server/src/process/runner.js';
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
  const found = await findGit({ env });
  expect(found).toBeDefined();
  gitFile = found!;
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

describe('gitConfigEnv', () => {
  it('drops the repository-locating variables (any letter case) and keeps the rest', () => {
    const cleaned = gitConfigEnv({
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
      args: ['config', '--get', 'user.email'],
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

describe('findGit', () => {
  it('finds an executable `git` on the absolute PATH entries only', async () => {
    const bin = path.join(root, 'bin');
    await mkdir(bin, { recursive: true });
    const fake = path.join(bin, 'git');
    await writeFile(fake, '#!/bin/sh\n');
    await chmod(fake, 0o755);
    expect(await findGit({ env: { PATH: ['relative/bin', bin].join(path.delimiter) }, platform: 'linux' })).toBe(fake);
    expect(await findGit({ env: { PATH: 'relative/bin' }, platform: 'linux' })).toBeUndefined();
    expect(await findGit({ env: {}, platform: 'linux' })).toBeUndefined();
  });

  it('skips a non-executable file on POSIX', async () => {
    const bin = path.join(root, 'bin-noexec');
    await mkdir(bin, { recursive: true });
    await writeFile(path.join(bin, 'git'), '');
    await chmod(path.join(bin, 'git'), 0o644);
    expect(await findGit({ env: { PATH: bin }, platform: 'linux' })).toBeUndefined();
  });

  it('looks for git.exe on Windows (case-insensitive Path key)', async () => {
    const bin = path.join(root, 'bin-win');
    await mkdir(bin, { recursive: true });
    await writeFile(path.join(bin, 'git.exe'), '');
    expect(await findGit({ env: { Path: bin }, platform: 'win32' })).toBe(path.join(bin, 'git.exe'));
  });
});
