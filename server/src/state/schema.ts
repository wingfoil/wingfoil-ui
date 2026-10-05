/**
 * Validation of `state.json` against `contracts/state/state.schema.json` (spec-006 §2), read at run
 * time like the message catalogue.
 */
import { Ajv } from 'ajv';
import { readFileSync } from 'node:fs';
import type { ProjectEntry, StateFile } from '@wingfoil-ui/contracts';

/** The format version this build reads and writes. */
export const STATE_VERSION = 1;

const schema = JSON.parse(
  readFileSync(new URL('../../../contracts/state/state.schema.json', import.meta.url), 'utf8'),
) as object;
const validate = new Ajv({ allErrors: true }).compile<StateFile>(schema);

const PROJECT_KEYS: readonly (keyof ProjectEntry)[] = ['id', 'path', 'name', 'remote', 'addedAt', 'roleView'];

/** Raised when a mutation would write a state the schema refuses; nothing is written. */
export class InvalidStateError extends Error {
  override name = 'InvalidStateError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Why `data` is not a valid state file (schema, then unique ids), or `undefined` when it is. */
export function stateProblem(data: unknown): string | undefined {
  if (!validate(data)) return validate.errors?.map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`).join('; ');
  const seen = new Set<string>();
  for (const { id } of data.projects) {
    if (seen.has(id)) return `duplicate project id ${id}`;
    seen.add(id);
  }
  return undefined;
}

/** The `version` of a parsed file when it is an integer greater than {@link STATE_VERSION}. */
export function newerVersion(data: unknown): number | undefined {
  if (!isRecord(data)) return undefined;
  const { version } = data;
  return typeof version === 'number' && Number.isInteger(version) && version > STATE_VERSION ? version : undefined;
}

/**
 * The fields this version knows of a file written by a newer build, or `undefined` when they do
 * not validate (spec-006 §4).
 */
export function knownFields(data: Record<string, unknown>, version: number): StateFile | undefined {
  const projects = Array.isArray(data.projects)
    ? data.projects.map((p: unknown) =>
        isRecord(p) ? Object.fromEntries(PROJECT_KEYS.filter((k) => k in p).map((k) => [k, p[k]])) : p,
      )
    : data.projects;
  const picked = { version, projects, settings: data.settings ?? {}, actionLog: data.actionLog ?? [] };
  return stateProblem(picked) === undefined ? (picked as StateFile) : undefined;
}

/** A parsed object, or `undefined` for anything else. */
export function asRecord(data: unknown): Record<string, unknown> | undefined {
  return isRecord(data) ? data : undefined;
}
