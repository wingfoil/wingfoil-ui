/**
 * The per-project write lock port (adr-001 D5, adr-002) and its in-process adapter: one governed or
 * git write at a time per project, queued in arrival order; two projects write in parallel. A write
 * route holds the lock from its fresh preconditions (spec-004 §4 rows 7–9) to the end of its CLI or
 * git process, so no check goes stale before the write.
 */

/** The port. */
export interface WriteLock {
  /** Run `task` once every earlier write of the project `key` has ended; resolves with its result. */
  run<T>(key: string, task: () => Promise<T>): Promise<T>;
}

/** The in-process queue. */
export class InProcessWriteLock implements WriteLock {
  /** Last write queued per project. */
  private readonly tails = new Map<string, Promise<void>>();
  /** Writes running or queued per project. */
  private readonly queued = new Map<string, number>();

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    this.queued.set(key, (this.queued.get(key) ?? 0) + 1);
    const current = previous.then(task);
    // Released before the caller sees the outcome; the queue goes on whatever it is (a failure is
    // the caller's).
    const release = (): void => {
      const left = (this.queued.get(key) ?? 1) - 1;
      if (left > 0) {
        this.queued.set(key, left);
        return;
      }
      this.queued.delete(key);
      this.tails.delete(key);
    };
    this.tails.set(key, current.then(release, release));
    return current;
  }

  /** Whether a write of the project `key` is running or queued. */
  isBusy(key: string): boolean {
    return this.queued.has(key);
  }
}
