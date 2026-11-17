// task-081 (D81-1) — the shared who-must-act part: who must act on an element, from its action
// descriptor only (spec-003 §4, §5, §8), the same answer Today's *Waiting on others* gave from its
// row (`waitingWho`, which now delegates to it; `test/web/today/model.test.ts` unchanged).
import type { ActionDescriptor } from '@wingfoil-ui/contracts';
import { expect, it } from 'vitest';
import { whoMustAct } from '../../../web/src/element/WhoMustAct.js';
import { waitingWho } from '../../../web/src/today/model.js';

const JORDAN = { name: 'Jordan', email: 'jordan@example.test' };

function descriptor(over: Partial<ActionDescriptor>): ActionDescriptor {
  return {
    id: 'x-1',
    type: 'x',
    status: 's',
    kind: 'work',
    tone: 'neutral',
    verbs: [],
    actor: { kind: 'none' },
    ...over,
  };
}

const CASES: [string, Partial<ActionDescriptor>, ReturnType<typeof whoMustAct>][] = [
  [
    'a member with a basis',
    { actor: { kind: 'member', member: JORDAN, basis: 'submitter' } },
    { kind: 'member', name: 'Jordan', basis: 'submitter' },
  ],
  ['a member without a basis', { actor: { kind: 'member', member: JORDAN } }, { kind: 'member', name: 'Jordan' }],
  ['a member actor naming no member', { actor: { kind: 'member' } }, { kind: 'none' }],
  [
    'a role with members',
    { actor: { kind: 'role', role: 'approver', members: ['Morgan', 'Alex'] } },
    { kind: 'role', role: 'approver', members: ['Morgan', 'Alex'] },
  ],
  ['a role without members', { actor: { kind: 'role', role: 'qa' } }, { kind: 'role', role: 'qa', members: [] }],
  ['a role actor naming no role', { actor: { kind: 'role' } }, { kind: 'none' }],
  ['the workflow engine', { actor: { kind: 'engine' } }, { kind: 'engine' }],
  ['no one', { actor: { kind: 'none' } }, { kind: 'none' }],
  [
    'a held gate, whatever its actor',
    {
      actor: { kind: 'role', role: 'approver', members: ['Morgan'] },
      approveHeld: { condition: 'never', reason: { code: 'held-by-config' } },
    },
    { kind: 'held', reason: { code: 'held-by-config' } },
  ],
];

for (const [name, over, expected] of CASES) {
  it(`names who must act for ${name}, as Today's waitingWho`, () => {
    const d = descriptor(over);
    expect(whoMustAct(d)).toEqual(expected);
    expect(
      waitingWho({
        element: { id: 'x-1', type: 'x', title: 't', status: 's', localChanges: false },
        descriptor: d,
      }),
    ).toEqual(expected);
  });
}
