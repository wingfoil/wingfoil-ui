// adr-001 D5, adr-002 — per-project write lock: one governed or git write at a time per project.
import { describe, expect, it } from 'vitest';
import { InProcessWriteLock } from '../../../server/src/process/write-lock.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

const tick = () => new Promise((r) => setTimeout(r, 10));

describe('InProcessWriteLock', () => {
  it('runs the writes of one project one at a time, in arrival order', async () => {
    const lock = new InProcessWriteLock();
    const log: string[] = [];
    const first = deferred();
    const a = lock.run('p1', async () => {
      log.push('a:start');
      await first.promise;
      log.push('a:end');
      return 'a';
    });
    const b = lock.run('p1', async () => {
      log.push('b:start');
      return 'b';
    });
    await tick();
    expect(log).toEqual(['a:start']);
    expect(lock.isBusy('p1')).toBe(true);
    first.resolve();
    expect(await a).toBe('a');
    expect(await b).toBe('b');
    expect(log).toEqual(['a:start', 'a:end', 'b:start']);
    expect(lock.isBusy('p1')).toBe(false);
  });

  it('lets two projects write in parallel', async () => {
    const lock = new InProcessWriteLock();
    const log: string[] = [];
    const hold = deferred();
    const a = lock.run('p1', async () => {
      log.push('p1');
      await hold.promise;
    });
    const b = lock.run('p2', async () => {
      log.push('p2');
    });
    await b;
    expect(log).toEqual(['p1', 'p2']);
    hold.resolve();
    await a;
  });

  it('releases the lock when a write fails', async () => {
    const lock = new InProcessWriteLock();
    await expect(
      lock.run('p1', async () => {
        throw new Error('refused');
      }),
    ).rejects.toThrow('refused');
    expect(await lock.run('p1', async () => 'next')).toBe('next');
    expect(lock.isBusy('p1')).toBe(false);
  });
});
