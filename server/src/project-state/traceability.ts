/**
 * The reference rows of Traceability (spec-012 §4; task-059 D59-8, task-074 D74-2, Q3 (a)): every
 * reference with a category made by a readable element of the applied scope, keyed by its kind and
 * its key (the target's id, or the escaped value, §9), with its linked elements; with `project` also
 * a `no-elements` row for each listed element of a `requirement` or `feature` type that no element
 * references. A row's category is that of the first reference met (index order, then value order).
 * Pure; rows in natural id order (an element row before a pattern row of the same id), `linked` in
 * natural order.
 */
import type { TraceabilityReference, TraceabilityScope } from '@wingfoil-ui/contracts';
import { DONE_FIELD, REFERENCE_STATUS } from '../presets/api.js';
import type { IndexedElement, ReferenceIndex } from '../references/index.js';
import type { EffectiveUiConfig, UiCategory } from '../ui-config/types.js';
import { counted, inScopeElements, referenceKey } from './figures.js';
import { naturalCompare } from './order.js';
import { percentOf } from './percent.js';

/** What the rows read. */
export interface RowInputs {
  index: ReferenceIndex;
  ui: EffectiveUiConfig;
  /** The current element, `undefined` for none. */
  current: IndexedElement | undefined;
  /** `current` only when a current element exists. */
  applied: TraceabilityScope;
}

interface Row {
  id: string;
  category: UiCategory;
  element: boolean;
  linked: Map<string, IndexedElement>;
}

/** The `status` of a row from its counts (spec-012 §4). */
function statusOf(finished: number, total: number): TraceabilityReference['status'] {
  if (total === 0) return REFERENCE_STATUS.noElements;
  if (finished === total) return REFERENCE_STATUS.completed;
  return finished === 0 ? REFERENCE_STATUS.notStarted : REFERENCE_STATUS.inProgress;
}

/** The reference rows (spec-012 §4 `references`). */
export function traceabilityRows(inputs: RowInputs): TraceabilityReference[] {
  const { index, ui, applied } = inputs;
  const scoped = inScopeElements({ index, current: applied === 'current' ? inputs.current : undefined });
  const rows = new Map<string, Row>();
  const keyOf = (element: boolean, id: string): string => `${element ? 'e' : 'p'}\0${id}`;
  for (const element of scoped) {
    if (element.unreadable !== undefined) continue;
    for (const reference of element.references) {
      if (reference.category === null) continue;
      const isElement = reference.kind === 'element';
      const id = referenceKey(reference);
      const key = keyOf(isElement, id);
      let row = rows.get(key);
      if (!row) rows.set(key, (row = { id, category: reference.category, element: isElement, linked: new Map() }));
      row.linked.set(element.id, element);
    }
  }
  if (applied === 'project') {
    for (const element of index.elements) {
      const category = ui.categories.value.get(element.type);
      if (!counted(category) || rows.has(keyOf(true, element.id))) continue;
      rows.set(keyOf(true, element.id), { id: element.id, category: category!, element: true, linked: new Map() });
    }
  }
  return [...rows.values()]
    .sort((a, b) => naturalCompare(a.id, b.id) || Number(b.element) - Number(a.element))
    .map((row) => {
      const linked = [...row.linked.keys()].sort(naturalCompare);
      const finished = [...row.linked.values()].filter((e) => e.finished).length;
      const total = linked.length;
      return {
        id: row.id,
        category: row.category,
        element: row.element,
        linked,
        [DONE_FIELD]: finished,
        total,
        percent: total === 0 ? null : percentOf(finished, total),
        status: statusOf(finished, total),
      };
    });
}
