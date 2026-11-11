/**
 * The natural id order of spec-012 §3 (task-059 D59-1, D59-3): digit runs compared as numbers
 * (`US-M-2` before `US-M-10`, `v0.9` before `v0.10`), other runs by code units; two ids equal in
 * that order (`a01`, `a1`) fall back to plain code-unit order, so the order is total.
 */

const RUNS = /\d+|\D+/g;

/** Compare two digit runs as numbers of any length: fewer significant digits first. */
function compareDigits(a: string, b: string): number {
  const x = a.replace(/^0+(?=\d)/, '');
  const y = b.replace(/^0+(?=\d)/, '');
  if (x.length !== y.length) return x.length - y.length;
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Negative when `a` sorts before `b` in natural order, 0 only when they are equal. */
export function naturalCompare(a: string, b: string): number {
  throw new Error('not implemented (red)');
}

/** The distinct `ids` in natural order. */
export function naturalOrder(ids: Iterable<string>): string[] {
  throw new Error('not implemented (red)');
}
