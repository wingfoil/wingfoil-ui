/**
 * Process runner of the test harness. Every process is started with `execFile` and an argument
 * array — never through a shell — so paths, URLs and titles reach the program verbatim
 * (REQ-SEC-05, the same rule the lint enforces on `server/`).
 */
import { execFile } from 'node:child_process';

/** Options of {@link run}. */
export interface RunOptions {
  /** Working directory of the process. */
  cwd?: string;
  /** Full environment of the process (defaults to the current one). */
  env?: NodeJS.ProcessEnv;
  /** Resolve instead of reject when the process exits with a non-zero status. */
  allowFailure?: boolean;
  /** Kill the process after this many milliseconds (default 60 s). */
  timeoutMs?: number;
  /** Kill the process when aborted (SIGTERM); it then resolves or rejects as a failure. */
  signal?: AbortSignal;
}

/** Outcome of a finished process. */
export interface RunResult {
  /** Exit status (`null` when killed by a signal). */
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Raised by {@link run} when a process fails and `allowFailure` is not set. */
export class RunError extends Error {
  constructor(
    readonly file: string,
    readonly args: readonly string[],
    readonly result: RunResult,
  ) {
    super(
      `${file} ${args.join(' ')} exited with ${String(result.code)}: ${result.stderr.trim() || result.stdout.trim()}`,
    );
    this.name = 'RunError';
  }
}

/** Run `file` with `args` (no shell) and collect its output. */
export function run(file: string, args: readonly string[], options: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      [...args],
      {
        cwd: options.cwd,
        env: options.env ?? process.env,
        timeout: options.timeoutMs ?? 60_000,
        maxBuffer: 32 * 1024 * 1024,
        encoding: 'utf8',
        ...(options.signal ? { signal: options.signal } : {}),
      },
      (error, stdout, stderr) => {
        const code = error ? (typeof error.code === 'number' ? error.code : null) : 0;
        const result: RunResult = { code, stdout, stderr };
        if (error && !options.allowFailure) reject(new RunError(file, args, result));
        else resolve(result);
      },
    );
  });
}

/** Run `git` with `args` in `cwd`. */
export function git(cwd: string, args: readonly string[], env?: NodeJS.ProcessEnv): Promise<RunResult> {
  return run('git', args, env ? { cwd, env } : { cwd });
}
