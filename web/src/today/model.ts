/**
 * The pure part of Today (task-036; ux-reference §4.1; spec-003 §5, §8; decisions D36-4…D36-8): who
 * the greeting names, the reason of a Requires you row and who must act on a Waiting on others row.
 * Everything is read from `GET /api/p/:pid/today` and the project header as data — placement, order,
 * actor, tone and action come from the server and are never re-derived here (spec-003 §8).
 *
 * v0.3 (task-061, D61-4): each card's type and state facets, its filters and its 10-row limit, over
 * the rows the server sent — grouping its data, never placing a row (no new query).
 */
import type { HoldReason, ProjectHeader, TodayActionRow, TodayRow } from '@wingfoil-ui/contracts';
import { ageOf, type Age } from '../memory/model.js';

/** An age in its largest whole unit, as a positive count (the reason's "for 3 days", D36-7). */
export interface Duration {
  count: number;
  unit: Age['unit'];
}

/** The reason of a Requires you row (D36-7). */
export type RowReason =
  | { kind: 'rejection'; by: string; reason: string | null }
  | { kind: 'undeclared'; state: string; type: string }
  | { kind: 'age'; state: string; age: Duration }
  | { kind: 'state'; state: string };

/** Who must act on a Waiting on others row (D36-6). */
export type WaitingWho =
  | { kind: 'member'; name: string; basis?: string }
  | { kind: 'role'; role: string; members: string[] }
  | { kind: 'engine' }
  /** A held gate (v0.3, spec-003 §5): its hold's reason in place of "Reserved to approver". */
  | { kind: 'held'; reason: HoldReason }
  | { kind: 'none' };

/** What the identity sentence of an unidentified user says (D36-8); `undefined` for a member. */
export type IdentityNote = 'notInTeam' | 'unidentified';

/** The time spent since `since` (ISO 8601) at `now` (ms), in its largest whole unit. */
export function durationOf(since: string, now: number): Duration {
  const age = ageOf(since, now);
  return { count: Math.abs(age.value), unit: age.unit };
}

/**
 * The reason of a Requires you row: the rejection of rework, the *Action required* text of an
 * undeclared state (action `resolve`), else the state and the time in it (D36-7).
 */
export function rowReason(row: TodayActionRow, now: number): RowReason {
  const { element, descriptor, action } = row;
  const rejection = descriptor.rejection;
  if (action === 'rework' && rejection) return { kind: 'rejection', by: rejection.by, reason: rejection.reason };
  if (action === 'resolve') return { kind: 'undeclared', state: element.status, type: element.type };
  if (descriptor.since !== undefined) {
    return { kind: 'age', state: element.status, age: durationOf(descriptor.since, now) };
  }
  return { kind: 'state', state: element.status };
}

/** Who must act on a Waiting on others row, from the descriptor's actor (spec-003 §4, §8). */
export function waitingWho(row: TodayRow): WaitingWho {
  const { actor, approveHeld } = row.descriptor;
  if (approveHeld) return { kind: 'held', reason: approveHeld.reason };
  switch (actor.kind) {
    case 'member':
      return actor.member === undefined
        ? { kind: 'none' }
        : { kind: 'member', name: actor.member.name, ...(actor.basis ? { basis: actor.basis } : {}) };
    case 'role':
      return actor.role === undefined
        ? { kind: 'none' }
        : { kind: 'role', role: actor.role, members: actor.members ?? [] };
    case 'engine':
      return { kind: 'engine' };
    case 'none':
      return { kind: 'none' };
  }
}

/** The member's name for the greeting; `undefined` for a user not identified in the team. */
export function greetingName(header: ProjectHeader): string | undefined {
  return header.identity.kind === 'member' ? header.identity.name : undefined;
}

/**
 * The identity sentence shown in place of Requires you (D36-8): *not in team* with a readable DNA
 * gets *How to join* (D35-8); *No identity*, *Ambiguous* (and a not-in-team user whose DNA could
 * not be read) point to the read-only notice of the header.
 */
export function identityNote(header: ProjectHeader): IdentityNote | undefined {
  const { identity } = header;
  if (identity.kind === 'member') return undefined;
  return identity.kind === 'not-in-team' && !header.dnaError ? 'notInTeam' : 'unidentified';
}

/** Rows a Today card shows before "Show all (<n>)" (REQ-PERF-11 v0.3, D61-7). */
export const ROW_LIMIT = 10;

/** The facet a card filter reads: the element's type, or its state. */
export type FacetKey = 'type' | 'state';

/** One value of a facet and the count of the card's rows that have it. */
export interface Facet {
  value: string;
  count: number;
}

/** A card's filters: `undefined` is *All*. */
export interface CardFilter {
  type?: string;
  state?: string;
}

const COLLATOR = new Intl.Collator('en');

/** The value of `key` of a row. */
function valueOf(row: TodayRow, key: FacetKey): string {
  return key === 'type' ? row.element.type : row.element.status;
}

/**
 * The distinct values of `key` among `rows` with their counts, sorted by value (stable across
 * refetches). Counted over the card's unfiltered rows: the other filter does not change them (T-02.4).
 */
export function facetsOf(rows: readonly TodayRow[], key: FacetKey): Facet[] {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(valueOf(row, key), (counts.get(valueOf(row, key)) ?? 0) + 1);
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => COLLATOR.compare(a.value, b.value));
}

/** The rows matching both filters, in the server's order. */
export function filterCard<R extends TodayRow>(rows: readonly R[], filter: CardFilter): R[] {
  return rows.filter(
    (row) =>
      (filter.type === undefined || row.element.type === filter.type) &&
      (filter.state === undefined || row.element.status === filter.state),
  );
}

/** `filter` without a value that none of `rows` has any more: that filter is *All* again (D61-6). */
export function effectiveFilter(rows: readonly TodayRow[], filter: CardFilter): CardFilter {
  const has = (key: FacetKey, value: string | undefined): value is string =>
    value !== undefined && rows.some((row) => valueOf(row, key) === value);
  return {
    ...(has('type', filter.type) ? { type: filter.type } : {}),
    ...(has('state', filter.state) ? { state: filter.state } : {}),
  };
}

/** The rows a card shows: the first {@link ROW_LIMIT} unless it is expanded. */
export function limited<R>(rows: readonly R[], expanded: boolean): readonly R[] {
  return expanded ? rows : rows.slice(0, ROW_LIMIT);
}
