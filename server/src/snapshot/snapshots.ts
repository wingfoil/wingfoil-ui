/**
 * The snapshots of the open projects, by opaque project id (adr-001 D6, REQ-STATE-02,
 * REQ-INT-09): each project's {@link ProjectSnapshot}, its repository watcher (file watching,
 * events debounced) and its periodic check (the fallback; git only, never the CLI). A state change
 * is published on the event bus as `repo {pid, state}` (spec-004 §6).
 *
 * Who opens what: the project read routes (task-012) and the project list (task-008) call
 * {@link Snapshots.open} with the project's id and root, {@link Snapshots.close} when a project is
 * removed from the list; the launcher calls {@link Snapshots.closeAll} in the stop sequence.
 */
import { realpath } from 'node:fs/promises';
import { WingfoilCli, type CliLogger } from '../cli/adapter.js';
import { discoverCli } from '../cli/discovery.js';
import { VersionCache } from '../cli/version.js';
import type { EventBus } from '../events/bus.js';
import { GitReads, resolveGit, type GitReadError } from '../git/git.js';
import { redactLocalPaths } from '../git/redact.js';
import { SyncStatus } from '../git/sync-status.js';
import type { ProcessRunner } from '../process/runner.js';
import type { ReadFs } from '../reads/confine.js';
import { ProjectSnapshot } from './snapshot.js';
import { globalConfigFiles, watchRepository, type RepositoryWatcher, type WatchRepository } from './watcher.js';

/** Interval of the periodic check (fallback of file watching), in milliseconds. */
export const DEFAULT_FALLBACK_MS = 10_000;

/** Interval of the periodic check once file watching is degraded (a watch failed). */
export const DEGRADED_FALLBACK_MS = 2_000;

/** Wait after a file event before the check: a burst of events (a commit, a save) is one check. */
export const DEFAULT_DEBOUNCE_MS = 100;

/** Where the registry logs (pino's `Logger` fits). */
export interface SnapshotLogger extends CliLogger {
  warn(object: object, message: string): void;
}

/** Options of {@link Snapshots}. */
export interface SnapshotsOptions {
  /** Runner of every `wingfoil` and git process (the launcher's, terminated at stop). */
  runner: ProcessRunner;
  /** Where `repo` events go. */
  bus: EventBus;
  /** Environment of the CLI and git processes and of the discovery (default: the server's). */
  env?: NodeJS.ProcessEnv;
  logger?: SnapshotLogger;
  /** Watch the files (default `true`). */
  watch?: boolean;
  /** Periodic check interval; `0` turns it off (default {@link DEFAULT_FALLBACK_MS}). */
  fallbackMs?: number;
  /** Debounce of file events (default {@link DEFAULT_DEBOUNCE_MS}). */
  debounceMs?: number;
  /** The watcher adapter (default: `fs.watch`). */
  watchRepository?: WatchRepository;
  /** Read port of the direct reads (default: the local file system). */
  fs?: ReadFs;
  /** The detected CLI versions, one cache for the server (default: a new one). */
  versions?: VersionCache;
}

interface Entry {
  root: string;
  snapshot: ProjectSnapshot;
  watcher: RepositoryWatcher | undefined;
  timers: Set<NodeJS.Timeout>;
}

/** The registry. */
export class Snapshots {
  private readonly entries = new Map<string, Entry>();
  private readonly opening = new Map<string, Promise<ProjectSnapshot>>();
  private git: Promise<string> | undefined;
  /** The server-wide version cache (adr-001 D3): one `--version` per CLI resolution. */
  readonly versions: VersionCache;
  /** The sync status of the open projects (spec-010 §3, task-033): dropped when a project closes. */
  readonly sync: SyncStatus;

  constructor(private readonly options: SnapshotsOptions) {
    this.versions = options.versions ?? new VersionCache();
    this.sync = new SyncStatus({ bus: options.bus, stateOf: (pid) => this.get(pid)?.current()?.key });
  }

  /** The open snapshots, in opening order (the scheduler's scope, spec-010 §6, RP-18). */
  openProjects(): { pid: string; snapshot: ProjectSnapshot }[] {
    return [...this.entries].map(([pid, entry]) => ({ pid, snapshot: entry.snapshot }));
  }

  /** The snapshot of `pid`, if open. */
  get(pid: string): ProjectSnapshot | undefined {
    return this.entries.get(pid)?.snapshot;
  }

  /**
   * The snapshot of project `pid` at `root` (realpath of its working directory), opened and
   * watched on the first call: one `git rev-parse` for the layout, no CLI process, no state read
   * yet (the first view checks). Opening an open id again returns it; with another root, the old
   * one is closed first.
   */
  async open(pid: string, root: string): Promise<ProjectSnapshot> {
    const existing = this.entries.get(pid);
    if (existing && existing.root === root) return existing.snapshot;
    const pending = this.opening.get(pid);
    if (pending) return pending;
    const opening = (async () => {
      if (existing) await this.close(pid);
      return this.start(pid, root);
    })();
    this.opening.set(pid, opening);
    try {
      return await opening;
    } finally {
      this.opening.delete(pid);
    }
  }

  /** Stop watching `pid` and drop its cache (the project left the list). */
  async close(pid: string): Promise<void> {
    // Closed while being opened: wait for the open, then close what it registered.
    const pending = this.opening.get(pid);
    if (!this.entries.has(pid) && pending) await pending.catch(() => undefined);
    const entry = this.entries.get(pid);
    if (!entry) return;
    this.entries.delete(pid);
    this.sync.forget(pid);
    entry.watcher?.close();
    for (const timer of entry.timers) clearTimeout(timer);
    entry.timers.clear();
  }

  /** Close every snapshot (stop sequence). */
  async closeAll(): Promise<void> {
    await Promise.all([...this.opening.values()].map((p) => p.catch(() => undefined)));
    for (const pid of [...this.entries.keys()]) await this.close(pid);
  }

  private resolveGit(env: NodeJS.ProcessEnv): Promise<string> {
    if (!this.git) {
      const resolving = resolveGit(env);
      this.git = resolving;
      // Not found now (a PATH being fixed): looked for again at the next open.
      resolving.catch(() => {
        if (this.git === resolving) this.git = undefined;
      });
    }
    return this.git;
  }

  private async start(pid: string, root: string): Promise<ProjectSnapshot> {
    const { runner, bus, logger } = this.options;
    const env = this.options.env ?? process.env;
    const git = new GitReads({ git: await this.resolveGit(env), runner, cwd: root, env });
    const layout = await git.layout();
    // The write lock's key (D32-2): one per repository, whatever folder of it a project is.
    const commonDir = await realpath(layout.commonDir).catch(() => layout.commonDir);
    const snapshot: ProjectSnapshot = new ProjectSnapshot({
      pid,
      root,
      prefix: layout.prefix,
      git,
      discover: () => discoverCli(root, { env }),
      cli: (resolved): WingfoilCli =>
        new WingfoilCli({
          cli: resolved,
          runner,
          env,
          // D33-5 (bug-012): the project's and the repository's folders out of every refusal message.
          redact: (text: string): string =>
            redactLocalPaths(text, {
              ...snapshot.localRoots,
              ...(resolved.packageDir !== undefined ? { wingfoil: [resolved.packageDir] } : {}),
            }),
          ...(logger ? { logger } : {}),
        }),
      ...(this.options.fs ? { fs: this.options.fs } : {}),
      onChange: (state) => bus.publish({ event: 'repo', data: { pid, state: state.key } }),
      versions: this.versions,
      commonDir,
      gitDir: layout.gitDir,
      ...(logger ? { logger } : {}),
    });
    const entry: Entry = { root, snapshot, watcher: undefined, timers: new Set() };
    this.entries.set(pid, entry);

    const live = (): boolean => this.entries.get(pid) === entry;
    const check = (): void => {
      // Never before the first view: an unread project has nothing to refresh.
      if (!live() || !snapshot.current()) return;
      snapshot.check().catch((error: unknown) => {
        // The kind and the exit only: git's message may quote paths or configuration.
        const e = error as Partial<GitReadError>;
        logger?.warn({ pid, kind: e.name, ended: e.ended, exitCode: e.exitCode }, 'repository check failed');
      });
    };
    const debounced = (fn: () => void): (() => void) => {
      let timer: NodeJS.Timeout | undefined;
      return () => {
        if (timer || !live()) return;
        timer = setTimeout(() => {
          entry.timers.delete(timer!);
          timer = undefined;
          fn();
        }, this.options.debounceMs ?? DEFAULT_DEBOUNCE_MS);
        timer.unref();
        entry.timers.add(timer);
      };
    };
    const fallbackMs = this.options.fallbackMs ?? DEFAULT_FALLBACK_MS;
    let interval = fallbackMs;
    let fallback: NodeJS.Timeout | undefined;
    const scheduleFallback = (): void => {
      if (fallback) {
        clearTimeout(fallback);
        entry.timers.delete(fallback);
      }
      if (interval <= 0 || !live()) return;
      const timer = setTimeout(() => {
        entry.timers.delete(timer);
        fallback = undefined;
        check();
        scheduleFallback();
      }, interval);
      timer.unref();
      fallback = timer;
      entry.timers.add(timer);
    };
    if (this.options.watch ?? true) {
      entry.watcher = (this.options.watchRepository ?? watchRepository)(
        { root, gitDir: layout.gitDir, commonDir: layout.commonDir, globalConfig: globalConfigFiles(env) },
        {
          repo: debounced(check),
          cli: debounced(() => {
            if (live()) snapshot.cliChanged();
          }),
          degraded: (reason) => {
            logger?.warn({ pid, reason }, 'file watching degraded: checking periodically');
            // File watching misses changes there: check often enough for the 5 s budget (REQ-PERF-03).
            if (interval <= 0 || interval > DEGRADED_FALLBACK_MS) {
              interval = DEGRADED_FALLBACK_MS;
              scheduleFallback();
            }
          },
        },
      );
    }
    scheduleFallback();
    // Watching before the first view: an edit made right after the open is not missed.
    await entry.watcher?.started;
    return snapshot;
  }
}
