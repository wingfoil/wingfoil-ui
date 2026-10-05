/**
 * The event stream (spec-004 §6, REQ-INT-09, `adr-001` D9): `GET /api/events`, Server-Sent Events,
 * one stream per page, guarded like every `/api/` request (Host/Origin, `Sec-Fetch-Site`, cookie or
 * Bearer — the guards of `guards.ts` answer before this handler). Every event of the bus is written
 * as `event: <name>` and a JSON `data` line; a comment heartbeat keeps the connection alive. Pages
 * never poll: on `repo` they refetch that project's queries.
 */
import type { FastifyInstance } from 'fastify';
import type { ServerResponse } from 'node:http';
import type { EventBus } from '../events/bus.js';

/** Path of the stream. */
export const EVENTS_PATH = '/api/events';

/** Interval of the comment heartbeat (spec-004 §6). */
export const HEARTBEAT_MS = 25_000;

/** Reconnection delay the stream suggests to `EventSource` (`retry:` field). */
export const RETRY_MS = 2_000;

/** Options of {@link registerEventStream}. */
export interface EventStreamOptions {
  bus: EventBus;
  /** Heartbeat interval (default {@link HEARTBEAT_MS}). */
  heartbeatMs?: number;
}

/** The open streams. */
export interface EventStreams {
  /** Number of open streams. */
  readonly size: number;
  /** End every open stream (stop sequence, spec-007 §6): the pages see the end and may reconnect. */
  close(): void;
}

/** Register `GET /api/events` on `app` (call it from `buildApp({ register })`). */
export function registerEventStream(app: FastifyInstance, options: EventStreamOptions): EventStreams {
  const heartbeatMs = options.heartbeatMs ?? HEARTBEAT_MS;
  const open = new Set<() => void>();

  app.get(EVENTS_PATH, (_request, reply) => {
    reply.hijack();
    const res: ServerResponse = reply.raw;
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive',
      'x-content-type-options': 'nosniff',
    });
    res.write(`retry: ${RETRY_MS}\n: connected\n\n`);
    const unsubscribe = options.bus.subscribe((event) => {
      res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), heartbeatMs);
    heartbeat.unref();
    let ended = false;
    const end = (): void => {
      if (ended) return;
      ended = true;
      clearInterval(heartbeat);
      unsubscribe();
      open.delete(end);
      if (!res.writableEnded) res.end();
    };
    open.add(end);
    // The response's `close`: the page went away or the stream was ended (the request's own
    // `close` fires once its body is read, not when the connection drops).
    res.on('close', end);
    res.on('error', end);
  });

  return {
    get size() {
      return open.size;
    },
    close() {
      for (const end of [...open]) end();
    },
  };
}
