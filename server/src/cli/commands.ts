/**
 * The static list of the WingFoil CLI commands the server invokes (spec-001 §3, adr-001 D4,
 * REQ-INT-01) and the validation of their output against `contracts/cli/<command>.schema.json`,
 * read at run time like the state schema. The adapter refuses any command not listed here.
 */
import { Ajv, type ValidateFunction } from 'ajv';
import { readFileSync } from 'node:fs';
import type {
  DirectivesList,
  DnaPaths,
  DnaShow,
  MemoryAdded,
  MemoryHistory,
  MemoryRejection,
  MemorySearch,
  MemoryTransition,
  WorkflowList,
} from '@wingfoil-ui/contracts';

/** One consumed command. */
export interface CliCommandSpec {
  /** Schema file name in `contracts/cli/`, without `.schema.json`. */
  schema: string;
  /** First release that invokes it (spec-001 §3 "Since"). */
  since: 'v0.1' | 'v0.2' | 'v0.3';
}

/** The consumed commands, by their words (spec-001 §3). `memory search --status …` is `memory search`. */
export const CLI_COMMANDS = {
  '--version': { schema: 'version', since: 'v0.1' },
  'dna show': { schema: 'dna-show', since: 'v0.1' },
  paths: { schema: 'paths', since: 'v0.1' },
  'directives list': { schema: 'directives-list', since: 'v0.1' },
  'workflow list': { schema: 'workflow-list', since: 'v0.1' },
  'memory search': { schema: 'memory-search', since: 'v0.1' },
  'memory history': { schema: 'memory-history', since: 'v0.1' },
  'memory submit': { schema: 'memory-submit', since: 'v0.2' },
  'memory approve': { schema: 'memory-approve', since: 'v0.2' },
  'memory reject': { schema: 'memory-reject', since: 'v0.2' },
  'memory add': { schema: 'memory-add', since: 'v0.3' },
} as const satisfies Record<string, CliCommandSpec>;

/** Name of a consumed command: its words joined by a space. */
export type CliCommandName = keyof typeof CLI_COMMANDS;

/** Output of each consumed command (exit 0), as its schema describes it. */
export interface CliCommandOutputs {
  '--version': string;
  'dna show': DnaShow;
  paths: DnaPaths;
  'directives list': DirectivesList;
  'workflow list': WorkflowList;
  'memory search': MemorySearch;
  'memory history': MemoryHistory;
  'memory submit': MemoryTransition;
  'memory approve': MemoryTransition;
  'memory reject': MemoryRejection;
  'memory add': MemoryAdded;
}

/** Path of the schema of `name`, relative to `contracts/`. */
export function cliSchemaFile(name: CliCommandName): string {
  return `cli/${CLI_COMMANDS[name].schema}.schema.json`;
}

/** The listed command whose words are `words`, or `undefined`. */
export function commandFor(words: readonly string[]): CliCommandName | undefined {
  const name = words.join(' ');
  return Object.hasOwn(CLI_COMMANDS, name) ? (name as CliCommandName) : undefined;
}

const ajv = new Ajv({ allErrors: true });
const validators = new Map<string, ValidateFunction>();

/** Compile (once) the schema at `contracts/<file>`. */
export function contractValidator(file: string): ValidateFunction {
  let validate = validators.get(file);
  if (!validate) {
    const schema = JSON.parse(readFileSync(new URL(`../../../contracts/${file}`, import.meta.url), 'utf8')) as object;
    validate = ajv.compile(schema);
    validators.set(file, validate);
  }
  return validate;
}

/**
 * Why `data` does not match the schema at `contracts/<file>` — one `<instance path> <message>` per
 * problem, never a value — or `undefined` when it does.
 */
export function schemaProblems(file: string, data: unknown): string[] | undefined {
  const validate = contractValidator(file);
  if (validate(data)) return undefined;
  return (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? 'is invalid'}`);
}

/** Why the output of `name` does not match its schema, or `undefined` when it does. */
export function outputProblem(name: CliCommandName, data: unknown): string[] | undefined {
  return schemaProblems(cliSchemaFile(name), data);
}
