/**
 * The CLI adapter (spec-001 §1–2, adr-001 D1, D5): invokes a project's resolved `wingfoil` with
 * `--format json` placed before the command, an argument array, the project root as working
 * directory and a 30 s timeout, and classifies the outcome.
 *
 * | Exit | The adapter |
 * |------|-------------|
 * | 0 | returns the parsed stdout, validated against the command's schema, and the stderr lines as warnings; stdout that is not JSON, or fails the schema, is a {@link CliOutputError} — except a `memory search` whose envelope passes: each failing match is dropped and becomes a warning (task-070, bug-024) |
 * | 1 | {@link CliRefusedError} with the CLI's message verbatim (stderr `{"error": …}`, else its text) and, from WingFoil 0.3.x, the `detail` texts of its `details` as `reasons` |
 * | 2 | {@link CliInternalError}: a defect of the adapter, logged (command words and option names) |
 * | other, signal, cancelled, stopped | {@link CliProcessError} with the reason |
 * | killed at the timeout | {@link CliTimeoutError} |
 *
 * Internal, process and timeout errors are logged with the command words and option names, never
 * a user value.
 *
 * Only the commands of the static list (`CLI_COMMANDS` of `./commands.ts`, spec-001 §3) run; any other is an
 * internal error raised before a process starts. Writes run under the project's write lock, taken
 * by the caller.
 */
import { envelope, type ErrorEnvelope } from '../http/app.js';
import { DEFAULT_TIMEOUT_MS, type ProcessResult, type ProcessRunner } from '../process/runner.js';
import {
  boundedLines,
  commandFor,
  MAX_TOOL_LINES,
  mergeToolLines,
  outputProblem,
  searchMatches,
  toolText,
  type CliCommandName,
  type CliCommandOutputs,
  type WarningParts,
} from './commands.js';
import { capMessage, redactLocalPaths } from '../git/redact.js';
import { READ_GIT_ENV, withoutNames } from '../git/git.js';
import { CliNotFoundError, type CliSource, type ResolvedCli } from './discovery.js';

/** Timeout of every `wingfoil` process (REQ-INT-04). */
export const CLI_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;

/** Options of a command: `--name` → value, or values for an option given once per value. */
export type CliOptions = Readonly<Record<string, string | readonly string[]>>;

/** Output of a command that exited 0. */
export interface CliOutput<T = unknown> {
  /** Parsed stdout. */
  data: T;
  /** stderr lines (e.g. `unknown field(s) ignored`, W-12): project warnings, never errors. */
  warnings: string[];
  /**
   * The same warnings in their parts, for a caller that merges several outputs of one command
   * ({@link mergeToolLines}: `/elements?archived=true`, task-070 review round 2 R2-F1).
   */
  warningParts: WarningParts;
}

/** Where the adapter logs its own defects (pino's `Logger` fits). */
export interface CliLogger {
  error(object: object, message: string): void;
}

/** Options of {@link WingfoilCli}. */
export interface WingfoilCliOptions {
  cli: ResolvedCli;
  runner: ProcessRunner;
  /** Environment of the CLI processes (default: the server's). */
  env?: NodeJS.ProcessEnv;
  /** Timeout in milliseconds (default 30 s). */
  timeoutMs?: number;
  logger?: CliLogger;
  /**
   * Removes the local folders a refusal message quotes (task-033 D33-5, bug-012). Default: the
   * project root, the CLI's package folder and the home directory ({@link redactLocalPaths}).
   */
  redact?: (text: string) => string;
}

/** Kinds of CLI failure (spec-001 §2). */
export type CliErrorKind = 'refused' | 'output' | 'internal' | 'timeout' | 'process';

/**
 * What an error and a log line record of a command: its words and option names — never a user
 * value (titles, reasons and ids passed as options or positionals stay out of logs).
 */
export interface CliCommand {
  /** The command words (`['memory', 'reject']`), or `['--version']`. */
  words: readonly string[];
  /** The option names given (`['--reason']`). */
  options: readonly string[];
}

/** A failed CLI command. */
export abstract class CliError extends Error {
  /** Which row of spec-001 §2. */
  abstract readonly kind: CliErrorKind;

  constructor(
    /** The command, without user values. */
    readonly command: CliCommand,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Exit 1: the CLI refused; its message is the truth (REQ-INT-04). */
export class CliRefusedError extends CliError {
  readonly kind = 'refused';

  constructor(
    command: CliCommand,
    /** The CLI's message, verbatim. */
    readonly cliMessage: string,
    /**
     * Why, from a WingFoil 0.3.x refusal's `details[].detail` (W-20; spec-001 §2, task-070): sanitised
     * like the message, at most {@link MAX_REASONS} then one count line; empty for 0.2.2.
     */
    readonly reasons: readonly string[] = [],
  ) {
    super(command, cliMessage);
  }
}

/** Most reasons of one refusal passed on; the others are counted in a last line (task-070 D70-5). */
export const MAX_REASONS = 200;

/** Exit 0 with output that cannot be read: not JSON, or failing the command's schema. */
export class CliOutputError extends CliError {
  readonly kind = 'output';

  constructor(
    command: CliCommand,
    /** What failed: `not JSON`, or one `<instance path> <message>` per schema problem (no value). */
    readonly problems: readonly string[] = [],
  ) {
    super(command, `Unexpected output of ${command.words.join(' ')}`);
  }
}

/** Exit 2 (usage error) or a command the adapter refuses to build: a defect of the adapter. */
export class CliInternalError extends CliError {
  readonly kind = 'internal';

  constructor(
    command: CliCommand,
    readonly detail: string,
  ) {
    super(command, detail);
  }
}

/** The process was killed at the timeout. */
export class CliTimeoutError extends CliError {
  readonly kind = 'timeout';

  constructor(
    command: CliCommand,
    readonly timeoutMs: number,
  ) {
    super(command, `WingFoil did not answer within ${Math.round(timeoutMs / 1000)} s`);
  }

  /** Same as the message (logged as the reason). */
  get reason(): string {
    return this.message;
  }
}

/** Any other end of the process: another exit status, a signal, a cancellation, the server's stop. */
export class CliProcessError extends CliError {
  readonly kind = 'process';

  constructor(
    command: CliCommand,
    readonly reason: string,
  ) {
    super(command, reason);
  }
}

/**
 * The arguments of option `name` with `value`: `--name value`, or `--name=value` when the value
 * starts with `-` so that the CLI cannot read it as an option (spec-001 §1).
 */
export function optionArg(name: string, value: string): string[] {
  return value.startsWith('-') ? [`${name}=${value}`] : [name, value];
}

/** Arguments of {@link WingfoilCli.json} besides the command words. */
export interface CliArgs {
  /** Options, user values included (rendered with {@link optionArg}). */
  options?: CliOptions;
  /** Positional user values (ids, titles): passed after `--`, so none is read as an option. */
  positionals?: readonly string[];
  /** Cancels the process. */
  signal?: AbortSignal;
}

/** One project's CLI. */
export class WingfoilCli {
  private readonly timeoutMs: number;

  constructor(private readonly options: WingfoilCliOptions) {
    this.timeoutMs = options.timeoutMs ?? CLI_TIMEOUT_MS;
  }

  /** Where the CLI comes from (the header's "(from PATH)", S-08.2). */
  get source(): CliSource {
    return this.options.cli.source;
  }

  /** The resolution this adapter runs: the key the detected version is cached with (adr-001 D3). */
  get resolved(): ResolvedCli {
    return this.options.cli;
  }

  /**
   * Run the listed command `name` (e.g. `'memory search'`) and return its validated output, typed by
   * {@link CliCommandOutputs}.
   */
  run<N extends Exclude<CliCommandName, '--version'>>(
    name: N,
    args: CliArgs = {},
  ): Promise<CliOutput<CliCommandOutputs[N]>> {
    return this.json<CliCommandOutputs[N]>(name.split(' '), args);
  }

  /**
   * Run `wingfoil --format json <words…> <options…> [-- <positionals…>]`, parse its JSON output and
   * validate it against the command's schema. The words are the adapter's own, name a command of
   * the static list (`CLI_COMMANDS`) and must not start with `-`; user values go in `options` or `positionals`.
   */
  async json<T = unknown>(words: readonly string[], args: CliArgs = {}): Promise<CliOutput<T>> {
    const options = args.options ?? {};
    const command: CliCommand = { words: [...words], options: Object.keys(options) };
    const argv = ['--format', 'json', ...words];
    for (const [name, value] of Object.entries(options)) {
      for (const v of typeof value === 'string' ? [value] : value) argv.push(...optionArg(name, v));
    }
    if (args.positionals && args.positionals.length > 0) argv.push('--', ...args.positionals);
    const badWord = words.find((w) => w.startsWith('-'));
    const badOption = command.options.find((name) => !/^--[a-z][a-z0-9-]*$/.test(name));
    if (badWord !== undefined || badOption !== undefined) {
      const detail = `invalid CLI argument: ${badWord ?? badOption ?? ''}`;
      this.log(command, { reason: detail }, 'CLI invocation rejected as malformed');
      throw new CliInternalError(command, detail);
    }
    const name = commandFor(words);
    if (name === undefined || name === '--version') {
      const detail = `command not on the static list: ${words.join(' ')}`;
      this.log(command, { reason: detail }, 'CLI invocation rejected as malformed');
      throw new CliInternalError(command, detail);
    }
    const result = await this.exec(command, argv, args.signal);
    let data: unknown;
    try {
      data = JSON.parse(result.stdout.trim());
    } catch {
      throw this.outputError(command, ['not JSON']);
    }
    const problems = outputProblem(name, data);
    // `memory search` alone is read per match (spec-001 §2, task-070, bug-024): a failing match is
    // dropped and becomes a warning; a failing envelope, and every other command, stays an output error.
    const perMatch = problems && name === 'memory search' ? searchMatches(data) : undefined;
    if (problems && !perMatch) throw this.outputError(command, problems);
    if (perMatch) data = perMatch.data;
    // Each warning, and the tool text of the output (task-046), through the one sanitiser of tool
    // messages (bug-017, review round 3 S3-1); the dropped matches after the stderr lines, one cap.
    const parts = stderrWarnings(result.stderr, (w) => this.redact(warningText(w)), perMatch?.dropped);
    return {
      data: toolText(name, data, (text) => this.redact(text)) as T,
      warnings: mergeToolLines([parts]),
      warningParts: parts,
    };
  }

  /**
   * `text` through the adapter's sanitiser of tool messages, with its roots (the project and the CLI's
   * package folder): for a tool text the caller passes on, e.g. the `--version` text (review round 2 n7).
   */
  sanitise(text: string): string {
    return this.redact(text);
  }

  /** `wingfoil --version`: one line of plain text, even with `--format json` (W-19). Not parsed here. */
  async version(): Promise<string> {
    const command: CliCommand = { words: ['--version'], options: [] };
    const text = (await this.exec(command, ['--version'])).stdout.trim();
    const problems = outputProblem('--version', text);
    if (problems) throw this.outputError(command, problems);
    return text;
  }

  /** An output error, logged with its problems (instance paths and messages, no value). */
  private outputError(command: CliCommand, problems: string[]): CliOutputError {
    this.log(command, { problems }, `Unexpected output of ${command.words.join(' ')}`);
    return new CliOutputError(command, problems);
  }

  private async exec(command: CliCommand, argv: readonly string[], signal?: AbortSignal): Promise<ProcessResult> {
    const { cli, runner, env } = this.options;
    const result = await runner.run({
      file: cli.file,
      args: [...cli.prefixArgs, ...argv],
      cwd: cli.projectRoot,
      timeoutMs: this.timeoutMs,
      // No optional git locks (task-046 D46-5): WingFoil 0.3's reads run `git status`, which would
      // otherwise rewrite a stale `.git/index`; commits take required locks and are unaffected.
      // …and no lazy fetch of a missing object (task-046 D46-7).
      env: withCliGitEnv(env ?? process.env),
      // No fsmonitor program (D46-6, spec-010 W4-5) and no transport (D46-7: a promisor remote's
      // program) in any git WingFoil runs, writes included — none of its verbs fetches or pushes.
      gitConfig: CLI_GIT_CONFIG,
      ...(signal ? { signal } : {}),
    });
    if (result.drained) {
      // The output was cut after the exit (a program left holding the pipes, task-034 W4-13).
      const error = new CliProcessError(command, 'WingFoil left its output open after it exited');
      this.log(command, { ended: result.ended, exitCode: result.exitCode, kind: 'pipes-held' }, error.reason);
      throw error;
    }
    if (result.ended === 'exit' && result.exitCode === 0) return result;
    if (result.ended === 'exit' && result.exitCode === 1) {
      // The CLI's wording verbatim, the machine's folders removed (D33-5, bug-012); its reasons too
      // (task-070 D70-5), cut before the sanitiser.
      // The stderr text is parsed once for both (review round 2 n5 of task-046: one parse per candidate).
      const { message, reasons } = refusalOf(result.stderr);
      const kept = reasons.slice(0, MAX_REASONS).map((r) => this.redact(r));
      const more = reasons.length - kept.length;
      throw new CliRefusedError(command, this.redact(message), [
        ...kept,
        ...(more > 0 ? [`${more} more reasons omitted`] : []),
      ]);
    }
    if (result.ended === 'exit' && result.exitCode === 2) {
      // A usage error may quote a value (a rejected option value, a reason WingFoil will not record,
      // W-29): the log keeps only its kind, the text before the first colon (task-032 review I1).
      const detail = result.stderr.trim();
      this.log(command, { exitCode: 2, stderr: usageKind(detail) }, 'CLI invocation rejected as malformed');
      throw new CliInternalError(command, detail);
    }
    const error =
      result.ended === 'timeout'
        ? new CliTimeoutError(command, this.timeoutMs)
        : new CliProcessError(command, reason(result));
    // Details of a 500/504 live only in the log (spec-004 §5).
    this.log(
      command,
      { ended: result.ended, exitCode: result.exitCode, signal: result.signal, reason: error.reason },
      error.reason,
    );
    throw error;
  }

  private redact(text: string): string {
    if (this.options.redact) return this.options.redact(text);
    const { cli } = this.options;
    return redactLocalPaths(text, {
      project: [cli.projectRoot],
      ...(cli.packageDir !== undefined ? { wingfoil: [cli.packageDir] } : {}),
    });
  }

  private log(command: CliCommand, fields: object, message: string): void {
    // No token, session or user value (spec-004 §2): the command words and option names only.
    this.options.logger?.error(
      { words: command.words, options: command.options, cli: this.options.cli.file, ...fields },
      message,
    );
  }
}

function reason(result: ProcessResult): string {
  switch (result.ended) {
    case 'cancelled':
      return 'WingFoil was cancelled';
    case 'terminated':
      return 'WingFoil was stopped with the server';
    case 'overflow':
      return 'WingFoil wrote too much output';
    default:
      return result.exitCode === null
        ? `WingFoil was killed by ${result.signal ?? 'a signal'}`
        : `WingFoil exited with status ${result.exitCode}`;
  }
}

/**
 * The kind of a CLI message, never a value: the text before the first colon of its message
 * (`{"error": …}` or plain), e.g. `invalid flag value`, `missing required argument`, `error`,
 * `Command failed`.
 */
export function usageKind(stderr: string): string {
  const trimmed = stderr.trim();
  // The CLI's own error (the whole text or its last line), else the text itself (review round 2).
  const text = cliError(trimmed) ?? trimmed;
  return /^([A-Za-z][A-Za-z ]{0,60}):/.exec(text)?.[1] ?? 'usage error';
}

/**
 * The CLI's refusal of a `stderr` text: its message — `{"error": "<message>"}`, else the stderr
 * text, else the exit — and the `detail` texts of its `details` (WingFoil 0.3.x, W-20; task-070
 * D70-5), in order: every item with a string `detail`; any other shape gives none. `details[].file`
 * is not read.
 */
function refusalOf(stderr: string): { message: string; reasons: string[] } {
  const text = stderr.trim();
  if (!text) return { message: 'WingFoil refused (exit status 1) without a message', reasons: [] };
  const parsed = cliErrorObject(text);
  const reasons: string[] = [];
  if (parsed && Array.isArray(parsed.details)) {
    for (const item of parsed.details as unknown[]) {
      const detail = item !== null && typeof item === 'object' ? (item as { detail?: unknown }).detail : undefined;
      if (typeof detail === 'string') reasons.push(detail);
    }
  }
  return { message: parsed?.error ?? text, reasons };
}

/**
 * The CLI's own error of a `stderr` text: `{"error": "<message>"}` as the whole text, or as its last
 * line (WingFoil 0.3 may write JSON warning lines first, task-046). The CLI writes its error last, so
 * no earlier line is read (review round 2 n5, n6: a hook's `{"error"}` before a plain-text end does not
 * win; one parse per candidate whatever the length).
 */
function cliError(text: string): string | undefined {
  return cliErrorObject(text)?.error;
}

/** The CLI's error object of a `stderr` text: the whole text or its last line ({@link cliError}). */
function cliErrorObject(text: string): { error: string; details?: unknown } | undefined {
  const last = text.slice(text.lastIndexOf('\n') + 1).trim();
  for (const candidate of last === text ? [text] : [text, last]) {
    if (!candidate.startsWith('{')) continue;
    try {
      const parsed = JSON.parse(candidate) as { error?: unknown; details?: unknown };
      if (typeof parsed.error === 'string') return { error: parsed.error, details: parsed.details };
    } catch {
      // Not JSON: the next candidate.
    }
  }
  return undefined;
}

/**
 * The git settings of every WingFoil process: no fsmonitor program (task-046 D46-6), no transport
 * at all (D46-7: a lazy fetch would run a promisor remote's `uploadpack` or `core.sshCommand`).
 */
const CLI_GIT_CONFIG: readonly (readonly [string, string])[] = [
  ['core.fsmonitor', 'false'],
  ['protocol.allow', 'never'],
  // No signature check in a history read (review round 5 s-minor-1: 0.2.2's `git log --follow`
  // would run a configured `gpg.program`); the server's own log reads set it too.
  ['log.showSignature', 'false'],
];

/** The git variables of every WingFoil process (task-046 D46-5, D46-7). */
const CLI_GIT_ENV: Readonly<Record<string, string>> = { GIT_OPTIONAL_LOCKS: '0', ...READ_GIT_ENV };

/**
 * `env` with {@link CLI_GIT_ENV} — `GIT_OPTIONAL_LOCKS=0`, `GIT_ALLOW_PROTOCOL=none` (which also
 * overrides the repository's `protocol.<name>.allow`, review round 3 M1), `GIT_NO_LAZY_FETCH=1` —, any
 * other spelling of those names removed first (names are case-insensitive on Windows, round 1 n3).
 */
function withCliGitEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...withoutNames(env, CLI_GIT_ENV), ...CLI_GIT_ENV };
}

/**
 * The text of one `stderr` warning line: WingFoil 0.3 writes each as `{"warning": "<text>"}` under
 * `--format json` (task-046), WingFoil 0.2.2 as the text itself; any other line is kept as written.
 */
function warningText(line: string): string {
  if (!line.startsWith('{')) return line;
  try {
    const parsed = JSON.parse(line) as { warning?: unknown };
    return typeof parsed.warning === 'string' ? parsed.warning : line;
  } catch {
    return line;
  }
}

/**
 * The warnings of an output in their parts ({@link WarningParts}): the first {@link MAX_TOOL_LINES}
 * non-empty `stderr` lines, sanitised, and how many follow — counted, never split into an array
 * (review round 3 n1 of task-046: a 64 MiB stderr) —, then the adapter's own lines (task-070: the
 * dropped matches), each text once. Each of those is one line on the page: a newline, carriage
 * return or tab its path holds is written as a visible escape after the sanitiser (review round 1
 * F1) — after it, so that the escape keeps one backslash, like the sanitiser's own, and a literal
 * backslash stays doubled —, and the line is capped again (round 2 R2-F2: an escape is longer).
 */
function stderrWarnings(
  stderr: string,
  sanitise: (text: string) => string,
  more: readonly string[] = [],
): WarningParts {
  const { lines: first, omitted } = boundedLines(stderr, MAX_TOOL_LINES);
  return {
    stderr: first.map(sanitise),
    stderrOmitted: omitted,
    // The cap's own omission mark is set off by newlines: spaces here, the same length.
    dropped: [...new Set(more)].map((l) => capMessage(oneLine(sanitise(l))).replace(/\n/g, ' ')),
  };
}

/** `text` on one line: newline, carriage return and tab as `\x0a`, `\x0d`, `\x09` (review round 1 F1). */
function oneLine(text: string): string {
  return text.replace(/[\n\r\t]/g, (ch) => `\\x${ch.charCodeAt(0).toString(16).padStart(2, '0')}`);
}

/** HTTP status and envelope of a CLI failure (spec-004 §5, spec-006 §3). */
export function cliErrorEnvelope(error: CliError | CliNotFoundError): { status: number; body: ErrorEnvelope } {
  if (error instanceof CliNotFoundError) {
    return {
      status: 422,
      body: {
        error: {
          code: error.code,
          message: 'WingFoil CLI not found for this project',
          // Never the project's absolute root (bug-012, coordinator C2): the catalogue uses the command.
          detail: { command: error.installCommand },
        },
      },
    };
  }
  switch (error.kind) {
    case 'refused': {
      // `detail.reasons` only when there is one: a refusal without `details` (0.2.2) is unchanged.
      const reasons = error instanceof CliRefusedError ? error.reasons : [];
      const body = envelope('cli-refused', error.message);
      return { status: 422, body: reasons.length > 0 ? { error: { ...body.error, detail: { reasons } } } : body };
    }
    case 'output':
      return { status: 502, body: envelope('cli-output', error.message) };
    case 'timeout':
      return { status: 504, body: envelope('cli-timeout', error.message) };
    case 'internal':
    case 'process':
      // Details only in the log (spec-004 §5 `internal`).
      return { status: 500, body: envelope('internal', 'Internal error') };
  }
}
