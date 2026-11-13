// task-036 — the pure part of Today (D36-6…D36-8): the reason of a Requires you row, who must act on
// a Waiting on others row, the greeting's name and the identity sentence. task-061 (D61-4): the
// card's facets, its filters and its 10-row limit.
import type { ActionDescriptor, TodayActionRow, TodayRow } from '@wingfoil-ui/contracts';
import { expect, it } from 'vitest';
import {
  durationOf,
  effectiveFilter,
  facetsOf,
  filterCard,
  greetingName,
  identityNote,
  limited,
  ROW_LIMIT,
  rowReason,
  waitingWho,
} from '../../../web/src/today/model.js';
import { header, morgan, riley } from '../project/header-data.js';

const NOW = Date.parse('2026-10-14T12:00:00Z');

function descriptor(over: Partial<ActionDescriptor> = {}): ActionDescriptor {
  return {
    id: 'x-001',
    type: 'kind-a',
    status: 's1',
    kind: 'gate',
    tone: 'human',
    verbs: [],
    actor: { kind: 'none' },
    ...over,
  };
}

function row(over: Partial<ActionDescriptor> = {}, action: TodayActionRow['action'] = 'approve'): TodayActionRow {
  return {
    element: { id: 'x-001', type: 'kind-a', title: 'X', status: 's1', localChanges: false },
    descriptor: descriptor(over),
    action,
  };
}

it('gives the state and the time in it, in the largest whole unit', () => {
  expect(rowReason(row({ since: '2026-10-11T11:50:00Z' }), NOW)).toEqual({
    kind: 'age',
    state: 's1',
    age: { count: 3, unit: 'day' },
  });
  expect(durationOf('2026-10-14T09:00:00Z', NOW)).toEqual({ count: 3, unit: 'hour' });
  expect(durationOf('2026-10-14T11:59:30Z', NOW)).toEqual({ count: 30, unit: 'second' });
  // A time in the future (clock skew) reads 0 s.
  expect(durationOf('2026-10-15T00:00:00Z', NOW)).toEqual({ count: 0, unit: 'second' });
});

it('gives the state alone when no event is known', () => {
  expect(rowReason(row(), NOW)).toEqual({ kind: 'state', state: 's1' });
});

it('gives the rejection of rework, with or without a reason', () => {
  const rejection = { by: 'Morgan', reason: 'Missing acceptance criteria', at: '2026-10-11T11:50:00Z' };
  expect(rowReason(row({ rejection, since: rejection.at }, 'rework'), NOW)).toEqual({
    kind: 'rejection',
    by: 'Morgan',
    reason: 'Missing acceptance criteria',
  });
  expect(rowReason(row({ rejection: { ...rejection, reason: null } }, 'rework'), NOW)).toEqual({
    kind: 'rejection',
    by: 'Morgan',
    reason: null,
  });
  // A rework row without its rejection (not expected) falls back to the state.
  expect(rowReason(row({}, 'rework'), NOW)).toEqual({ kind: 'state', state: 's1' });
});

it('gives the Action required reason of an undeclared state (action resolve)', () => {
  expect(rowReason(row({ since: '2026-10-11T11:50:00Z' }, 'resolve'), NOW)).toEqual({
    kind: 'undeclared',
    state: 's1',
    type: 'kind-a',
  });
});

it('names who must act from the actor', () => {
  const waiting = (actor: ActionDescriptor['actor']): TodayRow => ({
    element: row().element,
    descriptor: descriptor({ actor }),
  });
  const jordan = { name: 'Jordan', email: 'jordan@example.test' };
  expect(waitingWho(waiting({ kind: 'member', member: jordan, basis: 'submitter' }))).toEqual({
    kind: 'member',
    name: 'Jordan',
    basis: 'submitter',
  });
  expect(waitingWho(waiting({ kind: 'member', member: jordan }))).toEqual({ kind: 'member', name: 'Jordan' });
  expect(waitingWho(waiting({ kind: 'member' }))).toEqual({ kind: 'none' });
  expect(waitingWho(waiting({ kind: 'role', role: 'approver', members: ['Morgan', 'Alex'] }))).toEqual({
    kind: 'role',
    role: 'approver',
    members: ['Morgan', 'Alex'],
  });
  expect(waitingWho(waiting({ kind: 'role', role: 'approver' }))).toEqual({
    kind: 'role',
    role: 'approver',
    members: [],
  });
  expect(waitingWho(waiting({ kind: 'role' }))).toEqual({ kind: 'none' });
  expect(waitingWho(waiting({ kind: 'engine' }))).toEqual({ kind: 'engine' });
  expect(waitingWho(waiting({ kind: 'none' }))).toEqual({ kind: 'none' });
});

it('task-069 — a held gate names its hold, in place of the role (spec-003 §5)', () => {
  const reason = { code: 'held-until-references-done', count: 1 } as const;
  const row: TodayRow = {
    element: { id: 'x-001', type: 'kind-a', title: 'X', status: 's1', localChanges: false },
    descriptor: descriptor({
      kind: 'gate',
      actor: { kind: 'role', role: 'approver', members: ['Morgan'] },
      approveHeld: { condition: 'when-references-done', reason },
    }),
  };
  expect(waitingWho(row)).toEqual({ kind: 'held', reason });
});

it('greets a member by name and has no name for anyone else', () => {
  expect(greetingName(morgan())).toBe('Morgan Reyes');
  expect(greetingName(riley())).toBeUndefined();
});

it('says How to join only to a user not in the team with a readable DNA (D36-8, D35-8)', () => {
  expect(identityNote(morgan())).toBeUndefined();
  expect(identityNote(riley())).toBe('notInTeam');
  expect(identityNote({ ...riley(), dnaError: { code: 'cli-failed', message: 'x' } })).toBe('unidentified');
  expect(identityNote(header({ identity: { kind: 'no-identity' }, roleViews: [], roleView: null }))).toBe(
    'unidentified',
  );
  expect(
    identityNote(
      header({
        identity: { kind: 'ambiguous', email: 'a@x.test', members: ['A', 'B'] },
        roleViews: [],
        roleView: null,
      }),
    ),
  ).toBe('unidentified');
});

/** A card row of type `type` in state `status`, numbered `n` (D61-4). */
function cardRow(n: number, type: string, status: string): TodayRow {
  const id = `${type}-${String(n).padStart(3, '0')}`;
  return {
    element: { id, type, title: id, status, localChanges: false },
    descriptor: descriptor({ id, type, status }),
  };
}

const CARD = [
  cardRow(1, 'kind-b', 's2'),
  cardRow(2, 'kind-a', 's2'),
  cardRow(3, 'kind-b', 's1'),
  cardRow(4, 'kind-c', 's2'),
];
const idsOf = (rows: readonly TodayRow[]) => rows.map((r) => r.element.id);

it('task-061 — the facets count the card’s unfiltered rows, sorted by value (D61-4, T-02.4)', () => {
  expect(facetsOf(CARD, 'type')).toEqual([
    { value: 'kind-a', count: 1 },
    { value: 'kind-b', count: 2 },
    { value: 'kind-c', count: 1 },
  ]);
  expect(facetsOf(CARD, 'state')).toEqual([
    { value: 's1', count: 1 },
    { value: 's2', count: 3 },
  ]);
  expect(facetsOf([], 'type')).toEqual([]);
});

it('task-061 — the type and the state filter combine, the server’s order kept (D61-4)', () => {
  expect(idsOf(filterCard(CARD, {}))).toEqual(idsOf(CARD));
  expect(idsOf(filterCard(CARD, { type: 'kind-b' }))).toEqual(['kind-b-001', 'kind-b-003']);
  expect(idsOf(filterCard(CARD, { state: 's2' }))).toEqual(['kind-b-001', 'kind-a-002', 'kind-c-004']);
  expect(idsOf(filterCard(CARD, { type: 'kind-b', state: 's2' }))).toEqual(['kind-b-001']);
  expect(filterCard(CARD, { type: 'kind-a', state: 's1' })).toEqual([]);
});

it('task-061 — a chosen value no longer among the card’s rows falls back to All (D61-6)', () => {
  expect(effectiveFilter(CARD, { type: 'kind-b', state: 's1' })).toEqual({ type: 'kind-b', state: 's1' });
  expect(effectiveFilter(CARD, { type: 'kind-z', state: 's1' })).toEqual({ state: 's1' });
  expect(effectiveFilter(CARD, { type: 'kind-a', state: 's9' })).toEqual({ type: 'kind-a' });
  expect(effectiveFilter([], { type: 'kind-a' })).toEqual({});
});

it('task-061 — a card shows its first 10 rows unless expanded (D61-7, REQ-PERF-11)', () => {
  expect(ROW_LIMIT).toBe(10);
  const many = Array.from({ length: 13 }, (_, i) => cardRow(i + 1, 'kind-a', 's1'));
  expect(idsOf(limited(many, false))).toEqual(idsOf(many.slice(0, 10)));
  expect(limited(many, true)).toHaveLength(13);
  expect(limited(many.slice(0, 10), false)).toHaveLength(10);
});
