/**
 * Short ids (spec-011 §1, task-057): an element's short id is the literal text of its type's
 * `id_pattern` before `{n}` — non-empty, holding no other token — followed by the ASCII digits its
 * full id has there (the longest run): `task-{n}-{slug}` gives `task-046` for
 * `task-046-wingfoil-0.3-support`, `sprint-{n}` gives `sprint-001` (equal to the full id); a
 * pattern without `{n}` (`{kind}-{version}`, `{workflow}-{phase}-plan`), one starting with `{n}` or
 * with another token before it, and an id that does not follow its pattern give none. Computed by
 * the server only: the web receives short ids, it never derives them (REQ-ARC-05).
 *
 * A literal prefix comparison and a digit scan: neither the pattern nor the id is compiled into a
 * regular expression (spec-011 §6), so a hostile pattern or id cannot make the server backtrack.
 */
import type { MemoryYaml } from '@wingfoil-ui/contracts';

/** The token of the number in an `id_pattern`. */
const NUMBER_TOKEN = '{n}';

function isAsciiDigit(code: number): boolean {
  return code >= 0x30 && code <= 0x39;
}

/** The short id of the element `id` whose type has `idPattern`, or `undefined` when it has none. */
export function shortIdOf(id: string, idPattern: string | undefined): string | undefined {
  if (idPattern === undefined) return undefined;
  const at = idPattern.indexOf(NUMBER_TOKEN);
  if (at <= 0) return undefined; // no `{n}`, or `{n}` first: a bare number is no address
  const prefix = idPattern.slice(0, at);
  if (prefix.includes('{')) return undefined; // another token before `{n}`
  if (!id.startsWith(prefix)) return undefined;
  let end = prefix.length;
  while (end < id.length && isAsciiDigit(id.charCodeAt(end))) end += 1;
  return end > prefix.length ? id.slice(0, end) : undefined;
}

/** The short id of a listed element, from its type's pattern. */
export type ShortIds = (element: { id: string; type: string }) => string | undefined;

/**
 * The short ids of the elements of a project whose `memory.yaml` is `memoryYaml` (by each
 * element's own type); `undefined` — an unreadable `memory.yaml` — gives none to any element.
 */
export function shortIdsOf(memoryYaml: MemoryYaml | undefined): ShortIds {
  if (memoryYaml === undefined) return () => undefined;
  const { types } = memoryYaml;
  return ({ id, type }) =>
    Object.prototype.hasOwnProperty.call(types, type) ? shortIdOf(id, types[type]?.id_pattern) : undefined;
}
