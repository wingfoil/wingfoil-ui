/**
 * `PUT /api/p/:pid/role-view` `{role}` (spec-004 §3, spec-006 §3; REQ-STATE-06): remember the role
 * view of a project in the local state. Answers 204 without a body. Refusals, in the spec-004 §4
 * order: an unknown `:pid` → 404 `not-found` (before the body is read); a body failing
 * `contracts/api/role-view.request.schema.json` → 400 `invalid-request`; a user not identified as
 * exactly one member → 403 `not-in-team`; a role the member does not hold → 400
 * `invalid-request`. Nothing is stored on a refusal.
 */
import { Ajv } from 'ajv';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { readFileSync } from 'node:fs';
import type { RoleViewRequest } from '@wingfoil-ui/contracts';
import { CliError, cliErrorEnvelope } from '../cli/adapter.js';
import { CliNotFoundError } from '../cli/discovery.js';
import type { IdentitySource } from '../identity/project-identity.js';
import type { StateStore } from '../state/store.js';
import { envelope } from './app.js';

/** Path of the route. */
export const ROLE_VIEW_PATH = '/api/p/:pid/role-view';

/** The request schema, read like every contract at load (same depth from `src` and `dist`). */
const REQUEST_SCHEMA = JSON.parse(
  readFileSync(new URL('../../../contracts/api/role-view.request.schema.json', import.meta.url), 'utf8'),
) as object;

// Strict on this route: Fastify's default validator coerces types and drops extra properties.
const validateRequest = new Ajv({ allErrors: true }).compile(REQUEST_SCHEMA);

/** What the route needs. */
export interface RoleViewRouteOptions {
  /** The local state: the project lookup and where the role view is remembered. */
  store: StateStore;
  /** Who the user is in the project (the member's roles bound the accepted role). */
  identity: IdentitySource;
}

function notFound(reply: FastifyReply): FastifyReply {
  return reply.code(404).send(envelope('not-found', 'Not found'));
}

/** Register `PUT /api/p/:pid/role-view`. */
export function registerRoleViewRoute(app: FastifyInstance, options: RoleViewRouteOptions): void {
  const { store, identity } = options;
  app.put<{ Params: { pid: string }; Body: RoleViewRequest }>(ROLE_VIEW_PATH, {
    schema: { body: REQUEST_SCHEMA },
    validatorCompiler: () => validateRequest,
    // spec-004 §4 row 3 before row 4: the project is looked up before the body is parsed.
    onRequest: async (request, reply) => {
      if (store.get(request.params.pid) === undefined) return notFound(reply);
    },
    handler: async (request, reply) => {
      const project = store.get(request.params.pid);
      if (project === undefined) return notFound(reply);
      // A client gone before the answer cancels the reads (git, `dna show`).
      const gone = new AbortController();
      const onClose = (): void => {
        if (!reply.raw.writableFinished) gone.abort();
      };
      reply.raw.once('close', onClose);
      let user;
      try {
        user = await identity.identify(project, gone.signal);
      } catch (error) {
        if (gone.signal.aborted) {
          // The client left and its reads were cancelled: no answer to send, nothing went wrong.
          request.log.debug({ pid: project.id }, 'role view: client gone, identity read cancelled');
          reply.hijack();
          return;
        }
        if (error instanceof CliError || error instanceof CliNotFoundError) {
          const { status, body } = cliErrorEnvelope(error);
          return reply.code(status).send(body);
        }
        throw error;
      } finally {
        reply.raw.off('close', onClose);
      }
      if (user.kind !== 'member') {
        return reply.code(403).send(envelope('not-in-team', 'Not identified as a member of the team'));
      }
      if (!user.roles.includes(request.body.role)) {
        return reply.code(400).send(envelope('invalid-request', 'Role not held by the member'));
      }
      // Removed by another console in the meantime: nothing to remember.
      if ((await store.update(project.id, { roleView: request.body.role })) === undefined) return notFound(reply);
      return reply.code(204).send();
    },
  });
}
