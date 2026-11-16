/**
 * The figure filter of the Memory list (task-066 D66-9; US-T-13, TQ-4 (a); spec-012 §3 *Figure
 * filters*): `/p/<pid>/memory?figure=<code>` lists the elements whose full id is in that figure's
 * `ids` of the `/progress` answer Today shares. The ids stay in the query cache, never in the
 * address. The web selects by the server's ids and derives nothing.
 */
import type { Progress } from '@wingfoil-ui/contracts';
import { defineMessages, type MessageDescriptor } from 'react-intl';

/** The figure codes of the address, as spec-012 §3 names them. */
export const FIGURE_CODES = ['completion', 'iterated', 'open-defects', 'pending-gates'] as const;

/** A figure code of the address. */
export type FigureCode = (typeof FIGURE_CODES)[number];

/** The `figures` key of `/progress` for each code. */
const FIGURE_KEYS = {
  completion: 'completion',
  iterated: 'iterated',
  'open-defects': 'openDefects',
  'pending-gates': 'pendingGates',
} as const satisfies Record<FigureCode, keyof Progress['figures']>;

/** The label of each figure (D66-9, Q2 (a)): the type of `iterated` and `open-defects` as written. */
export const FIGURE_LABELS: Readonly<Record<FigureCode, MessageDescriptor>> = defineMessages({
  completion: { id: 'memory.figure.completion' },
  iterated: { id: 'memory.figure.iterated' },
  'open-defects': { id: 'memory.figure.openDefects' },
  'pending-gates': { id: 'memory.figure.pendingGates' },
});

/** `value` when it is a figure code, else `undefined` (an unknown code is ignored, T-13.4). */
export function figureCode(value: unknown): FigureCode | undefined {
  return FIGURE_CODES.find((c) => c === value);
}

/** The figure of `code` when it is shown, with its ids and the arguments of its label. */
export function shownFigure(
  progress: Progress,
  code: FigureCode,
): { ids: ReadonlySet<string>; values: { type: string } | Record<string, never> } | undefined {
  const figure = progress.figures[FIGURE_KEYS[code]];
  if (figure.state !== 'shown') return undefined;
  return { ids: new Set(figure.ids), values: 'type' in figure ? { type: figure.type } : {} };
}
