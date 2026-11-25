// dl-028 (governance-evolution-13-plan step 4) — this repository's bound checks of `backlog-item`:
// `scripts/project-checks/flow-tdd.mjs` (the pre check that skips the optional red for `flow:
// direct`) and `scripts/project-checks/task-tests.mjs` (tests-red, tests-green on red's own files),
// on a throwaway repository whose `npm test` and `test:e2e:chromium` are a fake that fails on a file
// holding the word FAIL, and fails a full run while a `full-fails` file exists.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { harnessEnv } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { TempWorkspace } from '../harness/temp-workspace.js';

const FLOW = path.join(REPO_ROOT, 'scripts', 'project-checks', 'flow-tdd.mjs');
const TESTS = path.join(REPO_ROOT, 'scripts', 'project-checks', 'task-tests.mjs');
const TASK = 'task-901-a-scratch-task';
const FAKE = `import { appendFileSync, existsSync, readFileSync } from 'node:fs';
const [tool, ...files] = process.argv.slice(2);
appendFileSync('calls.log', JSON.stringify({ tool, files }) + '\\n');
if (!files.length) process.exit(existsSync('full-fails') ? 1 : 0);
process.exit(files.some((f) => readFileSync(f, 'utf8').includes('FAIL')) ? 1 : 0);
`;

let ws: TempWorkspace;
let repo: string;
let env: NodeJS.ProcessEnv;

async function commitFile(file: string, text: string, subject: string): Promise<string> {
  await mkdir(path.dirname(path.join(repo, file)), { recursive: true });
  await writeFile(path.join(repo, file), text);
  await git(repo, ['add', file], env);
  await git(repo, ['commit', '--quiet', '-m', subject], env);
  return (await git(repo, ['rev-parse', 'HEAD'], env)).stdout.trim();
}

async function head(): Promise<string> {
  return (await git(repo, ['rev-parse', 'HEAD'], env)).stdout.trim();
}

function check(script: string, args: string[], extra: NodeJS.ProcessEnv = {}) {
  return ws.run(process.execPath, [script, ...args], {
    cwd: repo,
    env: { ...env, WINGFOIL_ELEMENT: TASK, WINGFOIL_RUNNER_CHECKOUT: repo, ...extra },
    allowFailure: true,
  });
}

async function calls(): Promise<{ tool: string; files: string[] }[]> {
  const text = await readFile(path.join(repo, 'calls.log'), 'utf8').catch(() => '');
  await rm(path.join(repo, 'calls.log'), { force: true });
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { tool: string; files: string[] });
}

async function task(flow: string | null): Promise<void> {
  const file = path.join(repo, 'docs', '04_memory', 'v9.9', `${TASK}.md`);
  await mkdir(path.dirname(file), { recursive: true });
  const field = flow === null ? '' : `flow: ${JSON.stringify(flow)}\n`;
  await writeFile(file, `---\nid: ${TASK}\ntype: task\nstatus: in-progress\n${field}---\n\n## Description\n`);
}

/** One completed red run record of the scratch task, from `base` to `redHead`. */
async function redRecord(base: string, redHead: string): Promise<void> {
  const record = {
    id: `${TASK}/red/1`,
    element: `task:${TASK}`,
    workflow: 'backlog-item',
    phase: 'red',
    role: 'qa',
    mode: 'fresh',
    agent: 'claude',
    adapter: 'claude-sonnet',
    agent_version: '2.1.322 (Claude Code)',
    model: 'claude-sonnet-5-5',
    session: '00000000-0000-4000-8000-000000000001',
    tokens: { input: 1, output: 1, cache_read: 0, cache_write: 0 },
    wingfoil: '0.3.2 (6de2e13c004bbf419acfa7dc4d98d5a7468cd693)',
    state_ref: base,
    duration_ms: 1,
    exit_status: 0,
    result: 'completed',
    notes: `line=trunk at=2026-11-25T10:00:00.000Z step=backlog-item.red@task:${TASK} instance=sw-life-cycle-1-plan head=${redHead}`,
  };
  await mkdir(path.join(repo, 'docs', 'runs'), { recursive: true });
  await writeFile(path.join(repo, 'docs', 'runs', `${TASK}.jsonl`), `${JSON.stringify(record)}\n`);
}

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-dl-028-checks-');
  repo = path.join(ws.dir, 'repo');
  await mkdir(repo);
  env = (await harnessEnv(ws.dir)).env;
  await git(repo, ['init', '--quiet', '--initial-branch=main'], env);
  await git(repo, ['config', 'user.email', 'alex@example.test'], env);
  await git(repo, ['config', 'user.name', 'Alex'], env);
  await writeFile(path.join(repo, 'fake.mjs'), FAKE);
  await writeFile(
    path.join(repo, 'package.json'),
    JSON.stringify({
      name: 'scratch',
      private: true,
      scripts: { test: 'node fake.mjs unit', 'test:e2e:chromium': 'node fake.mjs e2e' },
    }),
  );
  await writeFile(path.join(repo, '.gitignore'), 'calls.log\nfull-fails\ndocs/\n');
  await git(repo, ['add', '.'], env);
  await git(repo, ['commit', '--quiet', '-m', 'start'], env);
}, 120_000);

afterAll(async () => {
  await ws.dispose();
});

describe('scripts/project-checks/flow-tdd.mjs', () => {
  it('fails, so red is skipped, only for `direct` with its reason', async () => {
    await task('direct — the Wave 2 gate: no product code');
    const res = await check(FLOW, []);
    expect(res.code).toBe(1);
    expect(res.stderr).toContain('flow: direct — the Wave 2 gate: no product code');
  });

  it.each([
    ['no flow field', null],
    ['tdd', 'tdd'],
    ['a bare direct with no reason', 'direct'],
    ['an unknown value', 'fast'],
  ])('passes, so red runs, for %s', async (_name, flow) => {
    await task(flow);
    const res = await check(FLOW, []);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('red runs');
  });

  it('passes when the task file is not found', async () => {
    const res = await check(FLOW, ['--element', 'task-999-absent']);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('no file for task-999-absent');
  });
});

describe('scripts/project-checks/task-tests.mjs', () => {
  it("red: passes when red's vitest file and spec fail, each run by its own tool", async () => {
    const base = await head();
    await commitFile('test/web/a.test.ts', 'FAIL\n', 'test: red unit');
    await commitFile('test/e2e/a.spec.ts', 'FAIL\n', 'test: red spec');
    const res = await check(TESTS, ['--expect', 'red'], { WINGFOIL_RUNNER_BASE: base });
    expect(res.code).toBe(0);
    expect(await calls()).toEqual([
      { tool: 'unit', files: ['test/web/a.test.ts'] },
      { tool: 'e2e', files: ['test/e2e/a.spec.ts'] },
    ]);
  });

  it('red: rejects a red file that already passes', async () => {
    const base = await head();
    await commitFile('test/server/b.test.ts', 'ok\n', 'test: a passing test');
    const res = await check(TESTS, ['--expect', 'red'], { WINGFOIL_RUNNER_BASE: base });
    expect(res.code).toBe(1);
    expect(res.stderr).toContain("vitest passes on red's files (test/server/b.test.ts)");
    await calls();
  });

  it('red: rejects a red that wrote no test a tool runs', async () => {
    const base = await head();
    await commitFile('test/timing/c.test.ts', 'FAIL\n', 'test: timing only');
    const res = await check(TESTS, ['--expect', 'red'], { WINGFOIL_RUNNER_BASE: base });
    expect(res.code).toBe(1);
    expect(res.stderr).toContain('red wrote no test file a tool runs');
    expect(await calls()).toEqual([]);
  });

  it('red: cannot run without a base', async () => {
    const res = await check(TESTS, ['--expect', 'red']);
    expect(res.code).toBe(2);
  });

  it("green: runs npm test, then red's specs on Chromium, from the red run records", async () => {
    const base = await head();
    await commitFile('test/e2e/d.spec.ts', 'FAIL\n', 'test: red spec d');
    const redHead = await head();
    await redRecord(base, redHead);
    await commitFile('server/d.ts', 'code\n', 'feat: green');
    let res = await check(TESTS, ['--expect', 'green']);
    expect(res.code).toBe(1);
    expect(res.stderr).toContain("red's specs fail on Chromium");
    expect(await calls()).toEqual([
      { tool: 'unit', files: [] },
      { tool: 'e2e', files: ['test/e2e/d.spec.ts'] },
    ]);
    // Green may not touch red's spec: here the fake passes once the app makes it pass.
    await writeFile(path.join(repo, 'test', 'e2e', 'd.spec.ts'), 'now passing\n');
    res = await check(TESTS, ['--expect', 'green']);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("npm test passes, and red's specs on Chromium (test/e2e/d.spec.ts)");
    await git(repo, ['checkout', '--', 'test/e2e/d.spec.ts'], env);
    await calls();
  });

  it('green: with no red run (a red skipped for flow: direct) runs npm test only', async () => {
    await rm(path.join(repo, 'docs', 'runs'), { recursive: true, force: true });
    let res = await check(TESTS, ['--expect', 'green']);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('npm test passes (no red test file to run)');
    expect(await calls()).toEqual([{ tool: 'unit', files: [] }]);
    await writeFile(path.join(repo, 'full-fails'), '');
    res = await check(TESTS, ['--expect', 'green']);
    expect(res.code).toBe(1);
    expect(res.stderr).toContain('npm test failed (exit 1)');
    await rm(path.join(repo, 'full-fails'));
    await calls();
  });
});
