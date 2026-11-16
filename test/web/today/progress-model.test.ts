// task-065 D65-1, D65-5, D65-11 — the progress card's model over a `/progress` answer: the shown
// iterated, open-defects and pending-gates figures in the card's order with their codes and values
// (an `unavailable` iterated or open-defects figure left out, Q7 (a)), the scope's name, the percent
// the tab title shows. Nothing is computed: every number is the server's.
import type { Progress } from '@wingfoil-ui/contracts';
import { describe, expect, it } from 'vitest';
import { cardFigures, completionPercent, scopeName } from '../../../web/src/today/progress.js';

const READ_ONLY = { state: 'read-only', reason: { code: 'not-in-release' } } as const;

function progress(over: Partial<Progress> = {}, figures: Partial<Progress['figures']> = {}): Progress {
  return {
    ui: { source: 'file' },
    mode: 'sequence',
    scope: {
      type: 'kind-r',
      current: { id: 'r-007-seven', shortId: 'r-007', title: 'Seven', type: 'kind-r', status: 's2', tone: 'active' },
      basis: 'derived',
    },
    figures: {
      completion: { state: 'shown', value: 0.25, percent: 25, references: [], referencesCount: 0, ids: [] },
      phase: READ_ONLY,
      phaseCompletion: READ_ONLY,
      iterated: { state: 'shown', type: 'kind-a', done: 1, total: 4, ids: [], doneIds: [] },
      openDefects: { state: 'shown', type: 'kind-d', count: 1, ids: [] },
      pendingGates: { state: 'shown', count: 3, ids: [] },
      ...figures,
    },
    unreadable: [],
    capped: [],
    ...over,
  };
}

describe('cardFigures', () => {
  it('lists iterated, open defects and pending gates with their codes and the server values', () => {
    expect(cardFigures(progress())).toEqual([
      { code: 'iterated', message: 'iterated', values: { type: 'kind-a', finished: 1, total: 4 } },
      { code: 'open-defects', message: 'openDefects', values: { type: 'kind-d', count: 1 } },
      { code: 'pending-gates', message: 'pendingGates', values: { count: 3 } },
    ]);
  });

  it('leaves out an unavailable iterated or open-defects figure (Q7 (a))', () => {
    const p = progress(
      {},
      {
        iterated: { state: 'unavailable', reason: { code: 'no-iterates-type' } },
        openDefects: { state: 'unavailable', reason: { code: 'no-defects-type' } },
      },
    );
    expect(cardFigures(p)).toEqual([{ code: 'pending-gates', message: 'pendingGates', values: { count: 3 } }]);
  });
});

describe('scopeName', () => {
  it('is the short id, else the id, of the current element; null without one', () => {
    expect(scopeName(progress())).toBe('r-007');
    const noShort = progress({
      scope: {
        type: 'kind-r',
        current: { id: 'minor-v0.2', title: 'Two', type: 'kind-r', status: 's', tone: 'active' },
        basis: 'derived',
      },
    });
    expect(scopeName(noShort)).toBe('minor-v0.2');
    expect(scopeName(progress({ scope: { type: 'kind-r', current: null, basis: null } }))).toBeNull();
  });
});

describe('completionPercent', () => {
  it('is the server percent of a shown completion, else undefined', () => {
    expect(completionPercent(progress())).toBe(25);
    expect(
      completionPercent(progress({}, { completion: { state: 'unavailable', reason: { code: 'no-linked-elements' } } })),
    ).toBeUndefined();
    expect(completionPercent(undefined)).toBeUndefined();
  });
});
