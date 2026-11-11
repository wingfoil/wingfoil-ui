/**
 * The percentages of spec-012 §3 (task-059 D59-4): `round(100 × value)` half up, computed in
 * integers so that an exact half (12.5 %) never rounds down through a float error.
 */

/** `round(100 × done / total)` half up; `total` > 0. */
export function percentOf(done: number, total: number): number {
  return Math.floor((200 * done + total) / (2 * total));
}

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));

/**
 * The unweighted mean of `parts` (each `finished / total`, `total` > 0, at least one part): its value
 * (0 … 1, for display) and its percent from the exact rational mean.
 */
export function meanOf(parts: readonly { finished: number; total: number }[]): { value: number; percent: number } {
  let lcm = 1n;
  for (const { total } of parts) {
    const t = BigInt(total);
    lcm = (lcm / gcd(lcm, t)) * t;
  }
  let sum = 0n;
  for (const { finished, total } of parts) sum += (BigInt(finished) * lcm) / BigInt(total);
  const den = lcm * BigInt(parts.length);
  const percent = Number((200n * sum + den) / (2n * den));
  return { value: parts.reduce((a, p) => a + p.finished / p.total, 0) / parts.length, percent };
}
