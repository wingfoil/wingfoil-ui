/**
 * The auto-sync scheduler of spec-010 §6 (REQ-PERF-07, REQ-STATE-09; task-034): one timer per
 * server, ticking every `fetchIntervalSeconds` (spec-006 §2, RP-19).
 *
 * | Rule | Source |
 * |------|--------|
 * | each tick re-reads the settings (another console's `PUT` is seen there); an interval changed there re-arms the timer, without an extra tick | spec-006 §2, task-030 D30-3 |
 * | a change of `autoFetch` or `fetchIntervalSeconds` announced by this console's `settings` event re-arms the timer: one tick at once, then every interval; a re-arm during a tick runs right after it | RP-40, C-07.3 |
 * | `autoFetch` off → no work (read again before each group, so turning it off stops a running tick) | Y-02.3, C-07.3 |
 * | a tick that falls while the previous one runs is skipped | RP-40 |
 * | one group (repository) at a time, inside its write lock; a group whose lock is busy is skipped, never waited for | RP-40, RP-41, D34-4 |
 *
 * What a group's sync does is the work port's ({@link SyncWork}; `AutoSync`). The scheduler starts no
 * process itself.
 */
import type { UiSettings } from '@wingfoil-ui/contracts';
import type { EventBus } from '../events/bus.js';

/** The listed projects of one repository (one write-lock key), in list order. */
export interface SyncGroup {
  /** The write-lock key (`ProjectSnapshot.lockKey`). */
  key: string;
  pids: string[];
}

/** The work of a tick. */
export interface SyncWork {
  /** The groups to sync now. */
  groups(): SyncGroup[];
  /** Sync `group`; called inside its write lock. */
  sync(group: SyncGroup): Promise<void>;
}

/** The settings source (the `StateStore` fits). */
export interface SchedulerSettings {
  /** Re-read the local state (another console's change). */
  reload(): Promise<unknown>;
  /** The settings as last read. */
  settings(): UiSettings;
}

/** The write lock, with the busy test of a skip (the `InProcessWriteLock` fits). */
export interface SchedulerLock {
  isBusy(key: string): boolean;
  run<T>(key: string, task: () => Promise<T>): Promise<T>;
}

/** Where the scheduler logs: kinds only. */
export interface SchedulerLogger {
  warn(object: object, message: string): void;
}

/** Options of {@link SyncScheduler}. */
export interface SyncSchedulerOptions {
  store: SchedulerSettings;
  work: SyncWork;
  lock: SchedulerLock;
  /** The server's bus: its `settings` events re-arm the timer. */
  bus: EventBus;
  logger?: SchedulerLogger;
}

/** The timer's inputs. */
interface Armed {
  autoFetch: boolean;
  interval: number;
}

/** The scheduler. */
export class SyncScheduler {
  private armed: Armed | undefined;
  private timer: NodeJS.Timeout | undefined;
  private ticking = false;
  /** A re-arm asked for its immediate tick while a tick was running. */
  private rearmed = false;
  private stopped = false;
  private unsubscribe: (() => void) | undefined;

  constructor(private readonly options: SyncSchedulerOptions) {}

  /** Arm the timer (the first tick after one interval) and listen to settings changes. */
  start(): void {
    if (this.stopped || this.armed) return;
    this.armed = this.inputs();
    this.arm();
    this.unsubscribe = this.options.bus.subscribe((event) => {
      if (event.event === 'settings') this.settingsChanged();
    });
  }

  /** No further tick; a running one starts no further group. Its process is the stop sequence's. */
  stop(): void {
    this.stopped = true;
    clearInterval(this.timer);
    this.timer = undefined;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  /** One tick (also called by the timer); resolves when it ended or was skipped. */
  async tick(): Promise<void> {
    if (this.stopped || this.ticking) return;
    this.ticking = true;
    try {
      await this.run();
    } finally {
      this.ticking = false;
      if (this.rearmed && !this.stopped) {
        this.rearmed = false;
        void this.tick();
      }
    }
  }

  private async run(): Promise<void> {
    const { store, work, lock, logger } = this.options;
    try {
      await store.reload();
    } catch (error) {
      // The settings as last read still apply.
      logger?.warn({ kind: (error as Error).name }, 'auto-sync: the local state could not be read');
    }
    const now = this.inputs();
    if (this.armed && now.interval !== this.armed.interval) {
      // Another console changed the interval: the timer follows, this tick goes on.
      this.armed = now;
      this.arm();
    } else if (this.armed) {
      this.armed = now;
    }
    for (const group of work.groups()) {
      if (this.stopped || !store.settings().autoFetch) return;
      // Checked and taken in one synchronous step: no write can slip in between.
      if (lock.isBusy(group.key)) continue;
      try {
        await lock.run(group.key, () => work.sync(group));
      } catch (error) {
        logger?.warn({ kind: (error as Error).name }, 'auto-sync: a repository failed');
      }
    }
  }

  private settingsChanged(): void {
    if (this.stopped) return;
    const now = this.inputs();
    if (this.armed && now.autoFetch === this.armed.autoFetch && now.interval === this.armed.interval) return;
    this.armed = now;
    this.arm();
    if (this.ticking) this.rearmed = true;
    else void this.tick();
  }

  private inputs(): Armed {
    const settings = this.options.store.settings();
    return { autoFetch: settings.autoFetch, interval: settings.fetchIntervalSeconds };
  }

  private arm(): void {
    clearInterval(this.timer);
    const timer = setInterval(() => void this.tick(), (this.armed?.interval ?? 60) * 1000);
    timer.unref();
    this.timer = timer;
  }
}
