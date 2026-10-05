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
import { WingfoilCli, type CliLogger } from '../cli/adapter.js';
import { discoverCli } from '../cli/discovery.js';
import type { EventBus } from '../events/bus.js';
import { GitReads, resolveGit } from '../git/git.js';
import type { ProcessRunner } from '../process/runner.js';
import type { ReadFs } from '../reads/confine.js';
import { ProjectSnapshot } from './snapshot.js';
import { globalConfigFiles, watchRepository, type RepositoryWatcher, type WatchRepository } from './watcher.js';

/** Interval of the periodic check (fallback of file watching), in milliseconds. */
export const DEFAULT_FALLBACK_MS = 10_000;

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

  constructor(private readonly options: SnapshotsOptions) {}

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
    const entry = this.entries.get(pid);
    if (!entry) return;
    this.entries.delete(pid);
    entry.watcher?.close();
    for (const timer of entry.timers) clearTimeout(timer);
    entry.timers.clear();
  }

  /** Close every snapshot (stop sequence). */
  async closeAll(): Promise<void> {
    await Promise.all([...this.opening.values()].map((p) => p.catch(() => undefined)));
    for (const pid of [...this.entries.keys()]) await this.close(pid);
  }

  private async start(pid: string, root: string): Promise<ProjectSnapshot> {
    const { runner, bus, logger } = this.options;
    const env = this.options.env ?? process.env;
    this.git ??= resolveGit(env);
    const git = new GitReads({ git: await this.git, runner, cwd: root, env });
    const layout = await git.layout();
    const snapshot = new ProjectSnapshot({
      pid,
      root,
      prefix: layout.prefix,
      git,
      discover: () => discoverCli(root, { env }),
      cli: (resolved) => new WingfoilCli({ cli: resolved, runner, env, ...(logger ? { logger } : {}) }),
      ...(this.options.fs ? { fs: this.options.fs } : {}),
      onChange: (state) => bus.publish({ event: 'repo', data: { pid, state: state.key } }),
    });
    const entry: Entry = { root, snapshot, watcher: undefined, timers: new Set() };
    this.entries.set(pid, entry);

    const live = (): boolean => this.entries.get(pid) === entry;
    const check = (): void => {
      // Never before the first view: an unread project has nothing to refresh.
      if (!live() || !snapshot.current()) return;
      snapshot.check().catch((error: unknown) => {
        logger?.warn({ pid, reason: (error as Error).message }, 'repository check failed');
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
    if (this.options.watch ?? true) {
      entry.watcher = (this.options.watchRepository ?? watchRepository)(
        { root, gitDir: layout.gitDir, commonDir: layout.commonDir, globalConfig: globalConfigFiles(env) },
        {
          repo: debounced(check),
          cli: debounced(() => {
            if (live()) snapshot.cliChanged();
          }),
        },
      );
    }
    const fallbackMs = this.options.fallbackMs ?? DEFAULT_FALLBACK_MS;
    if (fallbackMs > 0) {
      const tick = (): void => {
        if (!live()) return;
        check();
        const timer = setTimeout(() => {
          entry.timers.delete(timer);
          tick();
        }, fallbackMs);
        timer.unref();
        entry.timers.add(timer);
      };
      const first = setTimeout(() => {
        entry.timers.delete(first);
        tick();
      }, fallbackMs);
      first.unref();
      entry.timers.add(first);
    }
    return snapshot;
  }
}
