/**
 * The percentages of spec-012 §3 (task-059 D59-4): `round(100 × value)` half up, computed in
 * integers so that an exact half (12.5 %) never rounds down through a float error.
 */

/** `round(100 × done / total)` half up; `total` > 0. */
export function percentOf(_done: number, _total: number): number {
  throw new Error('not implemented (red)');
}

/** The unweighted mean of `parts`: its value (0 … 1) and its percent from the exact rational mean. */
export function meanOf(_parts: readonly { finished: number; total: number }[]): { value: number; percent: number } {
  throw new Error('not implemented (red)');
}
