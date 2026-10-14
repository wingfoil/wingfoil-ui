/**
 * The Today output of spec-003 §5 (task-031): from the listed elements with their action
 * descriptors, the user's identity and the role view, *Requires you* with each row's action,
 * *Waiting on others* without the Requires you rows (T-11.3), both in the order of
 * {@link compareRequiresYou} (rejected first, then oldest in the current state, then id — D31-4),
 * and the all-roles summary of a member holding two or more roles (S5, REQ-PERF-11: the first
 * {@link SUMMARY_ITEMS} rows of each role view and "N more").
 *
 * Pure: the route (`http/project-routes.ts`) reads the inputs once per repository state and checks
 * the role view (`?view=` must be one of the member's role views, spec-004 §3).
 */
import type { Identity, Today, TodayActionRow, TodayRow, TodaySummaryLine } from '@wingfoil-ui/contracts';
import { compareRequiresYou, placement, type PlacementUser } from './placement.js';

/** Rows of each role view in the all-roles summary (REQ-PERF-11). */
export const SUMMARY_ITEMS = 3;

const byOrder = (a: TodayRow, b: TodayRow): number => compareRequiresYou(a.descriptor, b.descriptor);

/** Requires you and Waiting on others of `user` (`undefined`: not identified) in `view`. */
function lists(
  rows: readonly TodayRow[],
  user: PlacementUser | undefined,
  view: string,
): { requiresYou: TodayActionRow[]; waitingOnOthers: TodayRow[] } {
  const requiresYou: TodayActionRow[] = [];
  const waitingOnOthers: TodayRow[] = [];
  for (const row of rows) {
    const p = placement(row.descriptor, user, view);
    if (p.list === 'requires-you') requiresYou.push({ ...row, action: p.action });
    else if (p.list === 'waiting-on-others') waitingOnOthers.push(row);
  }
  return { requiresYou: requiresYou.sort(byOrder), waitingOnOthers: waitingOnOthers.sort(byOrder) };
}

/**
 * Today of `identity` in the role view `view` (`null`: none — not identified, or a member holding
 * no role). A user not identified as one member gets `view` and `requiresYou` `null` and Waiting
 * on others as for a member holding no role (RP-27); a member with no role gets the rows whose
 * actor they are (D31-5). `summary` only for a member holding two or more roles (S-23.3).
 */
export function today(rows: readonly TodayRow[], identity: Identity, view: string | null): Today {
  if (identity.kind !== 'member') {
    return { view: null, requiresYou: null, waitingOnOthers: lists(rows, undefined, '').waitingOnOthers };
  }
  const user: PlacementUser = { email: identity.email, roles: identity.roles };
  const current = lists(rows, user, view ?? '');
  if (identity.roles.length < 2) return { view, ...current };
  const summary = identity.roles.map((role): TodaySummaryLine => {
    const own = role === view ? current.requiresYou : lists(rows, user, role).requiresYou;
    return {
      role,
      count: own.length,
      items: own.slice(0, SUMMARY_ITEMS),
      more: Math.max(0, own.length - SUMMARY_ITEMS),
    };
  });
  return { view, ...current, summary };
}
