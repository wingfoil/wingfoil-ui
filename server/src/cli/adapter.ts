/**
 * The CLI adapter (spec-001 §1–2, adr-001 D1, D5): invokes a project's resolved `wingfoil` with
 * `--format json` placed before the command, an argument array, the project root as working
 * directory and a 30 s timeout, and classifies the outcome.
 *
 * | Exit | The adapter |
 * |------|-------------|
 * | 0 | returns the parsed stdout and the stderr lines as warnings; stdout that is not JSON is a {@link CliOutputError} |
 * | 1 | {@link CliRefusedError} with the CLI's message verbatim (stderr `{"error": …}`, else its text) |
 * | 2 | {@link CliInternalError}: a defect of the adapter, logged (command words and option names) |
 * | other, signal, cancelled, stopped | {@link CliProcessError} with the reason |
 * | killed at the timeout | {@link CliTimeoutError} |
 *
 * Internal, process and timeout errors are logged with the command words and option names, never
 * a user value.
 *
 * Validating the data against the command's schema is the caller's (contracts, task-005); writes
 * run under the project's write lock, taken by the caller.
 */
import { envelope, type ErrorEnvelope } from '../http/app.js';
import { DEFAULT_TIMEOUT_MS, type ProcessResult, type ProcessRunner } from '../process/runner.js';
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
  ) {
    super(command, cliMessage);
  }
}

/** Exit 0 with output that cannot be read. */
export class CliOutputError extends CliError {
  readonly kind = 'output';

  constructor(command: CliCommand) {
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

  /**
   * Run `wingfoil --format json <words…> <options…> [-- <positionals…>]` and parse its JSON output.
   * The words are the adapter's own and must not start with `-`; user values go in `options` or
   * `positionals`.
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
    const result = await this.exec(command, argv, args.signal);
    try {
      return { data: JSON.parse(result.stdout.trim()) as T, warnings: lines(result.stderr) };
    } catch {
      throw new CliOutputError(command);
    }
  }

  /** `wingfoil --version`: one line of plain text, even with `--format json` (W-19). Not parsed here. */
  async version(): Promise<string> {
    const command: CliCommand = { words: ['--version'], options: [] };
    const text = (await this.exec(command, ['--version'])).stdout.trim();
    if (!text) throw new CliOutputError(command);
    return text;
  }

  private async exec(command: CliCommand, argv: readonly string[], signal?: AbortSignal): Promise<ProcessResult> {
    const { cli, runner, env } = this.options;
    const result = await runner.run({
      file: cli.file,
      args: [...cli.prefixArgs, ...argv],
      cwd: cli.projectRoot,
      timeoutMs: this.timeoutMs,
      ...(env ? { env } : {}),
      ...(signal ? { signal } : {}),
    });
    if (result.ended === 'exit' && result.exitCode === 0) return result;
    if (result.ended === 'exit' && result.exitCode === 1) {
      throw new CliRefusedError(command, refusalMessage(result.stderr));
    }
    if (result.ended === 'exit' && result.exitCode === 2) {
      // A usage error names options, but it may quote a value (`missing required argument`,
      // a rejected option value): the log keeps its first 200 characters only.
      const detail = result.stderr.trim();
      this.log(command, { exitCode: 2, stderr: detail.slice(0, 200) }, 'CLI invocation rejected as malformed');
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

/** The CLI's refusal message: stderr `{"error": "<message>"}`, else the stderr text, else the exit. */
function refusalMessage(stderr: string): string {
  const text = stderr.trim();
  if (!text) return 'WingFoil refused (exit status 1) without a message';
  try {
    const parsed = JSON.parse(text) as { error?: unknown };
    if (typeof parsed.error === 'string') return parsed.error;
  } catch {
    // Not JSON: the text itself.
  }
  return text;
}

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
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
          detail: { path: error.projectRoot, command: error.installCommand },
        },
      },
    };
  }
  switch (error.kind) {
    case 'refused':
      return { status: 422, body: envelope('cli-refused', error.message) };
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
