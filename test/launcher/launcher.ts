/**
 * Starts the `wingfoil-ui` bin as a child process and follows its output (spec-007). Used by the
 * launcher tests and, later, by the e2e suite to get the URL and the token.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { REPO_ROOT } from '../harness/cli.js';

/** The package `bin` (`npx wingfoil-ui` runs it). */
export const BIN = path.join(REPO_ROOT, 'bin', 'wingfoil-ui.cjs');

const RUNNING = /^WingFoil UI is running at http:\/\/127\.0\.0\.1:(\d+)\/#token=([A-Za-z0-9_-]+)$/;

/** A running console. */
export interface Launcher {
  pid: number;
  port: number;
  token: string;
  /** The `WingFoil UI is running at …` line. */
  runningLine: string;
  /** Milliseconds from spawn to the running line. */
  startMs: number;
  stdoutLines(): string[];
  stderr(): string;
  signal(signal: NodeJS.Signals): void;
  /** Send `signal` (default SIGINT) and resolve with the exit status (or 128 + signal number). */
  stop(signal?: NodeJS.Signals): Promise<number | null>;
  kill(): Promise<void>;
}

/** Options of {@link startLauncher}. */
export interface LaunchOptions {
  /** Run the bin in its own process group (the e2e support kills the group, bug-004). */
  detached?: boolean;
}

/** Start the bin with `args` and wait for its running line (rejects after `timeoutMs`). */
export function startLauncher(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  timeoutMs = 10_000,
  options: LaunchOptions = {},
): Promise<Launcher> {
  const t0 = performance.now();
  const child: ChildProcess = spawn(process.execPath, [BIN, ...args], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: options.detached ?? false,
  });
  const out: string[] = [];
  let buffer = '';
  let err = '';
  const exited = new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)));
  child.stderr!.on('data', (d: Buffer) => {
    err += String(d);
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`no running line after ${timeoutMs} ms; stderr: ${err}`));
    }, timeoutMs);
    const early = (code: number | null): void => {
      clearTimeout(timer);
      reject(new Error(`exited with ${String(code)} before the running line; stderr: ${err}`));
    };
    child.once('exit', early);
    child.stdout!.on('data', (d: Buffer) => {
      buffer += String(d);
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        out.push(line);
        const m = RUNNING.exec(line);
        if (!m || out.length > 1) continue;
        clearTimeout(timer);
        child.off('exit', early);
        const launcher: Launcher = {
          pid: child.pid!,
          port: Number(m[1]),
          token: m[2]!,
          runningLine: line,
          startMs: performance.now() - t0,
          stdoutLines: () => [...out],
          stderr: () => err,
          signal: (signal) => {
            child.kill(signal);
          },
          stop: async (signal = 'SIGINT') => {
            if (child.exitCode === null && child.signalCode === null) child.kill(signal);
            return exited;
          },
          kill: async () => {
            if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
            await exited;
          },
        };
        resolve(launcher);
      }
    });
  });
}
