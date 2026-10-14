/**
 * The pure part of Today (task-036; ux-reference §4.1; spec-003 §5, §8; decisions D36-4…D36-8): who
 * the greeting names, the reason of a Requires you row and who must act on a Waiting on others row.
 * Everything is read from `GET /api/p/:pid/today` and the project header as data — placement, order,
 * actor, tone and action come from the server and are never re-derived here (spec-003 §8).
 */
import type { ProjectHeader, TodayActionRow, TodayRow } from '@wingfoil-ui/contracts';
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
  const { actor } = row.descriptor;
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

/** The ids of rows, in order (the comparison of TT-PERF-09). */
export function rowIds(rows: readonly TodayRow[]): string[] {
  return rows.map((r) => r.element.id);
}
