/**
 * The number settings of the UI settings page (task-041, D41-4): typed in a text field, sent only as
 * a whole number inside the range of `contracts/api/settings.schema.json` (spec-006 §2; a test
 * compares the two), so the server never sees a value it refuses.
 */

/** An inclusive range of whole numbers. */
export interface WholeRange {
  min: number;
  max: number;
}

/** The number settings and their ranges. */
export const NUMBER_RANGES = {
  fetchIntervalSeconds: { min: 15, max: 3600 },
  actionLogCap: { min: 100, max: 100_000 },
} as const satisfies Record<string, WholeRange>;

/** A number setting. */
export type NumberSettingKey = keyof typeof NUMBER_RANGES;

/** The value of `text` (ASCII digits, surrounding spaces allowed) when it is a whole number in `range`. */
export function parseWholeNumber(text: string, range: WholeRange): number | undefined {
  const trimmed = text.trim();
  if (!/^[0-9]{1,9}$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value >= range.min && value <= range.max ? value : undefined;
}
