/**
 * The git routes of spec-004 §3 and spec-010 §4–§5, §8 (v0.2, task-033):
 *
 * | Route | Request | 200 | Refusals |
 * |-------|---------|-----|----------|
 * | `POST /api/p/:pid/git/fetch` | no body (or `{}`) | `git.response.schema.json` | `git.refusal.schema.json` |
 * | `POST /api/p/:pid/git/update` | no body (or `{}`) | `git.response.schema.json` | `git.refusal.schema.json` |
 * | `POST /api/p/:pid/git/push` | no body (or `{}`) | `git.response.schema.json` | `git.refusal.schema.json` |
 *
 * An unknown `:pid` → 404 before the body (spec-004 §4 row 3); any other body → 400
 * `invalid-request` (row 4, D33-9); the rest is {@link GitTransport}. Fetch and push are cancelled
 * when the client leaves (the process group is killed, RP-37); an update runs to completion.
 */
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { GitOperation } from '@wingfoil-ui/contracts';
import type { WriteLock } from '../process/write-lock.js';
import type { Snapshots } from '../snapshot/snapshots.js';
import type { StateStore } from '../state/store.js';
import { GitTransport } from '../writes/transport.js';
import { envelope } from './app.js';
import { clientGone } from './projects.js';

/** The operations, in route order. */
export const GIT_OPERATIONS: readonly GitOperation[] = ['fetch', 'update', 'push'];

/** Path of each route, by operation. */
export const GIT_PATHS: Readonly<Record<GitOperation, string>> = {
  fetch: '/api/p/:pid/git/fetch',
  update: '/api/p/:pid/git/update',
  push: '/api/p/:pid/git/push',
};

/** What the routes need. */
export interface GitRoutesOptions {
  /** The project list. */
  store: StateStore;
  /** The snapshots of the open projects (the launcher's), with their sync status. */
  snapshots: Snapshots;
  /** The server's write lock (shared with the clones and the governed writes). */
  writeLock: WriteLock;
  /** The server's environment (default `process.env`). */
  env?: NodeJS.ProcessEnv;
}

function notFound(reply: FastifyReply): FastifyReply {
  return reply.code(404).send(envelope('not-found', 'Not found'));
}

/** No body, or an empty object (D33-9); a JSON `null` is a body (review round 1 S9). */
function emptyBody(body: unknown): boolean {
  if (body === undefined) return true;
  if (body === null) return false;
  return typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 0;
}

/** Register the three routes. */
export function registerGitRoutes(app: FastifyInstance, options: GitRoutesOptions): void {
  const { store } = options;
  const transport = new GitTransport({
    snapshots: options.snapshots,
    writeLock: options.writeLock,
    ...(options.env ? { env: options.env } : {}),
  });
  for (const op of GIT_OPERATIONS) {
    app.post<{ Params: { pid: string } }>(GIT_PATHS[op], {
      // spec-004 §4 row 3 before row 4: the project is looked up before the body is parsed.
      onRequest: async (request, reply) => {
        if (store.get(request.params.pid) === undefined) return notFound(reply);
      },
      handler: async (request, reply) => {
        const entry = store.get(request.params.pid);
        if (entry === undefined) return notFound(reply);
        if (!emptyBody(request.body)) return reply.code(400).send(envelope('invalid-request', 'Invalid request'));
        const gone = clientGone(reply);
        try {
          const outcome = await transport.run(entry, op, request.log, gone.signal);
          return await reply.code(outcome.status).send(outcome.body);
        } finally {
          gone.detach();
        }
      },
    });
  }
}
