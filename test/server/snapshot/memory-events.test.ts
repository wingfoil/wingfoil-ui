// spec-002 §5 consistency contract (task-012 AC "Actor events"): on the three fixtures built with the
// pinned CLI, the events of the project-wide `git log -p` parse (spec-002 §3) equal, for every
// element, the `wf` entries of its `memory history` — same sha, operation, from, to, approver,
// reason — and the parse is one git process per HEAD.
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { buildFixture, FIXTURE_KINDS, type Fixture, type FixtureKind } from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';
import { auditedSnapshots } from './support.js';

let root: string;
const fixtures = new Map<FixtureKind, Fixture>();
const registries: Snapshots[] = [];

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-events-')));
  for (const kind of FIXTURE_KINDS) fixtures.set(kind, await buildFixture(kind, { root: path.join(root, kind) }));
}, 600_000);

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await rm(root, { recursive: true, force: true });
});

const pick = (e: {
  sha: string;
  operation: unknown;
  from: unknown;
  to: unknown;
  approver: unknown;
  reason: unknown;
}) => ({
  sha: e.sha,
  operation: e.operation,
  from: e.from,
  to: e.to,
  approver: e.approver,
  reason: e.reason,
});

describe.each(FIXTURE_KINDS)('spec-002 §5 on the %s fixture', (kind) => {
  it('gives every element the wf entries of its memory history, in one git process', async () => {
    const fx = fixtures.get(kind)!;
    const audited = auditedSnapshots(fx.env);
    registries.push(audited.snapshots);
    const snapshot = await audited.snapshots.open(`p_${kind}`, fx.dir);
    const view = await snapshot.view();
    const gitBefore = audited.runner.count('git');
    const events = await view.events();
    expect(audited.runner.count('git') - gitBefore).toBe(1);
    // Cached for the HEAD: a second view of the same state reads nothing.
    await (await snapshot.view()).events();
    expect(audited.runner.count('git') - gitBefore).toBe(1);

    const { matches } = await view.elements();
    expect(matches.length).toBeGreaterThan(0);
    let compared = 0;
    for (const { match } of matches) {
      const history = (await view.history(match.id)).data.entries.filter((e) => e.operation !== null);
      expect((events.get(match.id) ?? []).map(pick), match.id).toEqual(history.map(pick));
      compared += history.length;
    }
    expect(compared).toBeGreaterThan(0);
  }, 300_000);
});

describe('the cache key of the events is HEAD only (spec-002 §4)', () => {
  it('does not parse again after a working-tree edit, does after a commit', async () => {
    const fx = fixtures.get('kanban')!;
    const audited = auditedSnapshots(fx.env);
    registries.push(audited.snapshots);
    const snapshot = await audited.snapshots.open('p_kanban_key', fx.dir);
    await (await snapshot.view()).events();
    const logs = () => audited.runner.spawned.filter((r) => r.args.includes('log')).length;
    expect(logs()).toBe(1);
    await writeFile(path.join(fx.dir, 'notes.txt'), 'a working-tree edit\n');
    await snapshot.check();
    await (await snapshot.view()).events();
    expect(logs()).toBe(1);
    await git(fx.dir, ['commit', '-q', '--allow-empty', '-m', 'empty'], fx.env);
    await snapshot.check();
    await (await snapshot.view()).events();
    expect(logs()).toBe(2);
  }, 120_000);
});
