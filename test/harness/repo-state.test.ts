// task-025 AC-5 (ES-15): the repository snapshot of the "no commit" check detects every kind of
// change a console could make — so that an unchanged snapshot in `no-commit.spec.ts` means
// something.
import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harnessEnv } from './fixtures/index.js';
import { diffRepo, snapshotRepo, type RepoState } from './repo-state.js';
import { git } from './run.js';

let root: string;
let dir: string;
let env: NodeJS.ProcessEnv;
let before: RepoState;

const diff = async (): Promise<string[]> => diffRepo(dir, env, before, await snapshotRepo(dir, env));

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'wfui-repo-state-'));
  ({ env } = await harnessEnv(root));
  env = { ...env, GIT_AUTHOR_NAME: 'Alex', GIT_AUTHOR_EMAIL: 'alex@example.test' };
  env = { ...env, GIT_COMMITTER_NAME: 'Alex', GIT_COMMITTER_EMAIL: 'alex@example.test' };
  dir = path.join(root, 'repo');
  await git(root, ['init', '-q', '-b', 'main', dir], env);
  await writeFile(path.join(dir, 'a.md'), 'a\n');
  await git(dir, ['add', '-A'], env);
  await git(dir, ['commit', '-q', '-m', 'chore: initial commit'], env);
  before = await snapshotRepo(dir, env);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('repository snapshot (AC-5)', () => {
  it('AC-5 reports nothing when nothing changed, and taking it writes nothing', async () => {
    await snapshotRepo(dir, env);
    expect(await diff()).toEqual([]);
  });

  it('AC-5 detects a commit and lists it', async () => {
    await writeFile(path.join(dir, 'a.md'), 'b\n');
    await git(dir, ['commit', '-q', '-am', 'wf(task): submit task-001'], env);
    const changes = await diff();
    expect(changes[0]).toMatch(/^HEAD /);
    expect(changes).toContainEqual(expect.stringMatching(/^new commit [0-9a-f]+ Alex: wf\(task\): submit task-001$/));
  });

  it('AC-5 detects a new ref', async () => {
    await git(dir, ['tag', 'v0'], env);
    expect(await diff()).toEqual([expect.stringMatching(/^ref added or moved: refs\/tags\/v0 /)]);
  });

  it('AC-5 detects an untracked file and a modified one', async () => {
    await writeFile(path.join(dir, 'new.md'), 'x\n');
    expect(await diff()).toEqual(['working tree: ?? new.md']);
    await rm(path.join(dir, 'new.md'));
    await writeFile(path.join(dir, 'a.md'), 'changed\n');
    expect((await diff()).join('\n')).toContain(' M a.md');
  });

  it('AC-5 detects an index write (a plain git status after a touch) and a configuration change', async () => {
    const later = new Date(Date.now() + 60_000);
    await utimes(path.join(dir, 'a.md'), later, later);
    await git(dir, ['status', '--porcelain'], env); // refreshes the stat data: rewrites .git/index
    expect(await diff()).toEqual(['.git/index rewritten']);
    await git(dir, ['config', 'ui.color', 'never'], env);
    expect(await diff()).toEqual(['.git/index rewritten', '.git/config changed']);
  });

  it('AC-5 detects a branch switch and a detached HEAD at the same commit', async () => {
    await git(dir, ['checkout', '-q', '-b', 'other'], env);
    expect(await diff()).toEqual([
      'HEAD on refs/heads/main → refs/heads/other',
      expect.stringMatching(/^ref added or moved: refs\/heads\/other /),
    ]);
    await git(dir, ['checkout', '-q', '--detach', 'main'], env);
    await git(dir, ['branch', '-q', '-D', 'other'], env);
    expect(await diff()).toEqual(['HEAD on refs/heads/main → (detached)']);
  });

  it('AC-5 detects a stash', async () => {
    await writeFile(path.join(dir, 'a.md'), 'stashed\n');
    await git(dir, ['stash', '-q'], env);
    expect((await diff()).join('\n')).toMatch(/stash: stash@\{0\}/);
  });
});
