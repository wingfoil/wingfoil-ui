/**
 * A console serving the real v0.1 read routes (task-012: `GET /api/server`, `/api/p/:pid/…`) over
 * the given snapshot registry, next to the real event stream `GET /api/events`, on a real loopback
 * listener, with the projects listed in an in-memory store under the given ids. Used by the process
 * audits (REQ-PERF-05, REQ-INT-09) and the refresh measurement (REQ-PERF-03); the successor of
 * task-010's stand-in routes.
 */
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import type { EventBus } from '../../../server/src/events/bus.js';
import { buildApp } from '../../../server/src/http/app.js';
import { EVENTS_PATH, registerEventStream, type EventStreams } from '../../../server/src/http/events.js';
import { registerProjectRoutes } from '../../../server/src/http/project-routes.js';
import { registerRoleViewRoute } from '../../../server/src/http/role-view.js';
import { registerServerRoute } from '../../../server/src/http/server-route.js';
import { createSnapshotIdentitySource } from '../../../server/src/identity/snapshot-identity.js';
import { createLogger } from '../../../server/src/logging.js';
import { REPO_STATE_HEADER } from '../../../server/src/snapshot/state.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { createMemoryStateStore } from '../../../server/src/state/memory-store.js';
import { openSse, type SseStream } from './sse-client.js';

/** A running read console. */
export interface ReadConsole {
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

const TOKEN = 'ReadConsole_'.padEnd(43, 'x');

/**
 * Start the console over `snapshots` and `bus`, with `projects` (`pid` → realpath of the project) in
 * its local state. Project ids follow the state schema (`p_` + 12 Crockford base32 characters).
 */
export async function startReadConsole(
  snapshots: Snapshots,
  bus: EventBus,
  projects: Record<string, string>,
): Promise<ReadConsole> {
  const staticDir = await mkdtemp(path.join(tmpdir(), 'wfui-console-'));
  const holder: { port?: number } = {};
  let streams: EventStreams | undefined;
  const opened: SseStream[] = [];
  const store = await createMemoryStateStore({
    initial: {
      version: 1,
      projects: Object.entries(projects).map(([id, dir]) => ({
        id,
        path: dir,
        name: path.basename(dir),
        remote: '',
        addedAt: '2026-10-06T08:00:00Z',
        roleView: '',
      })),
      settings: {},
      actionLog: [],
    },
  });

  const register = (app: FastifyInstance): void => {
    const identity = createSnapshotIdentitySource(snapshots);
    registerServerRoute(app, { store, version: '0.0.0-test' });
    registerProjectRoutes(app, { store, snapshots, identity });
    registerRoleViewRoute(app, { store, identity });
    streams = registerEventStream(app, { bus });
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
