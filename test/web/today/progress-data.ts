/**
 * A `GET /api/p/:pid/progress` answer for the Today tests (task-065): Today reads it for its progress
 * card, so the tests of the other cards answer it too (an unanswered read would add the card's error
 * alert to the page). Whole project, nothing shown but the pending gates.
 */
import type { Progress } from '@wingfoil-ui/contracts';

const READ_ONLY = { state: 'read-only', reason: { code: 'not-in-release' } } as const;

/** The progress answer of project `pid`, keyed by its path for a fake API. */
export function progressAnswer(pid: string): Record<string, { status: number; body: Progress }> {
  return {
    [`/api/p/${pid}/progress`]: {
      status: 200,
      body: {
        ui: { source: 'none' },
        mode: 'flow',
        scope: { type: null, current: null, basis: null },
        figures: {
          completion: { state: 'unavailable', reason: { code: 'no-reference-categories' } },
          phase: READ_ONLY,
          phaseCompletion: READ_ONLY,
          iterated: { state: 'unavailable', reason: { code: 'no-iterates-type' } },
          openDefects: { state: 'unavailable', reason: { code: 'no-defects-type' } },
          pendingGates: { state: 'shown', count: 0, ids: [] },
        },
        unreadable: [],
        capped: [],
      },
    },
  };
}
