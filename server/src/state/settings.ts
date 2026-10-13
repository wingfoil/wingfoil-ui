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
 * else its default; unknown keys ignored. Always a new object.
 */
export function readSettings(stored: Readonly<Record<string, unknown>>): UiSettings {
  const settings = { ...DEFAULT_SETTINGS };
  for (const key of KEYS) {
    if (Object.hasOwn(stored, key) && isValid(key, stored[key])) {
      (settings as Record<string, unknown>)[key] = stored[key];
    }
  }
  return settings;
}

/**
 * What a write keeps of a `settings` object (D30-2): the known keys with valid values; unknown and
 * invalid keys are dropped, a missing key stays missing (it reads as its default).
 */
export function storedSettings(settings: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(
    KEYS.filter((k) => Object.hasOwn(settings, k) && isValid(k, settings[k])).map((k) => [k, settings[k]]),
  );
}

/** The newest `cap` entries of `log`, in order (the oldest beyond the cap are dropped, RP-38). */
export function trimActionLog(log: readonly ActionLogEntry[], cap: number): ActionLogEntry[] {
  return log.slice(Math.max(0, log.length - cap));
}
