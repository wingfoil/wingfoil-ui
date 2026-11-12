/**
 * The figures of spec-012 §3 and spec-005 §4 (task-059 D59-3 … D59-6), over one state's reference
 * index: completion, iterated, open defects, pending gates. Pure; every id list in natural id
 * order; a pattern reference is keyed by its escaped value (§9: two values equal after the escape
 * are one reference), an element reference by its target's id.
 */
import type {
  CompletionFigure,
  CoverageFigure,
  IteratedFigure,
  OpenDefectsFigure,
  PendingGatesFigure,
} from '@wingfoil-ui/contracts';
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
  return reference.kind === 'element' ? reference.id : neutralise(reference.value);
}

/** The elements in scope (spec-012 §1): the current element's scope, or every listed element. */
export function inScopeElements(inputs: Pick<FigureInputs, 'index' | 'current'>): readonly IndexedElement[] {
  return inputs.current ? inputs.index.inScope(inputs.current) : inputs.index.elements;
}

/** A category the completion figures count (`requirement`, `feature`). */
export const counted = (category: UiCategory | null | undefined): boolean =>
  category != null && (COMPLETION_CATEGORIES as readonly string[]).includes(category);

/** `figures.completion` (spec-012 §3). */
export function completionFigure(inputs: Pick<FigureInputs, 'index' | 'ui' | 'current'>): CompletionFigure {
  const { ui } = inputs;
  const categorised =
    [...ui.categories.value.values()].some(counted) || ui.patterns.value.some((p) => counted(p.category));
  if (!categorised) return { state: 'unavailable', reason: { code: 'no-reference-categories' } };
  const linked = new Map<string, IndexedElement[]>();
  for (const element of inScopeElements(inputs)) {
    if (element.unreadable !== undefined) continue;
    const keys = new Set(element.references.filter((r) => counted(r.category)).map(referenceKey));
    for (const key of keys) {
      const list = linked.get(key);
      if (list) list.push(element);
      else linked.set(key, [element]);
    }
  }
  if (linked.size === 0) return { state: 'unavailable', reason: { code: 'no-linked-elements' } };
  const references = [...linked.keys()].sort(naturalCompare).map((id) => {
    const elements = linked.get(id)!;
    const finished = elements.filter((e) => e.finished).length;
    return { id, [DONE_FIELD]: finished, total: elements.length, percent: percentOf(finished, elements.length) };
  });
  const mean = meanOf(references.map((r) => ({ finished: r[DONE_FIELD], total: r.total })));
  return {
    state: 'shown',
    value: mean.value,
    percent: mean.percent,
    references: references.slice(0, COMPLETION_REFERENCES_SHOWN),
    referencesCount: references.length,
    ids: naturalOrder([...linked.values()].flat().map((e) => e.id)),
  };
}

/** `figures.iterated`: the `progress.iterates` type's elements in scope, the finished ones. */
export function iteratedFigure(inputs: FigureInputs): IteratedFigure {
  const type = inputs.ui.progress.iterates.value;
  if (type === null) return { state: 'unavailable', reason: { code: 'no-iterates-type' } };
  const elements = inScopeElements(inputs).filter((e) => e.type === type);
  const ids = naturalOrder(elements.map((e) => e.id));
  const doneIds = naturalOrder(elements.filter((e) => e.finished).map((e) => e.id));
  return { state: 'shown', type: neutralise(type), [DONE_FIELD]: doneIds.length, total: ids.length, ids, doneIds };
}

/** `figures.openDefects`: the `progress.defects` type's elements not finished, project-wide. */
export function openDefectsFigure(inputs: FigureInputs): OpenDefectsFigure {
  const type = inputs.ui.progress.defects.value;
  if (type === null) return { state: 'unavailable', reason: { code: 'no-defects-type' } };
  const ids = naturalOrder(inputs.index.elements.filter((e) => e.type === type && !e.finished).map((e) => e.id));
  return { state: 'shown', type: neutralise(type), count: ids.length, ids };
}

/** `figures.pendingGates`: elements of kind `gate` whose *Approve* is not held, project-wide. */
export function pendingGatesFigure(inputs: FigureInputs): PendingGatesFigure {
  const ids = naturalOrder(inputs.index.elements.filter((e) => e.kind === 'gate' && !inputs.held(e)).map((e) => e.id));
  return { state: 'shown', count: ids.length, ids };
}

/**
 * `figures.coverage` of Traceability (spec-012 §4, spec-005 §4; task-074 D74-4, Q2 (a)): project-wide,
 * `total` the listed readable elements whose type has `requires`, `carrying` those `missing` does not
 * name; `percent` `null` when `total` is 0; `no-requires` when `requires` names no type.
 */
export function coverageFigure(
  index: ReferenceIndex,
  requires: ReadonlyMap<string, readonly UiCategory[]>,
  missing: ReadonlyMap<string, unknown>,
): CoverageFigure {
  if (requires.size === 0) return { state: 'unavailable', reason: { code: 'no-requires' } };
  const required = index.elements.filter((e) => e.unreadable === undefined && (requires.get(e.type)?.length ?? 0) > 0);
  const carrying = required.filter((e) => !missing.has(e.id)).length;
  const total = required.length;
  return { state: 'shown', carrying, total, percent: total === 0 ? null : percentOf(carrying, total) };
}
