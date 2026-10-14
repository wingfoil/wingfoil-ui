// TT-SEC-10 (RP-45, task-032 D32-9) — `scripts/action-log-ratio.mjs` on a throwaway repository with
// approve, reject, submit and hand-transition commits and a state file logging some of them.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { harnessEnv } from '../harness/fixtures/index.js';
import { git, run } from '../harness/run.js';
import { TempWorkspace } from '../harness/temp-workspace.js';

const SCRIPT = path.join(REPO_ROOT, 'scripts', 'action-log-ratio.mjs');
let ws: TempWorkspace;
let repo: string;
let env: NodeJS.ProcessEnv;
const sha: Record<string, string> = {};

async function commit(subject: string, key: string): Promise<void> {
  await writeFile(path.join(repo, 'f.md'), `${key}\n`);
  await git(repo, ['add', 'f.md'], env);
  await git(repo, ['commit', '--quiet', '-m', subject], env);
  sha[key] = (await git(repo, ['rev-parse', 'HEAD'], env)).stdout.trim();
}

async function state(shas: string[]): Promise<string> {
  const file = path.join(ws.dir, `state-${shas.length}.json`);
  const actionLog = shas.map((s) => ({ sha: s, at: '2026-10-14T10:00:00Z' }));
  await writeFile(file, JSON.stringify({ version: 1, projects: [], settings: {}, actionLog }));
  return file;
}

function ratio(args: string[]) {
  return run(process.execPath, [SCRIPT, ...args], { cwd: repo, env, allowFailure: true });
}

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-032-ratio-');
  repo = path.join(ws.dir, 'repo');
  await mkdir(repo);
  env = (await harnessEnv(ws.dir)).env;
  await git(repo, ['init', '--quiet', '--initial-branch=main'], env);
  await git(repo, ['config', 'user.email', 'alex@example.test'], env);
  await git(repo, ['config', 'user.name', 'Alex'], env);
  await commit('start', 'start');
  await commit('wf(task): submit task-001-a', 'submit');
  await commit('wf(task): approve task-001-a [pending → approved]', 'approve1');
  await commit('wf(task): task-001-a [approved → done]', 'hand');
  await commit('wf(bug): reject bug-001-b [pending → draft]', 'reject');
  await commit('wf(task): approve task-002-c [in-review → approved]', 'approve2');
}, 120_000);

afterAll(async () => {
  await ws.dispose();
});

describe('scripts/action-log-ratio.mjs', () => {
  it('counts the approve and reject commits of the range found in the action log', async () => {
    const file = await state([sha.approve1!, sha.reject!, sha.submit!]);
    const res = await ratio(['--state', file, `${sha.start!}..HEAD`]);
    expect(res.code).toBe(0);
    expect(res.stdout).toBe(`2/3 (66.7 %)\nnot in the action log: ${sha.approve2!}\n`);
  });

  it('--json, and a range bounds the count', async () => {
    const file = await state([sha.approve2!]);
    const res = await ratio(['--json', '--state', file, `${sha.hand!}..HEAD`]);
    expect(JSON.parse(res.stdout)).toEqual({
      range: `${sha.hand!}..HEAD`,
      total: 2,
      logged: 1,
      ratio: 0.5,
      unlogged: [sha.reject!],
    });
  });

  it('a range with no decision has no ratio', async () => {
    const file = await state([]);
    const res = await ratio(['--json', '--state', file, `${sha.start!}..${sha.submit!}`]);
    expect(JSON.parse(res.stdout)).toMatchObject({ total: 0, logged: 0, ratio: null, unlogged: [] });
    expect((await ratio(['--state', file, `${sha.start!}..${sha.submit!}`])).stdout).toBe(
      '0/0 (no approve or reject commit)\n',
    );
  });

  it.each([[[]], [['HEAD']], [['--state']], [['--bogus', 'x', 'HEAD']]])('usage error %j → exit 2', async (args) => {
    expect((await ratio(args)).code).toBe(2);
  });

  it('an unreadable state file or a range git refuses → exit 2', async () => {
    expect((await ratio(['--state', path.join(ws.dir, 'missing.json'), 'HEAD'])).code).toBe(2);
    const file = await state([]);
    const res = await ratio(['--state', file, '--', '--output=x']);
    expect(res.code).toBe(2);
  });
});
