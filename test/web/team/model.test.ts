// task-019 — the Team view's pure helpers (US-R-07; ux-reference §4.10; W3-39, W3-44): pending gates
// per member read from the descriptors (a `gate` element whose actor lists the member; never
// re-derived from the states), the cards, the filters of the URL and the role filters.
import type { ActionDescriptor, DnaMember, ListedElement } from '@wingfoil-ui/contracts';
import { describe, expect, it } from 'vitest';
import {
  filterCards,
  initialsOf,
  memberCards,
  pendingGates,
  roleFilters,
  teamSearch,
} from '../../../web/src/team/model.js';

function el(id: string, descriptor?: Partial<ActionDescriptor>): ListedElement {
  return {
    path: `docs/${id}.md`,
    id,
    title: id,
    type: 'kind-a',
    status: 's1',
    tags: [],
    localChanges: false,
    ...(descriptor
      ? {
          descriptor: {
            id,
            type: 'kind-a',
            status: 's1',
            kind: 'work',
            tone: 'active',
            verbs: [],
            actor: { kind: 'none' },
            ...descriptor,
          } as ActionDescriptor,
        }
      : {}),
  };
}

const GATE = { kind: 'gate', actor: { kind: 'role', role: 'r-approve', members: ['Ann', 'Bo'] } } as const;

const ELEMENTS: ListedElement[] = [
  el('e1', GATE),
  el('e2', GATE),
  el('e3', { kind: 'gate', actor: { kind: 'role', role: 'r-approve', members: ['Bo'] } }),
  // Waiting for the workflow engine: not a pending gate (spec-003 §5).
  el('e4', { kind: 'gate-waiting', actor: { kind: 'engine' } }),
  // A member actor of a work state: an action, not a gate.
  el('e5', { kind: 'work', actor: { kind: 'member', member: { name: 'Cy', email: 'cy@x.test' } } }),
  el('e6'),
];

const MEMBERS: DnaMember[] = [
  { name: 'Ann', email: 'ann@x.test', roles: ['r-approve', 'r-lead'] },
  { name: 'Bo Ray', email: 'bo@x.test', roles: ['r-dev'] },
  { name: 'Cy', roles: ['r-dev'] },
];

describe('pendingGates', () => {
  it('counts the gate elements whose actor lists the member', () => {
    expect(pendingGates('Ann', ELEMENTS)).toBe(2);
    expect(pendingGates('Bo', ELEMENTS)).toBe(3);
    expect(pendingGates('Cy', ELEMENTS)).toBe(0);
    expect(pendingGates('Nobody', [])).toBe(0);
  });
});

describe('memberCards', () => {
  it('builds one card per member in DNA order, with "you" and the pending gates once known', () => {
    expect(memberCards(MEMBERS, ELEMENTS, 'Ann')).toEqual([
      { name: 'Ann', email: 'ann@x.test', roles: ['r-approve', 'r-lead'], initials: 'A', me: true, pendingGates: 2 },
      { name: 'Bo Ray', email: 'bo@x.test', roles: ['r-dev'], initials: 'BR', me: false, pendingGates: 0 },
      { name: 'Cy', roles: ['r-dev'], initials: 'C', me: false, pendingGates: 0 },
    ]);
  });

  it('leaves the pending gates out while the elements are unknown, and "you" without identity', () => {
    const cards = memberCards(MEMBERS, undefined, undefined);
    expect(cards.map((c) => [c.me, c.pendingGates])).toEqual([
      [false, undefined],
      [false, undefined],
      [false, undefined],
    ]);
  });
});

describe('initialsOf', () => {
  it('takes the first letter of the first two words', () => {
    expect(initialsOf('Ann')).toBe('A');
    expect(initialsOf('ada lovelace byron')).toBe('AL');
    expect(initialsOf('  ')).toBe('');
  });
});

describe('teamSearch', () => {
  it('keeps the text, the role and the pending-gates flag of the URL', () => {
    expect(teamSearch({ q: 'an', role: 'r-dev', gates: '1' })).toEqual({ q: 'an', role: 'r-dev', gates: true });
    expect(teamSearch({ gates: 1 })).toEqual({ gates: true });
    expect(teamSearch({ q: '', role: '', gates: '0', other: 'x' })).toEqual({});
  });
});

describe('filterCards', () => {
  const cards = memberCards(MEMBERS, ELEMENTS, undefined);
  const names = (f: Parameters<typeof filterCards>[1]) => filterCards(cards, f).map((c) => c.name);
  it('filters by text on the name or the email, case-insensitively', () => {
    expect(names({ q: 'BO' })).toEqual(['Bo Ray']);
    expect(names({ q: 'x.test' })).toEqual(['Ann', 'Bo Ray']);
  });
  it('filters by role and by pending gates, together', () => {
    expect(names({ role: 'r-dev' })).toEqual(['Bo Ray', 'Cy']);
    expect(names({ gates: true })).toEqual(['Ann']);
    expect(names({ gates: true, role: 'r-dev' })).toEqual([]);
    expect(names({})).toEqual(['Ann', 'Bo Ray', 'Cy']);
  });
  it('keeps no card for "with pending gates" while the gates are unknown', () => {
    expect(filterCards(memberCards(MEMBERS, undefined, undefined), { gates: true })).toEqual([]);
  });
});

describe('roleFilters', () => {
  it('lists the roles held by a member, in the declared order, then the undeclared ones', () => {
    expect(roleFilters(MEMBERS, [{ name: 'r-dev' }, { name: 'r-none' }, { name: 'r-approve' }])).toEqual([
      'r-dev',
      'r-approve',
      'r-lead',
    ]);
  });
});
