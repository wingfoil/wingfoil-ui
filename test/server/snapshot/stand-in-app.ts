/**
 * Stand-ins of the v0.1 read routes the Memory list needs (spec-004 §3: the project header, the
 * configuration, the element list — the real routes are task-012's), served over the snapshot with
 * `X-Repo-State` and next to the real event stream `GET /api/events`, on a real loopback listener.
 * Used by the process audits (REQ-PERF-05, REQ-INT-09) and the refresh measurement (REQ-PERF-03).
 */
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import type { EventBus } from '../../../server/src/events/bus.js';
import { buildApp } from '../../../server/src/http/app.js';
import { EVENTS_PATH, registerEventStream, type EventStreams } from '../../../server/src/http/events.js';
import { createLogger } from '../../../server/src/logging.js';
import { REPO_STATE_HEADER, repoStateHeader } from '../../../server/src/snapshot/state.js';
import type { SnapshotView } from '../../../server/src/snapshot/snapshot.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { openSse, type SseStream } from '../http/sse-client.js';

/** A running stand-in console. */
export interface StandIn {
  port: number;
  token: string;
  /** `GET <path>` with the token: status, `X-Repo-State` and the JSON body. */
  get(path: string): Promise<{ status: number; state: string | null; body: unknown }>;
  /** The three reads of the Memory list, as a page loads them (in parallel). */
  openMemoryList(pid: string): Promise<{ state: string | null; body: unknown }[]>;
  /** Open the page's event stream. */
  events(): Promise<SseStream>;
  close(): Promise<void>;
}

const TOKEN = 'StandIn_'.padEnd(43, 'x');

/** Start the stand-in console over `snapshots` (projects already opened there) and `bus`. */
export async function startStandIn(snapshots: Snapshots, bus: EventBus): Promise<StandIn> {
  const staticDir = await mkdtemp(path.join(tmpdir(), 'wfui-standin-'));
  const holder: { port?: number } = {};
  let streams: EventStreams | undefined;
  const opened: SseStream[] = [];

  const register = (app: FastifyInstance): void => {
    streams = registerEventStream(app, { bus });
    const withView = async (pid: string, reply: FastifyReply, read: (view: SnapshotView) => Promise<unknown>) => {
      const snapshot = snapshots.get(pid);
      if (!snapshot) return reply.code(404).send({ error: { code: 'not-found', message: 'Not found' } });
      const view = await snapshot.view();
      const body = await read(view);
      return reply.header(REPO_STATE_HEADER, repoStateHeader(view.state)).send(body);
    };
    app.get<{ Params: { pid: string } }>('/api/p/:pid', (request, reply) =>
      withView(request.params.pid, reply, async (view) => {
        const [version, dna] = await Promise.all([view.version(), view.dna()]);
        return { name: dna.data.project?.name ?? null, version, email: view.state.email ?? null };
      }),
    );
    app.get<{ Params: { pid: string } }>('/api/p/:pid/config', (request, reply) =>
      withView(request.params.pid, reply, async (view) => {
        const [dna, paths, workflows, types] = await Promise.all([
          view.dna(),
          view.paths(),
          view.workflows(),
          view.memoryTypes(),
        ]);
        return { dna: dna.data, paths: paths.data, workflows: workflows.data, types };
      }),
    );
    app.get<{ Params: { pid: string } }>('/api/p/:pid/elements', (request, reply) =>
      withView(request.params.pid, reply, async (view) => {
        const list = await view.elements();
        return list.matches.map(({ match, localChanges }) => ({ ...match, localChanges }));
      }),
    );
  };

  const app = await buildApp({
    staticDir,
    logger: createLogger(new Writable({ write: (_c, _e, cb) => cb() })),
    security: { authentication: createTokenAuthentication(TOKEN), port: () => holder.port },
    register,
  });
  const server = http.createServer((req, res) => app.routing(req, res));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  holder.port = port;

  const get = async (p: string) => {
    const response = await fetch(`http://127.0.0.1:${port}${p}`, { headers: { authorization: `Bearer ${TOKEN}` } });
    return { status: response.status, state: response.headers.get(REPO_STATE_HEADER), body: await response.json() };
  };
  return {
    port,
    token: TOKEN,
    get,
    openMemoryList: (pid) =>
      Promise.all([get(`/api/p/${pid}`), get(`/api/p/${pid}/config`), get(`/api/p/${pid}/elements`)]),
    events: async () => {
      const s = await openSse(port, EVENTS_PATH, { authorization: `Bearer ${TOKEN}` });
      opened.push(s);
      return s;
    },
    close: async () => {
      for (const s of opened) s.close();
      streams?.close();
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      await app.close();
      await rm(staticDir, { recursive: true, force: true });
    },
  };
}
