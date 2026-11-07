/**
 * The checks of `.wingfoil/ui.yaml` (spec-005 §1, amended 2026-11-05; task-054 D54-4, D54-5):
 * the schema `contracts/files/ui-yaml.schema.json`, its first error rendered in the texts of
 * spec-005 §1's table, then the semantic checks against the project — the types and states named
 * are declared in `memory.yaml`, each pattern compiles and stays in the safe subset — the first
 * failure reported as written. Used on the file read (`effective.ts`) and on a rendered preset
 * before it is written (task-060).
 */
import { Ajv, type ErrorObject } from 'ajv';
import { readFileSync } from 'node:fs';
import type { MemoryYaml } from '@wingfoil-ui/contracts';
import { declaredStates, resolveStates } from '../reads/memory-yaml.js';
import { patternProblem } from './patterns.js';
import type { UiYaml } from './types.js';

// Its own instance: the first error is the failure (`allErrors: false`); `verbose` gives each
// error its schema and data, for the texts.
const validate = new Ajv({ allErrors: false, verbose: true }).compile(
  JSON.parse(readFileSync(new URL('../../../contracts/files/ui-yaml.schema.json', import.meta.url), 'utf8')) as object,
);

/** The result of a check: the valid file, or the first failure. */
export type UiYamlCheck = { ok: true; value: UiYaml } | { ok: false; failure: string };

/** `/a/b/0/c` → `a.b[0].c`. */
function dotted(pointer: string): string {
  return pointer
    .split('/')
    .slice(1)
    .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((out, part) => (/^\d+$/.test(part) ? `${out}[${part}]` : out === '' ? part : `${out}.${part}`), '');
}

/** A value as the texts quote it. */
function found(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return 'nothing';
  if (Array.isArray(value)) return 'a list';
  if (typeof value === 'object') return 'a mapping';
  return String(value as number | boolean);
}

const TYPE_NAMES: Record<string, string> = {
  string: 'a string',
  integer: 'an integer',
  number: 'a number',
  array: 'a list',
  object: 'a mapping',
  boolean: 'true or false',
};

/** The text of one schema error (spec-005 §1 *Failure texts of the schema*). */
function errorText(error: ErrorObject): string {
  const at = dotted(error.instancePath);
  const key = (name: string): string => (at === '' ? name : `${at}.${name}`);
  const params = error.params as Record<string, unknown>;
  const schema = (error.parentSchema ?? {}) as Record<string, unknown>;
  switch (error.keyword) {
    case 'required':
      return `missing required key ${key(String(params['missingProperty']))}`;
    case 'additionalProperties':
      return `unknown key ${key(String(params['additionalProperty']))}`;
    case 'const':
      return `${at} must be ${String(params['allowedValue'] as number)} (found ${found(error.data)})`;
    case 'enum': {
      const allowed = (params['allowedValues'] as unknown[]).map(String);
      const list = allowed.length === 2 ? allowed.join(' or ') : `one of ${allowed.join(', ')}`;
      return `${at} must be ${list} (found ${found(error.data)})`;
    }
    case 'type':
      if (at === '') return 'ui.yaml must be a mapping';
      return `${at} must be ${TYPE_NAMES[String(params['type'])] ?? String(params['type'])} (found ${found(error.data)})`;
    case 'minLength':
    case 'maxLength':
      return `${at} must be ${String(schema['minLength'] as number)} to ${String(schema['maxLength'] as number)} characters`;
    case 'maxItems':
      return `${at} must have at most ${String(params['limit'] as number)} entries`;
    case 'pattern':
      return `${at} must be a repository path or an https:// URL`;
    default:
      return `${at || 'ui.yaml'} is not valid`;
  }
}

/** The schema's first failure for `data`, or `undefined` when it has the shape of `ui.yaml`. */
export function schemaFailure(data: unknown): string | undefined {
  if (validate(data)) return undefined;
  const first = validate.errors?.[0];
  return first ? errorText(first) : 'ui.yaml is not valid';
}

/** The first semantic failure of a file of the schema's shape against the project, or `undefined`. */
export function semanticFailure(value: UiYaml, memoryYaml: MemoryYaml): string | undefined {
  // 1. Every type named is declared, in the order of the keys.
  const types = [
    ...Object.keys(value.taxonomy?.categories ?? {}),
    ...Object.keys(value.taxonomy?.requires ?? {}),
    ...(value.progress?.scope ? [value.progress.scope.type] : []),
    ...(value.progress?.iterates !== undefined ? [value.progress.iterates] : []),
    ...(value.progress?.defects !== undefined ? [value.progress.defects] : []),
    ...Object.keys(value.holds ?? {}),
  ];
  const undeclared = types.find((t) => !Object.hasOwn(memoryYaml.types, t));
  if (undeclared !== undefined) return `type ${undeclared} is not declared in memory.yaml`;
  // 2. Every state under holds.<t> is declared for <t>.
  for (const [type, states] of Object.entries(value.holds ?? {})) {
    const declared = declaredStates(resolveStates(memoryYaml, type)!);
    const state = Object.keys(states).find((s) => !declared.includes(s));
    if (state !== undefined) return `state ${state} is not declared for ${type}`;
  }
  // 3. Every pattern compiles and stays in the safe subset.
  for (const [i, pattern] of (value.taxonomy?.patterns ?? []).entries()) {
    const problem = patternProblem(pattern.match);
    if (problem !== undefined) return `taxonomy.patterns[${i}].match: ${problem}`;
  }
  return undefined;
}

/** The schema, then the semantic checks against `memoryYaml`: the valid file or the first failure. */
export function checkUiYaml(data: unknown, memoryYaml: MemoryYaml): UiYamlCheck {
  const shape = schemaFailure(data);
  if (shape !== undefined) return { ok: false, failure: shape };
  const value = data as UiYaml;
  const semantic = semanticFailure(value, memoryYaml);
  return semantic === undefined ? { ok: true, value } : { ok: false, failure: semantic };
}
