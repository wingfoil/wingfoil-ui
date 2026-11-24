// task-093 AC-1 / AC-2: independent review of the patch stop-check on actual inputs.
import { cpSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { TempWorkspace } from '../harness/temp-workspace.js';

const TOOLS = path.join(REPO_ROOT, 'docs/03_backlog/X_tools');
const PATCH = 'docs/04_memory/planning/v1/patch-v0.3.1.md';
let ws: TempWorkspace;

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-patch-review-');
  for (const entry of ['.wingfoil/memory.yaml', 'docs/01_vision', 'docs/04_memory/planning', 'docs/03_backlog']) {
    cpSync(path.join(REPO_ROOT, entry), path.join(ws.dir, entry), { recursive: true });
  }
});
afterAll(async () => ws?.dispose());

describe('task-093 independent patch review', () => {
  it('AC-2 accepts the real v0.3.1 task list', async () => {
    const result = await ws.run('python3', [path.join(TOOLS, 'check_tasks.py'), 'v0.3.1'], { allowFailure: true });
    // The count follows the release's task files, so a task added to v0.3.1 does not break the check.
    const count = readdirSync(path.join(REPO_ROOT, 'docs/04_memory/v0.3.1')).filter((f) =>
      /^task-\d+-.*\.md$/.test(f),
    ).length;
    expect(count).toBeGreaterThan(0);
    expect(result.stdout).toContain(`${count} tasks · 0 backlog items · 0 listed`);
    expect(result.code, result.stdout + result.stderr).toBe(0);
  });

  it.each([
    ['a non-empty block list', 'features:\n  - R1'],
    ['a missing required field', ''],
    ['a null field', 'features: null'],
    ['a double-quoted scalar', 'features: "[]"'],
    ['a single-quoted scalar', "features: '[]'"],
    ['an unmatched opening quote', 'features: "[]'],
    ['an unmatched closing quote', 'features: []"'],
  ])('AC-1 refuses %s instead of features: []', async (_label, replacement) => {
    const source = readFileSync(path.join(REPO_ROOT, PATCH), 'utf8');
    writeFileSync(path.join(ws.dir, PATCH), source.replace(/^features:.*$/m, replacement));
    const result = await ws.run('python3', [path.join(TOOLS, 'check_releases.py'), '--root', ws.dir], {
      allowFailure: true,
    });
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.stdout).toContain('FAIL patch-v0.3.1.md:');
  });

  it('refuses a scalar masquerading as a minor feature list through the same validator', async () => {
    writeFileSync(path.join(ws.dir, PATCH), readFileSync(path.join(REPO_ROOT, PATCH), 'utf8'));
    const minor = 'docs/04_memory/planning/v1/minor-v0.3.md';
    const source = readFileSync(path.join(REPO_ROOT, minor), 'utf8');
    writeFileSync(path.join(ws.dir, minor), source.replace(/^features:.*$/m, 'features: "[T2, T5, M2, R5, C1]"'));
    const result = await ws.run('python3', [path.join(TOOLS, 'check_releases.py'), '--root', ws.dir], {
      allowFailure: true,
    });
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.stdout).toContain('FAIL minor-v0.3.md:');
  });
});
