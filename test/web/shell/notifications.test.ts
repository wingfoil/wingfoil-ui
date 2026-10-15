// task-042 — the pure part of the notification bell (US-S-21; spec-003 §5, spec-002 §1, D42-3,
// D42-4): the count of the bell and one line of its *Updates*.
import type { MemoryEventEntry, Today } from '@wingfoil-ui/contracts';
import { describe, expect, it } from 'vitest';
import { bellCount, updateLine } from '../../../web/src/shell/notifications.js';

function event(over: Partial<MemoryEventEntry> = {}): MemoryEventEntry {
  return {
    sha: 'a'.repeat(40),
    timestamp: '2026-10-01T10:00:00Z',
    author: 'Jordan <jordan@example.test>',
    operation: 'submit',
    type: 'task',
    id: 'task-001-login-form',
    from: 'draft',
    to: 's2',
    approver: null,
    reason: null,
    ...over,
  };
}

describe('bellCount (D42-4)', () => {
  const today = (requiresYou: Today['requiresYou']): Today => ({ view: null, requiresYou, waitingOnOthers: [] });

  it('is the length of Requires you (spec-003 §5)', () => {
    const row: NonNullable<Today['requiresYou']>[number] = {
      element: { id: 'x', type: 't', title: 'X', status: 's', localChanges: false },
      descriptor: { id: 'x', type: 't', status: 's', kind: 'gate', tone: 'human', verbs: [], actor: { kind: 'none' } },
      action: 'approve',
    };
    expect(bellCount(today([row, row]))).toBe(2);
    expect(bellCount(today([]))).toBe(0);
  });

  it('is undefined without a Today, or for a user who is not identified', () => {
    expect(bellCount(undefined)).toBeUndefined();
    expect(bellCount(today(null))).toBeUndefined();
  });
});

describe('updateLine (D42-3)', () => {
  it('names the author of a submit, with its transition', () => {
    expect(updateLine(event())).toEqual({
      sha: 'a'.repeat(40),
      id: 'task-001-login-form',
      operation: 'submit',
      name: 'Jordan',
      from: 'draft',
      to: 's2',
      timestamp: '2026-10-01T10:00:00Z',
    });
  });

  it('names the approver of an approve or a reject, not the author of the commit', () => {
    const line = updateLine(
      event({ operation: 'reject', approver: 'Morgan <morgan@example.test> (approver)', from: 's2', to: 'draft' }),
    );
    expect(line.name).toBe('Morgan');
    expect(line.operation).toBe('reject');
  });

  it('keeps a creation without a transition', () => {
    const line = updateLine(event({ operation: 'add', from: null, to: null }));
    expect([line.operation, line.from, line.to]).toEqual(['add', null, null]);
  });
});
