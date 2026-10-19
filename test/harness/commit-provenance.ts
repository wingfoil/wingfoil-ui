/**
 * Commit provenance of a console session (task-043 AC-1, e2e-smoke `drive-browser`: "every commit
 * the UI causes is a CLI `wf(…)` commit"; decisions D43-1, D43-2, D43-7, D43-8). Given the copy's
 * snapshot before and after a session (`repo-state.ts`), the bare remote's refs before and after,
 * and the commit the remote brought (the test's own push, D43-2), {@link provenanceProblems} lists
 * every way the session differs from "only the CLI's governed commits, each touching its element's
 * file, then pushed": readable lines, empty when clean (`commit-provenance.test.ts` shows each rule
 * failing).
 */
import path from 'node:path';
import type { RepoState } from './repo-state.js';
import { git, run } from './run.js';

/**
 * The CLI's subject forms (`wingfoil@0.2.2`, `test/server/cli/governed-verbs.test.ts`):
 * `wf(<type>): submit <id>` and `wf(<type>): <approve|reject> <id> [<from> → <to>]`.
 */
export const SUBMIT_SUBJECT = /^wf\(([a-z][a-z0-9-]*)\): submit (\S+)$/;
export const DECISION_SUBJECT = /^wf\(([a-z][a-z0-9-]*)\): (approve|reject) (\S+) \[(\S+) → (\S+)\]$/;

/** A commit of the session. */
export interface SessionCommit {
  sha: string;
  subject: string;
  /** Parent shas. */
  parents: string[];
  /** The paths it changes (`git diff-tree --no-commit-id --name-only -r`). */
  files: string[];
}

/** What {@link provenanceProblems} compares. */
export interface ProvenanceInput {
  /** The copy and its isolated git environment. */
  dir: string;
  env: NodeJS.ProcessEnv;
  /** The copy before the session (the console not yet started) and after it (the console stopped). */
  before: RepoState;
  after: RepoState;
  /** `<ref> <object>` of every ref of the bare remote, before and after ({@link remoteRefs}). */
  remoteBefore: string[];
  remoteAfter: string[];
  /** The remote's head right after the test's own push (D43-2). */
  remoteBrought: string;
  /** The subjects of `<before>..<remoteBrought>`, in order: the test's own commits. */
  remoteExpected: string[];
  /** The subjects of the session's governed commits, in order. */
  expected: string[];
  /** The branch and the remote (default `main`, `origin`). */
  branch?: string;
  remote?: string;
}

/** `<ref> <object>` of every ref of the bare repository `remoteDir`. */
export async function remoteRefs(remoteDir: string, env: NodeJS.ProcessEnv): Promise<string[]> {
  const { stdout } = await git(remoteDir, ['for-each-ref', '--format=%(refname) %(objectname)'], env);
  return stdout.split('\n').filter(Boolean);
}

async function out(dir: string, env: NodeJS.ProcessEnv, args: string[]): Promise<string> {
  return (await git(dir, args, env)).stdout.trim();
}

async function describeCommit(dir: string, env: NodeJS.ProcessEnv, sha: string): Promise<SessionCommit> {
  const [subject = '', parents = ''] = (await out(dir, env, ['log', '-1', '--format=%s%x00%P', sha])).split('\0');
  const files = (await out(dir, env, ['diff-tree', '--no-commit-id', '--name-only', '-r', sha]))
    .split('\n')
    .filter(Boolean);
  return { sha, subject, parents: parents.split(' ').filter(Boolean), files };
}

/** The range of a session: its start, its end (the after-snapshot's HEAD) and what the remote brought. */
export interface SessionRange {
  before: string;
  head: string;
  remoteBrought: string;
}

/** The commits of `<before>..<head>` that the remote did not bring (`^<remoteBrought>`), oldest first. */
export async function sessionCommits(
  dir: string,
  env: NodeJS.ProcessEnv,
  { before, head, remoteBrought }: SessionRange,
): Promise<SessionCommit[]> {
  const shas = (await out(dir, env, ['rev-list', '--reverse', head, `^${before}`, `^${remoteBrought}`]))
    .split('\n')
    .filter(Boolean);
  return Promise.all(shas.map((sha) => describeCommit(dir, env, sha)));
}

/** The element id a governed subject names, or `undefined` when it is not one of the CLI's forms. */
export function governedId(subject: string): string | undefined {
  return SUBMIT_SUBJECT.exec(subject)?.[2] ?? DECISION_SUBJECT.exec(subject)?.[3];
}

const short = (sha: string): string => sha.slice(0, 7);

function refMap(refs: readonly string[]): Map<string, string> {
  return new Map(refs.map((line) => [line.slice(0, line.lastIndexOf(' ')), line.slice(line.lastIndexOf(' ') + 1)]));
}

/** The refs of `before` and `after` that differ, except `allowed` (readable lines). */
function refChanges(before: readonly string[], after: readonly string[], allowed: Set<string>, prefix = ''): string[] {
  const b = refMap(before);
  const a = refMap(after);
  const lines: string[] = [];
  for (const [ref, sha] of a)
    if (!allowed.has(ref) && b.get(ref) !== sha) lines.push(`${prefix}ref added or moved: ${ref} ${sha}`);
  for (const [ref, sha] of b) if (!allowed.has(ref) && !a.has(ref)) lines.push(`${prefix}ref removed: ${ref} ${sha}`);
  return lines;
}

/** Every way the session differs from "only the CLI's governed commits of their elements, pushed". */
export async function provenanceProblems(input: ProvenanceInput): Promise<string[]> {
  const { dir, env, before, after } = input;
  const branch = input.branch ?? 'main';
  const remote = input.remote ?? 'origin';
  const problems: string[] = [];

  // What the remote brought: exactly the test's own commits, and HEAD contains them (D43-2).
  const brought = (await out(dir, env, ['log', '--reverse', '--format=%s', input.remoteBrought, `^${before.head}`]))
    .split('\n')
    .filter(Boolean);
  if (JSON.stringify(brought) !== JSON.stringify(input.remoteExpected)) {
    problems.push(`the remote brought ${JSON.stringify(brought)}, not ${JSON.stringify(input.remoteExpected)}`);
  }
  const inHead = await run('git', ['merge-base', '--is-ancestor', input.remoteBrought, after.head], {
    cwd: dir,
    env,
    allowFailure: true,
  });
  if (inHead.code !== 0) problems.push(`the remote's commit ${short(input.remoteBrought)} is not in HEAD`);

  // No merge commit anywhere in the session (the Update is a fast-forward, bug-014).
  const merges = (await out(dir, env, ['rev-list', '--merges', after.head, `^${before.head}`])).split('\n');
  for (const sha of merges.filter(Boolean)) problems.push(`merge commit: ${short(sha)}`);

  // Each commit the UI caused: the CLI's subject form, only its element's file (D43-1).
  const commits = await sessionCommits(dir, env, {
    before: before.head,
    head: after.head,
    remoteBrought: input.remoteBrought,
  });
  // The element's file is its tracked path when the session started (review R3), not a file name.
  const tracked = (await out(dir, env, ['ls-tree', '-r', '--name-only', before.head])).split('\n').filter(Boolean);
  for (const c of commits) {
    if (c.parents.length > 1) continue; // reported above
    const id = governedId(c.subject);
    if (id === undefined) {
      problems.push(`not a governed subject: ${short(c.sha)} ${c.subject}`);
      continue;
    }
    const own = tracked.filter((f) => path.posix.basename(f) === `${id}.md`);
    if (own.length !== 1) {
      problems.push(`${short(c.sha)} ${c.subject}: ${own.length} tracked files named ${id}.md at the start`);
    } else if (c.files.length !== 1 || c.files[0] !== own[0]) {
      problems.push(`${short(c.sha)} ${c.subject} touches ${c.files.join(', ')}, not only ${own[0]}`);
    }
  }
  const subjects = commits.filter((c) => c.parents.length <= 1).map((c) => c.subject);
  if (JSON.stringify(subjects) !== JSON.stringify(input.expected)) {
    problems.push(
      `subjects differ from the session's: ${JSON.stringify(subjects)}, expected ${JSON.stringify(input.expected)}`,
    );
  }

  // The copy: only its branch and its tracking ref moved, both to HEAD; nothing else changed (D43-8:
  // `.git/index` is rewritten by every commit — its effect is compared through the status).
  const local = `refs/heads/${branch}`;
  const tracking = `refs/remotes/${remote}/${branch}`;
  const allowed = new Set([local, tracking]);
  // git ≥ 2.48 creates `refs/remotes/<remote>/HEAD` on fetch (`remote.<name>.followRemoteHEAD`,
  // bug-021); the symref then follows the branch it names. Ignored only while it is a symbolic ref
  // into the remote's own tracking refs: a plain ref of that name, its removal or another remote's
  // HEAD are still reported. Read from the after-snapshot (`RepoState.symrefs`), not live.
  const remoteHeadRef = `refs/remotes/${remote}/HEAD`;
  const target = refMap(after.symrefs).get(remoteHeadRef);
  if (target?.startsWith(`refs/remotes/${remote}/`)) allowed.add(remoteHeadRef);
  problems.push(...refChanges(before.refs, after.refs, allowed));
  const afterRefs = refMap(after.refs);
  if (afterRefs.get(local) !== after.head) problems.push(`${local} is not HEAD`);
  if (afterRefs.get(tracking) !== after.head)
    problems.push(`${tracking} is not HEAD (${afterRefs.get(tracking) ?? 'missing'})`);
  if (before.headRef !== after.headRef) {
    problems.push(`HEAD on ${before.headRef || '(detached)'} → ${after.headRef || '(detached)'}`);
  }
  if (before.stash !== after.stash) problems.push(`stash: ${after.stash || '(empty)'}`);
  if (before.status !== after.status) problems.push(`working tree: ${after.status || '(clean)'}`);
  if (before.config !== after.config) problems.push('.git/config changed');

  // The remote: only its branch moved, to HEAD (the Push).
  problems.push(...refChanges(input.remoteBefore, input.remoteAfter, new Set([local]), 'remote '));
  const remoteHead = refMap(input.remoteAfter).get(local);
  if (remoteHead !== after.head) problems.push(`the remote's ${local} is not HEAD (${remoteHead ?? 'missing'})`);
  return problems;
}
