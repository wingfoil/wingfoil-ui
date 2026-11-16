/** The progress card's model (task-065 D65-1). Red stub. */
import type { Progress } from '@wingfoil-ui/contracts';
import type { FigureCode } from '../memory/figure.js';

/** A figure of the card's row after the completion and the phase figures. */
export interface CardFigure {
  code: FigureCode;
  /** The `today.progress.*` message of the figure. */
  message: 'iterated' | 'openDefects' | 'pendingGates';
  values: Record<string, string | number>;
}

/** The shown iterated, open-defects and pending-gates figures, in the card's order. */
export function cardFigures(progress: Progress): CardFigure[] {
  void progress;
  return [];
}

/** The scope's name in texts: the current element's short id, else its id; `null` without one. */
export function scopeName(progress: Progress): string | null {
  void progress;
  return null;
}

/** The project completion the tab title shows: its percent when the figure is shown. */
export function completionPercent(progress: Progress | undefined): number | undefined {
  void progress;
  return undefined;
}
