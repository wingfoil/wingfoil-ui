/**
 * The missing-reference flag of spec-012 §5 (task-059 D59-7): for each listed, readable element
 * whose type has `taxonomy.requires`, the required categories it carries no reference of (an
 * element or a pattern reference of that category; an uncategorised one counts nowhere), in the
 * order `requires` declares them. Pure.
 */
import type { ReferenceIndex } from '../references/index.js';
import type { UiCategory } from '../ui-config/types.js';

/** Element id → its missing categories (only the elements missing at least one). */
export function missingCategories(
  index: ReferenceIndex,
  requires: ReadonlyMap<string, readonly UiCategory[]>,
): ReadonlyMap<string, UiCategory[]> {
  throw new Error('not implemented (red)');
}
