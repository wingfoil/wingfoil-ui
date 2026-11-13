// spec-012 §1, §8, task-055 AC-2, AC-3, D55-6, D55-8 — `SnapshotView.referenceIndex()` on the real
// kanban fixture and the pinned CLI: one index per state, the values reused across states by
// (path, blob id), the revert after an edit (red first), one file re-read for a commit touching one
// element, one `git ls-tree -r` per new HEAD, no CLI process added by the index.
import { readFile, realpath, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gitSubcommand } from '../../../server/src/git/git.js';
import { nodeReadFs, type ReadFs } from '../../../server/src/reads/confine.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { buildFixture, copyFixture, type Fixture } from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';
import { auditedSnapshots } from './support.js';

let root: string;
let template: Fixture;
let n = 0;
const registries: Snapshots[] = [];

/** A read port counting the element files read (by path relative to the project). */
function countingFs(dir: () => string): ReadFs & { reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    readFile: (file) => {
      reads.push(path.relative(dir(), file));
      return nodeReadFs.readFile(file);
    },
    realpath: (file) => nodeReadFs.realpath(file),
    size: (file) => nodeReadFs.size(file),
  };
}

async function fresh() {
  n += 1;
  const fx = await copyFixture(template, path.join(root, `copy-${n}`));
  const dir = await realpath(fx.dir);
  const fs = countingFs(() => dir);
  const audited = auditedSnapshots(fx.env, { fs });
  registries.push(audited.snapshots);
  const snapshot = await audited.snapshots.open(`p${n}`, fx.dir);
  return { fx, dir, fs, snapshot, ...audited };
}

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-reference-index-')));
  template = await buildFixture('kanban', { root: path.join(root, 'template') });
}, 600_000);

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await rm(root, { recursive: true, force: true });
});

const elementReads = (reads: string[]) => reads.filter((p) => p.endsWith('.md'));

describe('SnapshotView.referenceIndex()', () => {
  it('one index per state, every listed element; no CLI process; one ls-tree per new HEAD', async () => {
    const { snapshot, runner } = await fresh();
    const view = await snapshot.view();
    const listed = (await view.elements()).matches.map((x) => x.match.id);
    await view.uiConfig();
    const before = runner.spawned.length;
    const index = await view.referenceIndex();
    expect(index.elements.map((e) => e.id)).toEqual(listed);
    expect(index.unreadable).toEqual([]);
    // The index starts no process: the HEAD listing it reuses was read once for the state, by the
    // tie of the first direct read (bug-034, task-075 D75-2).
    expect(runner.spawned.slice(before)).toEqual([]);
    expect(runner.wingfoilCommands().filter((c) => c.startsWith('memory search')).length).toBe(1);
    const lsTrees = runner.spawned.filter((r) => gitSubcommand(r.args) === 'ls-tree');
    expect(lsTrees).toHaveLength(1);
    expect(lsTrees[0]!.args).toContain('-r');
    expect(await view.referenceIndex()).toBe(index);
  });

  it('AC-3 red first: edit an element, read, revert the edit, read again → the committed values', async () => {
    const { dir, fs, snapshot } = await fresh();
    let view = await snapshot.view();
    const first = (await view.elements()).matches[0]!.match;
    const file = path.join(dir, first.path);
    const committed = await readFile(file, 'utf8');
    expect((await view.referenceIndex()).get(first.id)!.values).not.toContain('US-EDITED');

    await writeFile(file, committed.replace(/^---\n/, '---\nref: US-EDITED\n'));
    await snapshot.check();
    view = await snapshot.view();
    expect((await view.referenceIndex()).get(first.id)!.values).toContain('US-EDITED');

    await writeFile(file, committed);
    await snapshot.check();
    view = await snapshot.view();
    const readsBefore = elementReads(fs.reads).filter((p) => p === first.path).length;
    const index = await view.referenceIndex();
    expect(index.get(first.id)!.values).not.toContain('US-EDITED');
    // The committed values came from the cache: the reverted file was not read again by the index.
    expect(elementReads(fs.reads).filter((p) => p === first.path).length).toBe(readsBefore);
  });

  it('a commit touching one element re-reads that one file', async () => {
    const { fx, dir, fs, snapshot } = await fresh();
    let view = await snapshot.view();
    const [one] = (await view.elements()).matches.map((x) => x.match);
    await view.referenceIndex();
    const file = path.join(dir, one!.path);
    await writeFile(file, (await readFile(file, 'utf8')).replace(/^---\n/, '---\nref: US-COMMITTED\n'));
    await git(
      fx.dir,
      ['-c', 'user.name=T', '-c', 'user.email=t@example.test', 'commit', '-qam', 'edit one element'],
      fx.env,
    );
    await snapshot.check();
    view = await snapshot.view();
    const before = elementReads(fs.reads).length;
    const index = await view.referenceIndex();
    expect(index.get(one!.id)!.values).toContain('US-COMMITTED');
    expect(elementReads(fs.reads).slice(before)).toEqual([one!.path]);
  });
});
