/**
 * Validation against the JSON Schemas of `contracts/` (adr-002: one schema language, Ajv), read at
 * run time like the state schema and compiled once, at load, so that no request reads a schema.
 */
import { Ajv, type ValidateFunction } from 'ajv';
import { readFileSync } from 'node:fs';

/** The schemas of the CLI output and of the directly read files (spec-001 §5), relative to `contracts/`. */
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
] as const;

/** A schema of {@link CONTRACT_SCHEMAS}. */
export type ContractSchema = (typeof CONTRACT_SCHEMAS)[number];

const ajv = new Ajv({ allErrors: true });
const validators = new Map<string, ValidateFunction>(
  CONTRACT_SCHEMAS.map((file) => [
    file,
    ajv.compile(JSON.parse(readFileSync(new URL(`../../contracts/${file}`, import.meta.url), 'utf8')) as object),
  ]),
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
