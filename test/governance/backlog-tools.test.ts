// task-093 AC-1 … AC-3: the backlog tools of `docs/03_backlog/X_tools/` know the patch releases
// (`v0.3.1` ranks right after `v0.3`, `build_backlog.py` writes its empty partition), and the
// generated backlog committed in the repository is the output of a fresh build. The tools find
// their inputs from their own location and `build_backlog.py` / `check_backlog.py` write, so they
// are driven on a copy of the inputs in a temporary folder, never on the repository.
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { run } from '../harness/run.js';

const TOOLS = path.join('docs', '03_backlog', 'X_tools');
const roots: string[] = [];

afterAll(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

/** A copy of the inputs of the tools, as committed. */
function copy(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'task-093-backlog-'));
  roots.push(root);
  for (const d of ['docs/02_requirements', 'docs/03_backlog', '.wingfoil/dna.yaml']) {
    cpSync(path.join(REPO_ROOT, d), path.join(root, d), { recursive: true });
  }
  return root;
}

const py = (root: string, script: string, args: string[] = []) =>
  run('python3', [path.join(root, TOOLS, script), ...args], { allowFailure: true });

describe('backlog tools and patch releases', () => {
  it('build_backlog.py writes the v0.3.1 partition, empty, and the checks accept it', async () => {
    const root = copy();
    const build = await py(root, 'build_backlog.py');
    expect(build.code, build.stderr).toBe(0);
    const partition = JSON.parse(
      readFileSync(path.join(root, 'docs/03_backlog/04_backlog/by-release/v0.3.1.json'), 'utf8'),
    ) as { release: string; items: unknown[] };
    expect(partition.release).toBe('v0.3.1');
    expect(partition.items).toEqual([]);

    const backlog = await py(root, 'check_backlog.py');
    expect(backlog.stdout).toContain('v0.3.1: 0 stories, 0 technical tasks');
    expect(backlog.code, backlog.stdout).toBe(0);

    // no docs/04_memory in the copy: no task, but the partition is found and the rank known
    const tasks = await py(root, 'check_tasks.py', ['v0.3.1']);
    expect(tasks.stdout).toContain('0 tasks · 0 backlog items');
    expect(tasks.code, tasks.stdout + tasks.stderr).toBe(0);
  });

  it('check_tasks.py reads the partitions of v0.1 … v0.4 as before', async () => {
    const root = copy();
    await py(root, 'build_backlog.py');
    for (const rel of ['v0.1', 'v0.2', 'v0.3', 'v0.4']) {
      const r = await py(root, 'check_tasks.py', [rel]);
      expect(r.stderr, rel).toBe('');
      expect(r.stdout, rel).toMatch(/\d+ tasks · [1-9]\d* backlog items/);
    }
  });

  it('the committed generated backlog is up to date with a fresh build', async () => {
    const root = copy();
    const r = await py(root, 'check_backlog.py');
    expect(r.stdout).toContain('all checks passed');
    expect(r.code, r.stdout).toBe(0);
  });
});
