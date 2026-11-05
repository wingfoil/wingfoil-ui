/**
 * The safe subset of `taxonomy.patterns[].match` (spec-005 §1, amended 2026-11-05 — task-054
 * Q1 (a)): `ui.yaml` is repository content anyone with push access writes, and the server tests
 * every pattern against frontmatter values of every element on each repository state, so a pattern
 * must not be able to stall it. A pattern is compiled with the `u` flag first, then scanned once:
 *
 * - every top-level alternative starts with `^` (one anchored attempt per value);
 * - no backreference (`\1`, `\k<name>`), no lookahead or lookbehind;
 * - at most 2 quantifiers, each on a single atom (never on a group), `{n,m}` with `m ≤ 100`;
 * - the alternatives of its groups multiply to at most {@link MAX_ALTERNATIVES} (alternation
 *   without a quantifier is exponential in the number of groups holding `|`: design probe P3b).
 *
 * With these bounds one test on a value of at most {@link MAX_PATTERN_VALUE} characters costs at
 * most a few milliseconds (design probe P3c).
 */

/** Longest value a pattern is ever tested on (spec-012 §1 rule 2, measured as written). */
export const MAX_PATTERN_VALUE = 256;

/** Largest product of the groups' alternatives. */
export const MAX_ALTERNATIVES = 16;

/** Most quantifiers in one pattern. */
const MAX_QUANTIFIERS = 2;

/** Largest `m` of a `{n,m}` quantifier. */
const MAX_REPEAT = 100;

/** What one scan of a compiled pattern found. */
interface Scan {
  unanchored: boolean;
  backreference: boolean;
  lookaround: boolean;
  quantifiers: number;
  groupQuantifier: boolean;
  repeatAbove: boolean;
  alternatives: number;
}

/** The index after the first `close` at or after `from` (or the end). */
function after(source: string, from: number, close: string): number {
  const end = source.indexOf(close, from);
  return end === -1 ? source.length : end + 1;
}

/** The index after the escape starting at `i` (`source[i]` is `\`), and whether it is a backreference. */
function escapeEnd(source: string, i: number): { end: number; backreference: boolean; atom: boolean } {
  const c = source[i + 1] ?? '';
  if (/[1-9]/.test(c)) {
    let end = i + 2;
    while (/[0-9]/.test(source[end] ?? '')) end += 1;
    return { end, backreference: true, atom: true };
  }
  if (c === 'k') return { end: after(source, i + 2, '>'), backreference: true, atom: true };
  if ((c === 'u' || c === 'p' || c === 'P') && source[i + 2] === '{') {
    return { end: after(source, i + 3, '}'), backreference: false, atom: true };
  }
  if (c === 'u') return { end: i + 6, backreference: false, atom: true };
  if (c === 'x') return { end: i + 4, backreference: false, atom: true };
  if (c === 'c') return { end: i + 3, backreference: false, atom: true };
  // `\b` and `\B` are assertions: a quantifier on them does not compile with `u`.
  return { end: i + 2, backreference: false, atom: c !== 'b' && c !== 'B' };
}

/** The index after the character class starting at `i` (`source[i]` is `[`). */
function classEnd(source: string, i: number): number {
  let j = i + 1;
  if (source[j] === '^') j += 1;
  while (j < source.length && source[j] !== ']') j += source[j] === '\\' ? 2 : 1;
  return j + 1;
}

/** One pass over a source that compiles with the `u` flag. */
function scan(source: string): Scan {
  const found: Scan = {
    unanchored: source[0] !== '^',
    backreference: false,
    lookaround: false,
    quantifiers: 0,
    groupQuantifier: false,
    repeatAbove: false,
    alternatives: 1,
  };
  /** The alternatives of each open group. */
  const groups: number[] = [];
  /** What a quantifier here would apply to. */
  let last: 'atom' | 'group' | 'none' = 'none';
  let i = 0;
  const quantifier = (end: number, max?: number): void => {
    found.quantifiers += 1;
    if (last === 'group') found.groupQuantifier = true;
    if (max !== undefined && max > MAX_REPEAT) found.repeatAbove = true;
    i = source[end] === '?' ? end + 1 : end; // a lazy quantifier counts once
    last = 'none';
  };
  while (i < source.length) {
    const c = source[i]!;
    switch (c) {
      case '\\': {
        const escape = escapeEnd(source, i);
        if (escape.backreference) found.backreference = true;
        i = escape.end;
        last = escape.atom ? 'atom' : 'none';
        break;
      }
      case '[':
        i = classEnd(source, i);
        last = 'atom';
        break;
      case '(': {
        const head = source.slice(i, i + 4);
        if (/^\(\?(?:=|!|<=|<!)/.test(head)) found.lookaround = true;
        groups.push(1);
        if (/^\(\?<[^=!]/.test(head))
          i = after(source, i + 3, '>'); // a named group: skip its name
        else if (source[i + 1] === '?')
          i += /^\(\?<[=!]/.test(head) ? 4 : 3; // (?:, (?=, (?!, (?<=, (?<!
        else i += 1;
        last = 'none';
        break;
      }
      case ')': {
        const alternatives = groups.pop() ?? 1;
        if (alternatives > 1) found.alternatives *= alternatives;
        i += 1;
        last = 'group';
        break;
      }
      case '|':
        if (groups.length === 0) {
          if (source[i + 1] !== '^') found.unanchored = true;
        } else {
          groups[groups.length - 1]! += 1;
        }
        i += 1;
        last = 'none';
        break;
      case '*':
      case '+':
      case '?':
        quantifier(i + 1);
        break;
      case '{': {
        // With `u` a brace outside a class or an escape is always a quantifier.
        const end = after(source, i + 1, '}');
        const [, max] = /^\{\d+(?:,(\d*))?\}$/.exec(source.slice(i, end)) ?? [];
        quantifier(end, max ? Number(max) : undefined);
        break;
      }
      case '^':
      case '$':
        i += 1;
        last = 'none';
        break;
      default:
        i += 1;
        last = 'atom';
    }
  }
  return found;
}

/**
 * Why `source` is not an accepted pattern — the reason as spec-005 §1 writes it — or `undefined`
 * when it is one.
 */
export function patternProblem(source: string): string | undefined {
  try {
    new RegExp(source, 'u');
  } catch (error) {
    return `does not compile: ${(error as Error).message}`;
  }
  const found = scan(source);
  if (found.unanchored) return 'must start with ^';
  if (found.backreference) return 'backreferences are not allowed';
  if (found.lookaround) return 'lookaround is not allowed';
  if (found.quantifiers > MAX_QUANTIFIERS) return `at most ${MAX_QUANTIFIERS} quantifiers`;
  if (found.groupQuantifier) return 'a quantifier on a group is not allowed';
  if (found.repeatAbove) return `{n,m} above ${MAX_REPEAT}`;
  if (found.alternatives > MAX_ALTERNATIVES) return `at most ${MAX_ALTERNATIVES} alternatives combined`;
  return undefined;
}
