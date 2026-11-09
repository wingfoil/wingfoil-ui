// task-052 (AC-2, AC-3; D52-2, D52-7) — `scripts/coverage-totals.mjs`, the coverage asset of the
// GitHub Release: it rebuilds the `total` figures of a Vitest `json-summary` from an allow-list of
// keys, so no per-file entry — and no path, of the runner or of a developer's machine (dl-005) —
// can reach the file the `release` job attaches.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { TempWorkspace } from '../harness/temp-workspace.js';

const SCRIPT = path.join(REPO_ROOT, 'scripts', 'coverage-totals.mjs');
const SHA = '0123456789abcdef0123456789abcdef01234567';
const METRICS = ['lines', 'statements', 'functions', 'branches'] as const;
let ws: TempWorkspace;

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-052-totals-');
});

afterAll(async () => {
  await ws?.dispose();
});

const metric = (covered: number, total: number): Record<string, number> => ({
  total,
  covered,
  skipped: 0,
  pct: Math.round((covered / total) * 10_000) / 100,
});

/** A summary as Vitest writes it: `total` plus one entry per file, keyed by its absolute path. */
function summary(): Record<string, unknown> {
  const file = {
    lines: metric(1, 2),
    statements: metric(1, 2),
    functions: metric(1, 1),
    branches: metric(0, 1),
  };
  return {
    total: {
      lines: metric(5397, 5487),
      statements: metric(6330, 6555),
      functions: metric(1698, 1745),
      branches: { ...metric(4349, 4758), note: path.join(ws.dir, 'leak') },
      branchesTrue: metric(0, 0),
    },
    [path.join(ws.dir, 'server', 'src', 'app.ts')]: file,
    '/tmp/x/web/src/main.tsx': file,
  };
}

async function reduce(input: unknown, args: string[] = ['--commit', SHA]) {
  const file = path.join(ws.dir, `summary-${Math.random().toString(36).slice(2)}.json`);
  await writeFile(file, typeof input === 'string' ? input : JSON.stringify(input));
  return ws.run(process.execPath, [SCRIPT, file, ...args], { cwd: ws.dir, allowFailure: true });
}

describe('coverage-totals.mjs (task-052, D52-2)', () => {
  it('keeps the four totals and the commit; drops every per-file entry and every other field', async () => {
    const result = await reduce(summary());
    expect(result.stderr).toBe('');
    expect(result.code).toBe(0);
    const out = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(Object.keys(out)).toEqual(['source', 'commit', 'total']);
    expect(out.commit).toBe(SHA);
    const total = out.total as Record<string, Record<string, number>>;
    expect(Object.keys(total)).toEqual([...METRICS]);
    for (const name of METRICS) expect(Object.keys(total[name]!)).toEqual(['covered', 'total', 'skipped', 'pct']);
    expect(total.lines).toEqual({ covered: 5397, total: 5487, skipped: 0, pct: 98.36 });
    expect(total.branches).toEqual({ covered: 4349, total: 4758, skipped: 0, pct: 91.4 });
  });

  it('writes no path: neither a file entry nor a string smuggled into a metric', async () => {
    const result = await reduce(summary());
    expect(result.stdout).not.toContain(ws.dir);
    expect(result.stdout).not.toContain('/tmp');
    expect(result.stdout).not.toContain('leak');
    expect(result.stdout).not.toContain('/');
  });

  it.each([
    ['no total', { other: {} }],
    ['a missing metric', { total: { lines: metric(1, 1), statements: metric(1, 1), functions: metric(1, 1) } }],
    [
      'a number that is a string',
      {
        total: {
          lines: { ...metric(1, 1), pct: '100' },
          statements: metric(1, 1),
          functions: metric(1, 1),
          branches: metric(1, 1),
        },
      },
    ],
    ['an array', []],
    ['not JSON', '{'],
  ])('refuses %s with one line and exit 1, no stack trace', async (_, input) => {
    const result = await reduce(input);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/^refused: [^\n]+\n$/);
    expect(result.stderr).not.toMatch(/\bat \S+:\d+/);
    expect(result.stderr).not.toContain(ws.dir);
  });

  it('names the workflow it ran in by a fixed --source choice, the publish workflow by default (task-071 D71-16)', async () => {
    const publish = 'npm run test:coverage (Vitest, v8 provider) in the gate job of the publish workflow';
    const gates = 'npm run test:coverage (Vitest, v8 provider) in the coverage job of the gates workflow';
    const source = async (args: string[]) =>
      (JSON.parse((await reduce(summary(), ['--commit', SHA, ...args])).stdout) as { source: string }).source;
    expect(await source([])).toBe(publish);
    expect(await source(['--source', 'publish'])).toBe(publish);
    expect(await source(['--source', 'gates'])).toBe(gates);
    // Any other value is a usage error: the text is never taken from the command line.
    for (const args of [['--source', 'other'], ['--source'], ['--source', 'gates', 'extra']]) {
      const r = await reduce(summary(), ['--commit', SHA, ...args]);
      expect(r.code, JSON.stringify(args)).toBe(2);
      expect(r.stdout).toBe('');
      expect(r.stderr).toMatch(/^usage: /);
    }
  });

  it('refuses a commit that is not 40 hex digits, and a usage error exits 2', async () => {
    const bad = await reduce(summary(), ['--commit', 'main']);
    expect(bad.code).toBe(1);
    expect(bad.stderr).toMatch(/^refused: /);
    const usage = await ws.run(process.execPath, [SCRIPT], { cwd: ws.dir, allowFailure: true });
    expect(usage.code).toBe(2);
    expect(usage.stderr).toMatch(/^usage: /);
  });
});
