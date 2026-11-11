// bug-034, task-075 AC-1 (D75-1 … D75-7; spec-012 §8, spec-004 §5 amended 2026-11-11) — every read
// kept for a repository state is tied to what that state's check saw, on copies of the kanban
// fixture and the pinned CLI, with no watcher and no periodic check unless a test sets one, so the
// checks run when the test says:
//
// - red first: a file edited, read, and reverted before the next check, which gives the same state
//   key again — the next read serves the reverted content (an element file, `ui.yaml`, `memory.yaml`,
//   the reference index, a directive file), and a CLI read made after a watcher event is not kept;
// - a drop asks a check and publishes `repo` when it ends, also with the same key (Q2 (a));
// - a mismatch a later check confirms (`assume-unchanged`) is cached once confirmed (D75-5).
import { readFile, realpath, rm, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderPreset } from '../../../server/src/presets/ui-config.js';
import type { SnapshotsOptions, Snapshots } from '../../../server/src/snapshot/snapshots.js';
import type { WatchHandlers } from '../../../server/src/snapshot/watcher.js';
import { buildFixture, copyFixture, type Fixture } from '../../harness/fixtures/index.js';
import { HEAVY_MS } from '../../harness/load.js';
import { git } from '../../harness/run.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';
import { auditedSnapshots } from './support.js';

let ws: TempWorkspace;
let root: string;
let template: Fixture;
let n = 0;
const registries: Snapshots[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-075-tie-');
  root = await realpath(ws.dir);
  template = await buildFixture('kanban', { root: path.join(root, 'template') });
}, HEAVY_MS);

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await ws?.dispose();
});

async function fresh(options: Partial<SnapshotsOptions> = {}) {
  n += 1;
  const fx = await copyFixture(template, path.join(root, `copy-${n}`));
  const audited = auditedSnapshots(fx.env, options);
  registries.push(audited.snapshots);
  const snapshot = await audited.snapshots.open(`p${n}`, fx.dir);
  return { fx, snapshot, ...audited };
}

/** A registry whose watcher is a stand-in: the test fires its `repo()`; the debounced check never runs by itself. */
async function freshWatched() {
  let handlers: WatchHandlers | undefined;
  const started = await fresh({
    watch: true,
    debounceMs: 3_600_000,
    watchRepository: (_targets, h) => {
      handlers = h;
      return { started: Promise.resolve(), close: () => undefined };
    },
  });
  return { ...started, fire: () => handlers!.repo() };
}

/** Replace the frontmatter's `title:` line of the file at `file`; returns the text before. */
async function retitle(file: string, title: string): Promise<string> {
  const before = await readFile(file, 'utf8');
  await writeFile(file, before.replace(/^title: .*$/m, `title: "${title}"`));
  return before;
}

describe('AC-1 bug-034 red first: edited, read and reverted between two checks', () => {
  it('an element file — the next read serves the reverted content', async () => {
    const { fx, snapshot } = await fresh();
    const view = await snapshot.view();
    const [, second] = (await view.elements()).matches.map((m) => m.match);
    const file = path.join(fx.dir, second!.path);
    const committed = await retitle(file, 'EDITED');
    expect((await view.element(second!.id))?.content.frontmatter.title).toBe('EDITED');
    await writeFile(file, committed);
    const state = await snapshot.check();
    expect(state.key).toBe(view.state.key);
    const again = await (await snapshot.view()).element(second!.id);
    expect(again?.content.frontmatter.title).not.toBe('EDITED');
    expect(again?.content.frontmatter.title).toBe(second!.title);
  });

  it('`ui.yaml` through `uiConfig()`', async () => {
    const { fx, snapshot } = await fresh();
    const view = await snapshot.view();
    const file = path.join(fx.dir, '.wingfoil', 'ui.yaml');
    await writeFile(file, renderPreset('kanban'));
    expect((await view.uiConfig()).status.source).toBe('file');
    await rm(file);
    const state = await snapshot.check();
    expect(state.key).toBe(view.state.key);
    expect((await (await snapshot.view()).uiConfig()).status.source).toBe('none');
  });

  it('`memory.yaml`', async () => {
    const { fx, snapshot } = await fresh();
    const view = await snapshot.view();
    const file = path.join(fx.dir, '.wingfoil', 'memory.yaml');
    const committed = await readFile(file, 'utf8');
    await writeFile(file, `${committed}\n: [unclosed\n`);
    await expect(view.memoryTypes()).rejects.toThrow(/invalid YAML/);
    await writeFile(file, committed);
    expect((await snapshot.check()).key).toBe(view.state.key);
    await expect((await snapshot.view()).memoryTypes()).resolves.toMatchObject({ types: expect.any(Object) });
  });

  it('the reference index', async () => {
    const { fx, snapshot } = await fresh();
    const view = await snapshot.view();
    const [first] = (await view.elements()).matches.map((m) => m.match);
    await view.uiConfig();
    const file = path.join(fx.dir, first!.path);
    const committed = await readFile(file, 'utf8');
    await writeFile(file, committed.replace(/^---\n/, '---\nref: US-EDITED\n'));
    expect((await view.referenceIndex()).get(first!.id)!.values).toContain('US-EDITED');
    await writeFile(file, committed);
    expect((await snapshot.check()).key).toBe(view.state.key);
    expect((await (await snapshot.view()).referenceIndex()).get(first!.id)!.values).not.toContain('US-EDITED');
  });

  it('a directive file', async () => {
    const { fx, snapshot } = await fresh();
    const view = await snapshot.view();
    const entry = (await view.directives()).data.entries[0]!;
    const file = path.join(fx.dir, '.wingfoil', entry.path);
    const committed = await readFile(file, 'utf8');
    await writeFile(file, `${committed}\nEDITED-BODY\n`);
    expect((await view.directive(entry.frontmatter.id))?.content.body).toContain('EDITED-BODY');
    await writeFile(file, committed);
    expect((await snapshot.check()).key).toBe(view.state.key);
    expect((await (await snapshot.view()).directive(entry.frontmatter.id))?.content.body).not.toContain('EDITED-BODY');
  });

  it('a CLI read completing after a watcher event is not kept', async () => {
    const { fx, snapshot, fire } = await freshWatched();
    const view = await snapshot.view();
    const listed = await (await fresh()).snapshot.view().then((v) => v.elements());
    const second = listed.matches[1]!.match;
    const file = path.join(fx.dir, second.path);
    const committed = await retitle(file, 'EDITED');
    fire();
    const edited = await view.elements();
    expect(edited.matches.find((m) => m.match.id === second.id)?.match.title).toBe('EDITED');
    await writeFile(file, committed);
    expect((await snapshot.check()).key).toBe(view.state.key);
    const again = await (await snapshot.view()).elements();
    expect(again.matches.find((m) => m.match.id === second.id)?.match.title).toBe(second.title);
  });
});

describe('AC-1 the CLI reads with no event, the drop, the confirmation', () => {
  it('a CLI read with no event is kept: 0 processes on the next view of the state', async () => {
    const { snapshot, runner } = await freshWatched();
    const view = await snapshot.view();
    const list = await view.elements();
    const before = runner.spawned.length;
    expect(await (await snapshot.view()).elements()).toEqual(list);
    expect(runner.spawned.length).toBe(before);
  });

  it('a drop publishes `repo` after its check, also with the same key', async () => {
    const { fx, snapshot, events } = await fresh();
    const view = await snapshot.view();
    const [, second] = (await view.elements()).matches.map((m) => m.match);
    // git's status hides the edit, so the drop's own check finds the same key.
    await git(fx.dir, ['update-index', '--assume-unchanged', second!.path], fx.env);
    await retitle(path.join(fx.dir, second!.path), 'HIDDEN');
    const published = events.length;
    await view.element(second!.id);
    await expect
      .poll(() => events.slice(published), { timeout: 20_000 })
      .toContainEqual({ event: 'repo', data: { pid: snapshot.pid, state: view.state.key } });
    expect(snapshot.current()?.key).toBe(view.state.key);
  });

  it('a mismatch a later check confirms (`assume-unchanged`) is cached once confirmed, with no drop after', async () => {
    const { fx, snapshot, runner } = await fresh();
    let view = await snapshot.view();
    const [, second] = (await view.elements()).matches.map((m) => m.match);
    await git(fx.dir, ['update-index', '--assume-unchanged', second!.path], fx.env);
    await retitle(path.join(fx.dir, second!.path), 'HIDDEN');
    expect((await snapshot.check()).key).toBe(view.state.key); // git's status hides the edit
    view = await snapshot.view();
    // First read: the bytes differ from the HEAD blob — served, the memo dropped, a check asked.
    expect((await view.element(second!.id))?.content.frontmatter.title).toBe('HIDDEN');
    await snapshot.check();
    // After a check that started later: the same mismatch is accepted and kept.
    view = await snapshot.view();
    const confirmed = await view.element(second!.id);
    expect(confirmed?.content.frontmatter.title).toBe('HIDDEN');
    const before = runner.spawned.length;
    const next = await (await snapshot.view()).element(second!.id);
    expect(next?.content).toBe(confirmed?.content);
    expect(runner.spawned.length).toBe(before);
  });
});

describe('task-075 review round 1', () => {
  it('F-2 an outside writer firing the watcher every 20 ms: bounded processes, at most one same-key `repo` per key', async () => {
    const { snapshot, fire, runner, events } = await freshWatched();
    const key = (await snapshot.view()).state.key;
    const before = runner.count('wingfoil');
    const published = events.length;
    const writer = setInterval(fire, 20);
    // The page: one read, then a refetch on every `repo` event, for 3 s.
    let seen = published;
    const deadline = Date.now() + 3_000;
    try {
      await (await snapshot.view()).elements();
      while (Date.now() < deadline) {
        if (events.length > seen) {
          seen = events.length;
          await (await snapshot.view()).elements();
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    } finally {
      clearInterval(writer);
    }
    const sameKey = events.slice(published).filter((e) => (e as { data: { state: string } }).data.state === key);
    expect(sameKey.length).toBeLessThanOrEqual(1);
    expect(runner.count('wingfoil') - before).toBeLessThanOrEqual(3);
    // The writer stopped: after one check, a reopen starts 0 processes (REQ-PERF-05).
    await snapshot.check();
    await (await snapshot.view()).elements();
    const settled = runner.spawned.length;
    await (await snapshot.view()).elements();
    expect(runner.spawned.length).toBe(settled);
  });

  it('F-4 a checkout with line-end conversion settles in one drop cycle', async () => {
    const { fx, snapshot, runner } = await fresh();
    await git(fx.dir, ['config', 'core.autocrlf', 'true'], fx.env);
    // Every tracked governance and Memory file checked out again, with CRLF line ends.
    const tracked = (await git(fx.dir, ['ls-files', '-z', '--', '.wingfoil', 'docs'], fx.env)).stdout
      .split('\0')
      .filter(Boolean);
    for (const file of tracked) await unlink(path.join(fx.dir, file));
    await git(fx.dir, ['checkout', '--', '.wingfoil', 'docs'], fx.env);
    expect(await readFile(path.join(fx.dir, '.wingfoil', 'memory.yaml'), 'utf8')).toContain('\r\n');
    const first = await snapshot.view();
    await first.uiConfig();
    await first.referenceIndex(); // mismatches everywhere: one drop, the suspects recorded
    await snapshot.check();
    const second = await snapshot.view();
    await second.uiConfig();
    const index = await second.referenceIndex(); // every mismatch confirmed: kept
    const before = runner.spawned.length;
    const third = await snapshot.view();
    expect(await third.referenceIndex()).toBe(index);
    expect(runner.spawned.length).toBe(before);
  });
});
