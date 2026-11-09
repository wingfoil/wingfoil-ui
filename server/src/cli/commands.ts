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
import { definitionProblems, schemaProblems, type ContractSchema } from '../contracts.js';

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

/** The fields of a `memory search` match, in the schema's order (`#/definitions/match`). */
const MATCH_FIELDS = ['path', 'id', 'title', 'type', 'status', 'tags'] as const;

/** The valid matches of a `memory search` output and one line per dropped match (not sanitised). */
export interface SearchMatches {
  /** The output with the valid matches only, in their order. */
  data: MemorySearch;
  /** `memory search left out <path>: not a Memory element (…)`, one per dropped match. */
  dropped: string[];
}

/**
 * The per-match reading of a `memory search` output that fails its schema (spec-001 §2, task-070
 * D70-1 … D70-3, bug-024): `undefined` when the envelope fails (`matches` not an array, or the rest
 * of the object invalid — checked as the same schema with no match), else the valid matches and one
 * line per dropped match, naming its `path` as the CLI returned it (`<no path>` when it is not text)
 * and the failing fields — never a value.
 */
export function searchMatches(data: unknown): SearchMatches | undefined {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return undefined;
  const matches = (data as { matches?: unknown }).matches;
  if (!Array.isArray(matches)) return undefined;
  if (outputProblem('memory search', { ...data, matches: [] }) !== undefined) return undefined;
  const kept: unknown[] = [];
  const dropped: string[] = [];
  for (const match of matches) {
    const problems = definitionProblems(cliSchemaFile('memory search'), '#/definitions/match', match);
    if (problems === undefined) {
      kept.push(match);
      continue;
    }
    const path = (match as { path?: unknown } | null)?.path;
    const where = typeof path === 'string' ? path : '<no path>';
    const fields = new Set(
      problems.map((p) => p.missingProperty ?? p.instancePath.split('/')[1]).filter((f) => f !== undefined && f !== ''),
    );
    const named = MATCH_FIELDS.filter((f) => fields.has(f));
    const why = named.length > 0 ? `${named.join(', ')} missing or not text` : 'not an object';
    dropped.push(`memory search left out ${where}: not a Memory element (${why})`);
  }
  return { data: { ...(data as MemorySearch), matches: kept as MemorySearch['matches'] }, dropped };
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
export function toolLines(lines: readonly string[], sanitise: (text: string) => string, omitted = 0): string[] {
  const kept = lines.slice(0, MAX_TOOL_LINES).map(sanitise);
  const rest = Math.max(0, lines.length - MAX_TOOL_LINES) + omitted;
  return rest > 0 ? [...kept, `${rest} more warnings omitted`] : kept;
}

/**
 * The first `max` non-empty lines of `text` (trimmed; CR LF or LF), and how many non-empty lines
 * follow them — counted by a scan, never split into an array (review round 3 n1).
 */
export function boundedLines(text: string, max: number): { lines: string[]; omitted: number } {
  const lines: string[] = [];
  let omitted = 0;
  let start = 0;
  while (start <= text.length) {
    let end = text.indexOf('\n', start);
    if (end === -1) end = text.length;
    if (lines.length < max) {
      const line = text.slice(start, end).trim();
      if (line) lines.push(line);
    } else if (hasNonBlank(text, start, end)) omitted += 1;
    start = end + 1;
  }
  return { lines, omitted };
}

/** The characters `String.prototype.trim` removes (white space and line terminators). */
const BLANK = new Set([
  0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007,
  0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
]);

/** Whether `text` holds a character `trim` keeps in `[start, end)` — no slice (review round 4 nit-1). */
function hasNonBlank(text: string, start: number, end: number): boolean {
  for (let i = start; i < end; i += 1) if (!BLANK.has(text.charCodeAt(i))) return true;
  return false;
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
  if (name === 'memory search') {
    // Its `message` is the CLI's text (review round 3 n2).
    const search = data as unknown as MemorySearch;
    return (search.message === undefined ? data : { ...search, message: sanitise(search.message) }) as unknown as T;
  }
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
