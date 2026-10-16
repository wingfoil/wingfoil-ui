// task-037 — what the element panel's footer shows (`web/src/element/footer.ts`, D37-5 … D37-7):
// the rules over the descriptor shapes of the three fixtures and every identity kind.
import type { ActionDescriptor, Identity } from '@wingfoil-ui/contracts';
import { describe, expect, it } from 'vitest';
import { footerView, isBlank, isFinal } from '../../../web/src/element/footer.js';
import { header } from '../dna/data.js';

const APPROVER = 'r-approver';
const MEMBER: Identity = { kind: 'member', email: 'mo@x.test', name: 'Mo', roles: [APPROVER] };
const OTHER: Identity = { kind: 'member', email: 'sa@x.test', name: 'Sa', roles: ['r-review'] };

function descriptor(over: Partial<ActionDescriptor>): ActionDescriptor {
  return {
    id: 'e-1',
    type: 't',
    status: 's2',
    kind: 'gate',
    tone: 'human',
    verbs: [],
    actor: { kind: 'none' },
    ...over,
  };
}

const approve = { verb: 'approve' as const, to: 's3', role: APPROVER, enabled: true };
const reject = { verb: 'reject' as const, to: 's1', role: APPROVER, enabled: true };
const GATE = descriptor({ verbs: [approve, reject], actor: { kind: 'role', role: APPROVER, members: ['Mo', 'Al'] } });

describe('footerView', () => {
  it('a gate: approve first, then the rejects (D37-2)', () => {
    expect(footerView(descriptor({ ...GATE, verbs: [reject, approve] }), header(MEMBER))).toEqual({
      kind: 'gate',
      outcomes: [
        { verb: 'approve', to: 's3', enabled: true },
        { verb: 'reject', to: 's1', enabled: true },
      ],
      approve: true,
      engineAdvance: false,
    });
  });

  it('keeps the descriptor enablement and reason of each outcome', () => {
    const reason = { code: 'local-changes' } as const;
    const view = footerView(
      descriptor({
        ...GATE,
        verbs: [
          { ...approve, enabled: false, reason },
          { ...reject, enabled: false, reason },
        ],
      }),
      header(MEMBER),
    );
    expect(view.kind === 'gate' && view.outcomes.map((o) => [o.enabled, o.reason])).toEqual([
      [false, reason],
      [false, reason],
    ]);
  });

  it('a gate that is also a waiting state: only its reject, with the engine note (S-24.4)', () => {
    expect(footerView(descriptor({ verbs: [reject], actor: { kind: 'engine' } }), header(MEMBER))).toEqual({
      kind: 'gate',
      outcomes: [{ verb: 'reject', to: 's1', enabled: true }],
      approve: false,
      engineAdvance: true,
    });
  });

  it('a member without the gate role: who can act (G-09.1), without names when the actor has none (D37-6)', () => {
    expect(footerView(GATE, header(OTHER))).toEqual({
      kind: 'reserved',
      role: APPROVER,
      members: ['Mo', 'Al'],
      engineAdvance: false,
    });
    expect(footerView(descriptor({ verbs: [reject], actor: { kind: 'engine' } }), header(OTHER))).toEqual({
      kind: 'reserved',
      role: APPROVER,
      engineAdvance: true,
    });
    expect(
      footerView(descriptor({ ...GATE, actor: { kind: 'role', role: APPROVER, members: [] } }), header(OTHER)),
    ).toEqual({ kind: 'reserved', role: APPROVER, engineAdvance: false });
  });

  it('not identified: the read-only line, with the email only when How to join applies (S-13.2, S-15.2)', () => {
    expect(footerView(GATE, header({ kind: 'not-in-team', email: 'z@x.test' }))).toEqual({
      kind: 'readOnly',
      email: 'z@x.test',
    });
    expect(
      footerView(GATE, {
        ...header({ kind: 'not-in-team', email: 'z@x.test' }),
        dnaError: { code: 'x', message: 'x' },
      }),
    ).toEqual({ kind: 'readOnly' });
    expect(footerView(GATE, header({ kind: 'no-identity' }))).toEqual({ kind: 'readOnly' });
    expect(footerView(GATE, header({ kind: 'ambiguous', email: 'j@x.test', members: ['A', 'B'] }))).toEqual({
      kind: 'readOnly',
    });
  });

  it('no verb: the engine waits (S-24.2), no one acts (S-24.1), or nothing (undeclared)', () => {
    expect(footerView(descriptor({ actor: { kind: 'engine' } }), header(MEMBER))).toEqual({
      kind: 'waiting',
      state: 's2',
    });
    expect(footerView(descriptor({ actor: { kind: 'none' } }), header(MEMBER))).toEqual({ kind: 'final' });
    expect(footerView(descriptor({ actor: { kind: 'role', role: 'r-lead', members: [] } }), header(MEMBER))).toEqual({
      kind: 'none',
    });
  });

  // task-038 (D38-6, D38-7): the single-action footer, for every member identified in the team.
  it('a submit: the single-action footer for any member, with the descriptor enablement', () => {
    const submit = { verb: 'submit' as const, to: 's2', role: null, enabled: true };
    expect(footerView(descriptor({ kind: 'first', verbs: [submit] }), header(OTHER))).toEqual({
      kind: 'submit',
      to: 's2',
      enabled: true,
    });
    const reason = { code: 'local-changes' } as const;
    expect(
      footerView(descriptor({ kind: 'first', verbs: [{ ...submit, enabled: false, reason }] }), header(MEMBER)),
    ).toEqual({ kind: 'submit', to: 's2', enabled: false, reason });
  });

  it('a submit for a user who is not identified: the read-only line first (S-13.2)', () => {
    const submit = { verb: 'submit' as const, to: 's2', role: null, enabled: false, reason: { code: 'not-in-team' } as const };
    expect(footerView(descriptor({ verbs: [submit] }), header({ kind: 'no-identity' }))).toEqual({ kind: 'readOnly' });
  });
});

it('isBlank: empty and whitespace-only reasons (G-07.2)', () => {
  expect(['', '   ', '\n\t'].map(isBlank)).toEqual([true, true, true]);
  expect(isBlank(' x ')).toBe(false);
});

it('isFinal: no verb and no actor', () => {
  expect(isFinal(descriptor({}))).toBe(true);
  expect(isFinal(descriptor({ actor: { kind: 'engine' } }))).toBe(false);
  expect(isFinal(GATE)).toBe(false);
  expect(isFinal(undefined)).toBe(false);
});
