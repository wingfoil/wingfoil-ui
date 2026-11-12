// task-072 AC-4 (D72-3; bug-035) — the Team view compares member names across three bodies: the
// DNA's members (`/config`), the identified user (`/api/p/:pid` `identity.name`) and the gates'
// actors (`/elements` `descriptor.actor.members[]`). The server escapes each with the same function,
// so a name with U+202E and ESC is the same text in all three: the user's card is still "you" and
// still counts its pending gates (characterization: equal raw names stay equal escaped).
import type { ActionDescriptor, DnaMember, ListedElement } from '@wingfoil-ui/contracts';
import { expect, it } from 'vitest';
import { memberCards } from '../../../web/src/team/model.js';

/** The name as every body serves it. */
const NAME = 'Alex \\u202ex\\x1by';

const MEMBERS: DnaMember[] = [
  { name: NAME, email: 'alex\\u202e\\x1b@example.test', roles: ['approver'] },
  { name: 'Jordan', email: 'jordan@example.test', roles: ['developer'] },
];

const GATE: ListedElement = {
  path: 'docs/memory/task/task-001-x.md',
  id: 'task-001-x',
  title: 'X',
  type: 'task',
  status: 'pending',
  tags: [],
  localChanges: false,
  descriptor: {
    id: 'task-001-x',
    type: 'task',
    status: 'pending',
    kind: 'gate',
    tone: 'human',
    verbs: [],
    actor: { kind: 'role', role: 'approver', members: [NAME] },
  } as ActionDescriptor,
};

it('the escaped name is "you" and counts its pending gates', () => {
  const [alex, jordan] = memberCards(MEMBERS, [GATE], NAME);
  expect(alex).toMatchObject({ name: NAME, me: true, pendingGates: 1, initials: 'A\\' });
  expect(jordan).toMatchObject({ me: false, pendingGates: 0 });
});
