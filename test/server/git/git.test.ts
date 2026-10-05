// REQ-STATE-01/02, REQ-INT-06 (read operations) — the git reads of the snapshot: one
// `git status --porcelain=v2` for HEAD and the working tree, `git config user.email`, `git
// rev-parse` for the layout; nothing else, no optional lock (a read never writes `.git/index`).
import { chmod, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  GitNotFoundError,
  GitReadError,
  GitReads,
  parseStatus,
  resolveGit,
  UNBORN_HEAD,
} from '../../../server/src/git/git.js';
import { LocalProcessRunner } from '../../../server/src/process/runner.js';
import { harnessEnv } from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';
import { FakeProcessRunner } from '../process/fake-runner.js';

const SHA = 'a'.repeat(40);
let root: string;
let env: NodeJS.ProcessEnv;
let gitFile: string;

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-git-')));
  env = (await harnessEnv(root)).env;
  gitFile = await resolveGit(env);
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('parseStatus — porcelain v2, -z', () => {
  it('reads HEAD from branch.oid and every kind of entry, paths verbatim', () => {
    const records = [
      `# branch.oid ${SHA}`,
      '# branch.head main',
      '# branch.upstream origin/main',
      '# branch.ab +0 -0',
      `1 .M N... 100644 100644 100644 ${SHA} ${SHA} docs/memory/task/task 001.md`,
      `2 R. N... 100644 100644 100644 ${SHA} ${SHA} R100 docs/new name.md`,
      'docs/old name.md',
      `u UU N... 100644 100644 100644 100644 ${SHA} ${SHA} ${SHA} conflict.md`,
      '? docs/memory/task/task-009-draft-idea.md',
      '! ignored.log',
    ];
    const status = parseStatus(records.join('\0') + '\0');
    expect(status.head).toBe(SHA);
    expect(status.entries).toEqual([
      { code: '.M', path: 'docs/memory/task/task 001.md' },
      { code: 'R.', path: 'docs/new name.md', from: 'docs/old name.md' },
      { code: 'UU', path: 'conflict.md' },
      { code: '??', path: 'docs/memory/task/task-009-draft-idea.md' },
      { code: '!!', path: 'ignored.log' },
    ]);
  });

  it('hashes the entries only: the same entries give the same hash whatever the headers', () => {
    const entry = `1 .M N... 100644 100644 100644 ${SHA} ${SHA} a.md`;
    const a = parseStatus(`# branch.oid ${SHA}\0# branch.ab +0 -0\0${entry}\0`);
    const b = parseStatus(`# branch.oid ${SHA}\0# branch.ab +3 -0\0${entry}\0`);
    const clean = parseStatus(`# branch.oid ${SHA}\0`);
    expect(a.hash).toBe(b.hash);
    expect(a.hash).not.toBe(clean.hash);
    expect(a.hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('gives the unborn HEAD for a repository without commits', () => {
    expect(parseStatus('# branch.oid (initial)\0# branch.head main\0').head).toBe(UNBORN_HEAD);
    expect(UNBORN_HEAD).toBe('0'.repeat(40));
  });
});

describe('GitReads — the commands it runs', () => {
  function reads(runner: FakeProcessRunner): GitReads {
    return new GitReads({ git: '/usr/bin/git', runner, cwd: '/p', env: { HOME: '/h' } });
  }

  it('status: one process, no optional lock, untracked files listed one by one', async () => {
    const runner = new FakeProcessRunner().answer({ stdout: `# branch.oid ${SHA}\0` });
    const status = await reads(runner).status();
    expect(status.head).toBe(SHA);
    expect(runner.requests).toHaveLength(1);
    expect(runner.requests[0]).toMatchObject({
      file: '/usr/bin/git',
      cwd: '/p',
      env: { HOME: '/h' },
      args: ['--no-optional-locks', 'status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all'],
    });
  });

  it('email: the effective user.email, undefined when unset (exit 1) or empty', async () => {
    const runner = new FakeProcessRunner()
      .answer({ stdout: 'alex@example.test\n' })
      .answer({ exitCode: 1 })
      .answer({ stdout: '\n' });
    const r = reads(runner);
    expect(await r.email()).toBe('alex@example.test');
    expect(await r.email()).toBeUndefined();
    expect(await r.email()).toBeUndefined();
    expect(runner.requests[0]!.args).toEqual(['--no-optional-locks', 'config', 'user.email']);
  });

  it('layout: prefix, git dir and common dir in one rev-parse, resolved against the project', async () => {
    const runner = new FakeProcessRunner().answer({ stdout: 'sub/\n/repo/.git\n../.git\n' });
    expect(await reads(runner).layout()).toEqual({ prefix: 'sub/', gitDir: '/repo/.git', commonDir: '/.git' });
    expect(runner.requests[0]!.args).toEqual([
      '--no-optional-locks',
      'rev-parse',
      '--show-prefix',
      '--absolute-git-dir',
      '--git-common-dir',
    ]);
  });

  it("a failed read is a GitReadError with git's message", async () => {
    const runner = new FakeProcessRunner().answer({ exitCode: 128, stderr: 'fatal: not a git repository\n' });
    const error = await reads(runner)
      .status()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GitReadError);
    expect((error as GitReadError).message).toBe('fatal: not a git repository');
  });

  it('a timed-out read is a GitReadError too', async () => {
    const runner = new FakeProcessRunner().answer({ ended: 'timeout', exitCode: null });
    await expect(reads(runner).email()).rejects.toBeInstanceOf(GitReadError);
  });
});

describe('GitReads — on a real repository', () => {
  it('reads HEAD, the entries (staged, modified, untracked in a new folder) and the identity', async () => {
    const repo = path.join(root, 'repo');
    await mkdir(repo, { recursive: true });
    await git(repo, ['init', '-q'], env);
    const runner = new LocalProcessRunner();
    const r = new GitReads({ git: gitFile, runner, cwd: repo, env });
    expect((await r.status()).head).toBe(UNBORN_HEAD);
    await writeFile(path.join(repo, 'a.md'), 'a\n');
    await git(repo, ['add', 'a.md'], env);
    await git(repo, ['-c', 'user.name=A', '-c', 'user.email=a@example.test', 'commit', '-qm', 'a'], env);
    const head = (await git(repo, ['rev-parse', 'HEAD'], env)).stdout.trim();
    const clean = await r.status();
    expect(clean).toMatchObject({ head, entries: [] });
    await writeFile(path.join(repo, 'a.md'), 'b\n');
    await mkdir(path.join(repo, 'new dir'));
    await writeFile(path.join(repo, 'new dir', 'n.md'), 'n\n');
    const dirty = await r.status();
    expect(dirty.entries).toEqual([
      { code: '.M', path: 'a.md' },
      { code: '??', path: 'new dir/n.md' },
    ]);
    expect(dirty.hash).not.toBe(clean.hash);
    expect(await r.email()).toBeUndefined();
    await git(repo, ['config', 'user.email', 'alex@example.test'], env);
    expect(await r.email()).toBe('alex@example.test');
    const layout = await r.layout();
    expect(layout).toEqual({ prefix: '', gitDir: path.join(repo, '.git'), commonDir: path.join(repo, '.git') });
  });
});

describe('resolveGit', () => {
  it('finds git on the PATH as an absolute path', async () => {
    expect(path.isAbsolute(gitFile)).toBe(true);
    expect(path.basename(gitFile)).toMatch(/^git(\.exe)?$/);
  });

  it('skips relative PATH entries and non-executable files; GitNotFoundError when none', async () => {
    const bin = path.join(root, 'bin-noexec');
    await mkdir(bin, { recursive: true });
    await writeFile(path.join(bin, 'git'), '#!/bin/sh\n');
    await chmod(path.join(bin, 'git'), 0o644);
    await expect(resolveGit({ PATH: `relative${path.delimiter}${bin}` }, 'linux')).rejects.toBeInstanceOf(
      GitNotFoundError,
    );
    await chmod(path.join(bin, 'git'), 0o755);
    await expect(resolveGit({ PATH: `relative${path.delimiter}${bin}` }, 'linux')).resolves.toBe(path.join(bin, 'git'));
  });
});
