/**
 * The progress card's model (task-065 D65-1, D65-5, D65-11; spec-012 §3): the figures of a
 * `GET /progress` answer as the card shows them after the completion and the phase figures, the
 * scope's name in texts and the percent the tab title shows. Every number is the server's; no type,
 * state or category name is known here (REQ-ARC-05). The completion and the phase figures are the
 * shared `web/src/progress/` module's.
 */
import type { Progress } from '@wingfoil-ui/contracts';
import type { FigureCode } from '../memory/figure.js';

/** A figure of the card's row after the completion and the phase figures. */
export interface CardFigure {
  code: FigureCode;
  /** The `today.progress.*` message of the figure. */
  message: 'iterated' | 'openDefects' | 'pendingGates';
  values: Record<string, string | number>;
}

/**
 * The shown iterated, open-defects and pending-gates figures, in the card's order (ux-reference
 * §4.1); an `unavailable` iterated or open-defects figure is left out (spec-012 §3, Q7 (a)).
 */
export function cardFigures(progress: Progress): CardFigure[] {
  const { iterated, openDefects, pendingGates } = progress.figures;
  const out: CardFigure[] = [];
  if (iterated.state === 'shown')
    out.push({
      code: 'iterated',
      message: 'iterated',
      values: { type: iterated.type, finished: iterated.done, total: iterated.total },
    });
  if (openDefects.state === 'shown')
    out.push({
      code: 'open-defects',
      message: 'openDefects',
      values: { type: openDefects.type, count: openDefects.count },
    });
  out.push({ code: 'pending-gates', message: 'pendingGates', values: { count: pendingGates.count } });
  return out;
}

/** The scope's name in texts: the current element's short id, else its id; `null` without one. */
export function scopeName(progress: Progress): string | null {
  const current = progress.scope.current;
  return current === null ? null : (current.shortId ?? current.id);
}

/** The project completion the tab title shows: its percent when the figure is shown (X-10.4). */
export function completionPercent(progress: Progress | undefined): number | undefined {
  const completion = progress?.figures.completion;
  return completion?.state === 'shown' ? completion.percent : undefined;
}
