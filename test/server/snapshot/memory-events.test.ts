// spec-002 §5 consistency contract (task-012 AC "Actor events"): on the three fixtures built with the
// pinned CLI, the events of the project-wide `git log -p` parse (spec-002 §3) equal, for every
// element, the `wf` entries of its `memory history` — same sha, operation, from, to, approver,
// reason — and the parse is two git processes per HEAD (the patch read and its sha list). Also on the
// WingFoil 0.3 operations (task-048 D48-2): the entries whose operation is neither `null` nor `assign`.
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import {
  addOperations,
  buildFixture,
  copyFixture,
  FIXTURE_KINDS,
  type Fixture,
  type BddFixtureKind,
  type OperationIds,
} from '../../harness/fixtures/index.js';
import { GitReadError } from '../../../server/src/git/git.js';
import { git } from '../../harness/run.js';
import { auditedSnapshots } from './support.js';

let root: string;
const fixtures = new Map<BddFixtureKind, Fixture>();
const registries: Snapshots[] = [];
let operations: Fixture;
let operationIds: OperationIds;

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-events-')));
  for (const kind of FIXTURE_KINDS) fixtures.set(kind, await buildFixture(kind, { root: path.join(root, kind) }));
  operations = await buildFixture('custom', { root: path.join(root, 'operations') });
  operationIds = await addOperations(operations);
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
  it('gives every element the wf entries of its memory history, in two git processes', async () => {
    const fx = fixtures.get(kind)!;
    const audited = auditedSnapshots(fx.env);
    registries.push(audited.snapshots);
    const snapshot = await audited.snapshots.open(`p_${kind}`, fx.dir);
    const view = await snapshot.view();
    const gitBefore = audited.runner.count('git');
    const events = await view.events();
    // The patch read and its header-only sha list (review round 2, finding A).
    expect(audited.runner.count('git') - gitBefore).toBe(2);
    // Cached for the HEAD: a second view of the same state reads nothing.
    await (await snapshot.view()).events();
    expect(audited.runner.count('git') - gitBefore).toBe(2);

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

describe('spec-002 §5 on the WingFoil 0.3 operations (task-048, bug-026)', () => {
  it('gives every element the entries of its memory history that are neither null nor assign', async () => {
    const audited = auditedSnapshots(operations.env);
    registries.push(audited.snapshots);
    const view = await (await audited.snapshots.open('p_operations', operations.dir)).view();
    const events = await view.events();
    const ids = operationIds;
    const seen = new Set<unknown>();
    for (const id of [ids.plan, ids.parked, ...ids.grouped, ids.amended, ...ids.assigned]) {
      const entries = (await view.history(id)).data.entries;
      for (const e of entries) seen.add(e.operation);
      const expected = entries.filter((e) => e.operation !== null && e.operation !== 'assign');
      expect((events.get(id) ?? []).map(pick), id).toEqual(expected.map(pick));
    }
    expect([...seen]).toEqual(expect.arrayContaining(['start', 'finalize', 'sync', 'amend', 'park', 'assign']));
  }, 300_000);
});

// task-048 review round 1 (m-1, M-1): subjects WingFoil 0.3.1 reads with its own tolerance — no or
// several blanks after the colon, an arrow without blanks, text after the bracket, a bracket of one
// state, a repeated id — give the events of its history.
describe('spec-002 §5 on subjects written loosely (task-048 review round 1)', () => {
  it('gives the element the entries of its memory history, one per commit', async () => {
    const fx = await copyFixture(operations, path.join(root, 'loose'));
    const id = operationIds.grouped[0];
    const file = path.join(fx.dir, 'docs', '04_memory', 'v0.1', `${id}.md`);
    const commit = async (status: string, subject: string) => {
      await writeFile(file, (await readFile(file, 'utf8')).replace(/^status:.*$/m, `status: ${status}`));
      await git(fx.dir, ['commit', '-q', '-am', subject], fx.env);
    };
    await commit('backlog', `wf(task):park ${id} [in-progress->backlog]`);
    await commit('in-progress', `wf(task):  start ${id} [backlog → in-progress] by hand`);
    await commit('in-review', `wf(task): sync ${id} [in-review]`);
    await commit('in-progress', `wf(task): start ${id}, ${id} [in-review → in-progress]`);
    // Review round 2: a bracket the file contradicts, a line separator in the subject, an amend
    // by hand that changes no state (minor-1 … minor-3).
    await commit('in-review', `wf(task): approve ${id} [in-progress → done]`);
    await commit('in-progress', `wf(task): sync ${id}\u2028by hand`);
    await writeFile(file, `${await readFile(file, 'utf8')}\nA note.\n`);
    await git(fx.dir, ['commit', '-q', '-am', `wf(task): amend ${id}`], fx.env);
    const audited = auditedSnapshots(fx.env);
    registries.push(audited.snapshots);
    const view = await (await audited.snapshots.open('p_loose', fx.dir)).view();
    const entries = (await view.history(id)).data.entries;
    const expected = entries.filter((e) => e.operation !== null && e.operation !== 'assign');
    expect(expected.slice(-7).map((e) => e.operation)).toEqual([
      'park',
      'start',
      'sync',
      'start',
      'approve',
      'sync',
      'amend',
    ]);
    expect(((await view.events()).get(id) ?? []).map(pick)).toEqual(expected.map(pick));
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
    expect(logs()).toBe(2);
    await writeFile(path.join(fx.dir, 'notes.txt'), 'a working-tree edit\n');
    await snapshot.check();
    await (await snapshot.view()).events();
    expect(logs()).toBe(2);
    await git(fx.dir, ['commit', '-q', '--allow-empty', '-m', 'empty'], fx.env);
    await snapshot.check();
    await (await snapshot.view()).events();
    expect(logs()).toBe(4);
  }, 120_000);
});

describe('review round 3 follow-ups', () => {
  it("M1: reads the history at the view's HEAD, even when a commit lands between the two reads", async () => {
    const fx = fixtures.get('kanban')!;
    const audited = auditedSnapshots(fx.env);
    registries.push(audited.snapshots);
    const snapshot = await audited.snapshots.open('p_kanban_m1', fx.dir);
    const view = await snapshot.view();
    const head = view.state.head;
    const run = audited.runner.run.bind(audited.runner);
    let moved = false;
    audited.runner.run = async (request) => {
      if (request.args.includes('log') && !moved) {
        moved = true;
        // A wf-looking commit touching a Memory folder lands before the reads start.
        await writeFile(path.join(fx.dir, 'docs/memory/task/m1.txt'), 'm1\n');
        await git(fx.dir, ['add', '-A'], fx.env);
        await git(fx.dir, ['commit', '-qm', 'wf(task): submit task-001-login-form'], fx.env);
      }
      return run(request);
    };
    const events = await view.events();
    expect(events.get('task-001-login-form')!.length).toBeGreaterThan(0);
    const logs = audited.runner.spawned.filter((r) => r.args.includes('log'));
    expect(logs).toHaveLength(2);
    for (const r of logs) expect(r.args.slice(r.args.indexOf('--') - 1, r.args.indexOf('--'))).toEqual([head]);
  }, 120_000);

  it('M2: keeps an oversized log for the HEAD instead of reading it at every request', async () => {
    const fx = fixtures.get('unknown')!;
    const audited = auditedSnapshots(fx.env);
    registries.push(audited.snapshots);
    const run = audited.runner.run.bind(audited.runner);
    audited.runner.run = async (request) =>
      request.args.includes('-p')
        ? { exitCode: null, signal: 'SIGKILL', stdout: '', stderr: '', ended: 'overflow', durationMs: 1 }
        : run(request);
    const snapshot = await audited.snapshots.open('p_unknown_m2', fx.dir);
    const first = await (await snapshot.view()).events().catch((e: unknown) => e);
    expect(first).toBeInstanceOf(GitReadError);
    expect((first as GitReadError).ended).toBe('overflow');
    const before = audited.runner.spawned.length;
    expect(await (await snapshot.view()).events().catch((e: unknown) => e)).toBe(first);
    expect(audited.runner.spawned.length).toBe(before);
  }, 120_000);
});
