/**
 * The reference rows of Traceability (spec-012 §4; task-059 D59-8, task-074 D74-2, Q3 (a)): every
 * reference with a category made by a readable element of the applied scope, keyed by its kind and
 * its key (the target's id, or the escaped value, §9), with its linked elements; with `project` also
 * a `no-elements` row for each listed element of a `requirement` or `feature` type that no element
 * references. Pure; rows in natural id order (an element row before a pattern row of the same id),
 * `linked` in natural order.
 */
import type { TraceabilityReference, TraceabilityScope } from '@wingfoil-ui/contracts';
import type { IndexedElement, ReferenceIndex } from '../references/index.js';
import type { EffectiveUiConfig } from '../ui-config/types.js';

/** What the rows read. */
export interface RowInputs {
  index: ReferenceIndex;
  ui: EffectiveUiConfig;
  /** The current element, `undefined` for none. */
  current: IndexedElement | undefined;
  /** `current` only when a current element exists. */
  applied: TraceabilityScope;
}

/** The reference rows (spec-012 §4 `references`). */
export function traceabilityRows(inputs: RowInputs): TraceabilityReference[] {
  void inputs;
  throw new Error('traceabilityRows: not implemented');
}
