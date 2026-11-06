/**
 * The values of one element's frontmatter (spec-012 §1 *Values*, task-055 D55-3): for each
 * top-level field but WingFoil's own ({@link NON_REFERENCE_FIELDS}), in field order, a string
 * value or each string item of a list value; nested maps, items of nested lists, numbers, booleans
 * and `null` are none. Values are kept as written and distinct (a value twice is linked once); at
 * most {@link MAX_VALUES}. Under the YAML core schema (spec-001 §4.2) a date is a string, so a value.
 */
import { NON_REFERENCE_FIELDS, VERSION_FIELD } from '../presets/wingfoil.js';
import { MAX_VALUES, type FileValues } from './index.js';

/** The values of `frontmatter` (a parsed mapping). */
export function extractValues(frontmatter: Readonly<Record<string, unknown>>): FileValues {
  const seen = new Set<string>();
  let capped = false;
  const add = (value: unknown): void => {
    if (typeof value !== 'string' || seen.has(value)) return;
    if (seen.size === MAX_VALUES) capped = true;
    else seen.add(value);
  };
  for (const [field, value] of Object.entries(frontmatter)) {
    if (NON_REFERENCE_FIELDS.has(field)) continue;
    if (Array.isArray(value)) for (const item of value) add(item);
    else add(value);
  }
  const version = frontmatter[VERSION_FIELD];
  return { values: [...seen], ...(typeof version === 'string' ? { version } : {}), capped };
}
