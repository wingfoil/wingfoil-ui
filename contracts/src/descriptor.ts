/**
 * The action descriptor of an element (spec-003 §8): what can be done on it now, by whom, and how
 * it is shown. Computed by the server once per repository state and served with the element list;
 * the web renders it and never re-derives it. Kinds, tones and verbs are the UI's and WingFoil's
 * own closed vocabulary, not a methodology's (REQ-ARC-05); three of its words (`archived`, `done`,
 * `active`) coincide with fixture state names, so `server/` keeps its tables in `presets/`.
 */

/** The state kind of spec-003 §2 (first match wins, in this order). */
export type StateKind =
  'archived' | 'off-sequence' | 'undeclared' | 'last' | 'gate-waiting' | 'gate' | 'waiting' | 'first' | 'work';

/** The colour of a state (spec-003 §7, `ux-reference.md` §7). */
export type Tone = 'human' | 'done' | 'neutral' | 'active' | 'attention' | 'muted';

/** A verb the UI may offer on WingFoil 0.2.2 (`deprecate` is not offered in the MVP). */
export type DescriptorVerbName = 'submit' | 'approve' | 'reject';

/** Why an offered verb is disabled: the first failing rule of spec-003 §6, rendered by the web. */
export type DisabledReason =
  | { code: 'not-in-team' }
  | { code: 'version-unsupported'; range: string }
  | { code: 'local-changes' }
  | { code: 'copy-behind'; commits: number }
  | { code: 'copy-diverged' }
  | { code: 'copy-detached' };

/** One verb of spec-003 §3. */
export interface DescriptorVerb {
  verb: DescriptorVerbName;
  /** The state the verb leads to. */
  to: string;
  /** The role WingFoil requires (`approver` for a gate on 0.2.2), `null` for none. */
  role: string | null;
  /** Whether the four rules of spec-003 §6 hold (the role is not one of them). */
  enabled: boolean;
  /** The first failing rule, when disabled. */
  reason?: DisabledReason;
}

/** A member of `dna.team.members` matched by email. */
export interface DescriptorMember {
  name: string;
  email: string;
}

/** Who must act (spec-003 §4). */
export interface DescriptorActor {
  /** A member, a role, the workflow engine, or no one. */
  kind: 'member' | 'role' | 'engine' | 'none';
  /** The member, for `kind: "member"`. */
  member?: DescriptorMember;
  /** The role, for `kind: "role"`. */
  role?: string;
  /** Names of the members holding `role`, in `dna.team.members` order. */
  members?: string[];
  /** Set on the tech-lead fallback: the author is not in the team, or there is no event. */
  note?: 'author-not-in-team';
}

/** The last reject, when it led to the current state. */
export interface DescriptorRejection {
  /** Name of the approver who rejected (the commit author when no `Approver:` line). */
  by: string;
  /** The reject's reason, `null` when the commit has none. */
  reason: string | null;
  /** ISO 8601 timestamp of the reject. */
  at: string;
}

/** The action descriptor of one element (spec-003 §8). */
export interface ActionDescriptor {
  id: string;
  type: string;
  status: string;
  kind: StateKind;
  tone: Tone;
  /** The verbs WingFoil accepts from this state, in the order submit, approve, reject. */
  verbs: DescriptorVerb[];
  actor: DescriptorActor;
  rejection?: DescriptorRejection;
  /** ISO 8601 time of the last event into the current state; absent when none is known. */
  since?: string;
}
