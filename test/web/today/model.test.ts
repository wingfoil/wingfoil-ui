// task-036 — the pure part of Today (D36-6…D36-8): the reason of a Requires you row, who must act on
// a Waiting on others row, the greeting's name and the identity sentence.
import type { ActionDescriptor, TodayActionRow, TodayRow } from '@wingfoil-ui/contracts';
import { expect, it } from 'vitest';
import { durationOf, greetingName, identityNote, rowReason, waitingWho } from '../../../web/src/today/model.js';
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
