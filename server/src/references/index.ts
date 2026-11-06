/**
 * The reference index (spec-012 §1, §8; task-055 D55-8): one per repository state, shared by every
 * consumer — the progress figures, the traceability route and the missing-reference flag
 * (task-059) and the `when-references-done` hold of the descriptor (task-069). It keeps the
 * frontmatter **values** of each element listed by `memory search` (never a body), the references
 * those values make, and answers the in-scope rule. Values are raw: never escaped here (the routes
 * escape what they echo, spec-012 §9). Build it with `SnapshotView.referenceIndex()`.
 */
import type { StateKind } from '@wingfoil-ui/contracts';
import type { DirectReadErrorKind } from '../reads/confine.js';
import type { UiCategory } from '../ui-config/types.js';

/** Distinct values kept per element (spec-012 §1); an element with more is `capped`. */
export const MAX_VALUES = 200;

/** Element files the index reads at a time (spec-001 §4.2, bulk reader). */
export const INDEX_READS = 16;

/** Pattern-test time one index build may spend, in milliseconds (spec-012 §1, Q2-a). */
export const PATTERN_BUDGET_MS = 500;

/** The time the pattern tests run before the event loop is served again, in milliseconds. */
export const PATTERN_SLICE_MS = 20;

/** Bytes of frontmatter the index reads (spec-001 §4.2, Q3-a); a larger one is `shape`. */
export const MAX_INDEX_FRONTMATTER = 65_536;

/** The values of one element file (spec-012 §1 *Values*). */
export interface FileValues {
  /** As written, distinct, in field then list order, at most {@link MAX_VALUES}. */
  values: readonly string[];
  /** The top-level `version` field when it is a string (the in-scope rule). */
  version?: string;
  /** More than {@link MAX_VALUES} distinct values. */
  capped: boolean;
}

/** A reference an element's value makes (spec-012 §1 *References*). */
export type Reference =
  /** Rule 1: the full id of another listed element; the category of its type, `null` for none. */
  | { value: string; kind: 'element'; id: string; category: UiCategory | null }
  /** Rule 2: the first `taxonomy.patterns` entry that matches. */
  | { value: string; kind: 'pattern'; category: UiCategory };

/** One element of the index. */
export interface IndexedElement {
  /** As `memory search` lists it. */
  id: string;
  type: string;
  status: string;
  path: string;
  /** The state kind (spec-003 §2). */
  kind: StateKind;
  /** Kind `last` (spec-005 §4 *Done*). */
  done: boolean;
  /** Why the file could not be read; then no values, no version, no references. */
  unreadable?: DirectReadErrorKind;
  values: readonly string[];
  version?: string;
  /** In values order. */
  references: readonly Reference[];
  /** Indexed incompletely: more than 200 values, or values not yet tested against the patterns. */
  capped: boolean;
}

/** The index of one repository state. */
export interface ReferenceIndex {
  /** In `memory search` order. */
  readonly elements: readonly IndexedElement[];
  get(id: string): IndexedElement | undefined;
  /** Ids of the elements whose file could not be read, in list order. */
  readonly unreadable: readonly string[];
  /** Ids of the elements indexed incompletely, in list order. */
  readonly capped: readonly string[];
  /** The readable elements one of whose values equals `value`, in list order. */
  carrying(value: string): readonly IndexedElement[];
  /** The in-scope rule (spec-012 §1): elements carrying `c.id` or `c.version`, `c` excluded. */
  inScope(c: IndexedElement): readonly IndexedElement[];
  /**
   * The elements referencing `id` that are not done (spec-005 §4a `when-references-done`): its
   * scope, or the elements carrying its id when its own file is unreadable; 0 for an unlisted id.
   */
  referencingNotDone(id: string): number;
}
