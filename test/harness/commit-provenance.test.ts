// task-043 AC-1 (D43-7): the commit-provenance check of a UI session sees every kind of commit or
// change that is not the CLI's `wf(…)` commit of its element — so that a clean report in
// `test/e2e/commit-provenance.spec.ts` means something. A scratch repository with a bare remote
// plays the session: the remote brings one commit, the copy fast-forwards to it, two governed
// commits follow, then a push; each test adds one defect before the after-snapshot.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provenanceProblems, remoteRefs, sessionCommits, type ProvenanceInput } from './commit-provenance.js';
import { harnessEnv } from './fixtures/index.js';
import { snapshotRepo, type RepoState } from './repo-state.js';
import { git } from './run.js';

let root: string;
let dir: string;
let remoteDir: string;
let env: NodeJS.ProcessEnv;
let before: RepoState;
let remoteBefore: string[];

const TASK = 'docs/memory/task/task-001-login.md';
const BUG = 'docs/memory/bug/bug-001-crash.md';
const SUBMIT = 'wf(task): submit task-001-login';
const REJECT = 'wf(bug): reject bug-001-crash [pending → draft]';
const OUTSIDE = 'outside: outside.txt';

async function commit(file: string, content: string, subject: string, cwd = dir): Promise<void> {
  await writeFile(path.join(cwd, file), content);
  await git(cwd, ['add', '--', file], env);
  await git(cwd, ['commit', '-q', '-m', subject], env);
}

async function head(cwd = dir): Promise<string> {
  return (await git(cwd, ['rev-parse', 'HEAD'], env)).stdout.trim();
}

/** The session of the e2e test, played with git: returns the remote's head after its own commit. */
async function playSession(): Promise<string> {
  const other = path.join(root, 'other');
  await git(root, ['clone', '-q', remoteDir, other], env);
  await commit('outside.txt', 'theirs\n', OUTSIDE, other);
  await git(other, ['push', '-q', 'origin', 'HEAD:main'], env);
  const brought = await head(other);
  await git(dir, ['pull', '-q', '--ff-only'], env);
  await commit(TASK, 'task, submitted\n', SUBMIT);
  await commit(BUG, 'bug, rejected\n', REJECT);
  await git(dir, ['push', '-q', 'origin', 'HEAD:main'], env);
  return brought;
}

/** The checker's input once the session (and the test's defect) is over. */
async function input(brought: string, expected = [SUBMIT, REJECT]): Promise<ProvenanceInput> {
  await git(dir, ['fetch', '-q', 'origin'], env); // as the console's Push updates the tracking ref
  return {
    dir,
    env,
    before,
    after: await snapshotRepo(dir, env),
    remoteBefore,
    remoteAfter: await remoteRefs(remoteDir, env),
    remoteBrought: brought,
    remoteExpected: [OUTSIDE],
    expected,
  };
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'wfui-provenance-'));
  ({ env } = await harnessEnv(root));
  env = { ...env, GIT_AUTHOR_NAME: 'Morgan', GIT_AUTHOR_EMAIL: 'morgan@example.test' };
  env = { ...env, GIT_COMMITTER_NAME: 'Morgan', GIT_COMMITTER_EMAIL: 'morgan@example.test' };
  remoteDir = path.join(root, 'remote.git');
  dir = path.join(root, 'repo');
  await git(root, ['init', '-q', '--bare', '-b', 'main', remoteDir], env);
  await git(root, ['clone', '-q', remoteDir, dir], env);
  await git(dir, ['checkout', '-q', '-b', 'main'], env);
  await git(dir, ['config', 'user.email', 'morgan@example.test'], env);
  await mkdir(path.join(dir, 'docs/memory/task'), { recursive: true });
  await mkdir(path.join(dir, 'docs/memory/bug'), { recursive: true });
  await writeFile(path.join(dir, TASK), 'task\n');
  await writeFile(path.join(dir, BUG), 'bug\n');
  await git(dir, ['add', '-A'], env);
  await git(dir, ['commit', '-q', '-m', 'chore: initial commit'], env);
  await git(dir, ['branch', '-q', 'other'], env);
  await git(dir, ['tag', 'v0'], env);
  await git(dir, ['push', '-q', '-u', 'origin', 'main', 'other'], env);
  await git(dir, ['fetch', '-q', 'origin'], env);
  before = await snapshotRepo(dir, env);
  remoteBefore = await remoteRefs(remoteDir, env);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('commit provenance of a UI session (task-043 AC-1)', () => {
  it('a clean session: no problem, the governed commits listed without the remote one', async () => {
    const brought = await playSession();
    const commits = await sessionCommits(dir, env, before.head, brought);
    expect(commits.map((c) => [c.subject, c.files])).toEqual([
      [SUBMIT, [TASK]],
      [REJECT, [BUG]],
    ]);
    expect(await provenanceProblems(await input(brought))).toEqual([]);
  });

  it('an extra commit of another form', async () => {
    const brought = await playSession();
    await commit('notes.txt', 'x\n', 'chore(ui): write something');
    await git(dir, ['push', '-q', 'origin', 'HEAD:main'], env);
    const problems = await provenanceProblems(await input(brought));
    expect(problems).toContainEqual(
      expect.stringMatching(/^not a governed subject: [0-9a-f]{7} chore\(ui\): write something$/),
    );
    expect(problems).toContainEqual(expect.stringMatching(/^subjects differ from the session's/));
  });

  it("a governed subject that is not the CLI's form (no transition on a reject)", async () => {
    const brought = await playSession();
    await commit(BUG, 'again\n', 'wf(bug): reject bug-001-crash');
    await git(dir, ['push', '-q', 'origin', 'HEAD:main'], env);
    expect(await provenanceProblems(await input(brought))).toContainEqual(
      expect.stringMatching(/^not a governed subject: [0-9a-f]{7} wf\(bug\): reject bug-001-crash$/),
    );
  });

  it("a governed commit that touches another file than its element's", async () => {
    const brought = await playSession();
    await writeFile(path.join(dir, 'extra.txt'), 'x\n');
    await git(dir, ['add', 'extra.txt'], env);
    await writeFile(path.join(dir, TASK), 'task, approved\n');
    await git(dir, ['commit', '-q', '-am', 'wf(task): approve task-001-login [pending → approved]'], env);
    await git(dir, ['push', '-q', 'origin', 'HEAD:main'], env);
    const problems = await provenanceProblems(
      await input(brought, [SUBMIT, REJECT, 'wf(task): approve task-001-login [pending → approved]']),
    );
    expect(problems).toEqual([
      expect.stringMatching(/touches docs\/memory\/task\/task-001-login\.md, extra\.txt, not only task-001-login\.md$/),
    ]);
  });

  it('a merge commit', async () => {
    const brought = await playSession();
    await git(dir, ['checkout', '-q', '-b', 'side', 'HEAD~1'], env);
    await commit(TASK, 'side\n', 'wf(task): submit task-001-login');
    await git(dir, ['checkout', '-q', 'main'], env);
    await git(dir, ['merge', '-q', '--no-ff', '--no-edit', 'side'], env);
    await git(dir, ['branch', '-q', '-D', 'side'], env);
    await git(dir, ['push', '-q', 'origin', 'HEAD:main'], env);
    expect(await provenanceProblems(await input(brought))).toContainEqual(expect.stringMatching(/^merge commit: /));
  });

  it('a new tag, a moved branch, a stash', async () => {
    const brought = await playSession();
    await git(dir, ['tag', 'v1'], env);
    await git(dir, ['branch', '-q', '-f', 'other', 'HEAD'], env);
    await writeFile(path.join(dir, TASK), 'stashed\n');
    await git(dir, ['stash', '-q'], env);
    const problems = await provenanceProblems(await input(brought));
    expect(problems).toContainEqual(expect.stringMatching(/^ref added or moved: refs\/tags\/v1 /));
    expect(problems).toContainEqual(expect.stringMatching(/^ref added or moved: refs\/heads\/other /));
    expect(problems).toContainEqual(expect.stringMatching(/^stash: /));
  });

  it('a configuration change and an untracked file', async () => {
    const brought = await playSession();
    await git(dir, ['config', 'ui.color', 'never'], env);
    await writeFile(path.join(dir, 'left.txt'), 'x\n');
    const problems = await provenanceProblems(await input(brought));
    expect(problems).toContainEqual('.git/config changed');
    expect(problems).toContainEqual('working tree: ?? left.txt');
  });

  it("not pushed: the remote's branch and the tracking ref are not at HEAD", async () => {
    const brought = await playSession();
    await commit(TASK, 'local only\n', 'wf(task): submit task-001-login');
    const problems = await provenanceProblems(await input(brought, [SUBMIT, REJECT, SUBMIT]));
    expect(problems).toContainEqual(expect.stringMatching(/^the remote's refs\/heads\/main is not HEAD/));
    expect(problems).toContainEqual(expect.stringMatching(/^refs\/remotes\/origin\/main is not HEAD/));
  });

  it("a ref added on the remote, and a remote commit that is not the test's", async () => {
    const brought = await playSession();
    await git(dir, ['push', '-q', 'origin', 'HEAD:refs/heads/extra'], env);
    const problems = await provenanceProblems({
      ...(await input(brought)),
      remoteExpected: ['outside: something else'],
    });
    expect(problems).toContainEqual(expect.stringMatching(/^remote ref added or moved: refs\/heads\/extra /));
    expect(problems).toContainEqual(expect.stringMatching(/^the remote brought /));
  });

  it("the remote's commit not in HEAD (no update)", async () => {
    const other = path.join(root, 'other');
    await git(root, ['clone', '-q', remoteDir, other], env);
    await commit('outside.txt', 'theirs\n', OUTSIDE, other);
    await git(other, ['push', '-q', 'origin', 'HEAD:main'], env);
    const brought = await head(other);
    expect(await provenanceProblems(await input(brought, []))).toContainEqual(
      expect.stringMatching(/^the remote's commit [0-9a-f]{7} is not in HEAD$/),
    );
  });
});
