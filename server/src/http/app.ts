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
}

/** The error envelope of every refusal (spec-004 §5). */
export interface ErrorEnvelope {
  error: { code: string; message: string; detail?: unknown };
}

function notFound(reply: FastifyReply): FastifyReply {
  const body: ErrorEnvelope = { error: { code: 'not-found', message: 'Not found' } };
  return reply.code(404).send(body);
}

/** Build the application; call `ready()` before handing `routing` to a server. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const loggerInstance: FastifyBaseLogger = options.logger;
  const app = fastify({ loggerInstance });
  const hasWebBuild = existsSync(path.join(options.staticDir, 'index.html'));
  if (hasWebBuild) {
    await app.register(fastifyStatic, { root: options.staticDir, prefix: '/', wildcard: true, index: 'index.html' });
  } else {
    app.log.warn({ staticDir: options.staticDir }, 'web build not found: the application is not served');
  }
  app.setNotFoundHandler((request, reply) => {
    const pathname = request.url.split('?')[0] ?? '';
    const isApi = pathname === '/api' || pathname.startsWith('/api/');
    if (isApi || !hasWebBuild || (request.method !== 'GET' && request.method !== 'HEAD')) return notFound(reply);
    return reply.sendFile('index.html');
  });
  await app.ready();
  return app;
}
