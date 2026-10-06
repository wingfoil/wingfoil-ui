// @vitest-environment jsdom
// spec-004 §6, REQ-INT-09: one event stream per page; `repo` invalidates that project's queries
// (also with an unchanged state), `projects` the project list, a reconnect everything; a closed
// stream is re-created with backoff; a lost session stops it. No polling.
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  currentEventStream,
  onServerEvent,
  startEventStream,
  stopEventStream,
  useReachability,
  useServerEvent,
  UNREACHABLE_AFTER_MS,
} from '../../../web/src/api/events.js';
import { queryKeys } from '../../../web/src/api/query-keys.js';
import { markSessionLost, resetSession } from '../../../web/src/session/session.js';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  readyState = 0;
  readonly listeners = new Map<string, ((e: MessageEvent) => void)[]>();
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(
    readonly url: string,
    readonly init?: EventSourceInit,
  ) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, l: (e: MessageEvent) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), l]);
  }
  close(): void {
    this.closed = true;
    this.readyState = 2;
  }
  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }
  fail(readyState: 0 | 2): void {
    this.readyState = readyState;
    this.onerror?.();
  }
  emit(type: string, data: string): void {
    for (const l of this.listeners.get(type) ?? []) l(new MessageEvent(type, { data }));
  }
}

let client: QueryClient;
const latest = (): FakeEventSource => FakeEventSource.instances.at(-1)!;

beforeEach(() => {
  vi.useFakeTimers();
  resetSession();
  FakeEventSource.instances = [];
  client = new QueryClient();
  for (const key of [
    queryKeys.server(),
    queryKeys.projects(),
    queryKeys.project('p_a', 'header'),
    queryKeys.project('p_b', 'header'),
  ]) {
    client.setQueryData(key, { cached: true });
  }
});

afterEach(() => {
  stopEventStream();
  vi.useRealTimers();
});

const stale = (): string[] =>
  client
    .getQueryCache()
    .getAll()
    .filter((q) => q.state.isInvalidated)
    .map((q) => JSON.stringify(q.queryKey))
    .sort();

function start(probe = vi.fn(async () => undefined), unreachableAfterMs?: number) {
  return startEventStream(client, {
    EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
    probe,
    ...(unreachableAfterMs !== undefined ? { unreachableAfterMs } : {}),
  });
}

it('opens one EventSource on /api/events per page', () => {
  const a = start();
  const b = start();
  expect(a).toBe(b);
  expect(FakeEventSource.instances).toHaveLength(1);
  expect(latest().url).toBe('/api/events');
  expect(latest().init).toEqual({ withCredentials: false });
});

it('invalidates only the project of a repo event, also when the state did not move', () => {
  start();
  latest().open();
  latest().emit('repo', JSON.stringify({ pid: 'p_a', state: 's1' }));
  expect(stale()).toEqual([JSON.stringify(['p', 'p_a', 'header'])]);
  client.setQueryData(queryKeys.project('p_a', 'header'), { cached: true });
  latest().emit('repo', JSON.stringify({ pid: 'p_a', state: 's1' }));
  expect(stale()).toEqual([JSON.stringify(['p', 'p_a', 'header'])]);
});

it('invalidates the project list on a projects event', () => {
  start();
  latest().open();
  latest().emit('projects', '{}');
  expect(stale()).toEqual([JSON.stringify(['projects'])]);
});

it('ignores an event whose data is not JSON', () => {
  start();
  latest().emit('repo', 'not json');
  expect(stale()).toEqual([]);
});

it('hands events to subscribers until they unsubscribe', () => {
  const stream = start();
  const handler = vi.fn();
  const off = stream.on('write', handler);
  latest().emit('write', JSON.stringify({ pid: 'p_a', commit: 'abc' }));
  off();
  latest().emit('write', JSON.stringify({ pid: 'p_a', commit: 'def' }));
  expect(handler).toHaveBeenCalledTimes(1);
  expect(handler).toHaveBeenCalledWith({ pid: 'p_a', commit: 'abc' });
});

it('refetches everything when the stream opens again after an error, not at the first open', () => {
  start();
  latest().open();
  expect(stale()).toEqual([]);
  latest().fail(0);
  latest().open();
  expect(stale()).toHaveLength(4);
});

it('re-creates a closed stream with a doubling backoff capped at 30 s, after probing the session', async () => {
  const probe = vi.fn(async () => undefined);
  start(probe);
  const delays: number[] = [];
  for (let i = 0; i < 7; i++) {
    const before = FakeEventSource.instances.length;
    latest().fail(2);
    await vi.advanceTimersByTimeAsync(0);
    let waited = 0;
    while (FakeEventSource.instances.length === before) {
      await vi.advanceTimersByTimeAsync(500);
      waited += 500;
    }
    delays.push(waited);
  }
  expect(delays).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  expect(probe).toHaveBeenCalledTimes(7);
  latest().open();
  latest().fail(2);
  await vi.advanceTimersByTimeAsync(1000);
  expect(FakeEventSource.instances).toHaveLength(9);
  expect(latest().closed).toBe(false);
});

it('stops when the session is lost and does not reconnect', async () => {
  start();
  const first = latest();
  markSessionLost();
  expect(first.closed).toBe(true);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(FakeEventSource.instances).toHaveLength(1);
});

it('does not reconnect when the probe finds the session lost', async () => {
  start(
    vi.fn(async () => {
      markSessionLost();
    }),
  );
  latest().fail(2);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(FakeEventSource.instances).toHaveLength(1);
});

it('probes GET /api/server by default: a 401 there loses the session and stops reconnecting', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () => new Response(JSON.stringify({ error: { code: 'unauthenticated', message: 'x' } }), { status: 401 }),
    ),
  );
  startEventStream(client, { EventSourceImpl: FakeEventSource as unknown as typeof EventSource });
  latest().fail(2);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(FakeEventSource.instances).toHaveLength(1);
  vi.unstubAllGlobals();
});

it('reconnects after a default probe that the console answers', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 200 })),
  );
  startEventStream(client, { EventSourceImpl: FakeEventSource as unknown as typeof EventSource });
  latest().fail(2);
  await vi.advanceTimersByTimeAsync(1_000);
  expect(FakeEventSource.instances).toHaveLength(2);
  vi.unstubAllGlobals();
});

it('lets a subscriber registered before the stream starts receive its events, without creating it', () => {
  const handler = vi.fn();
  const off = onServerEvent('settings', handler);
  expect(currentEventStream()).toBeUndefined();
  expect(FakeEventSource.instances).toHaveLength(0);
  const stream = start();
  expect(currentEventStream()).toBe(stream);
  latest().emit('settings', '{}');
  off();
  latest().emit('settings', '{}');
  expect(handler).toHaveBeenCalledTimes(1);
});

it('useServerEvent subscribes while mounted and calls the latest handler', () => {
  start();
  const first = vi.fn();
  const second = vi.fn();
  const { rerender, unmount } = renderHook(({ h }) => useServerEvent('repo', h), { initialProps: { h: first } });
  rerender({ h: second });
  latest().emit('repo', JSON.stringify({ pid: 'p_a', state: 's' }));
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledWith({ pid: 'p_a', state: 's' });
  unmount();
  latest().emit('repo', JSON.stringify({ pid: 'p_a', state: 's' }));
  expect(second).toHaveBeenCalledTimes(1);
  expect(FakeEventSource.instances).toHaveLength(1);
});

describe('reachability (W3-12)', () => {
  it('waits 10 s by default', () => {
    expect(UNREACHABLE_AFTER_MS).toBe(10_000);
  });

  it('turns unreachable when the stream stays connecting past the threshold, reachable again on open', async () => {
    start(undefined, 3_000);
    const { result } = renderHook(() => useReachability());
    latest().open();
    latest().fail(0);
    await vi.advanceTimersByTimeAsync(2_999);
    expect(result.current).toBe('reachable');
    await vi.advanceTimersByTimeAsync(1);
    expect(result.current).toBe('unreachable');
    latest().open();
    await vi.advanceTimersByTimeAsync(0);
    expect(result.current).toBe('reachable');
    expect(stale()).toHaveLength(4);
  });

  it('counts from the first failure across re-created streams', async () => {
    start(undefined, 5_000);
    const { result } = renderHook(() => useReachability());
    latest().open();
    latest().fail(2);
    await vi.advanceTimersByTimeAsync(1_000);
    latest().fail(2);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(result.current).toBe('unreachable');
  });

  it('is unreachable when the first stream never opens', async () => {
    start(undefined, 1_000);
    const { result } = renderHook(() => useReachability());
    await vi.advanceTimersByTimeAsync(1_000);
    expect(result.current).toBe('unreachable');
  });

  it('is back to reachable when the stream stops (the lost-session page takes over)', async () => {
    start(undefined, 1_000);
    const { result } = renderHook(() => useReachability());
    await vi.advanceTimersByTimeAsync(1_000);
    markSessionLost();
    await vi.advanceTimersByTimeAsync(0);
    expect(result.current).toBe('reachable');
  });
});
