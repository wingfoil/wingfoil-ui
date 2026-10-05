// spec-004 §6, REQ-INT-09 — `GET /api/events`: one authenticated Server-Sent Events stream per page
// carrying the bus events, a comment heartbeat, guarded like every `/api/` request (task-003),
// ended in the stop sequence; adr-002 event bus port (in-process adapter).
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import { InProcessEventBus } from '../../../server/src/events/bus.js';
import { buildApp } from '../../../server/src/http/app.js';
import { EVENTS_PATH, HEARTBEAT_MS, registerEventStream, type EventStreams } from '../../../server/src/http/events.js';
import { createLogger } from '../../../server/src/logging.js';
import { openSse, type SseStream } from './sse-client.js';

const TOKEN = 'T0ken_'.padEnd(43, 'x');
let staticDir: string;
let app: FastifyInstance;
let server: http.Server;
let port: number;
let bus: InProcessEventBus;
let streams: EventStreams;
const open: SseStream[] = [];

beforeAll(async () => {
  staticDir = await mkdtemp(path.join(tmpdir(), 'wfui-events-'));
  bus = new InProcessEventBus();
  const holder: { port?: number } = {};
  app = await buildApp({
    staticDir,
    logger: createLogger(new Writable({ write: (_c, _e, cb) => cb() })),
    security: { authentication: createTokenAuthentication(TOKEN), port: () => holder.port },
    register: (a) => {
      streams = registerEventStream(a, { bus, heartbeatMs: 100 });
    },
  });
  server = http.createServer((req, res) => app.routing(req, res));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
  holder.port = port;
});

afterEach(() => {
  for (const s of open.splice(0)) s.close();
});

afterAll(async () => {
  streams.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await app.close();
  await rm(staticDir, { recursive: true, force: true });
});

async function connect(headers: Record<string, string> = { authorization: `Bearer ${TOKEN}` }): Promise<SseStream> {
  const s = await openSse(port, EVENTS_PATH, headers);
  open.push(s);
  return s;
}

describe('GET /api/events', () => {
  it('is the spec-004 §6 path with a 25 s heartbeat by default', () => {
    expect(EVENTS_PATH).toBe('/api/events');
    expect(HEARTBEAT_MS).toBe(25_000);
  });

  it('opens an event stream that never caches', async () => {
    const s = await connect();
    expect(s.status).toBe(200);
    expect(s.headers['content-type']).toMatch(/^text\/event-stream/);
    expect(s.headers['cache-control']).toBe('no-store');
  });

  it('carries every bus event as `event: <name>` + JSON `data`, in order', async () => {
    const s = await connect();
    await expect.poll(() => streams.size).toBeGreaterThan(0);
    bus.publish({ event: 'repo', data: { pid: 'p_1', state: `${'a'.repeat(40)}.0123456789abcdef` } });
    bus.publish({ event: 'projects', data: {} });
    bus.publish({ event: 'write', data: { pid: 'p_1', eid: 'task-001', commit: 'b'.repeat(40) } });
    await expect
      .poll(() => s.events())
      .toEqual([
        { event: 'repo', data: { pid: 'p_1', state: `${'a'.repeat(40)}.0123456789abcdef` } },
        { event: 'projects', data: {} },
        { event: 'write', data: { pid: 'p_1', eid: 'task-001', commit: 'b'.repeat(40) } },
      ]);
  });

  it('sends a comment heartbeat', async () => {
    const s = await connect();
    await expect
      .poll(() => s.frames.filter((f) => 'comment' in f && f.comment === 'heartbeat').length)
      .toBeGreaterThan(1);
  });

  it('reaches every open page (one stream each)', async () => {
    const a = await connect();
    const b = await connect();
    await expect.poll(() => streams.size).toBeGreaterThanOrEqual(2);
    bus.publish({ event: 'settings', data: {} });
    await expect.poll(() => a.events()).toContainEqual({ event: 'settings', data: {} });
    await expect.poll(() => b.events()).toContainEqual({ event: 'settings', data: {} });
  });

  it('unsubscribes when the page goes away', async () => {
    const before = bus.size;
    const s = await connect();
    await expect.poll(() => bus.size).toBe(before + 1);
    s.close();
    await expect.poll(() => bus.size).toBe(before);
  });

  it('is guarded: 401 without a session, 403 from another site (spec-004 §1–2)', async () => {
    const anonymous = await connect({});
    expect(anonymous.status).toBe(401);
    const sameSite = await connect({ authorization: `Bearer ${TOKEN}`, 'sec-fetch-site': 'same-site' });
    expect(sameSite.status).toBe(403);
    const foreign = await connect({ authorization: `Bearer ${TOKEN}`, origin: 'https://evil.test' });
    expect(foreign.status).toBe(403);
  });

  it('ends every open stream on close() (stop sequence)', async () => {
    const s = await connect();
    await expect.poll(() => streams.size).toBeGreaterThan(0);
    streams.close();
    await s.ended;
    expect(streams.size).toBe(0);
  });
});

describe('InProcessEventBus', () => {
  it('delivers to every listener and survives a failing one', () => {
    const local = new InProcessEventBus();
    const good = vi.fn();
    const offBad = local.subscribe(() => {
      throw new Error('listener failed');
    });
    const offGood = local.subscribe(good);
    local.publish({ event: 'projects', data: {} });
    expect(good).toHaveBeenCalledWith({ event: 'projects', data: {} });
    expect(local.size).toBe(2);
    offBad();
    offGood();
    offGood();
    expect(local.size).toBe(0);
  });
});
