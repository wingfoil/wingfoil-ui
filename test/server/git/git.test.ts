// REQ-STATE-01/02, REQ-INT-06 (read operations) — the git reads of the snapshot: one
// `git status --porcelain=v2` for HEAD and the working tree, `git config user.email`, `git
// rev-parse` for the layout; nothing else, no optional lock (a read never writes `.git/index`).
import { chmod, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  GitNotFoundError,
  GitReadError,
  GitReads,
  gitEnv,
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
      // W4-5 (security review S1): no fsmonitor program in the server's own reads.
      args: [
        '-c',
        'core.fsmonitor=false',
        '--no-optional-locks',
        'status',
        '--porcelain=v2',
        '--branch',
        '-z',
        '--untracked-files=all',
      ],
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
    expect(runner.requests[0]!.args).toEqual([
      '-c',
      'core.fsmonitor=false',
      '--no-optional-locks',
      'config',
      'user.email',
    ]);
  });

  it('layout: prefix, git dir and common dir in one rev-parse, resolved against the project', async () => {
    const runner = new FakeProcessRunner().answer({ stdout: 'sub/\n/repo/.git\n../.git\n' });
    expect(await reads(runner).layout()).toEqual({ prefix: 'sub/', gitDir: '/repo/.git', commonDir: '/.git' });
    expect(runner.requests[0]!.args).toEqual([
      '-c',
      'core.fsmonitor=false',
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

  it('W4-13: a read whose pipes were cut (drained) is a GitReadError, though git exited 0', async () => {
    const runner = new FakeProcessRunner().answer({ stdout: '# branch.oid', drained: true });
    const error = await reads(runner)
      .status()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GitReadError);
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

describe('gitEnv — inherited GIT_* variables never redirect a read (review F2)', () => {
  it('removes the repository-locating and config-injecting variables, case-insensitively, and keeps the rest', () => {
    const env = gitEnv({
      HOME: '/h',
      PATH: '/bin',
      GIT_CONFIG_GLOBAL: '/g',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_DIR: '/other/.git',
      git_work_tree: '/other',
      GIT_COMMON_DIR: '/c',
      GIT_INDEX_FILE: '/i',
      GIT_OBJECT_DIRECTORY: '/o',
      GIT_ALTERNATE_OBJECT_DIRECTORIES: '/a',
      GIT_NAMESPACE: 'n',
      GIT_CEILING_DIRECTORIES: '/',
      GIT_DISCOVERY_ACROSS_FILESYSTEM: '1',
      GIT_CONFIG_PARAMETERS: "'user.email'='x@y'",
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'user.email',
      GIT_CONFIG_VALUE_0: 'x@y',
      GIT_CONFIG: '/legacy',
    });
    expect(env).toEqual({ HOME: '/h', PATH: '/bin', GIT_CONFIG_GLOBAL: '/g', GIT_CONFIG_NOSYSTEM: '1' });
  });

  it('GitReads reads the project although GIT_DIR, GIT_WORK_TREE and a config injection point elsewhere', async () => {
    const make = async (name: string, email: string) => {
      const repo = path.join(root, name);
      await mkdir(repo, { recursive: true });
      await git(repo, ['init', '-q'], env);
      await git(repo, ['config', 'user.email', email], env);
      return repo;
    };
    const project = await make('project-f2', 'alex@example.test');
    const other = await make('other-f2', 'evil@example.test');
    await writeFile(path.join(project, 'mine.md'), 'x\n');
    const hostile = {
      ...env,
      GIT_DIR: path.join(other, '.git'),
      GIT_WORK_TREE: other,
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'user.email',
      GIT_CONFIG_VALUE_0: 'injected@example.test',
    };
    const r = new GitReads({ git: gitFile, runner: new LocalProcessRunner(), cwd: project, env: hostile });
    expect((await r.status()).entries).toEqual([{ code: '??', path: 'mine.md' }]);
    expect(await r.email()).toBe('alex@example.test');
    expect((await r.layout()).gitDir).toBe(path.join(project, '.git'));
  });

  it('GitReads passes the cleaned environment to the runner', async () => {
    const runner = new FakeProcessRunner().answer({ stdout: 'a@b\n' });
    await new GitReads({ git: '/usr/bin/git', runner, cwd: '/p', env: { HOME: '/h', GIT_DIR: '/x' } }).email();
    expect(runner.requests[0]!.env).toEqual({ HOME: '/h' });
  });
});

// task-032 (D32-1, D32-4): the two reads of a governed write.
describe('GitReads — the governed-write reads (task-032)', () => {
  async function repo(name: string): Promise<{ dir: string; r: GitReads }> {
    const dir = path.join(root, name);
    await mkdir(dir, { recursive: true });
    await git(dir, ['init', '--quiet', '--initial-branch=main'], env);
    await git(dir, ['config', 'user.email', 'alex@example.test'], env);
    await git(dir, ['config', 'user.name', 'Alex'], env);
    await writeFile(path.join(dir, 'e.md'), 'one\n');
    await writeFile(path.join(dir, '-dash.md'), 'dash\n');
    await git(dir, ['add', '.'], env);
    await git(dir, ['commit', '--quiet', '-m', 'init'], env);
    return { dir, r: new GitReads({ git: gitFile, runner: new LocalProcessRunner(), cwd: dir, env }) };
  }

  it('sameEntryEverywhere: true when HEAD, index and working tree agree; false on any difference git status may hide', async () => {
    const { dir, r } = await repo('blobs');
    expect(await r.sameEntryEverywhere('e.md')).toBe(true);
    expect(await r.sameEntryEverywhere('-dash.md')).toBe(true);
    await git(dir, ['update-index', '--assume-unchanged', 'e.md'], env);
    await writeFile(path.join(dir, 'e.md'), 'two\n');
    expect((await git(dir, ['status', '--porcelain'], env)).stdout).toBe('');
    expect(await r.sameEntryEverywhere('e.md')).toBe(false);
    await writeFile(path.join(dir, 'e.md'), 'one\n');
    expect(await r.sameEntryEverywhere('e.md')).toBe(true);
    await writeFile(path.join(dir, 'new.md'), 'untracked\n');
    expect(await r.sameEntryEverywhere('new.md')).toBe(false);
    await git(dir, ['add', 'new.md'], env);
    expect(await r.sameEntryEverywhere('new.md')).toBe(false);
    await rm(path.join(dir, '-dash.md'));
    expect(await r.sameEntryEverywhere('-dash.md')).toBe(false);
  });

  it('sameEntryEverywhere: a mode change hidden by assume-unchanged, a symlink to an identical copy (review S2)', async () => {
    const { dir, r } = await repo('modes');
    await git(dir, ['update-index', '--assume-unchanged', 'e.md'], env);
    await chmod(path.join(dir, 'e.md'), 0o755);
    expect((await git(dir, ['status', '--porcelain'], env)).stdout).toBe('');
    expect(await r.sameEntryEverywhere('e.md')).toBe(false);
    // Not tracked by git (core.fileMode false): the bit no longer counts.
    await git(dir, ['config', 'core.fileMode', 'false'], env);
    expect(await r.sameEntryEverywhere('e.md')).toBe(true);
    await git(dir, ['config', 'core.fileMode', 'true'], env);
    await chmod(path.join(dir, 'e.md'), 0o644);
    expect(await r.sameEntryEverywhere('e.md')).toBe(true);
    await writeFile(path.join(root, 'modes-copy.md'), 'one\n');
    await rm(path.join(dir, 'e.md'));
    await symlink(path.join(root, 'modes-copy.md'), path.join(dir, 'e.md'));
    expect(await r.worktreeBlob('e.md')).toBe((await r.fileAt('HEAD', 'e.md'))?.blob);
    expect(await r.sameEntryEverywhere('e.md')).toBe(false);
  });

  it('fileAt and changedPaths: regular files only; the paths a commit changes', async () => {
    const { dir, r } = await repo('entries');
    await symlink('e.md', path.join(dir, 'link.md'));
    await mkdir(path.join(dir, 'sub'));
    await writeFile(path.join(dir, 'sub', 'x*.md'), 'glob\n');
    await git(dir, ['add', '.'], env);
    await git(dir, ['commit', '--quiet', '-m', 'more'], env);
    const sha = (await git(dir, ['rev-parse', 'HEAD'], env)).stdout.trim();
    expect(await r.fileAt('HEAD', 'e.md')).toMatchObject({ mode: '100644' });
    expect(await r.fileAt('HEAD', 'link.md')).toBeUndefined();
    expect(await r.fileAt('HEAD', 'sub')).toBeUndefined();
    expect(await r.fileAt('HEAD', 'missing.md')).toBeUndefined();
    // Literal pathspecs: `x*.md` names that file, not a pattern.
    expect(await r.fileAt(sha, 'sub/x*.md')).toMatchObject({ mode: '100644' });
    expect(await r.sameEntryEverywhere('sub/x*.md')).toBe(true);
    expect((await r.changedPaths(sha)).sort()).toEqual(['link.md', 'sub/x*.md']);
    await expect(r.changedPaths('--all')).rejects.toBeInstanceOf(GitReadError);
  });

  it('sameEntryEverywhere: the index differing from HEAD (staged) is not the same', async () => {
    const { dir, r } = await repo('staged');
    await writeFile(path.join(dir, 'e.md'), 'two\n');
    await git(dir, ['add', 'e.md'], env);
    await writeFile(path.join(dir, 'e.md'), 'one\n');
    expect(await r.sameEntryEverywhere('e.md')).toBe(false);
  });

  it('commitsSince: the first-parent commits after `before`, newest first, with time and subject', async () => {
    const { dir, r } = await repo('since');
    const before = (await git(dir, ['rev-parse', 'HEAD'], env)).stdout.trim();
    expect(await r.commitsSince(before)).toEqual([]);
    await writeFile(path.join(dir, 'e.md'), 'two\n');
    await git(dir, ['commit', '--quiet', '-am', 'wf(task): submit e [a → b] | odd'], env);
    await writeFile(path.join(dir, 'e.md'), 'three\n');
    await git(dir, ['commit', '--quiet', '-am', 'second'], env);
    const commits = await r.commitsSince(before);
    expect(commits.map((c) => c.subject)).toEqual(['second', 'wf(task): submit e [a → b] | odd']);
    expect(commits[0]!.sha).toBe((await git(dir, ['rev-parse', 'HEAD'], env)).stdout.trim());
    expect(commits[0]!.at).toBeInstanceOf(Date);
    expect(Math.abs(commits[0]!.at.getTime() - Date.now())).toBeLessThan(120_000);
  });

  it('commitsSince refuses a `before` that is not a sha (never an option)', async () => {
    const runner = new FakeProcessRunner();
    const r = new GitReads({ git: '/usr/bin/git', runner, cwd: '/p', env: {} });
    await expect(r.commitsSince('--all')).rejects.toBeInstanceOf(GitReadError);
    expect(runner.requests).toEqual([]);
  });

  it('a timed-out blob read is a GitReadError, not a difference', async () => {
    const runner = new FakeProcessRunner().answer({ ended: 'timeout', exitCode: null });
    const r = new GitReads({ git: '/usr/bin/git', runner, cwd: '/p', env: {} });
    await expect(r.sameEntryEverywhere('e.md')).rejects.toBeInstanceOf(GitReadError);
  });
});
