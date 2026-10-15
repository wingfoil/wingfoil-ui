// spec-010 §6 (REQ-PERF-07, REQ-STATE-09, RP-18, RP-19, RP-40, RP-41; task-034) — the scheduler's
// timer and rules over a recording work port: one timer of `fetchIntervalSeconds`, the settings
// read at each tick, a re-arm with one immediate tick only on an `autoFetch` or
// `fetchIntervalSeconds` change (C-07.3), an overlapping tick skipped, a group whose write lock is
// busy skipped (never waited for), one group at a time, `autoFetch` off → no work (Y-02.3).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UiSettings } from '@wingfoil-ui/contracts';
import { InProcessEventBus } from '../../../server/src/events/bus.js';
import { InProcessWriteLock } from '../../../server/src/process/write-lock.js';
import { DEFAULT_SETTINGS } from '../../../server/src/state/settings.js';
import { SyncScheduler, type SyncGroup } from '../../../server/src/sync/scheduler.js';

/** A settings source: `stored` is what another console wrote (seen at `reload`), `current` what this one sees. */
class Settings {
  stored: UiSettings = { ...DEFAULT_SETTINGS };
  current: UiSettings = { ...DEFAULT_SETTINGS };
  reloads = 0;
  reload(): Promise<unknown> {
    this.reloads += 1;
    this.current = { ...this.stored };
    return Promise.resolve([]);
  }
  settings(): UiSettings {
    return this.current;
  }
  /** A `PUT /api/settings` of this console. */
  put(change: Partial<UiSettings>): void {
    this.stored = { ...this.stored, ...change };
    this.current = { ...this.stored };
  }
}

/** The work port: records each sync, which may be held until `release`. */
class Work {
  list: SyncGroup[] = [{ key: 'repo-a', pids: ['p_a'] }];
  synced: string[] = [];
  active = 0;
  maxActive = 0;
  hold = false;
  private waiting: (() => void)[] = [];
  groups(): SyncGroup[] {
    return this.list;
  }
  async sync(group: SyncGroup): Promise<void> {
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    this.synced.push(group.key);
    if (this.hold) await new Promise<void>((r) => this.waiting.push(r));
    this.active -= 1;
  }
  release(): void {
    this.hold = false;
    for (const go of this.waiting.splice(0)) go();
  }
}

let settings: Settings;
let work: Work;
let bus: InProcessEventBus;
let lock: InProcessWriteLock;
let scheduler: SyncScheduler;

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

beforeEach(() => {
  vi.useFakeTimers();
  settings = new Settings();
  work = new Work();
  bus = new InProcessEventBus();
  lock = new InProcessWriteLock();
  scheduler = new SyncScheduler({ store: settings, work, lock, bus });
});

afterEach(() => {
  scheduler.stop();
  vi.useRealTimers();
});

/** Advance the clock by `seconds` and let the ticks run. */
async function advance(seconds: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(seconds * 1000);
  await flush();
}

describe('the timer (spec-010 §6, RP-19)', () => {
  it('ticks every fetchIntervalSeconds (default 60 s), no tick at start', async () => {
    scheduler.start();
    await advance(59);
    expect(work.synced).toEqual([]);
    await advance(1);
    expect(work.synced).toEqual(['repo-a']);
    await advance(60);
    expect(work.synced).toEqual(['repo-a', 'repo-a']);
  });

  it('reads the settings at each tick: another console’s interval re-arms the timer, without an extra tick', async () => {
    scheduler.start();
    settings.stored = { ...settings.stored, fetchIntervalSeconds: 15 };
    await advance(60);
    expect(work.synced.length).toBe(1);
    expect(settings.reloads).toBe(1);
    await advance(15);
    expect(work.synced.length).toBe(2);
  });

  it('stop(): no tick any more', async () => {
    scheduler.start();
    scheduler.stop();
    await advance(600);
    expect(work.synced).toEqual([]);
  });
});

describe('settings changes (RP-40, C-07.3)', () => {
  it('an autoFetch or fetchIntervalSeconds change re-arms: one tick at once, then every new interval', async () => {
    scheduler.start();
    await advance(30);
    settings.put({ fetchIntervalSeconds: 15 });
    bus.publish({ event: 'settings', data: {} });
    await flush();
    expect(work.synced.length).toBe(1);
    await advance(15);
    expect(work.synced.length).toBe(2);
    await advance(15);
    expect(work.synced.length).toBe(3);
  });

  it.each<Partial<UiSettings>>([{ autoUpdate: true }, { autoPush: true }, { theme: 'dark' }, { actionLogCap: 100 }])(
    'another change (%j) does not re-arm: read at the next tick',
    async (change) => {
      scheduler.start();
      await advance(30);
      settings.put(change);
      bus.publish({ event: 'settings', data: {} });
      await flush();
      expect(work.synced).toEqual([]);
      await advance(30);
      expect(work.synced.length).toBe(1);
    },
  );

  it('autoFetch off → the immediate tick and every later tick sync nothing (Y-02.3, C-07.3)', async () => {
    scheduler.start();
    settings.put({ autoFetch: false });
    bus.publish({ event: 'settings', data: {} });
    await advance(600);
    expect(work.synced).toEqual([]);
  });

  it('autoFetch turned off during a tick: the groups left are not synced', async () => {
    work.list = [
      { key: 'repo-a', pids: ['p_a'] },
      { key: 'repo-b', pids: ['p_b'] },
    ];
    work.hold = true;
    scheduler.start();
    await advance(60);
    expect(work.synced).toEqual(['repo-a']);
    settings.put({ autoFetch: false });
    bus.publish({ event: 'settings', data: {} });
    work.release();
    await flush();
    expect(work.synced).toEqual(['repo-a']);
  });

  it('a re-arm while a tick runs is not lost: its tick runs once the running one ends', async () => {
    work.hold = true;
    scheduler.start();
    await advance(60);
    expect(work.synced.length).toBe(1);
    settings.put({ fetchIntervalSeconds: 3600 });
    bus.publish({ event: 'settings', data: {} });
    await flush();
    expect(work.synced.length).toBe(1);
    work.release();
    await flush();
    expect(work.synced.length).toBe(2);
  });
});

describe('the rules of a tick (spec-010 §6, RP-40, RP-41)', () => {
  it('an overlapping tick is skipped (not queued)', async () => {
    work.hold = true;
    scheduler.start();
    await advance(60);
    await advance(60);
    await advance(60);
    expect(work.synced.length).toBe(1);
    // The skipped ticks did not even read the settings.
    expect(settings.reloads).toBe(1);
    work.release();
    await flush();
    expect(work.synced.length).toBe(1);
    await advance(60);
    expect(work.synced.length).toBe(2);
  });

  it('one group at a time, each inside its write lock', async () => {
    work.list = [
      { key: 'repo-a', pids: ['p_a'] },
      { key: 'repo-b', pids: ['p_b'] },
      { key: 'repo-c', pids: ['p_c'] },
    ];
    const busy: boolean[] = [];
    const sync = work.sync.bind(work);
    work.sync = (group) => {
      busy.push(lock.isBusy(group.key));
      return sync(group);
    };
    await scheduler.tick();
    expect(work.synced).toEqual(['repo-a', 'repo-b', 'repo-c']);
    expect(work.maxActive).toBe(1);
    expect(busy).toEqual([true, true, true]);
  });

  it('a group whose write lock is busy is skipped, never waited for (RP-41)', async () => {
    work.list = [
      { key: 'repo-a', pids: ['p_a'] },
      { key: 'repo-b', pids: ['p_b'] },
    ];
    let releaseWrite!: () => void;
    const write = lock.run('repo-a', () => new Promise<void>((r) => (releaseWrite = r)));
    await scheduler.tick();
    expect(work.synced).toEqual(['repo-b']);
    releaseWrite();
    await write;
  });

  it('a failing group does not stop the others', async () => {
    work.list = [
      { key: 'repo-a', pids: ['p_a'] },
      { key: 'repo-b', pids: ['p_b'] },
    ];
    const sync = work.sync.bind(work);
    work.sync = (group) => (group.key === 'repo-a' ? Promise.reject(new Error('boom')) : sync(group));
    await scheduler.tick();
    expect(work.synced).toEqual(['repo-b']);
  });
});

describe('review round 1 (R5, R9)', () => {
  it('R9: a failing work port (groups() throws) never rejects a tick; it is logged by kind', async () => {
    const lines: unknown[] = [];
    const failing = new SyncScheduler({
      store: settings,
      work: {
        groups: () => {
          throw new Error('marker-task-034-r9');
        },
        sync: () => Promise.resolve(),
      },
      lock,
      bus,
      logger: { warn: (o) => lines.push(o) },
    });
    await expect(failing.tick()).resolves.toBeUndefined();
    expect(lines).toEqual([expect.objectContaining({ kind: 'Error' })]);
    expect(JSON.stringify(lines)).not.toContain('marker-task-034-r9');
  });

  it('R5: stop() tells the work port to stop', () => {
    let stopped = 0;
    const s = new SyncScheduler({
      store: settings,
      work: { groups: () => [], sync: () => Promise.resolve(), stop: () => (stopped += 1) },
      lock,
      bus,
    });
    s.stop();
    expect(stopped).toBe(1);
  });
});
