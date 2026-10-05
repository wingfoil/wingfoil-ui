/**
 * The HTTP application (spec-004 §1): the static `web/` build at `/`, the API under `/api/`, and
 * the application returned for any other path (client-side routing).
 */
import fastifyStatic from '@fastify/static';
import { fastify, type FastifyBaseLogger, type FastifyInstance, type FastifyReply } from 'fastify';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';

/** Options of {@link buildApp}. */
export interface AppOptions {
  /** Directory of the `web/` build; the application is not served when it has no `index.html`. */
  staticDir: string;
  logger: Logger;
  /** Registers routes and hooks before the application is ready (later tasks: `/api/` routes). */
  register?: (app: FastifyInstance) => void | Promise<void>;
}

/** The error envelope of every refusal (spec-004 §5). */
export interface ErrorEnvelope {
  error: { code: string; message: string; detail?: unknown };
}

/** Path prefix of the files of the `web/` build (Vite's `assets/`): never a client-side route. */
export const ASSETS_PREFIX = '/assets/';

/** The error envelope with `code` and `message` (the message is never shown to the user). */
export function envelope(code: string, message: string): ErrorEnvelope {
  return { error: { code, message } };
}

function notFound(reply: FastifyReply): FastifyReply {
  return reply.code(404).send(envelope('not-found', 'Not found'));
}

/** Build the application; call `ready()` before handing `routing` to a server. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const loggerInstance: FastifyBaseLogger = options.logger;
  const app = fastify({
    loggerInstance,
    // Errors Fastify raises before routing (e.g. a malformed URL) get the envelope too.
    frameworkErrors: (_error, _request, reply) => {
      void (reply as unknown as FastifyReply).code(400).send(envelope('invalid-request', 'Invalid request'));
    },
  });
  const hasWebBuild = existsSync(path.join(options.staticDir, 'index.html'));
  if (hasWebBuild) {
    await app.register(fastifyStatic, {
      root: options.staticDir,
      prefix: '/',
      wildcard: true,
      index: 'index.html',
      dotfiles: 'ignore',
    });
  } else {
    app.log.warn({ staticDir: options.staticDir }, 'web build not found: the application is not served');
  }
  app.setErrorHandler((error: { statusCode?: number; validation?: unknown }, request, reply) => {
    const status = error.validation !== undefined ? 400 : (error.statusCode ?? 500);
    if (status === 404) return notFound(reply);
    // A client error keeps its status (400, 413, 415, …); the request is what is wrong.
    if (status >= 400 && status < 500) return reply.code(status).send(envelope('invalid-request', 'Invalid request'));
    request.log.error({ err: error }, 'request failed');
    return reply.code(500).send(envelope('internal', 'Internal error'));
  });
  app.setNotFoundHandler((request, reply) => {
    const pathname = request.url.split('?')[0] ?? '';
    const isApi = pathname === '/api' || pathname.startsWith('/api/');
    // A missing build asset stays a 404; every other path is a client-side route (it may hold a
    // dot: a release id `v0.1`, a document `README.md`).
    const isAsset = pathname.startsWith(ASSETS_PREFIX);
    if (isApi || isAsset || !hasWebBuild || (request.method !== 'GET' && request.method !== 'HEAD')) {
      return notFound(reply);
    }
    return reply.sendFile('index.html');
  });
  if (options.register) await options.register(app);
  await app.ready();
  return app;
}
