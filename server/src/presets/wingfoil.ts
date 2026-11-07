/**
 * WingFoil 0.2.2's own vocabulary — the only state and role names the server knows (REQ-ARC-05:
 * no type or state name in code outside `presets/` and the tests). They are WingFoil's, not a
 * methodology's: the machine of a type that declares none, the archived set, and the roles the
 * action descriptor names (spec-003; W-13: every gate requires `approver` on 0.2.2).
 */
import type { MemoryOperation, StateMachine } from '@wingfoil-ui/contracts';

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

/**
 * The Memory operations a `wf(<type>): <verb> …` commit records, as WingFoil 0.3.x reads them
 * (`dist/memory/audit.js` `MEMORY_OPERATIONS`, in its order): the five verbs of 0.2.2, the
 * practised `start`, `finalize`, `sync`, then `amend`, `park` and `assign` (task-048).
 */
export const MEMORY_OPERATIONS: readonly MemoryOperation[] = Object.freeze([
  'add',
  'submit',
  'approve',
  'reject',
  'deprecate',
  'start',
  'finalize',
  'sync',
  'amend',
  'park',
  'assign',
]);

/**
 * The operation that changes the `release` field, not the state: never a Memory event (spec-002 §3,
 * task-048 D48-2).
 */
export const RELEASE_OPERATION = 'assign' satisfies MemoryOperation;

/**
 * The operation that records a correction and keeps the state: not a move of the action descriptor
 * (spec-003 §4, task-048 D48-6).
 */
export const CORRECTION_OPERATION = 'amend' satisfies MemoryOperation;

/**
 * The `wf(<scope>)` scopes of configuration commits (`dna`, `directive`, `workflow`): their verbs are
 * never Memory operations (WingFoil 0.3.x `CONFIGURATION_SCOPES`).
 */
export const CONFIGURATION_SCOPES: readonly string[] = Object.freeze(['dna', 'directive', 'workflow']);

/**
 * The frontmatter field `memory reject` writes from its reason (and `memory submit` removes): the one
 * field a WingFoil transition verb writes besides `status` (spec-001 §3; WingFoil's
 * `REJECTION_REASON_FIELD`).
 */
export const REJECTION_REASON_FIELD = 'rejection_reason';
