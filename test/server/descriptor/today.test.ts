// spec-003 §5 — the Today output (task-031): Requires you of the role view with each row's action,
// Waiting on others without the Requires you rows (T-11.3), the all-roles summary (S5,
// REQ-PERF-11: ≤ 3 items per role and "N more", absent for a single-role member — S-23.3), the
// unidentified user (RP-27, D31-5), a member with no role (D31-5) and the order of both lists
// (D31-4). On the samples captured from WingFoil 0.2.2 for the three fixtures. The placement of one
// element is `placement()`'s (its own hand-written oracle in `placement.test.ts`); here the rows of
// the scenarios are written by hand.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { DnaShow, Identity, MemoryHistory, MemorySearch, TodayRow } from '@wingfoil-ui/contracts';
import { describe, expect, it } from 'vitest';
import { describeElement } from '../../../server/src/descriptor/descriptor.js';
import { compareRequiresYou, placement } from '../../../server/src/descriptor/placement.js';
import { today } from '../../../server/src/descriptor/today.js';
import { parseMemoryYaml } from '../../../server/src/reads/memory-yaml.js';
import { REPO_ROOT } from '../../harness/cli.js';
import {
  memberByName,
  OUTSIDER,
  STANDARD_TEAM,
  type BddFixtureKind,
  type MemberName,
} from '../../harness/fixtures/index.js';

const SAMPLES = path.join(REPO_ROOT, 'test/contracts/samples/wingfoil-0.2.2');
const read = (kind: BddFixtureKind, file: string) => readFileSync(path.join(SAMPLES, kind, file), 'utf8');
const KINDS = ['kanban', 'custom', 'unknown'] as const;

/** The Today rows of a fixture: every `memory search` match with its descriptor. */
function rows(kind: BddFixtureKind, members = (JSON.parse(read(kind, 'dna-show.json')) as DnaShow).team.members) {
  const project = {
    memoryYaml: parseMemoryYaml(read(kind, 'files/memory.yaml')),
    members,
    enablement: { identified: true, version: { supported: true, range: '0.2.2' } },
  };
  return (JSON.parse(read(kind, 'memory-search.json')) as MemorySearch).matches.map((m): TodayRow => ({
    element: { id: m.id, type: m.type, title: m.title, status: m.status, localChanges: false },
    descriptor: describeElement(
      m,
      (JSON.parse(read(kind, `memory-history/${m.id}.json`)) as MemoryHistory).entries,
      project,
    ),
  }));
}

const member = (name: MemberName, roles?: readonly string[]): Identity => {
  const m = memberByName(name);
  return { kind: 'member', email: m.email, name, roles: [...(roles ?? m.roles)] };
};
const ids = (list: readonly { element: { id: string } }[] | null | undefined) => list?.map((r) => r.element.id);
const actions = (list: readonly { element: { id: string }; action: string }[] | null) =>
  list?.map((r) => [r.element.id, r.action]);

describe('Today — every fixture, member and role view (spec-003 §5)', () => {
  it('Requires you = the rows placed there, in the §5 order; Waiting on others = the rest placed there', () => {
    let checked = 0;
    for (const kind of KINDS) {
      const all = rows(kind);
      for (const m of STANDARD_TEAM) {
        for (const view of m.roles) {
          const user = { email: m.email, roles: m.roles };
          const placed = all.map((r) => ({ r, p: placement(r.descriptor, user, view) }));
          const byOrder = (a: TodayRow, b: TodayRow) => compareRequiresYou(a.descriptor, b.descriptor);
          const requires = placed
            .filter(({ p }) => p.list === 'requires-you')
            .map(({ r, p }) => ({ ...r, action: p.list === 'requires-you' ? p.action : undefined }))
            .sort(byOrder);
          const waiting = placed
            .filter(({ p }) => p.list === 'waiting-on-others')
            .map(({ r }) => r)
            .sort(byOrder);
          const t = today(all, member(m.name), view);
          expect(t.view).toBe(view);
          expect(t.requiresYou).toEqual(requires);
          expect(t.waitingOnOthers).toEqual(waiting);
          // T-11.3: never in both lists.
          const mine = new Set(ids(t.requiresYou));
          expect(t.waitingOnOthers.filter((r) => mine.has(r.element.id))).toEqual([]);
          checked += 1;
        }
      }
    }
    // 3 fixtures × (2 + 1 + 1 + 1 + 7) role views.
    expect(checked).toBe(36);
  });
});

describe('Today — the scenarios (rows written by hand)', () => {
  it('T-01.1, T-02.1, T-11.1, T-11.3: Morgan, approver view on kanban', () => {
    const t = today(rows('kanban'), member('Morgan'), 'approver');
    expect(actions(t.requiresYou)?.sort()).toEqual([
      ['bug-001-crash-on-save', 'approve'],
      ['task-001-login-form', 'approve'],
    ]);
    expect(
      t.waitingOnOthers.map((r) => [r.element.id, r.descriptor.actor.member?.name, r.descriptor.actor.basis]),
    ).toEqual([
      ['task-002-password-reset', 'Jordan', 'submitter'],
      ['task-004-session-timeout', 'Jordan', 'creator'],
    ]);
    const row = t.requiresYou!.find((r) => r.element.id === 'task-001-login-form')!;
    expect(row.element).toEqual({
      id: 'task-001-login-form',
      type: 'task',
      title: expect.any(String),
      status: 'pending',
      localChanges: false,
    });
    expect(t.summary?.map((l) => [l.role, l.count])).toEqual([
      ['approver', 2],
      ['tech-lead', 0],
    ]);
  });

  it('T-03.1, S-23.3: Jordan — rejected work first, no summary for a single-role member', () => {
    const t = today(rows('kanban'), member('Jordan'), 'developer');
    expect(actions(t.requiresYou)).toEqual([
      ['task-002-password-reset', 'rework'],
      ['task-004-session-timeout', 'submit'],
    ]);
    expect(t.requiresYou![0]!.descriptor.rejection).toMatchObject({
      by: 'Morgan',
      reason: 'Missing acceptance criteria',
    });
    expect(t).not.toHaveProperty('summary');
  });

  it('T-02.3: Alex in the product-owner view has nothing to do on kanban', () => {
    expect(today(rows('kanban'), member('Alex'), 'product-owner').requiresYou).toEqual([]);
  });

  it('T-04.1: Sam holding reviewer and approver sees the custom gate as Review', () => {
    const t = today(rows('custom'), member('Sam', ['reviewer', 'approver']), 'reviewer');
    expect(actions(t.requiresYou)).toContainEqual(['task-001-cli-adapter', 'review']);
  });

  it('T-06.1, T-06.2: a gate is in Waiting on others for a member without approver', () => {
    const sam = today(rows('custom'), member('Sam'), 'reviewer');
    expect(ids(sam.requiresYou)).not.toContain('task-001-cli-adapter');
    const gate = sam.waitingOnOthers.find((r) => r.element.id === 'task-001-cli-adapter')!;
    expect(gate.descriptor.actor).toMatchObject({ kind: 'role', role: 'approver', members: ['Morgan', 'Alex'] });
    const casey = today(rows('custom'), member('Casey'), 'product-owner');
    expect(ids(casey.waitingOnOthers)).toContain('dl-002-use-fastify');
  });

  it('T-05.1, T-05.2: Morgan on unknown — an undeclared state to resolve, an unfamiliar gate to approve', () => {
    expect(actions(today(rows('unknown'), member('Morgan'), 'tech-lead').requiresYou)).toEqual([
      ['note-002-retro', 'resolve'],
    ]);
    expect(actions(today(rows('unknown'), member('Morgan'), 'approver').requiresYou)).toEqual([
      ['story-001-onboarding', 'approve'],
    ]);
  });

  it('T-07.1: Casey — nothing requires her', () => {
    const t = today(rows('kanban'), member('Casey'), 'product-owner');
    expect(t.requiresYou).toEqual([]);
    expect(t).not.toHaveProperty('summary');
  });

  it('T-11.2: an engine-waiting element waits on the workflow engine', () => {
    const t = today(rows('custom'), member('Morgan'), 'approver');
    expect(t.waitingOnOthers.find((r) => r.element.id === 'minor-v0.1')?.descriptor.actor).toEqual({ kind: 'engine' });
  });

  it('S-23.1: Alex — one line per role in the DNA order, with its count and first rows', () => {
    const alex = memberByName('Alex');
    const t = today(rows('kanban'), member('Alex'), 'developer');
    expect(t.summary?.map((l) => l.role)).toEqual(alex.roles);
    const approver = t.summary!.find((l) => l.role === 'approver')!;
    expect({ count: approver.count, more: approver.more }).toEqual({ count: 2, more: 0 });
    expect(ids(approver.items)?.sort()).toEqual(['bug-001-crash-on-save', 'task-001-login-form']);
    expect(approver.items.map((r) => r.action)).toEqual(['approve', 'approve']);
    expect(t.summary!.find((l) => l.role === 'developer')).toEqual({ role: 'developer', count: 0, items: [], more: 0 });
    // Each line is the Requires you of that role view (its first ≤ 3 rows).
    for (const line of t.summary!) {
      const own = today(rows('kanban'), member('Alex'), line.role).requiresYou!;
      expect(line.count).toBe(own.length);
      expect(line.items).toEqual(own.slice(0, 3));
    }
  });

  it('S-23.4: at most 3 items per role, and "N more"', () => {
    const base = rows('kanban');
    const gate = base.find((r) => r.element.id === 'task-001-login-form')!;
    const five = [1, 2, 3, 4, 5].map((n): TodayRow => ({
      element: { ...gate.element, id: `task-10${n}` },
      descriptor: { ...gate.descriptor, id: `task-10${n}`, since: `2026-10-0${n}T10:00:00+00:00` },
    }));
    const line = today(five, member('Alex'), 'developer').summary!.find((l) => l.role === 'approver')!;
    expect(line.count).toBe(5);
    expect(ids(line.items)).toEqual(['task-101', 'task-102', 'task-103']);
    expect(line.more).toBe(2);
  });
});

describe('Today — users with no role view (RP-27, D31-5)', () => {
  it.each([
    [{ kind: 'not-in-team', email: OUTSIDER.email }],
    [{ kind: 'no-identity' }],
    [{ kind: 'ambiguous', email: 'x@example.test', members: ['Morgan', 'Casey'] }],
  ] as const)('%o: view and Requires you null, Waiting on others as for a member holding no role', (identity) => {
    const all = rows('kanban');
    const t = today(all, identity as Identity, null);
    expect(t.view).toBeNull();
    expect(t.requiresYou).toBeNull();
    expect(t).not.toHaveProperty('summary');
    expect(new Set(ids(t.waitingOnOthers))).toEqual(
      new Set(['task-002-password-reset', 'task-004-session-timeout', 'task-001-login-form', 'bug-001-crash-on-save']),
    );
    // Rejected first, then oldest in the current state (D31-4).
    expect(t.waitingOnOthers[0]!.element.id).toBe('task-002-password-reset');
  });

  it('a member with no role: view null, the rows whose actor they are, no summary', () => {
    const t = today(rows('kanban'), member('Jordan', []), null);
    expect(t.view).toBeNull();
    expect(actions(t.requiresYou)).toEqual([
      ['task-002-password-reset', 'rework'],
      ['task-004-session-timeout', 'submit'],
    ]);
    expect(t).not.toHaveProperty('summary');
    expect(ids(t.waitingOnOthers)?.sort()).toEqual(['bug-001-crash-on-save', 'task-001-login-form']);
  });
});
