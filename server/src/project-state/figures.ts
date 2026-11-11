/**
 * The figures of spec-012 §3 and spec-005 §4 (task-059 D59-3 … D59-6), over one state's reference
 * index: completion, iterated, open defects, pending gates. Pure; every id list in natural id
 * order; a pattern reference is keyed by its escaped value (§9: two values equal after the escape
 * are one reference), an element reference by its target's id.
 */
import type { CompletionFigure, IteratedFigure, OpenDefectsFigure, PendingGatesFigure } from '@wingfoil-ui/contracts';
import { neutralise } from '../git/redact.js';
import { COMPLETION_CATEGORIES } from '../presets/ui-config.js';
import { DONE_FIELD } from '../presets/api.js';
import type { IndexedElement, Reference, ReferenceIndex } from '../references/index.js';
import type { EffectiveUiConfig, UiCategory } from '../ui-config/types.js';
import { naturalCompare, naturalOrder } from './order.js';
import { meanOf, percentOf } from './percent.js';

/** References listed by `completion.references` (spec-012 §3). */
export const COMPLETION_REFERENCES_SHOWN = 10;

/** What the figures read. */
export interface FigureInputs {
  index: ReferenceIndex;
  ui: EffectiveUiConfig;
  /** The current element (D59-2), `undefined` for none: then every element is in scope. */
  current: IndexedElement | undefined;
  /** Whether a gate's *Approve* is held (spec-005 §4a; the descriptor's own rule). */
  held(element: IndexedElement): boolean;
}

/** The key of a reference: its target's id, or its escaped value (§9). */
export function referenceKey(reference: Reference): string {
  throw new Error('not implemented (red)');
}

/** The elements in scope (spec-012 §1): the current element's scope, or every listed element. */
export function inScopeElements(inputs: Pick<FigureInputs, 'index' | 'current'>): readonly IndexedElement[] {
  throw new Error('not implemented (red)');
}

const counted = (category: UiCategory | null): boolean =>
  category !== null && (COMPLETION_CATEGORIES as readonly string[]).includes(category);

/** `figures.completion` (spec-012 §3). */
export function completionFigure(inputs: FigureInputs): CompletionFigure {
  throw new Error('not implemented (red)');
}

/** `figures.iterated`: the `progress.iterates` type's elements in scope, the finished ones. */
export function iteratedFigure(inputs: FigureInputs): IteratedFigure {
  throw new Error('not implemented (red)');
}

/** `figures.openDefects`: the `progress.defects` type's elements not finished, project-wide. */
export function openDefectsFigure(inputs: FigureInputs): OpenDefectsFigure {
  throw new Error('not implemented (red)');
}

/** `figures.pendingGates`: elements of kind `gate` whose *Approve* is not held, project-wide. */
export function pendingGatesFigure(inputs: FigureInputs): PendingGatesFigure {
  throw new Error('not implemented (red)');
}
