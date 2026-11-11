/**
 * Validation against the JSON Schemas of `contracts/` (adr-002: one schema language, Ajv), read at
 * run time like the state schema and compiled once, at load, so that no request reads a schema.
 */
import { Ajv, type ValidateFunction } from 'ajv';
import { readFileSync } from 'node:fs';

/**
 * The schemas of the CLI output, of the directly read files and of the capability table (spec-001
 * §5), relative to `contracts/`.
 */
export const CONTRACT_SCHEMAS = [
  'cli/version.schema.json',
  'cli/dna-show.schema.json',
  'cli/paths.schema.json',
  'cli/directives-list.schema.json',
  'cli/workflow-list.schema.json',
  'cli/memory-search.schema.json',
  'cli/memory-history.schema.json',
  'cli/memory-submit.schema.json',
  'cli/memory-approve.schema.json',
  'cli/memory-reject.schema.json',
  'cli/memory-add.schema.json',
  'files/memory-yaml.schema.json',
  'files/element.schema.json',
  'files/directive.schema.json',
  'capabilities.schema.json',
] as const;

/** A schema of {@link CONTRACT_SCHEMAS}. */
export type ContractSchema = (typeof CONTRACT_SCHEMAS)[number];

const ajv = new Ajv({ allErrors: true });
/** The `$id` of each schema, by file. */
const ids = new Map<string, string>();
const validators = new Map<string, ValidateFunction>(
  CONTRACT_SCHEMAS.map((file) => {
    const schema = JSON.parse(readFileSync(new URL(`../../contracts/${file}`, import.meta.url), 'utf8')) as {
      $id?: string;
    };
    if (schema.$id !== undefined) ids.set(file, schema.$id);
    return [file, ajv.compile(schema)];
  }),
);

/**
 * Why `data` does not match the schema `file` — one `<instance path> <message>` per problem, never
 * a value — or `undefined` when it does.
 */
export function schemaProblems(file: ContractSchema, data: unknown): string[] | undefined {
  const validate = validators.get(file)!; // every ContractSchema is compiled at load
  if (validate(data)) return undefined;
  return (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? 'is invalid'}`);
}

/** A Draft-07 schema problem as Ajv reports it, without the value. */
export interface SchemaProblem {
  /** JSON pointer of the failing value (`''` for the root). */
  instancePath: string;
  /** Ajv's keyword (`required`, `type`, …). */
  keyword: string;
  /** For `required`: the missing property. */
  missingProperty?: string;
}

/**
 * The problems of `data` against the definition `pointer` (e.g. `#/definitions/match`) of the schema
 * `file`, or `undefined` when it matches — for a part of an output validated on its own (task-070,
 * the matches of `memory search`). The definition is the compiled schema's own, so nothing is read here.
 */
export function definitionProblems(
  file: ContractSchema,
  pointer: `#/${string}`,
  data: unknown,
): SchemaProblem[] | undefined {
  // Every ContractSchema is compiled at load, its definitions with it; Ajv keeps the fragment's function.
  const validate = ajv.getSchema(`${ids.get(file) ?? ''}${pointer}`);
  if (!validate) throw new Error(`no definition ${pointer} in ${file}`);
  if (validate(data)) return undefined;
  return (validate.errors ?? []).map((e) => ({
    instancePath: e.instancePath,
    keyword: e.keyword,
    ...(e.keyword === 'required'
      ? { missingProperty: String((e.params as { missingProperty?: unknown }).missingProperty) }
      : {}),
  }));
}
