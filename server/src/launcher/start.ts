/**
 * The start and stop sequences of the console (spec-007 §3, §6). No project is read and no CLI
 * is started before the URL is printed (REQ-PERF-06).
 */
import { randomBytes } from 'node:crypto';
import { buildApp } from '../http/app.js';
import { message } from '../i18n/messages.js';
import { createLogger } from '../logging.js';
import { listenLoopback, NoFreePortError, PortInUseError } from './listen.js';
import { openBrowser, type Spawner } from './opener.js';
import { parseOptions, UsageError } from './options.js';

/** Exit statuses of spec-007 §6. */
export const EXIT = {
  ok: 0,
  nodeTooOld: 1,
  usage: 2,
  port: 3,
  stateDirInsideProject: 4,
  unexpected: 70,
  forced: 130,
} as const;

/** What the launcher needs from its process (injected by tests). */
export interface LauncherIo {
  stdout(line: string): void;
  stderr(line: string): void;
  /** Package version printed by `--version`. */
  version: string;
  /** Directory of the `web/` build. */
  staticDir: string;
  platform: NodeJS.Platform;
  spawn?: Spawner;
  /** Registers the handler of SIGINT/SIGTERM. */
  onSignal(handler: () => void): void;
  /** Ends the process with `code`. */
  exit(code: number): void;
  /** Longest wait for open requests at stop before they are cut (default 5 s). */
  drainTimeoutMs?: number;
}

/** Work run during the stop sequence (e.g. closing event streams, terminating CLI children). */
export type StopHook = () => Promise<void>;

const stopHooks: StopHook[] = [];

/**
 * Register work to run during the stop sequence (spec-007 §6), whose order is: stop accepting
 * connections → run the hooks, in registration order (close the event streams, terminate the
 * `wingfoil` and git child processes) → wait for the open requests, at most `drainTimeoutMs`, then
 * cut them → print the stop line, exit 0. A hook must end what keeps a request open; it must not
 * wait for requests itself. Hooks live for the process (module scope).
 */
export function onStop(hook: StopHook): void {
  stopHooks.push(hook);
}

/** Draw the per-start session token: 32 random bytes, base64url (spec-004 §2). */
export function drawToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Run the command line `argv`. Resolves with the exit status for the commands that end at once
 * (`--version`, `--help`, refusals); for a start, resolves `undefined` once the URL is printed
 * and ends the process through `io.exit` when stopped.
 */
export async function runLauncher(argv: readonly string[], io: LauncherIo): Promise<number | undefined> {
  let command;
  try {
    command = parseOptions(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    io.stderr(message('launcher.usage.line', { reason: message(error.key, error.args) }));
    return EXIT.usage;
  }
  if (command.kind === 'version') {
    io.stdout(io.version);
    return EXIT.ok;
  }
  if (command.kind === 'help') {
    io.stdout(message('launcher.help'));
    return EXIT.ok;
  }

  const started = performance.now();
  const logger = createLogger();
  // Drawn before the application is built: the session guards (task-003) need it.
  const token = drawToken();
  const app = await buildApp({ staticDir: io.staticDir, logger });
  let listeners;
  try {
    listeners = await listenLoopback(app.routing, {
      port: command.port,
      onError: (error) => logger.error({ err: error }, 'listener error'),
    });
  } catch (error) {
    await app.close();
    if (error instanceof PortInUseError) {
      io.stderr(message('launcher.portInUse', { port: error.port }));
      return EXIT.port;
    }
    if (error instanceof NoFreePortError) {
      io.stderr(message('launcher.noFreePort', { tries: error.tries }));
      return EXIT.port;
    }
    throw error;
  }
  // Signals are handled before the URL is printed: a stop sent right after it is never lost.
  let stopping = false;
  io.onSignal(() => {
    if (stopping) {
      io.exit(EXIT.forced);
      return;
    }
    stopping = true;
    void (async () => {
      try {
        listeners.stopAccepting();
        for (const hook of stopHooks) await hook();
        await listeners.drain(io.drainTimeoutMs ?? 5_000);
        await app.close();
        io.stdout(message('launcher.stopped'));
        io.exit(EXIT.ok);
      } catch (error) {
        io.stderr(message('launcher.unexpected', { message: (error as Error).message }));
        io.exit(EXIT.unexpected);
      }
    })();
  });

  const url = `http://127.0.0.1:${listeners.port}/#token=${token}`;
  io.stdout(message('launcher.running', { url }));
  logger.info(
    { port: listeners.port, addresses: listeners.addresses, startMs: Math.round(performance.now() - started) },
    'listening',
  );

  if (command.open) {
    void openBrowser(url, io.spawn ? { platform: io.platform, spawn: io.spawn } : { platform: io.platform }).then(
      (opened) => {
        if (!opened) io.stdout(message('launcher.openManually', { url }));
      },
    );
  }
  return undefined;
}
