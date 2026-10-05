/**
 * The words of the action descriptor's own closed vocabulary (spec-003 §2, §7; the buckets of
 * `memory-list.feature`) that coincide with type or state names of the fixtures: the kind
 * `archived`, the tones `done` and `active`, the buckets `in-progress` and `done`. They are the
 * UI's words, not a methodology's, but REQ-ARC-05's lint rule matches literals by value, so the
 * tables holding them live here, next to WingFoil's vocabulary, and nowhere else.
 */
import type { StateKind, Tone } from '@wingfoil-ui/contracts';

/** A Memory list bucket with *All types* (`memory-list.feature`). */
export type Bucket = 'to-approve' | 'in-progress' | 'waiting' | 'done';

/** The kind of a state in WingFoil's archived set (spec-003 §2). */
export const ARCHIVED_KIND: StateKind = 'archived';

/** The tone of each kind (spec-003 §7). */
export const TONE_OF_KIND: Readonly<Record<StateKind, Tone>> = Object.freeze({
  gate: 'human',
  'gate-waiting': 'human',
  last: 'done',
  'off-sequence': 'done',
  first: 'neutral',
  waiting: 'neutral',
  work: 'active',
  undeclared: 'attention',
  archived: 'muted',
});

/**
 * The bucket of each kind (`memory-list.feature`): *To approve* — gates that are not waiting;
 * *In progress* — other intermediate states and undeclared ones; *Waiting/drafts/closed* — first,
 * waiting (also gate-waiting) states and reject targets with no way out; *Done* — the last state.
 * Archived elements are in none.
 */
export const BUCKET_OF_KIND: Readonly<Record<StateKind, Bucket | undefined>> = Object.freeze({
  gate: 'to-approve',
  work: 'in-progress',
  undeclared: 'in-progress',
  first: 'waiting',
  waiting: 'waiting',
  'gate-waiting': 'waiting',
  'off-sequence': 'waiting',
  last: 'done',
  archived: undefined,
});
