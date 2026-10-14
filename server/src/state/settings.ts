/**
 * The UI settings of the local state (spec-006 §2, REQ-STATE-09): their defaults, how a stored
 * value is read (a missing key, a wrong type or an out-of-range value reads as its default; an
 * unknown key is ignored, RP-39), what a write keeps of them (D30-2), and the action-log cap
 * (RP-38). The keys, types, ranges and defaults come from `contracts/api/settings.schema.json`,
 * read at load like every contract: one source for the routes and the store.
 */
import { Ajv, type ValidateFunction } from 'ajv';
import { readFileSync } from 'node:fs';
import type { ActionLogEntry, UiSettings } from '@wingfoil-ui/contracts';

interface SettingsSchema {
  properties: Record<keyof UiSettings, { default: unknown } & Record<string, unknown>>;
}

/** `contracts/api/settings.schema.json` (same depth from `src` and `dist`). */
export const SETTINGS_SCHEMA = JSON.parse(
  readFileSync(new URL('../../../contracts/api/settings.schema.json', import.meta.url), 'utf8'),
) as SettingsSchema & object;

// Strict: no type coercion, no default filling, no removal of extra properties.
const ajv = new Ajv({ allErrors: true });

/** Validates a whole settings object (the body of `PUT /api/settings`). */
export const validateSettings: ValidateFunction<UiSettings> = ajv.compile<UiSettings>(SETTINGS_SCHEMA);

const KEYS = Object.keys(SETTINGS_SCHEMA.properties) as (keyof UiSettings)[];

/** One validator per key, from that key's sub-schema. */
const validKey = new Map<string, ValidateFunction>(
  KEYS.map((key) => {
    const { default: _default, ...rule } = SETTINGS_SCHEMA.properties[key];
    return [key, ajv.compile(rule)];
  }),
);

/** The defaults of spec-006 §2. */
export const DEFAULT_SETTINGS: Readonly<UiSettings> = Object.freeze(
  Object.fromEntries(KEYS.map((key) => [key, SETTINGS_SCHEMA.properties[key].default])) as unknown as UiSettings,
);

/** Whether `value` is a valid value of the setting `key`. */
function isValid(key: string, value: unknown): boolean {
  return validKey.get(key)?.(value) === true;
}

/**
 * The effective settings of a stored `settings` object: each known key's stored value when valid,
 * else its default; unknown keys ignored. Always a new object, in the schema's key order.
 */
export function readSettings(stored: Readonly<object>): UiSettings {
  const settings = { ...DEFAULT_SETTINGS };
  const values = stored as Readonly<Record<string, unknown>>;
  for (const key of KEYS) {
    if (Object.hasOwn(values, key) && isValid(key, values[key])) {
      (settings as Record<string, unknown>)[key] = values[key];
    }
  }
  return settings;
}

/**
 * The `settings` object a write stores (D30-2, review F1/F4), in the schema's key order: a key is
 * written when `next` changes its effective value (from `before`) or when it was stored with a
 * valid value; unknown and invalid keys are dropped, a missing unchanged key stays missing.
 * `changed` tells whether any effective value differs (compared per key, never by key order).
 */
export function settingsToStore(
  stored: Readonly<Record<string, unknown>>,
  before: Readonly<UiSettings>,
  next: Readonly<UiSettings>,
): { settings: Record<string, unknown>; changed: boolean } {
  const settings: Record<string, unknown> = {};
  let changed = false;
  for (const key of KEYS) {
    if (next[key] !== before[key]) {
      changed = true;
      settings[key] = next[key];
    } else if (Object.hasOwn(stored, key) && isValid(key, stored[key])) {
      settings[key] = stored[key];
    }
  }
  return { settings, changed };
}

/** The newest `cap` entries of `log`, in order (the oldest beyond the cap are dropped, RP-38). */
export function trimActionLog(log: readonly ActionLogEntry[], cap: number): ActionLogEntry[] {
  return log.slice(Math.max(0, log.length - cap));
}
