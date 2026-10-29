/**
 * The static list of the WingFoil CLI commands the server invokes (spec-001 §3, adr-001 D4,
 * REQ-INT-01) and the validation of their output against `contracts/cli/<command>.schema.json`.
 * The adapter refuses any command not listed here.
 */
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
  WorkflowList02,
} from '@wingfoil-ui/contracts';
import { schemaProblems, type ContractSchema } from '../contracts.js';

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
export function cliSchemaFile(name: CliCommandName): ContractSchema {
  return `cli/${CLI_COMMANDS[name].schema}.schema.json`;
}

/** The listed command whose words are `words`, or `undefined`. */
export function commandFor(words: readonly string[]): CliCommandName | undefined {
  const name = words.join(' ');
  return Object.hasOwn(CLI_COMMANDS, name) ? (name as CliCommandName) : undefined;
}

/** Why the output of `name` does not match its schema, or `undefined` when it does. */
export function outputProblem(name: CliCommandName, data: unknown): string[] | undefined {
  return schemaProblems(cliSchemaFile(name), data);
}

/**
 * Most tool lines of one CLI output passed on (review round 1 m1): `workflow list` diagnostics and
 * `stderr` warnings; the others are counted (`diagnosticsOmitted`, a last warning line).
 */
export const MAX_TOOL_LINES = 200;

/**
 * Tool lines as the API passes them on (the CLI's `stderr` warnings, the `warnings` of `directives
 * list`): at most {@link MAX_TOOL_LINES}, cut before `sanitise`, then one line counting the others
 * (review round 1 m1, round 2 d1).
 */
export function toolLines(lines: readonly string[], sanitise: (text: string) => string): string[] {
  const kept = lines.slice(0, MAX_TOOL_LINES).map(sanitise);
  return lines.length > MAX_TOOL_LINES ? [...kept, `${lines.length - MAX_TOOL_LINES} more warnings omitted`] : kept;
}

/** `true` when `list` has WingFoil 0.2.x's shape (`manifest`, phases), `false` for 0.3.x's. */
export function isWorkflowList02(list: WorkflowList): list is WorkflowList02 {
  return 'manifest' in list;
}

/**
 * `data` (the validated output of `name`) with every tool-sourced text that is not project content
 * passed through `redact`, the one sanitiser of tool messages (bug-017): WingFoil 0.3's `workflow
 * list` `diagnostics` (configuration messages that quote values and may name files) and its
 * `message` (task-046 AC-2), each distinct text once; at most {@link MAX_TOOL_LINES} diagnostics,
 * the others counted in `diagnosticsOmitted`; and the `warnings` of `directives list`
 * ({@link toolLines}, review round 2 d1). Every other output is returned as it is.
 */
export function toolText<T>(name: CliCommandName, data: T, sanitise: (text: string) => string): T {
  if (name === 'directives list') {
    // Its `warnings` field is the CLI's text (review round 2 d1): as the stderr warnings.
    const list = data as unknown as DirectivesList;
    return { ...list, warnings: toolLines(list.warnings, sanitise) } as unknown as T;
  }
  if (name !== 'workflow list') return data;
  const list = data as unknown as WorkflowList;
  if (isWorkflowList02(list)) return data;
  // At most MAX_TOOL_LINES diagnostics, cut before the sanitiser (review round 1 m1); then a
  // configuration repeats its codes, files and messages: each distinct text is sanitised once.
  const kept = list.diagnostics.slice(0, MAX_TOOL_LINES);
  const omitted = list.diagnostics.length - kept.length;
  const done = new Map<string, string>();
  const redact = (text: string): string => {
    let out = done.get(text);
    if (out === undefined) done.set(text, (out = sanitise(text)));
    return out;
  };
  // `diagnosticsOmitted` is the server's count, never the CLI's (review round 2 n4).
  const { diagnosticsOmitted: _cli, ...rest } = list;
  return {
    ...rest,
    ...(list.message !== undefined ? { message: redact(list.message) } : {}),
    diagnostics: kept.map((d) => ({
      ...d,
      code: redact(d.code),
      severity: redact(d.severity),
      file: redact(d.file),
      path: redact(d.path),
      message: redact(d.message),
    })),
    ...(omitted > 0 ? { diagnosticsOmitted: omitted } : {}),
  } as unknown as T;
}
