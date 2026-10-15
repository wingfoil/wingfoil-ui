/**
 * The process runner port (adr-002) and its local adapter: every `wingfoil` and git process of the
 * server starts here, with `spawn`, an argument array and no shell (REQ-SEC-05), its standard input
 * closed, and a timeout — 30 s unless the caller lifts it for cancellable git transport (adr-001 D5).
 * Every child gets its environment through `gitEnv` (bug-002): no inherited `GIT_DIR`,
 * `GIT_WORK_TREE`, `GIT_CONFIG_KEY_<n>`, … redirects the `wingfoil` CLI (which runs git itself) or
 * a git read to another repository or configuration.
 * On POSIX each child leads its own process group and every kill (timeout, cancel, stop) goes to the
 * group, so the processes it started end with it; on Windows the child alone is killed.
 * A process is settled when its pipes close, or at the latest {@link DEFAULT_DRAIN_MS} after it
 * exited (task-034 W4-8, security review S4): a program it started in another session (a filter, an
 * fsmonitor, `setsid … &`) may keep stdout or stderr open forever; the pipes are then destroyed and
 * the result holds what was read.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { gitEnv } from '../git/git.js';

/** Timeout of every `wingfoil` process and git read (adr-001 D5, REQ-INT-04). */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Wait for the pipes to close after the process exited (W4-8). */
export const DEFAULT_DRAIN_MS = 2_000;

/** One process to run. */
export interface ProcessRequest {
  /** Absolute path of the program (no `PATH` lookup by a shell). */
  file: string;
  /** Arguments, each passed verbatim. */
  args: readonly string[];
  /** Working directory. */
  cwd: string;
  /** Full environment (default: the server's), without the redirecting `GIT_*` variables (`gitEnv`). */
  env?: NodeJS.ProcessEnv;
  /** Kill the process after this many milliseconds; `null` for no timeout (default 30 s). */
  timeoutMs?: number | null;
  /** Cancels the process (git transport, adr-001 D5). */
  signal?: AbortSignal;
}

/**
 * How a process ended: on its own (`exit`), or killed by the runner because of its timeout, its
 * cancellation, an output beyond the limit, or the server's stop sequence.
 */
export type ProcessEnd = 'exit' | 'timeout' | 'cancelled' | 'overflow' | 'terminated';

/** Outcome of a process. */
export interface ProcessResult {
  /** Exit status; `null` when the process ended on a signal. */
  exitCode: number | null;
  /** Signal that ended the process, if any. */
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  ended: ProcessEnd;
  /** From start to end, in milliseconds. */
  durationMs: number;
}

/** The port: runs one process to its end. */
export interface ProcessRunner {
  /** Run `request`; resolves with its outcome whatever its exit status. */
  run(request: ProcessRequest): Promise<ProcessResult>;
}

/** What the runner reports of each process it starts (process audit, REQ-ARC-02). */
export interface SpawnRecord {
  file: string;
  args: readonly string[];
  cwd: string;
  pid: number | undefined;
}

/** Options of {@link LocalProcessRunner}. */
export interface LocalRunnerOptions {
  /** Called once for every process started. */
  onSpawn?: (record: SpawnRecord) => void;
  /** Wait between SIGTERM and SIGKILL (default 2 s). */
  killGraceMs?: number;
  /** Most bytes kept of stdout plus stderr; a process writing more is killed (default 64 MiB). */
  maxOutputBytes?: number;
  /** Wait for the pipes after the process exited (default {@link DEFAULT_DRAIN_MS}). */
  drainMs?: number;
}

/** A process could not be started (missing program, or the runner is stopping). */
export class ProcessStartError extends Error {
  constructor(
    readonly file: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ProcessStartError';
  }
}

interface Running {
  child: ChildProcess;
  kill(end: ProcessEnd): void;
  /** SIGKILL now, synchronously. */
  killNow(): void;
  settled: Promise<unknown>;
}

/** The local adapter of the port. */
export class LocalProcessRunner implements ProcessRunner {
  private readonly children = new Set<Running>();
  private stopping = false;
  private readonly killGraceMs: number;
  private readonly maxOutputBytes: number;
  private readonly drainMs: number;

  constructor(private readonly options: LocalRunnerOptions = {}) {
    this.killGraceMs = options.killGraceMs ?? 2_000;
    this.maxOutputBytes = options.maxOutputBytes ?? 64 * 1024 * 1024;
    this.drainMs = options.drainMs ?? DEFAULT_DRAIN_MS;
  }

  /** Number of processes still running. */
  get running(): number {
    return this.children.size;
  }

  run(request: ProcessRequest): Promise<ProcessResult> {
    if (this.stopping) {
      return Promise.reject(new ProcessStartError(request.file, 'the server is stopping: no process is started'));
    }
    const started = performance.now();
    const result = (ended: ProcessEnd, partial: Partial<ProcessResult> = {}): ProcessResult => ({
      exitCode: null,
      signal: null,
      stdout: '',
      stderr: '',
      ended,
      durationMs: performance.now() - started,
      ...partial,
    });
    if (request.signal?.aborted) return Promise.resolve(result('cancelled'));

    return new Promise((resolve, reject) => {
      // POSIX: the child leads its own process group, so a kill reaches the processes it started
      // (a `git` under `wingfoil`), which would otherwise keep the output pipes open.
      const group = process.platform !== 'win32';
      const child = spawn(request.file, [...request.args], {
        cwd: request.cwd,
        env: gitEnv(request.env ?? process.env),
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        detached: group,
        windowsHide: true,
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let bytes = 0;
      let end: ProcessEnd = 'exit';
      let timer: NodeJS.Timeout | undefined;
      let escalation: NodeJS.Timeout | undefined;
      let drain: NodeJS.Timeout | undefined;
      let settle!: () => void;
      const done = new Promise<void>((r) => (settle = r));

      const signalAll = (sig: NodeJS.Signals): void => {
        if (group && child.pid !== undefined) {
          try {
            process.kill(-child.pid, sig);
            return;
          } catch {
            // The group is gone (or was never formed): the child alone.
          }
        }
        child.kill(sig);
      };
      let signalled = false;
      const terminate = (): void => {
        if (signalled || child.pid === undefined) return;
        signalled = true;
        signalAll('SIGTERM');
        escalation = setTimeout(() => signalAll('SIGKILL'), this.killGraceMs);
      };
      const kill = (why: ProcessEnd): void => {
        if (end !== 'exit') return;
        end = why;
        // Without a pid (not started yet) the signal is sent on 'spawn'.
        terminate();
      };
      const killNow = (): void => {
        if (end === 'exit') end = 'terminated';
        signalled = true;
        clearTimeout(escalation);
        if (child.pid !== undefined) signalAll('SIGKILL');
      };
      const entry: Running = { child, kill, killNow, settled: done };
      const onAbort = (): void => kill('cancelled');
      const cleanUp = (): void => {
        clearTimeout(timer);
        clearTimeout(escalation);
        clearTimeout(drain);
        request.signal?.removeEventListener('abort', onAbort);
        this.children.delete(entry);
        settle();
      };
      // Tracked and cancellable from now on, not only once spawned: a stop or an abort that comes
      // before 'spawn' is not lost.
      this.children.add(entry);
      request.signal?.addEventListener('abort', onAbort, { once: true });

      const collect =
        (into: Buffer[]) =>
        (chunk: Buffer): void => {
          bytes += chunk.length;
          if (bytes > this.maxOutputBytes) kill('overflow');
          else into.push(chunk);
        };
      child.stdout.on('data', collect(stdout));
      child.stderr.on('data', collect(stderr));

      child.on('error', (error) => {
        cleanUp();
        reject(new ProcessStartError(request.file, `cannot start ${request.file}: ${error.message}`, { cause: error }));
      });
      child.on('spawn', () => {
        this.options.onSpawn?.({ file: request.file, args: [...request.args], cwd: request.cwd, pid: child.pid });
        if (end !== 'exit') {
          // Stopped, aborted or killed before it existed.
          if (signalled) signalAll('SIGKILL');
          else terminate();
          return;
        }
        const timeoutMs = request.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : request.timeoutMs;
        if (timeoutMs !== null) timer = setTimeout(() => kill('timeout'), timeoutMs);
      });
      let settled = false;
      const finish = (exitCode: number | null, signal: NodeJS.Signals | null): void => {
        if (settled) return;
        settled = true;
        cleanUp();
        resolve(
          result(end, {
            exitCode: end === 'exit' ? exitCode : null,
            signal,
            stdout: Buffer.concat(stdout).toString('utf8'),
            stderr: Buffer.concat(stderr).toString('utf8'),
          }),
        );
      };
      child.on('exit', (exitCode, signal) => {
        // The pipes normally close right after; a program left in another session may hold them.
        drain = setTimeout(() => {
          child.stdout.destroy();
          child.stderr.destroy();
          finish(exitCode, signal);
        }, this.drainMs);
      });
      child.on('close', (exitCode, signal) => finish(exitCode, signal));
    });
  }

  /**
   * Stop sequence (spec-007 §6): refuse new processes, send SIGTERM to every running one, SIGKILL
   * after the grace period, and resolve once all have ended.
   */
  async terminateAll(): Promise<void> {
    this.stopping = true;
    const running = [...this.children];
    for (const entry of running) entry.kill('terminated');
    await Promise.all(running.map((entry) => entry.settled));
  }

  /**
   * Last resort, synchronous (a forced stop, `process.on('exit')`): refuse new processes and send
   * SIGKILL to every running one (its group on POSIX) now — no timer survives the server's exit.
   */
  killAllNow(): void {
    this.stopping = true;
    for (const entry of this.children) entry.killNow();
  }
}
