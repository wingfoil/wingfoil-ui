/**
 * The governed write routes of spec-004 §3 (v0.2, task-032):
 *
 * | Route | Request (`contracts/api/`) | 200 |
 * |-------|----------------------------|-----|
 * | `POST /api/p/:pid/elements/:eid/submit` | `element.submit.request.schema.json` `{expectedStatus}` | `write.response.schema.json` |
 * | `POST /api/p/:pid/elements/:eid/approve` | `element.decision.request.schema.json` `{expectedStatus, reason}` | `write.response.schema.json` |
 * | `POST /api/p/:pid/elements/:eid/reject` | `element.decision.request.schema.json` `{expectedStatus, reason}` | `write.response.schema.json` |
 *
 * An unknown `:pid` → 404 before the body is read (spec-004 §4 row 3); a body failing its schema →
 * 400 `invalid-request` (row 4, strict: no coercion, no extra key); the rest is
 * {@link GovernedWrites} (rows 5–9, the CLI, the action log, the `write` event). The write goes on
 * when the client leaves: a commit is never left half-made.
 */
import { Ajv } from 'ajv';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { readFileSync } from 'node:fs';
import type { ElementDecisionRequest } from '@wingfoil-ui/contracts';
import type { EventBus } from '../events/bus.js';
import type { WriteLock } from '../process/write-lock.js';
import type { Snapshots } from '../snapshot/snapshots.js';
import type { StateStore } from '../state/store.js';
import { GOVERNED_VERBS, GovernedWrites, type GovernedVerb, type WritePushPort } from '../writes/governed.js';
import { envelope } from './app.js';

/** Path of each route, by verb. */
export const ELEMENT_WRITE_PATHS: Readonly<Record<GovernedVerb, string>> = {
  submit: '/api/p/:pid/elements/:eid/submit',
  approve: '/api/p/:pid/elements/:eid/approve',
  reject: '/api/p/:pid/elements/:eid/reject',
};

function schema(file: string): object {
  // Read like every contract at load (same depth from `src` and `dist`).
  return JSON.parse(readFileSync(new URL(`../../../contracts/api/${file}`, import.meta.url), 'utf8')) as object;
}

const SUBMIT_SCHEMA = schema('element.submit.request.schema.json');
const DECISION_SCHEMA = schema('element.decision.request.schema.json');
// Strict: Fastify's default validator coerces types and drops extra properties.
const ajv = new Ajv({ allErrors: true });
const validateSubmit = ajv.compile(SUBMIT_SCHEMA);
const validateDecision = ajv.compile(DECISION_SCHEMA);

/** What the routes need. */
export interface ElementWriteRoutesOptions {
  /** The project list. */
  store: StateStore;
  /** The snapshots of the open projects (the launcher's). */
  snapshots: Snapshots;
  /** The server's write lock (shared with the clones and, from task-033, the git routes). */
  writeLock: WriteLock;
  bus: EventBus;
  /** The auto-push (default: off, D32-7). */
  push?: WritePushPort;
}

function notFound(reply: FastifyReply): FastifyReply {
  return reply.code(404).send(envelope('not-found', 'Not found'));
}

/** Register the three routes. */
export function registerElementWriteRoutes(app: FastifyInstance, options: ElementWriteRoutesOptions): void {
  const { store } = options;
  const writes = new GovernedWrites(options);
  for (const verb of GOVERNED_VERBS) {
    const submit = verb === 'submit';
    app.post<{ Params: { pid: string; eid: string }; Body: Partial<ElementDecisionRequest> }>(
      ELEMENT_WRITE_PATHS[verb],
      {
        schema: { body: submit ? SUBMIT_SCHEMA : DECISION_SCHEMA },
        validatorCompiler: () => (submit ? validateSubmit : validateDecision),
        // spec-004 §4 row 3 before row 4: the project is looked up before the body is parsed.
        onRequest: async (request, reply) => {
          if (store.get(request.params.pid) === undefined) return notFound(reply);
        },
        handler: async (request, reply) => {
          const entry = store.get(request.params.pid);
          if (entry === undefined) return notFound(reply);
          const { expectedStatus = '', reason } = request.body;
          const outcome = await writes.write(
            entry,
            {
              pid: entry.id,
              eid: request.params.eid,
              verb,
              expectedStatus,
              ...(reason !== undefined ? { reason } : {}),
            },
            request.log,
          );
          return reply.code(outcome.status).send(outcome.body);
        },
      },
    );
  }
}
