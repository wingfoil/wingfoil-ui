/**
 * Placement of an action descriptor in the role views (spec-003 §5) — *Requires you* and
 * *Waiting on others* of the current user in one of their role views — the order of *Requires
 * you*, and the verbs offered to a user (§6: a verb whose role the user does not hold is not
 * offered; its footer is informational). Pure functions over the descriptor; the identity and the
 * role view come from task-009.
 */
import type { ActionDescriptor, DescriptorActor, DescriptorVerb } from '@wingfoil-ui/contracts';
import { APPROVER_ROLE, REVIEWER_ROLE, TECH_LEAD_ROLE } from '../presets/wingfoil.js';

/** The current user: the member matched by `git config user.email` (REQ-STATE-05). */
export interface PlacementUser {
  email: string;
  roles: readonly string[];
}

/** What *Requires you* asks of the user. */
export type RequiresYouAction = 'submit' | 'rework' | 'review' | 'approve' | 'resolve';

/** Where an element goes in the user's role view. */
export type Placement =
  | { list: 'requires-you'; action: RequiresYouAction }
  | { list: 'waiting-on-others'; who: DescriptorActor }
  | { list: null };

/**
 * Where `d` goes for `user` (`undefined`: not identified) in the role view `roleView` (spec-003
 * §5): *Requires you* when the actor is the user (every view), a gate for a member holding
 * `approver` in the `reviewer` or `approver` view, an undeclared state — or the tech-lead
 * fallback actor — in the `tech-lead` view; *Waiting on others* when the actor is another member,
 * a role the user does not hold, or the workflow engine; otherwise neither. A gate-waiting element
 * is never in *Requires you*.
 */
export function placement(d: ActionDescriptor, user: PlacementUser | undefined, roleView: string): Placement {
  const actor = d.actor;
  const holds = (role: string | undefined) => role !== undefined && (user?.roles.includes(role) ?? false);
  if (actor.kind === 'member' && user && actor.member?.email.toLowerCase() === user.email.toLowerCase()) {
    return { list: 'requires-you', action: d.rejection ? 'rework' : 'submit' };
  }
  if (d.kind === 'gate' && holds(APPROVER_ROLE) && (roleView === REVIEWER_ROLE || roleView === APPROVER_ROLE)) {
    return { list: 'requires-you', action: roleView === REVIEWER_ROLE ? 'review' : 'approve' };
  }
  const techLeadActor = d.kind === 'undeclared' || actor.note === 'author-not-in-team';
  if (techLeadActor && roleView === TECH_LEAD_ROLE && holds(TECH_LEAD_ROLE)) {
    return { list: 'requires-you', action: d.kind === 'undeclared' ? 'resolve' : d.rejection ? 'rework' : 'submit' };
  }
  if (actor.kind === 'member' || actor.kind === 'engine' || (actor.kind === 'role' && !holds(actor.role))) {
    return { list: 'waiting-on-others', who: actor };
  }
  return { list: null };
}

/**
 * Order of *Requires you* (spec-003 §5): rejected work first, then by time in the current state,
 * oldest first (an unknown time last), then by id.
 */
export function compareRequiresYou(a: ActionDescriptor, b: ActionDescriptor): number {
  const rejected = Number(!a.rejection) - Number(!b.rejection);
  if (rejected !== 0) return rejected;
  const ta = a.since === undefined ? Infinity : Date.parse(a.since);
  const tb = b.since === undefined ? Infinity : Date.parse(b.since);
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The verbs of `d` offered to a user holding `roles` (spec-003 §6). */
export function offeredVerbs(d: ActionDescriptor, roles: readonly string[]): DescriptorVerb[] {
  return d.verbs.filter((v) => v.role === null || roles.includes(v.role));
}
