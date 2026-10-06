/**
 * The page's single event stream (spec-004 §6, REQ-INT-09): one `EventSource` on `/api/events` per
 * page, started by `App` once the session is connected — never by a screen.
 *
 * - Built-in rules: `repo {pid}` invalidates every query of that project (`['p', pid]`) — even
 *   when its `state` did not move (a CLI change publishes `repo` with the same state); `projects`
 *   invalidates the project list; a stream that opens again after an error invalidates everything
 *   (it may have missed events).
 * - Screens subscribe with {@link useServerEvent} (or {@link onServerEvent}): the subscription does
 *   not create the stream, and it holds whether the stream starts before or after it.
 * - The browser retries a dropped stream by itself; a stream that ends `CLOSED` (e.g. the console
 *   answered 401 after a restart) is probed — a 401 loses the session, in `apiRequest` — and
 *   re-created with a doubling backoff (1 s to 30 s). A lost session closes the stream for good.
 * - Reachability (decision W3-12): when the stream has not been open for `unreachableAfterMs`
 *   (10 s) since it was started or last failed, the console is **unreachable** (the shell shows a
 *   banner); it is reachable again as soon as the stream opens.
 *
 * Nothing polls.
 */
import type { QueryClient } from '@tanstack/react-query';
import type { ServerEventMap, ServerEventName } from '@wingfoil-ui/contracts';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { sessionStatus, subscribeSession } from '../session/session.js';
import { apiGet } from './client.js';
import { queryKeys } from './query-keys.js';

/** Every event name of spec-004 §6. */
const EVENT_NAMES: readonly ServerEventName[] = ['repo', 'projects', 'settings', 'write', 'agent'];

/** First and longest delay before a closed stream is re-created. */
const BACKOFF_MS = { first: 1_000, max: 30_000 };

/** Default time without an open stream after which the console is unreachable (W3-12). */
export const UNREACHABLE_AFTER_MS = 10_000;

/** A handler of one event's data. */
export type ServerEventHandler<N extends ServerEventName> = (data: ServerEventMap[N]) => void;

const handlers = new Map<ServerEventName, Set<ServerEventHandler<never>>>();

/** Call `handler` with the data of every `event` of the page's stream; returns the unsubscribe function. */
export function onServerEvent<N extends ServerEventName>(event: N, handler: ServerEventHandler<N>): () => void {
  const set = handlers.get(event) ?? new Set();
  handlers.set(event, set);
  const h = handler as ServerEventHandler<never>;
  set.add(h);
  return () => set.delete(h);
}

/** Subscribe the calling component to `event` while it is mounted (the latest `handler` is called). */
export function useServerEvent<N extends ServerEventName>(event: N, handler: ServerEventHandler<N>): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => onServerEvent(event, (data) => latest.current(data)), [event]);
}

/** Whether the console answers the page's event stream (W3-12). */
export type Reachability = 'reachable' | 'unreachable';

let reachability: Reachability = 'reachable';
const reachabilityListeners = new Set<() => void>();

function setReachability(next: Reachability): void {
  if (reachability === next) return;
  reachability = next;
  for (const l of [...reachabilityListeners]) l();
}

/** The console's reachability as React state. */
export function useReachability(): Reachability {
  return useSyncExternalStore(
    (l) => {
      reachabilityListeners.add(l);
      return () => reachabilityListeners.delete(l);
    },
    () => reachability,
  );
}

/** The page's event stream. */
export interface EventStream {
  /** Same as {@link onServerEvent}. */
  on<N extends ServerEventName>(event: N, handler: ServerEventHandler<N>): () => void;
  /** Closes the stream for good. */
  close(): void;
}

/** Options of {@link startEventStream}. */
export interface EventStreamOptions {
  /** Stream URL (default `/api/events`). */
  url?: string;
  /** `EventSource` implementation (tests). */
  EventSourceImpl?: typeof EventSource;
  /** Called when the stream ended `CLOSED`, before it is re-created (default: `GET /api/server`). */
  probe?: () => Promise<void>;
  /** Time without an open stream before the console is unreachable (default {@link UNREACHABLE_AFTER_MS}). */
  unreachableAfterMs?: number;
}

/** A 401 of the probe loses the session inside `apiRequest`; any other outcome just lets the stream retry. */
async function defaultProbe(): Promise<void> {
  await apiGet('/api/server').catch(() => undefined);
}

let current: (EventStream & { stop(): void; noteNetworkFailure(): void }) | undefined;

/**
 * A request got no answer at network level (spec-004 §6): starts the unreachable countdown of the
 * page's stream, unless it is already running (no effect before the stream starts).
 */
export function noteNetworkFailure(): void {
  current?.noteNetworkFailure();
}

/** The page's event stream, if started. */
export function currentEventStream(): EventStream | undefined {
  return current;
}

/** Start the page's event stream (`App` does), or return the one already started. */
export function startEventStream(queryClient: QueryClient, options: EventStreamOptions = {}): EventStream {
  if (current) return current;
  const url = options.url ?? '/api/events';
  const Impl = options.EventSourceImpl ?? EventSource;
  const probe = options.probe ?? defaultProbe;
  const unreachableAfterMs = options.unreachableAfterMs ?? UNREACHABLE_AFTER_MS;
  let source: EventSource | undefined;
  let opened = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let unreachableTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const dispatch = (name: ServerEventName, raw: string): void => {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    if (name === 'repo') {
      const pid = (data as { pid?: unknown }).pid;
      if (typeof pid === 'string') void queryClient.invalidateQueries({ queryKey: queryKeys.project(pid) });
    } else if (name === 'projects') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
    }
    for (const h of [...(handlers.get(name) ?? [])]) (h as (d: unknown) => void)(data);
  };

  /** Start counting towards "unreachable", unless already counting. */
  const watchReachability = (): void => {
    if (unreachableTimer !== undefined || stopped) return;
    unreachableTimer = setTimeout(() => setReachability('unreachable'), unreachableAfterMs);
  };

  const connect = (): void => {
    const es = new Impl(url, { withCredentials: false });
    source = es;
    watchReachability();
    for (const name of EVENT_NAMES) es.addEventListener(name, (e) => dispatch(name, String((e as MessageEvent).data)));
    es.onopen = () => {
      attempt = 0;
      clearTimeout(unreachableTimer);
      unreachableTimer = undefined;
      setReachability('reachable');
      if (opened) void queryClient.invalidateQueries();
      opened = true;
    };
    es.onerror = () => {
      if (stopped) return;
      watchReachability();
      if (es.readyState !== Impl.CLOSED) return;
      es.close();
      void probe()
        .catch(() => undefined)
        .then(() => {
          if (stopped || sessionStatus() === 'lost') return;
          const delay = Math.min(BACKOFF_MS.first * 2 ** attempt, BACKOFF_MS.max);
          attempt++;
          // A re-created stream counts as a reconnect: everything is refetched on its open.
          opened = true;
          retryTimer = setTimeout(connect, delay);
        });
    };
  };

  const stop = (): void => {
    stopped = true;
    clearTimeout(retryTimer);
    clearTimeout(unreachableTimer);
    source?.close();
    unsubscribe();
    setReachability('reachable');
    if (current === stream) current = undefined;
  };
  const unsubscribe = subscribeSession(() => {
    if (sessionStatus() === 'lost') stop();
  });

  const stream: EventStream & { stop(): void; noteNetworkFailure(): void } = {
    on: onServerEvent,
    close: stop,
    stop,
    noteNetworkFailure: watchReachability,
  };
  current = stream;
  if (sessionStatus() === 'lost') stop();
  else connect();
  return stream;
}

/** Close the page's event stream (tests, page teardown). */
export function stopEventStream(): void {
  current?.stop();
}
