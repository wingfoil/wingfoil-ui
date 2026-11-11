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
  const xs = a.match(RUNS) ?? [];
  const ys = b.match(RUNS) ?? [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i += 1) {
    const x = xs[i]!;
    const y = ys[i]!;
    const digits = /^\d/.test(x) && /^\d/.test(y);
    const c = digits ? compareDigits(x, y) : x < y ? -1 : x > y ? 1 : 0;
    if (c !== 0) return c;
  }
  if (xs.length !== ys.length) return xs.length - ys.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The distinct `ids` in natural order. */
export function naturalOrder(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort(naturalCompare);
}
