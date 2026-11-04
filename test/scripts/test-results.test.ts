// task-052 (AC-2, AC-3; D52-7, the approver's Q3) — `scripts/test-results.mjs`, the
// `test-results.md` asset of the GitHub Release: a summary of the gate's suite run built from
// Vitest's JSON results with fixed fields only — counts per suite (the first folder under `test/`),
// the commit, the run URL. Vitest's results name every file by its absolute path and carry test
// titles and failure messages; none of them may reach the asset (dl-005).
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { TempWorkspace } from '../harness/temp-workspace.js';

const SCRIPT = path.join(REPO_ROOT, 'scripts', 'test-results.mjs');
const SHA = '0123456789abcdef0123456789abcdef01234567';
const RUN_URL = 'https://github.com/wingfoil/wingfoil-ui/actions/runs/39497286374';
let ws: TempWorkspace;

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-052-results-');
  await writeFile(path.join(ws.dir, 'package.json'), JSON.stringify({ name: 'wingfoil-ui', version: '0.3.0' }));
});

afterAll(async () => {
  await ws?.dispose();
});

type Status = 'passed' | 'failed' | 'skipped' | 'pending' | 'todo';
function file(name: string, statuses: Status[], status = statuses.includes('failed') ? 'failed' : 'passed') {
  return {
    name,
    status,
    message: status === 'failed' && statuses.length === 0 ? `Failed to load ${name}` : '',
    assertionResults: statuses.map((s, i) => ({
      ancestorTitles: [`suite reading ${ws.dir}`],
      title: `test ${i} of ${name}`,
      fullName: `suite reading ${ws.dir} test ${i} of ${name}`,
      status: s,
      failureMessages: s === 'failed' ? [`Error: ENOENT ${path.join(ws.dir, 'secret')}\n    at ${name}:3:7`] : [],
    })),
  };
}

/** Results as Vitest's JSON reporter writes them (absolute file names, titles, messages, coverage). */
function results(): Record<string, unknown> {
  const at = (...parts: string[]) => path.join(ws.dir, ...parts);
  return {
    numTotalTests: 9,
    success: false,
    testResults: [
      file(at('test', 'server', 'http', 'routes.test.ts'), ['passed', 'passed', 'failed']),
      file(at('test', 'server', 'app.test.ts'), ['passed', 'skipped']),
      file(at('test', 'web', 'today', 'today.test.tsx'), ['passed', 'todo', 'pending']),
      file(at('test', 'web', 'broken.test.tsx'), [], 'failed'),
      file(at('test', 'top.test.ts'), ['passed']),
      file(at('test', 'Odd Folder', 'x.test.ts'), ['passed']),
      file('/tmp/x/test/server/elsewhere.test.ts', ['passed']),
    ],
    coverageMap: { [at('server', 'src', 'app.ts')]: { path: at('server', 'src', 'app.ts') } },
  };
}

async function summarise(input: unknown, args: string[] = ['--commit', SHA, '--run-url', RUN_URL]) {
  const name = path.join(ws.dir, `results-${Math.random().toString(36).slice(2)}.json`);
  await writeFile(name, typeof input === 'string' ? input : JSON.stringify(input));
  return ws.run(process.execPath, [SCRIPT, name, ...args], { cwd: ws.dir, allowFailure: true });
}

describe('test-results.mjs (task-052, D52-7)', () => {
  it('counts files and tests per suite, with a total row, the version, the commit and the run', async () => {
    const result = await summarise(results());
    expect(result.stderr).toBe('');
    expect(result.code).toBe(0);
    const md = result.stdout;
    expect(md).toContain('# Test results of wingfoil-ui 0.3.0');
    expect(md).toContain(`Commit \`${SHA}\``);
    expect(md).toContain(`[run 39497286374](${RUN_URL})`);
    expect(md).toContain('| Suite | Files | Files failed | Tests passed | Tests failed | Tests skipped |');
    // other = directly in test/, an odd folder name, a file outside the working directory.
    expect(md).toContain('| other | 3 | 0 | 3 | 0 | 0 |');
    expect(md).toContain('| server | 2 | 1 | 3 | 1 | 1 |');
    expect(md).toContain('| web | 2 | 1 | 1 | 0 | 2 |');
    expect(md).toContain('| **total** | **7** | **2** | **7** | **1** | **3** |');
    expect(md).toContain('Result: **failed**');
    const rows = md.split('\n').filter((line) => line.startsWith('| ') && !line.startsWith('| Suite'));
    expect(rows.map((r) => r.split(' | ')[0])).toEqual(['| other', '| server', '| web', '| **total**']);
  });

  it('writes no path, no test title and no failure message', async () => {
    const md = (await summarise(results())).stdout;
    expect(md).not.toContain(ws.dir);
    expect(md).not.toContain('/tmp');
    expect(md).not.toMatch(/test \d of|suite reading|ENOENT|secret|Failed to load|Odd Folder|\.test\./);
    // The only slashes are the run URL's.
    expect(md.replace(`(${RUN_URL})`, '')).not.toContain('/');
  });

  it('a run with no failure says passed', async () => {
    const md = (await summarise({ testResults: [file(path.join(ws.dir, 'test', 'docs', 'a.test.ts'), ['passed'])] }))
      .stdout;
    expect(md).toContain('| docs | 1 | 0 | 1 | 0 | 0 |');
    expect(md).toContain('Result: **passed**');
  });

  it.each([
    ['no testResults', {}],
    ['a name that is not a string', { testResults: [{ name: 3, status: 'passed', assertionResults: [] }] }],
    [
      'an unknown status',
      { testResults: [{ name: 'test/a/b.test.ts', status: 'passed', assertionResults: [{ status: 'weird' }] }] },
    ],
    ['an unknown file status', { testResults: [{ name: 'test/a/b.test.ts', status: 'odd', assertionResults: [] }] }],
    ['not JSON', '['],
  ])('refuses %s with one line and exit 1, no stack trace', async (_, input) => {
    const result = await summarise(input);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/^refused: [^\n]+\n$/);
    expect(result.stderr).not.toMatch(/\bat \S+:\d+/);
    expect(result.stderr).not.toContain(ws.dir);
  });

  it.each([
    ['a commit that is not 40 hex digits', ['--commit', 'main', '--run-url', RUN_URL]],
    ['a run URL of another host', ['--commit', SHA, '--run-url', 'https://example.com/a/b/actions/runs/1']],
    ['a run URL with a path after the id', ['--commit', SHA, '--run-url', `${RUN_URL}/attempts/1`]],
  ])('refuses %s', async (_, args) => {
    const result = await summarise(results(), args);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/^refused: /);
  });

  it('a usage error exits 2', async () => {
    const usage = await ws.run(process.execPath, [SCRIPT], { cwd: ws.dir, allowFailure: true });
    expect(usage.code).toBe(2);
    expect(usage.stderr).toMatch(/^usage: /);
  });
});
