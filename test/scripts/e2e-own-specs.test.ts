// task-071 (AC-2, D71-6, D71-7) — `scripts/e2e-own-specs.mjs`, the spec list of the `own-specs`
// job of `.github/workflows/gates.yml`: the `specs` dispatch input (read from `SPECS`, never from
// the command line) when it holds anything, else the e2e spec files the branch changes against its
// merge-base with the phase branch. Every token and every path git prints must be a plain spec path
// under `test/e2e/` naming an existing file, or the run fails with the token escaped: the list
// reaches Playwright as a bash array, and no line the script prints can start a workflow command.
// Run on a throwaway repository with the harness's git identity rule.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { harnessEnv } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { TempWorkspace } from '../harness/temp-workspace.js';

const SCRIPT = path.join(REPO_ROOT, 'scripts', 'e2e-own-specs.mjs');
const PHASE = 'design/dev-loop_v0.3';
const ID = ['-c', 'user.email=harness@example.invalid'];
let ws: TempWorkspace;
let repo: string;
let env: NodeJS.ProcessEnv;

async function put(file: string, text = `// ${file}\n`): Promise<void> {
  await mkdir(path.dirname(path.join(repo, file)), { recursive: true });
  await writeFile(path.join(repo, file), text);
}
async function commit(message: string): Promise<void> {
  await git(repo, ['add', '-A'], env);
  await git(repo, [...ID, 'commit', '-q', '-m', message], env);
}

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-071-own-specs-');
  ({ env } = await harnessEnv(path.join(ws.dir, 'harness')));
  repo = path.join(ws.dir, 'repo');
  await mkdir(repo);
  await git(repo, ['init', '-q', '-b', 'main'], env);
  for (const f of [
    'test/e2e/a.spec.ts',
    'test/e2e/b.spec.ts',
    'test/e2e/c.spec.ts',
    'test/e2e/harness/h.spec.ts',
    'test/e2e/support/console.ts',
    'playwright.config.ts',
  ])
    await put(f);
  await commit('base');
  await git(repo, ['branch', PHASE], env);
  // The task branch: one spec changed, one added under harness/, one deleted, one renamed, the
  // e2e support and the Playwright config changed, a document added.
  await git(repo, ['switch', '-q', '-c', 'task/task-999-x'], env);
  await put('test/e2e/a.spec.ts', '// changed\n');
  await put('test/e2e/harness/n.spec.ts');
  await rm(path.join(repo, 'test/e2e/b.spec.ts'));
  await git(repo, ['mv', 'test/e2e/c.spec.ts', 'test/e2e/d.spec.ts'], env);
  await put('test/e2e/support/console.ts', '// changed\n');
  await put('playwright.config.ts', '// changed\n');
  await put('docs/notes.md');
  await commit('task');
  // The phase branch moves on after the task branched: its new spec is not the task's.
  await git(repo, ['switch', '-q', PHASE], env);
  await put('test/e2e/p.spec.ts');
  await commit('phase');
  await git(repo, ['switch', '-q', 'task/task-999-x'], env);
});

afterAll(async () => {
  await ws?.dispose();
});

async function select(specs: string | undefined, args: string[] = ['--base', PHASE], branch = 'task/task-999-x') {
  await git(repo, ['switch', '-q', branch], env);
  const e: NodeJS.ProcessEnv = { ...env };
  delete e['SPECS'];
  if (specs !== undefined) e['SPECS'] = specs;
  return ws.run(process.execPath, [SCRIPT, ...args], { cwd: repo, env: e, allowFailure: true });
}
const lines = (text: string): string[] => text.split('\n').filter(Boolean);

describe('e2e-own-specs.mjs (task-071, AC-2, D71-6)', () => {
  it('without the input: the specs the branch changes since its merge-base with the phase branch', async () => {
    const r = await select(undefined);
    expect(r.code, r.stderr).toBe(0);
    // Changed, added under harness/, renamed (the new path); not the deleted one, not the phase
    // branch's later spec, not the support file, the config or the document.
    expect(lines(r.stdout)).toEqual(['test/e2e/a.spec.ts', 'test/e2e/d.spec.ts', 'test/e2e/harness/n.spec.ts']);
    expect(r.stderr).toContain(`changed against the merge-base with ${PHASE}`);
  });

  it('names the changed e2e support and Playwright config, selecting no spec for them (D71-7)', async () => {
    const r = await select('');
    expect(r.code).toBe(0);
    expect(r.stderr).toMatch(/notice: .*test\/e2e\/support\/console\.ts/);
    expect(r.stderr).toMatch(/notice: .*playwright\.config\.ts/);
    expect(r.stderr).toContain('wave scope');
  });

  it('an empty or blank input is no input', async () => {
    for (const blank of ['', '   ', '\t \n']) {
      const r = await select(blank);
      expect(r.code).toBe(0);
      expect(lines(r.stdout)).toHaveLength(3);
    }
  });

  it('on the phase branch itself: no spec, one line that says so, success', async () => {
    const r = await select(undefined, ['--base', PHASE], PHASE);
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toBe('');
    expect(r.stderr).toMatch(/no own e2e spec/);
  });

  it('the input wins over the diff: sorted, without duplicates, any whitespace between tokens', async () => {
    const r = await select('  test/e2e/c.spec.ts\ttest/e2e/harness/h.spec.ts  test/e2e/c.spec.ts ', undefined, PHASE);
    expect(r.code, r.stderr).toBe(0);
    expect(lines(r.stdout)).toEqual(['test/e2e/c.spec.ts', 'test/e2e/harness/h.spec.ts']);
    expect(r.stderr).toContain('from the specs input');
  });

  it.each([
    ['a parent segment', 'test/e2e/../e2e/a.spec.ts'],
    ['a dot segment', 'test/e2e/./a.spec.ts'],
    ['an escape from the folder', '../test/e2e/a.spec.ts'],
    ['an absolute path', '/test/e2e/a.spec.ts'],
    ['a shell separator', 'test/e2e/a.spec.ts;id'],
    ['a command substitution', 'test/e2e/$(id).spec.ts'],
    ['a backtick', 'test/e2e/`id`.spec.ts'],
    ['an option', '--project=webkit'],
    ['a glob', 'test/e2e/*.spec.ts'],
    ['a file that is not a spec', 'test/e2e/support/console.ts'],
    ['a spec outside test/e2e', 'test/a.spec.ts'],
    ['a missing spec', 'test/e2e/missing.spec.ts'],
    ['a control character', 'test/e2e/a\u001b[31m.spec.ts'],
    ['a workflow command', '::error::x'],
  ])('refuses %s: exit 1, nothing on stdout, the token escaped on a refused: line', async (_, token) => {
    const r = await select(`test/e2e/c.spec.ts ${token}`, undefined, PHASE);
    expect(r.code).toBe(1);
    expect(r.stdout).toBe('');
    expect(r.stderr).toMatch(/^refused: [^\n]+\n$/);
    expect(r.stderr).toContain(JSON.stringify(token).slice(1, -1));
    expect(r.stderr).not.toContain('\u001b');
    for (const line of r.stderr.split('\n')) expect(line.trimStart().startsWith('::')).toBe(false);
  });

  it('refuses a changed spec whose path is not plain, instead of leaving it out', async () => {
    await git(repo, ['switch', '-q', '-c', 'task/task-998-odd', PHASE], env);
    await put('test/e2e/we ird.spec.ts');
    await commit('odd');
    const r = await select(undefined, ['--base', PHASE], 'task/task-998-odd');
    expect(r.code).toBe(1);
    expect(r.stdout).toBe('');
    expect(r.stderr).toMatch(/^refused: [^\n]*we ird\.spec\.ts/);
  });

  it('fails when the base cannot be resolved, naming it (D71-7)', async () => {
    const r = await select(undefined, ['--base', 'origin/no-such-branch']);
    expect(r.code).toBe(1);
    expect(r.stdout).toBe('');
    expect(r.stderr).toMatch(/^refused: .*origin\/no-such-branch/);
  });

  it('refuses a base that git would read as an option, and a usage error exits 2', async () => {
    const opt = await select(undefined, ['--base', '--output=x']);
    expect(opt.code).toBe(1);
    expect(opt.stderr).toMatch(/^refused: /);
    for (const args of [[], ['--base'], ['--other', PHASE], ['--base', PHASE, 'extra']]) {
      const usage = await select(undefined, args);
      expect(usage.code, JSON.stringify(args)).toBe(2);
      expect(usage.stderr).toMatch(/^usage: /);
    }
  });
});
