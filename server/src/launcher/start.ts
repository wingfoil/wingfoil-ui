/**
 * The start and stop sequences of the console (spec-007 §3, §6). No project is read and no CLI
 * is started before the URL is printed (REQ-PERF-06).
 */
import { randomBytes } from 'node:crypto';
import { createTokenAuthentication } from '../auth/authentication.js';
import { InProcessEventBus } from '../events/bus.js';
import { buildApp } from '../http/app.js';
import { registerElementWriteRoutes } from '../http/element-writes.js';
import { registerGitRoutes } from '../http/git-routes.js';
import { registerEventStream, type EventStreams } from '../http/events.js';
import { registerProjectRoutes } from '../http/project-routes.js';
import { registerProjectListRoutes } from '../http/projects.js';
import { registerRoleViewRoute } from '../http/role-view.js';
import { registerServerRoute } from '../http/server-route.js';
import { registerSettingsRoutes } from '../http/settings.js';
import { createSnapshotIdentitySource } from '../identity/snapshot-identity.js';
import { message } from '../i18n/messages.js';
import { createLogger } from '../logging.js';
import { LocalProcessRunner } from '../process/runner.js';
import { InProcessWriteLock } from '../process/write-lock.js';
import { ProjectList } from '../projects/project-list.js';
import { Snapshots } from '../snapshot/snapshots.js';
import { openFileStateStore } from '../state/file-store.js';
import { AutoSync } from '../sync/auto-sync.js';
import { SyncScheduler } from '../sync/scheduler.js';
import { AutoPush } from '../writes/auto-push.js';
import { GitTransport } from '../writes/transport.js';
import { findProjectContaining } from '../state/location.js';
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
  /** The local state directory (spec-006 §1, `resolveStateDir`). */
  stateDir: string;
  platform: NodeJS.Platform;
  spawn?: Spawner;
  /** Registers the handler of the stop signals (SIGINT, SIGTERM, SIGHUP — spec-007 §6). */
  onSignal(handler: () => void): void;
  /** Registers a synchronous handler run at any process exit (a start only). */
  onExit?(handler: () => void): void;
  /** Ends the process with `code`. */
  exit(code: number): void;
  /** Longest wait for open requests at stop before they are cut (default 5 s). */
  drainTimeoutMs?: number;
  /** Runner of the `wingfoil` and git processes, terminated at stop (default: a new one). */
  processes?: LocalProcessRunner;
}

/** Work run during the stop sequence (e.g. closing event streams, terminating CLI children). */
export type StopHook = () => Promise<void>;

const stopHooks: StopHook[] = [];

/**
 * Register work to run during the stop sequence (spec-007 §6), whose order is: stop accepting
 * connections → run the hooks, in registration order (close the event streams, terminate the
 * `wingfoil` and git child processes) → wait for the open requests, at most `drainTimeoutMs`, then
 * cut them → print the stop line, exit 0. A hook must end what keeps a request open; it must not
 * wait for requests itself. Every hook runs even if another fails; the first failure then ends the
 * process with exit 70. Hooks live for the process (module scope); the returned function removes
 * the hook.
 */
export function onStop(hook: StopHook): () => void {
  stopHooks.push(hook);
  return () => {
    const index = stopHooks.indexOf(hook);
    if (index >= 0) stopHooks.splice(index, 1);
  };
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
  // spec-007 §3.2: the local state is read before listening; no project is read here.
  const state = await openFileStateStore({ dir: io.stateDir });
  const holder = await findProjectContaining(io.stateDir, state.projects());
  if (holder) {
    io.stderr(message('launcher.stateDirInsideProject', { stateDir: io.stateDir, path: holder.path }));
    return EXIT.stateDirInsideProject;
  }
  for (const warning of state.warnings()) logger.warn({ warning }, 'local state');
  // Drawn before the application is built: the session guards (task-003) need it.
  const token = drawToken();
  const processes = io.processes ?? new LocalProcessRunner();
  // Children lead their own process group (no terminal signal reaches them): whatever ends the
  // process, the ones still running are killed with it (spec-007 §6).
  io.onExit?.(() => processes.killAllNow());
  // The port is known once listening; until then the guards refuse every request.
  const listening: { port?: number } = {};
  // Change notifications (adr-002 event bus) and the project snapshots (task-010): the read routes
  // (task-012) and the project list (task-008) open projects in `snapshots`; no project is read here.
  const bus = new InProcessEventBus();
  const snapshots = new Snapshots({ runner: processes, bus, logger });
  const streams: { events?: EventStreams } = {};
  // One write lock for the server: the clones (task-008), the governed writes (task-032) and the
  // git routes (task-033).
  const writeLock = new InProcessWriteLock();
  // The project list (task-008).
  // task-034: the auto-push of the governed writes and the auto-sync scheduler (spec-010 §6), on the
  // routes' transport (its plan and redaction) and the one write lock.
  const transport = new GitTransport({ snapshots, writeLock });
  const autoPush = new AutoPush({ store: state, transport, logger });
  const scheduler = new SyncScheduler({
    store: state,
    work: new AutoSync({ store: state, snapshots, transport, logger }),
    lock: writeLock,
    bus,
    logger,
  });
  const projects = new ProjectList({
    store: state,
    snapshots,
    bus,
    runner: processes,
    writeLock,
    stateDir: io.stateDir,
    logger,
  });
  const app = await buildApp({
    staticDir: io.staticDir,
    logger,
    security: { authentication: createTokenAuthentication(token), port: () => listening.port },
    register: (routes) => {
      // task-012: the identity of the role-view PUT and of the header is the watched one (one source).
      const identity = createSnapshotIdentitySource(snapshots);
      registerServerRoute(routes, { store: state, version: io.version });
      registerProjectRoutes(routes, { store: state, snapshots });
      registerRoleViewRoute(routes, { store: state, identity });
      streams.events = registerEventStream(routes, { bus });
      registerProjectListRoutes(routes, { projects });
      // task-030: the UI settings (spec-004 §3, spec-006 §2).
      registerSettingsRoutes(routes, { store: state, bus });
      // task-032: the governed writes on an element (spec-004 §3–§6).
      registerElementWriteRoutes(routes, { store: state, snapshots, writeLock, bus, push: autoPush });
      // task-033: the git routes (spec-010 §4–§5, §8).
      registerGitRoutes(routes, { store: state, snapshots, writeLock });
    },
  });
  // Stop sequence (spec-007 §6): close the event streams and the watchers, then terminate the CLI
  // and git children (adr-001 D5); registered once the application exists, removed again if the
  // listen fails.
  // task-034: no tick starts once stopping; a running automatic process is terminated below.
  const offScheduler = onStop(() => {
    scheduler.stop();
    return Promise.resolve();
  });
  const offStreams = onStop(async () => {
    projects.stop();
    streams.events?.close();
    await snapshots.closeAll();
  });
  const offProcesses = onStop(() => processes.terminateAll());
  let listeners;
  try {
    listeners = await listenLoopback(app.routing, {
      port: command.port,
      onError: (error) => logger.error({ err: error }, 'listener error'),
    });
  } catch (error) {
    offScheduler();
    offStreams();
    offProcesses();
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
  listening.port = listeners.port;
  // Availability changes and another console's list are noticed without a page asking (file reads only).
  projects.start();
  // task-034: the first tick after one fetch interval (spec-010 §6).
  scheduler.start();
  // Signals are handled before the URL is printed: a stop sent right after it is never lost.
  let stopping = false;
  io.onSignal(() => {
    if (stopping) {
      // Forced: the SIGKILL escalation timers would die with the process — kill the children now.
      processes.killAllNow();
      io.exit(EXIT.forced);
      return;
    }
    stopping = true;
    void (async () => {
      try {
        listeners.stopAccepting();
        // Every hook runs even when one fails (a failed stream close must not orphan CLI children).
        const failures: unknown[] = [];
        for (const hook of [...stopHooks]) {
          try {
            await hook();
          } catch (error) {
            failures.push(error);
          }
        }
        await listeners.drain(io.drainTimeoutMs ?? 5_000);
        await app.close();
        if (failures.length > 0) throw failures[0];
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
