/**
 * The project-list routes (spec-004 §3, spec-006 §2–§3):
 *
 * | Route | Answer |
 * |-------|--------|
 * | `GET /api/projects` | 200 `{ projects }` (`contracts/api/projects.list.response.schema.json`) |
 * | `POST /api/projects` `{path}` | 201 the new item (`contracts/api/projects.item.schema.json`) |
 * | `POST /api/projects/clone` `{url, directory?}` | 201 the new item |
 * | `DELETE /api/projects/:pid` | 204, no body; 404 `not-found` for an unknown id |
 *
 * A body failing its schema (`contracts/api/projects.*.request.schema.json`), a relative path or a
 * URL starting with `-` → 400 `invalid-request`; the refusals of spec-006 §3 → 422 with the
 * envelope of spec-004 §5; a CLI timeout or failure while reading the name → its spec-004 §5 code.
 * The guards (Host/Origin, `Sec-Fetch-Site`, session) answer before any of these.
 */
import { Ajv } from 'ajv';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { readFileSync } from 'node:fs';
import type { CloneRequest, ProjectAddRequest, ProjectListResponse } from '@wingfoil-ui/contracts';
import { CliError, cliErrorEnvelope } from '../cli/adapter.js';
import { CloneCancelledError } from '../projects/clone.js';
import { InvalidProjectRequest, ProjectRefusal, type ProjectList } from '../projects/project-list.js';
import { envelope } from './app.js';

/** Path of the list. */
export const PROJECTS_PATH = '/api/projects';

const load = (file: string): object =>
  JSON.parse(readFileSync(new URL(`../../../contracts/api/${file}`, import.meta.url), 'utf8')) as object;

/** The request schemas, read like every contract at load (same depth from `src` and `dist`). */
const ADD_SCHEMA = load('projects.add.request.schema.json');
const CLONE_SCHEMA = load('projects.clone.request.schema.json');

// Strict: Fastify's default validator coerces types and drops extra properties.
const ajv = new Ajv({ allErrors: true });
const validateAdd = ajv.compile(ADD_SCHEMA);
const validateClone = ajv.compile(CLONE_SCHEMA);

/** What the routes need. */
export interface ProjectListRoutesOptions {
  projects: ProjectList;
}

/** A signal aborted when the client leaves before the answer (the clone and the reads are cancelled). */
export function clientGone(reply: FastifyReply): { signal: AbortSignal; detach(): void } {
  const gone = new AbortController();
  const onClose = (): void => {
    if (!reply.raw.writableFinished) gone.abort();
  };
  reply.raw.once('close', onClose);
  return { signal: gone.signal, detach: () => reply.raw.off('close', onClose) };
}

/** Answer the outcome of an add or a clone. */
async function answerAdd(
  request: FastifyRequest,
  reply: FastifyReply,
  work: (signal: AbortSignal) => Promise<unknown>,
): Promise<FastifyReply | undefined> {
  const gone = clientGone(reply);
  try {
    return await reply.code(201).send(await work(gone.signal));
  } catch (error) {
    if (gone.signal.aborted) {
      // The client left and its work was cancelled: no answer to send, nothing went wrong.
      request.log.debug('project add: client gone, work cancelled');
      reply.hijack();
      return undefined;
    }
    if (error instanceof ProjectRefusal) {
      const body = {
        error: { code: error.code, message: error.message, ...(error.detail ? { detail: error.detail } : {}) },
      };
      return reply.code(422).send(body);
    }
    if (error instanceof InvalidProjectRequest) return reply.code(400).send(envelope('invalid-request', error.message));
    if (error instanceof CliError) {
      const { status, body } = cliErrorEnvelope(error);
      return reply.code(status).send(body);
    }
    if (error instanceof CloneCancelledError) {
      request.log.warn('project clone ended by the stop sequence');
      return reply.code(500).send(envelope('internal', 'Internal error'));
    }
    throw error;
  } finally {
    gone.detach();
  }
}

/** Register the four routes. */
export function registerProjectListRoutes(app: FastifyInstance, options: ProjectListRoutesOptions): void {
  const { projects } = options;

  app.get(PROJECTS_PATH, async (): Promise<ProjectListResponse> => ({ projects: await projects.list() }));

  app.post<{ Body: ProjectAddRequest }>(PROJECTS_PATH, {
    schema: { body: ADD_SCHEMA },
    validatorCompiler: () => validateAdd,
    handler: (request, reply) => answerAdd(request, reply, (signal) => projects.add(request.body.path, signal)),
  });

  app.post<{ Body: CloneRequest }>(`${PROJECTS_PATH}/clone`, {
    schema: { body: CLONE_SCHEMA },
    validatorCompiler: () => validateClone,
    handler: (request, reply) => answerAdd(request, reply, (signal) => projects.clone(request.body, signal)),
  });

  app.delete<{ Params: { pid: string } }>(`${PROJECTS_PATH}/:pid`, async (request, reply) => {
    if (!(await projects.remove(request.params.pid))) {
      return reply.code(404).send(envelope('not-found', 'Not found'));
    }
    return reply.code(204).send();
  });
}
