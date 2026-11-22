// task-091 (bug-053), review: the `repeat` job of `.github/workflows/gates.yml` takes the `specs`
// dispatch input through the validator of `scripts/e2e-own-specs.mjs` (`--explicit`) and hands
// Playwright only the validated paths. The two steps' `run:` blocks are taken from the real file
// and executed under `bash -e -o pipefail` in a throwaway folder, with a recording `npm` in front
// of the real one: a refused input must stop before `npm` is called.
import { chmod, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { REPO_ROOT } from '../harness/cli.js';
import { TempWorkspace } from '../harness/temp-workspace.js';

interface Step {
  name?: string;
  run?: string;
}
let ws: TempWorkspace;
let folder: string;
let validate: string;
let run: string;

beforeAll(async () => {
  const wf = parse(await readFile(path.join(REPO_ROOT, '.github', 'workflows', 'gates.yml'), 'utf8')) as {
    jobs: Record<string, { steps: Step[] }>;
  };
  const steps = wf.jobs['repeat']!.steps;
  validate = steps.find((s) => s.run?.includes('e2e-own-specs.mjs'))?.run ?? '';
  run = steps.find((s) => s.run?.includes('--repeat-each'))?.run ?? '';
  ws = await TempWorkspace.create('wfui-task-091-repeat-');
  folder = path.join(ws.dir, 'job');
  await mkdir(path.join(folder, 'scripts'), { recursive: true });
  await mkdir(path.join(folder, 'bin'));
  await mkdir(path.join(folder, 'test', 'e2e'), { recursive: true });
  await copyFile(
    path.join(REPO_ROOT, 'scripts', 'e2e-own-specs.mjs'),
    path.join(folder, 'scripts', 'e2e-own-specs.mjs'),
  );
  for (const f of ['a', 'b']) await writeFile(path.join(folder, 'test', 'e2e', `${f}.spec.ts`), '//\n');
  await writeFile(path.join(folder, 'bin', 'npm'), '#!/bin/bash\nprintf "%s\\n" "$@" > "$CALLS"\n');
  await chmod(path.join(folder, 'bin', 'npm'), 0o755);
});
afterAll(async () => {
  await ws?.dispose();
});

/** The job's two steps in order; `calls` is what the recording `npm` got, null when it never ran. */
async function job(specs: string, repeat = '3'): Promise<{ code: number; stderr: string; calls: string[] | null }> {
  const calls = path.join(folder, 'calls.txt');
  await rm(calls, { force: true });
  const env = { ...process.env, PATH: `${path.join(folder, 'bin')}:${process.env['PATH']}`, CALLS: calls };
  const bash = (script: string, extra: Record<string, string>) =>
    ws.run('bash', ['-e', '-o', 'pipefail', '-c', script], {
      cwd: folder,
      env: { ...env, ...extra },
      allowFailure: true,
    });
  const v = await bash(validate, { SPECS: specs });
  if (v.code !== 0) return { code: v.code ?? 1, stderr: v.stderr, calls: null };
  const r = await bash(run, { REPEAT: repeat });
  const text = await readFile(calls, 'utf8').catch(() => null);
  return { code: r.code ?? 1, stderr: r.stderr, calls: text === null ? null : text.split('\n').filter(Boolean) };
}

describe('gates.yml — the repeat job validates its specs input (task-091, bug-053)', () => {
  it('finds both steps of the real file', () => {
    expect(validate).toContain('--explicit');
    expect(run).toContain('mapfile');
  });

  it('accepts valid specs and hands Playwright exactly those paths, after the repeat options', async () => {
    const r = await job(' test/e2e/b.spec.ts\ttest/e2e/a.spec.ts test/e2e/a.spec.ts ');
    expect(r.code, r.stderr).toBe(0);
    expect(r.calls).toEqual([
      'run',
      'test:e2e:chromium',
      '--',
      '--repeat-each',
      '3',
      '--reporter=github,html',
      'test/e2e/a.spec.ts',
      'test/e2e/b.spec.ts',
    ]);
  });

  it.each([
    ['an option token', '--retries=2'],
    ['an option among valid specs', 'test/e2e/a.spec.ts --retries=2'],
    ['an option with a spec shape', '--grep=x.spec.ts'],
    ['a parent segment', 'test/e2e/../e2e/session-recovery.spec.ts'],
    ['a dot segment', 'test/e2e/./a.spec.ts'],
    ['a missing file', 'test/e2e/nonexistent.spec.ts'],
    ['a valid spec with a missing one', 'test/e2e/a.spec.ts test/e2e/nonexistent.spec.ts'],
    ['a path escaping the folder', '../test/e2e/a.spec.ts'],
    ['an empty input (no fallback to changed files)', ''],
    ['a blank input', ' \t '],
  ])('refuses %s before Playwright is invoked', async (_name, specs) => {
    const r = await job(specs);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/^refused: /m);
    expect(r.calls).toBeNull();
  });

  it('still refuses a bad repeat count before Playwright is invoked', async () => {
    for (const repeat of ['', '0', '03', '-1', '2x', '201']) {
      const r = await job('test/e2e/a.spec.ts', repeat);
      expect(r.code, repeat).toBe(1);
      expect(r.calls, repeat).toBeNull();
    }
  });
});
