/**
 * WingFoil 0.2.2's own vocabulary — the only state and role names the server knows (REQ-ARC-05:
 * no type or state name in code outside `presets/` and the tests). They are WingFoil's, not a
 * methodology's: the machine of a type that declares none, the archived set, and the roles the
 * action descriptor names (spec-003; W-13: every gate requires `approver` on 0.2.2).
 */
import type { StateMachine } from '@wingfoil-ui/contracts';

/** WingFoil's built-in machine, for a type with no `states` and no `defaults.states`. */
export const BUILT_IN_STATES: StateMachine = Object.freeze({
  sequence: ['draft', 'pending', 'approved'],
  gates: { pending: { reject: 'draft' } },
});

/** The implicit state every element can reach (`memory deprecate`). */
export const DEPRECATED = 'deprecated';

/** WingFoil's archived states: listed by `memory search` only when `--status` names them (W-19). */
export type ArchivedStatus = 'deprecated' | 'superseded';

/** WingFoil's archived set, in the order the archived searches run. */
export const ARCHIVED_STATES: readonly ArchivedStatus[] = Object.freeze(['deprecated', 'superseded']);

/** The role every gate verb requires on WingFoil 0.2.2 (W-13). */
export const APPROVER_ROLE = 'approver';

/** The role that resolves an undeclared state and the fallback actor (spec-003 §4). */
export const TECH_LEAD_ROLE = 'tech-lead';

/** The role view in which a member holding {@link APPROVER_ROLE} reviews gates (spec-003 §5). */
export const REVIEWER_ROLE = 'reviewer';
