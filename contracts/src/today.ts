/**
 * The Today output (spec-003 §5, `contracts/api/today.schema.json`) and the Memory events feed
 * (spec-002 §1, spec-004 §3, `contracts/api/memory-events.schema.json`) — v0.2.
 */
import type { ActionDescriptor } from './descriptor.js';

/**
 * What a Requires you row asks of the user (spec-003 §5); the web catalogue gives its button:
 * `submit` and `rework` → "Submit", `review` → "Review", `approve` → "Approve", `resolve` → "Open".
 */
export type TodayAction = 'submit' | 'rework' | 'review' | 'approve' | 'resolve';

/** The element of a Today row. */
export interface TodayElement {
  id: string;
  type: string;
  title: string;
  status: string;
  /** The element file has uncommitted changes (REQ-STATE-01). */
  localChanges: boolean;
}

/** One Today row: the element and its action descriptor (spec-003 §8). */
export interface TodayRow {
  element: TodayElement;
  descriptor: ActionDescriptor;
}

/** A Requires you row, with its action. */
export interface TodayActionRow extends TodayRow {
  action: TodayAction;
}

/** One line of the all-roles summary (S5, REQ-PERF-11). */
export interface TodaySummaryLine {
  role: string;
  /** The length of Requires you in this role view. */
  count: number;
  /** Its first rows, at most 3. */
  items: TodayActionRow[];
  /** `count − 3` when positive, else 0 ("N more"). */
  more: number;
}

/** `GET /api/p/:pid/today?view=<role>`. */
export interface Today {
  /** The role view used; `null` without one (not identified, or a member holding no role). */
  view: string | null;
  /** Requires you of `view`, in the §5 order; `null` when the user is not identified. */
  requiresYou: TodayActionRow[] | null;
  /** Waiting on others, Requires you rows excluded, in the same order. */
  waitingOnOthers: TodayRow[];
  /** One line per role, in the DNA's order; absent unless the member holds two or more roles. */
  summary?: TodaySummaryLine[];
}

/** One Memory event (spec-002 §1). */
export interface MemoryEventEntry {
  sha: string;
  /** Author date, ISO 8601. */
  timestamp: string;
  /** `Name <email>`. */
  author: string;
  operation: 'add' | 'submit' | 'approve' | 'reject' | 'deprecate';
  type: string;
  id: string;
  /** `null` for `add`, and when the commit shows no transition. */
  from: string | null;
  to: string | null;
  /** `Name <email> (role)`, or `null`. */
  approver: string | null;
  reason: string | null;
}

/** `GET /api/p/:pid/events/memory?before=&limit=`: newest first. */
export interface MemoryEventsPage {
  events: MemoryEventEntry[];
  /** Older events follow. */
  more: boolean;
}
