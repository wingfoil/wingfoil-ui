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
  const out = new Map<string, UiCategory[]>();
  for (const element of index.elements) {
    const required = requires.get(element.type);
    if (!required || required.length === 0 || element.unreadable !== undefined) continue;
    const carried = new Set(element.references.map((r) => r.category));
    const missing = required.filter((c) => !carried.has(c));
    if (missing.length > 0) out.set(element.id, missing);
  }
  return out;
}
