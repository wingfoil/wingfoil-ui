// task-059 D59-9 (spec-012 §8; review round 1 F-6) — `SnapshotView.contentDerived`: a value computed
// once per content key, shared by every view of that key; recomputed when the content moves (a
// commit), kept when only the copy's inputs move (a remote added: the full key changes, `derived`
// recomputes); never served to another project. On the real kanban fixture, the watcher off.
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { buildFixture, copyFixture, type Fixture } from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';
import { auditedSnapshots } from './support.js';

let root: string;
let template: Fixture;
let n = 0;
const registries: Snapshots[] = [];

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-content-derived-')));
  template = await buildFixture('kanban', { root: path.join(root, 'template') });
}, 600_000);

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await rm(root, { recursive: true, force: true });
});

async function fresh() {
  n += 1;
  const fx = await copyFixture(template, path.join(root, `copy-${n}`));
  const audited = auditedSnapshots(fx.env);
  registries.push(audited.snapshots);
  return { fx, snapshot: await audited.snapshots.open(`p${n}`, fx.dir) };
}

describe('SnapshotView.contentDerived (D59-9)', () => {
  it('once per content key: shared by views of one state, kept when only the full key moves, recomputed on a commit', async () => {
    const { fx, snapshot } = await fresh();
    let calls = 0;
    let derivedCalls = 0;
    const compute = () => Promise.resolve(++calls);
    const read = async () => {
      const view = await snapshot.view();
      await view.derived('probe', () => Promise.resolve(++derivedCalls));
      return {
        value: await view.contentDerived('probe', compute),
        key: view.state.key,
        content: view.state.contentKey,
      };
    };
    const first = await read();
    expect((await read()).value).toBe(first.value);
    expect(calls).toBe(1);

    // A remote added: the copy's inputs move (the full key), the content does not.
    await git(fx.dir, ['remote', 'add', 'probe', path.join(root, 'nowhere.git')], fx.env);
    await snapshot.check();
    const moved = await read();
    expect(moved.key).not.toBe(first.key);
    expect(moved.content).toBe(first.content);
    expect(moved.value).toBe(first.value);
    expect(calls).toBe(1);
    expect(derivedCalls).toBe(2);

    // A commit moves the content key: computed again.
    await git(fx.dir, ['commit', '-q', '--allow-empty', '-m', 'chore: probe'], fx.env);
    await snapshot.check();
    const committed = await read();
    expect(committed.content).not.toBe(first.content);
    expect(committed.value).toBe(2);
  }, 300_000);

  it('never served to another project, even at the same content key', async () => {
    const a = await fresh();
    const b = await fresh();
    const va = await a.snapshot.view();
    const vb = await b.snapshot.view();
    expect(vb.state.head).toBe(va.state.head);
    expect(await va.contentDerived('probe', () => Promise.resolve('a'))).toBe('a');
    expect(await vb.contentDerived('probe', () => Promise.resolve('b'))).toBe('b');
  }, 300_000);
});
