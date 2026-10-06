// Review F3 — the watcher watches only what feeds the reads: `.wingfoil/` and the element folders
// of `memory.yaml` recursively, the project root, `node_modules` and `node_modules/wingfoil`
// not recursively, the git directories, the global configuration folders. Never a source tree,
// `dist/`, `coverage/` or a nested `node_modules` (one inotify watch per folder on Linux). A watch
// that fails is reported (degraded: the snapshot then checks more often).
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { watch as fsWatch } from 'node:fs';
import { EventEmitter } from 'node:events';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  memoryTrees,
  memoryWatchPlan,
  watchRepository,
  type WatchTargets,
} from '../../../server/src/snapshot/watcher.js';
import { buildFixture, type Fixture } from '../../harness/fixtures/index.js';

let root: string;
let fx: Fixture;

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-scope-')));
  fx = await buildFixture('kanban', { root });
  for (const noise of ['server/node_modules/dep/lib', 'dist/assets', 'coverage/lcov', '.venv/lib']) {
    await mkdir(path.join(fx.dir, noise), { recursive: true });
    await writeFile(path.join(fx.dir, noise, 'f.txt'), 'x\n');
  }
}, 600_000);

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

function recordingWatch(fail?: (dir: string) => boolean) {
  const calls: { dir: string; recursive: boolean }[] = [];
  const watch = ((dir: string, options: { recursive?: boolean }) => {
    if (fail?.(dir))
      throw Object.assign(new Error('ENOSPC: System limit for number of file watchers reached'), {
        code: 'ENOSPC',
      });
    calls.push({ dir: path.relative(fx.dir, dir) || '.', recursive: options.recursive === true });
    return Object.assign(new EventEmitter(), { close: () => undefined });
  }) as unknown as typeof fsWatch;
  return { calls, watch };
}

function targets(): WatchTargets {
  const gitDir = path.join(fx.dir, '.git');
  return {
    root: fx.dir,
    gitDir,
    commonDir: gitDir,
    globalConfig: [path.join(fx.home, '.gitconfig')],
    trees: () => memoryWatchPlan(fx.dir),
  };
}

describe('watch scope', () => {
  it('memoryTrees: `.wingfoil` and the static folder of each type path pattern', async () => {
    const trees = await memoryTrees(fx.dir);
    expect(trees).toContain('.wingfoil');
    expect(trees).toContain(path.join('docs', 'memory', 'task'));
    expect(trees.every((t) => t === '.wingfoil' || t.startsWith(path.join('docs', 'memory')))).toBe(true);
  });

  it('watches recursively only the trees that feed the reads', async () => {
    const { calls, watch } = recordingWatch();
    const handlers = { repo: vi.fn(), cli: vi.fn(), degraded: vi.fn() };
    const w = watchRepository(targets(), handlers, { watch });
    await vi.waitFor(() => expect(calls.some((c) => c.dir === '.wingfoil')).toBe(true));
    const recursive = calls.filter((c) => c.recursive).map((c) => c.dir);
    for (const dir of recursive) {
      expect(
        dir === '.wingfoil' || dir.startsWith(path.join('docs', 'memory')) || dir === path.join('.git', 'refs'),
      ).toBe(true);
    }
    expect(calls).toContainEqual({ dir: '.', recursive: false });
    expect(calls).toContainEqual({ dir: 'node_modules', recursive: false });
    expect(calls).toContainEqual({ dir: path.join('node_modules', 'wingfoil'), recursive: false });
    expect(calls.map((c) => c.dir).filter((d) => /^(server|dist|coverage|\.venv)/.test(d))).toEqual([]);
    expect(handlers.degraded).not.toHaveBeenCalled();
    w.close();
  });

  it('reports a failed watch as degraded and keeps the others', async () => {
    const { calls, watch } = recordingWatch((dir) => dir.endsWith('.wingfoil'));
    const handlers = { repo: vi.fn(), cli: vi.fn(), degraded: vi.fn() };
    const w = watchRepository(targets(), handlers, { watch });
    await vi.waitFor(() => expect(handlers.degraded).toHaveBeenCalled());
    expect(String(handlers.degraded.mock.calls[0]![0])).toMatch(/ENOSPC/);
    expect(calls).toContainEqual({ dir: '.', recursive: false });
    w.close();
  });
});

describe('review round 2', () => {
  it('R3 — a type whose path pattern has no static folder is reported, and makes the watcher degraded', async () => {
    const project = path.join(root, 'r3');
    await mkdir(path.join(project, '.wingfoil'), { recursive: true });
    const yaml = parseYaml(await readFile(path.join(fx.dir, '.wingfoil', 'memory.yaml'), 'utf8')) as {
      types: Record<string, unknown>;
    };
    yaml.types.anywhere = { path: '{release}/{id}.md' };
    yaml.types.flat = { path: '{id}.md' };
    await writeFile(path.join(project, '.wingfoil', 'memory.yaml'), stringifyYaml(yaml));
    const plan = await memoryWatchPlan(project);
    expect(plan.unwatched).toEqual(['anywhere', 'flat']);
    expect(plan.trees).toContain('.wingfoil');

    const { watch } = recordingWatch();
    const handlers = { repo: vi.fn(), cli: vi.fn(), degraded: vi.fn() };
    const gitDir = path.join(fx.dir, '.git');
    const w = watchRepository(
      { root: project, gitDir, commonDir: gitDir, globalConfig: [], trees: () => memoryWatchPlan(project) },
      handlers,
      { watch },
    );
    await w.ready;
    expect(handlers.degraded).toHaveBeenCalledWith('no static folder in the path pattern of: anywhere, flat');
    w.close();
  });

  it('R4 — a superseded re-scoping neither adds nor drops a watch', async () => {
    const active = new Map<string, boolean>();
    const listeners = new Map<string, (type: string, name: string | null) => void>();
    const watch = ((dir: string, options: { recursive?: boolean }, listener: (t: string, n: string | null) => void) => {
      const rel = path.relative(fx.dir, dir) || '.';
      active.set(rel, options.recursive === true);
      listeners.set(rel, listener);
      return Object.assign(new EventEmitter(), { close: () => active.delete(rel) });
    }) as unknown as typeof fsWatch;
    let calls = 0;
    const trees = async () => {
      calls += 1;
      // The first plan comes late and is stale; the second is the current one.
      if (calls === 1) {
        await new Promise((r) => setTimeout(r, 300));
        return { trees: ['.wingfoil', path.join('docs', 'memory', 'task')], unwatched: [] };
      }
      return { trees: ['.wingfoil'], unwatched: [] };
    };
    const gitDir = path.join(fx.dir, '.git');
    const w = watchRepository(
      { root: fx.dir, gitDir, commonDir: gitDir, globalConfig: [], trees },
      { repo: vi.fn(), cli: vi.fn() },
      { watch },
    );
    // A root event re-scopes while the first call is still waiting for its plan.
    listeners.get('.')!('rename', 'docs');
    await w.ready;
    await new Promise((r) => setTimeout(r, 100));
    expect(active.get('.wingfoil')).toBe(true);
    expect(active.has(path.join('docs', 'memory', 'task'))).toBe(false);
    w.close();
  });
});
