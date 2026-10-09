/**
 * The Team view's pure helpers (US-R-07; ux-reference §4.10; W3-39, W3-44). A member's pending
 * gates are read from the action descriptors of `GET /elements` (spec-003 §4–§5): an element whose
 * descriptor `kind` is `gate` and whose actor lists the member — the descriptor is data, nothing is
 * derived from the states here, and a `gate-waiting` element is not a pending gate.
 */
import type { DnaMember, DnaRole, ListedElement } from '@wingfoil-ui/contracts';

/** The descriptor kind of an element waiting on a human gate (spec-003 §2). */
const GATE_KIND = 'gate';

/** One member card. */
export interface MemberCard {
  name: string;
  /** Absent when the DNA gives none (WingFoil 0.2.2: optional). */
  email?: string;
  roles: string[];
  initials: string;
  /** The current user. */
  me: boolean;
  /** Pending gates on the member's roles; absent while the elements are not known. */
  pendingGates?: number;
}

/** The Team filters of the URL (`?q=&role=&gates=1`). */
export interface TeamFilters {
  q?: string;
  role?: string;
  gates?: boolean;
}

/** The gate elements whose actor lists `member` (by name, as the descriptor names them). */
export function pendingGates(member: string, elements: readonly ListedElement[]): number {
  return elements.filter((e) => e.descriptor?.kind === GATE_KIND && e.descriptor.actor.members?.includes(member))
    .length;
}

/** Up to two initials of `name`. */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter((w) => w !== '')
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/** One card per member, in DNA order; `me` is the identified member's name. */
export function memberCards(
  members: readonly DnaMember[],
  elements: readonly ListedElement[] | undefined,
  me: string | undefined,
): MemberCard[] {
  return members.map((m) => ({
    name: m.name,
    ...(m.email !== undefined ? { email: m.email } : {}),
    roles: m.roles,
    initials: initialsOf(m.name),
    me: me !== undefined && m.name === me,
    ...(elements ? { pendingGates: pendingGates(m.name, elements) } : {}),
  }));
}

/** A search parameter as text, when not empty. */
function text(value: unknown): string | undefined {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** The filters of the URL's search parameters. */
export function teamSearch(search: Record<string, unknown>): TeamFilters {
  const q = text(search['q']);
  const role = text(search['role']);
  const gates = text(search['gates']) === '1';
  return { ...(q !== undefined ? { q } : {}), ...(role !== undefined ? { role } : {}), ...(gates ? { gates } : {}) };
}

/** The cards matching every filter (text on the name or email, role, pending gates). */
export function filterCards(cards: readonly MemberCard[], filters: TeamFilters): MemberCard[] {
  const q = filters.q?.toLowerCase();
  return cards.filter(
    (c) =>
      (q === undefined || `${c.name} ${c.email ?? ''}`.toLowerCase().includes(q)) &&
      (filters.role === undefined || c.roles.includes(filters.role)) &&
      (!filters.gates || (c.pendingGates ?? 0) > 0),
  );
}

/** The roles a member holds, in the order of `team.roles`, then those it does not declare. */
export function roleFilters(members: readonly DnaMember[], roles: readonly DnaRole[]): string[] {
  const held = new Set(members.flatMap((m) => m.roles));
  const declared = roles.map((r) => r.name).filter((r) => held.has(r));
  return [...declared, ...[...held].filter((r) => !declared.includes(r))];
}

/** The URL's search parameters of `filters` (`gates=1` for "with pending gates"). */
export function searchOf(filters: TeamFilters): { q?: string; role?: string; gates?: 1 } {
  const { gates, ...rest } = filters;
  return gates ? { ...rest, gates: 1 } : rest;
}
