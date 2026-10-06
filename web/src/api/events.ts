/**
 * The page's single event stream (spec-004 §6, REQ-INT-09): one `EventSource` on `/api/events` per
 * page. Built-in rules: `repo {pid}` invalidates every query of that project (`['p', pid]`) — even
 * when its `state` did not move (a CLI change publishes `repo` with the same state); `projects`
 * invalidates the project list; a stream that opens again after an error invalidates everything
 * (it may have missed events). Screens subscribe to other events with {@link EventStream.on}.
 * The browser retries a dropped stream by itself; a stream that ends `CLOSED` (e.g. the console
 * was restarted) is probed — a 401 loses the session — and re-created with a doubling backoff
 * (1 s to 30 s). A lost session closes the stream for good. Nothing polls.
 */
import type { QueryClient } from '@tanstack/react-query';
import type { ServerEventMap, ServerEventName } from '@wingfoil-ui/contracts';
import { sessionStatus, subscribeSession } from '../session/session.js';
import { ApiError, apiGet } from './client.js';
import { queryKeys } from './query-keys.js';

/** Every event name of spec-004 §6. */
const EVENT_NAMES: readonly ServerEventName[] = ['repo', 'projects', 'settings', 'write', 'agent'];

/** First and longest delay before a closed stream is re-created. */
const BACKOFF_MS = { first: 1_000, max: 30_000 };

/** The page's event stream. */
export interface EventStream {
  /** Calls `handler` with the data of every `event`; returns the unsubscribe function. */
  on<N extends ServerEventName>(event: N, handler: (data: ServerEventMap[N]) => void): () => void;
  /** Closes the stream for good. */
  close(): void;
}

/** Options of {@link startEventStream}. */
export interface EventStreamOptions {
  /** Stream URL (default `/api/events`). */
  url?: string;
  /** `EventSource` implementation (tests). */
  EventSourceImpl?: typeof EventSource;
  /**
   * Called when the stream ended `CLOSED`, before it is re-created: by default a
   * `GET /api/server`, whose 401 loses the session (the event stream itself cannot tell).
   */
  probe?: () => Promise<void>;
}

async function defaultProbe(): Promise<void> {
  try {
    await apiGet('/api/server');
  } catch (error) {
    if (!(error instanceof ApiError)) return;
  }
}

let current: (EventStream & { stop(): void }) | undefined;

/** Start the page's event stream, or return the one already started. */
export function startEventStream(queryClient: QueryClient, options: EventStreamOptions = {}): EventStream {
  if (current) return current;
  const url = options.url ?? '/api/events';
  const Impl = options.EventSourceImpl ?? EventSource;
  const probe = options.probe ?? defaultProbe;
  const handlers = new Map<ServerEventName, Set<(data: never) => void>>();
  let source: EventSource | undefined;
  let opened = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
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
    for (const h of handlers.get(name) ?? []) (h as (d: unknown) => void)(data);
  };

  const connect = (): void => {
    const es = new Impl(url, { withCredentials: false });
    source = es;
    for (const name of EVENT_NAMES) es.addEventListener(name, (e) => dispatch(name, String((e as MessageEvent).data)));
    es.onopen = () => {
      attempt = 0;
      if (opened) void queryClient.invalidateQueries();
      opened = true;
    };
    es.onerror = () => {
      if (es.readyState !== Impl.CLOSED || stopped) return;
      es.close();
      void probe()
        .catch(() => undefined)
        .then(() => {
          if (stopped || sessionStatus() === 'lost') return;
          const delay = Math.min(BACKOFF_MS.first * 2 ** attempt, BACKOFF_MS.max);
          attempt++;
          // A re-created stream counts as a reconnect: everything is refetched on its open.
          opened = true;
          timer = setTimeout(connect, delay);
        });
    };
  };

  const stop = (): void => {
    stopped = true;
    if (timer !== undefined) clearTimeout(timer);
    source?.close();
    unsubscribe();
    if (current === stream) current = undefined;
  };
  const unsubscribe = subscribeSession(() => {
    if (sessionStatus() === 'lost') stop();
  });

  const stream: EventStream & { stop(): void } = {
    on(event, handler) {
      const set = handlers.get(event) ?? new Set();
      handlers.set(event, set);
      set.add(handler as (data: never) => void);
      return () => set.delete(handler as (data: never) => void);
    },
    close: stop,
    stop,
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
