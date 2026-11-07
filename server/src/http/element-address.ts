/**
 * The resolution of the element read's `:eid` (spec-011 §3, task-057; the approver's Q1-a): `:eid`
 * is compared, as a string, with the ids of the state's `memory search` answers — never placed in a
 * path, a command line or a regular expression — in this order, the first step that matches
 * deciding:
 *
 * 1. the full id of a non-archived element;
 * 2. the full id of an archived element (the two lazy `--status` searches, spec-001 §3);
 * 3. the short id of non-archived elements whose short id differs from their full id;
 * 4. the same over archived elements, only when no non-archived element matched step 3 (E3);
 * 5. none — the route's 404 `not-found`.
 *
 * Several matches in step 3 or 4 give the 409 `ambiguous-id`'s detail: at most
 * {@link AMBIGUOUS_CANDIDATES_MAX} candidates ordered by full id, `more` counting the rest (E4), each
 * title through the character escape of repository texts (spec-004 §5, RP3-18 K1). History and the
 * writes take the full id only: they do not resolve.
 */
import type { AmbiguousCandidate, AmbiguousIdDetail, MemoryMatch } from '@wingfoil-ui/contracts';
import { repositoryText } from './serialise.js';
import type { ShortIds } from '../reads/short-id.js';

/** The most candidates a 409 `ambiguous-id` lists (RP3-17 E4). */
export const AMBIGUOUS_CANDIDATES_MAX = 20;

/** The lists a resolution reads: each asked for only when a step needs it. */
export interface ResolutionSource {
  /** The non-archived elements (`memory search`). */
  live(): Promise<readonly MemoryMatch[]>;
  /** The archived elements (the two lazy `--status` searches). */
  retired(): Promise<readonly MemoryMatch[]>;
  shortIds: ShortIds;
}

/** The element `:eid` names (its full id), the detail of an ambiguous short id, or `undefined`. */
export type Resolution = { id: string } | { ambiguous: AmbiguousIdDetail } | undefined;

/** The matches whose short id is `eid` and differs from their full id (`sprint-001` is found by steps 1–2). */
function byShortId(matches: readonly MemoryMatch[], eid: string, shortIds: ShortIds): MemoryMatch[] {
  return matches.filter((m) => m.id !== eid && shortIds(m) === eid);
}

function candidate(match: MemoryMatch, shortId: string): AmbiguousCandidate {
  const { id, title, type, status } = match;
  return { id, shortId, title: repositoryText(title), type, status };
}

/** The 409's detail for the matches of one step (two or more). */
function ambiguous(matches: readonly MemoryMatch[], shortId: string): { ambiguous: AmbiguousIdDetail } {
  // Code-unit order: the same on every machine, whatever the locale.
  const sorted = [...matches].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const shown = sorted.slice(0, AMBIGUOUS_CANDIDATES_MAX);
  return {
    ambiguous: { candidates: shown.map((m) => candidate(m, shortId)), more: sorted.length - shown.length },
  };
}

function decide(matches: readonly MemoryMatch[], eid: string): Resolution {
  if (matches.length === 0) return undefined;
  return matches.length === 1 ? { id: matches[0]!.id } : ambiguous(matches, eid);
}

/** Resolve `eid` over `source` (spec-011 §3). */
export async function resolveElementId(eid: string, source: ResolutionSource): Promise<Resolution> {
  const live = await source.live();
  if (live.some((m) => m.id === eid)) return { id: eid };
  const archived = await source.retired();
  if (archived.some((m) => m.id === eid)) return { id: eid };
  return decide(byShortId(live, eid, source.shortIds), eid) ?? decide(byShortId(archived, eid, source.shortIds), eid);
}
