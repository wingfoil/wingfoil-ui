/**
 * Snapshot of what a git repository holds, to prove a console session changed nothing in it
 * (e2e-smoke `drive-browser` "every commit is a CLI `wf(…)` commit or a `chore(ui)` commit": v0.1
 * makes no governed write, so its check is "the history and the working tree are unchanged";
 * task-025 AC-5, ES-15). The new commits are listed too, so that a later release can check their
 * subjects instead of their absence.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { git, run } from './run.js';

/** What a repository holds at one moment. */
export interface RepoState {
  head: string;
  /** The branch HEAD points to (`git symbolic-ref -q HEAD`), empty when detached. */
  headRef: string;
  /** `<ref> <object>` of every ref. */
  refs: string[];
  stash: string;
  /** `git status --porcelain`, untracked and ignored files included. */
  status: string;
  /** SHA-256 of `.git/index` and `.git/config`. */
  index: string;
  config: string;
}

async function digest(file: string): Promise<string> {
  try {
    return createHash('sha256')
      .update(await readFile(file))
      .digest('hex');
  } catch {
    return 'absent';
  }
}

/**
 * Snapshot `dir` with `env` (the fixture's isolated git environment). The reads take no optional
 * lock, so the snapshot itself never rewrites `.git/index`.
 */
export async function snapshotRepo(dir: string, env: NodeJS.ProcessEnv): Promise<RepoState> {
  const e = { ...env, GIT_OPTIONAL_LOCKS: '0' };
  const out = async (args: string[]): Promise<string> => (await git(dir, args, e)).stdout.trim();
  const gitDir = path.resolve(dir, await out(['rev-parse', '--git-dir']));
  return {
    head: await out(['rev-parse', 'HEAD']),
    // Exit 1 when HEAD is detached: not an error.
    headRef: (await run('git', ['symbolic-ref', '-q', 'HEAD'], { cwd: dir, env: e, allowFailure: true })).stdout.trim(),
    refs: (await out(['for-each-ref', '--format=%(refname) %(objectname)'])).split('\n').filter(Boolean),
    stash: await out(['stash', 'list']),
    status: await out(['status', '--porcelain=v1', '--untracked-files=all', '--ignored']),
    index: await digest(path.join(gitDir, 'index')),
    config: await digest(path.join(gitDir, 'config')),
  };
}

/** The differences from `before` to `after`, as readable lines (empty: unchanged). */
export async function diffRepo(
  dir: string,
  env: NodeJS.ProcessEnv,
  before: RepoState,
  after: RepoState,
): Promise<string[]> {
  const changes: string[] = [];
  if (before.head !== after.head) {
    changes.push(`HEAD ${before.head} → ${after.head}`);
    const { stdout } = await git(dir, ['log', '--format=new commit %h %an: %s', `${before.head}..${after.head}`], env);
    changes.push(...stdout.trim().split('\n').filter(Boolean));
  }
  if (before.headRef !== after.headRef) {
    changes.push(`HEAD on ${before.headRef || '(detached)'} → ${after.headRef || '(detached)'}`);
  }
  const refsBefore = new Set(before.refs);
  const refsAfter = new Set(after.refs);
  for (const ref of after.refs) if (!refsBefore.has(ref)) changes.push(`ref added or moved: ${ref}`);
  for (const ref of before.refs) if (!refsAfter.has(ref)) changes.push(`ref removed or moved: ${ref}`);
  if (before.stash !== after.stash) changes.push(`stash: ${after.stash || '(empty)'}`);
  if (before.status !== after.status) changes.push(`working tree: ${after.status || '(clean)'}`);
  if (before.index !== after.index) changes.push('.git/index rewritten');
  if (before.config !== after.config) changes.push('.git/config changed');
  return changes;
}
