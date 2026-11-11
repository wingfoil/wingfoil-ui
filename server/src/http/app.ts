/**
 * The HTTP application (spec-004 §1): the static `web/` build at `/`, the API under `/api/`, and
 * the application returned for any other path (client-side routing).
 */
import fastifyStatic from '@fastify/static';
import { fastify, type FastifyBaseLogger, type FastifyInstance, type FastifyReply } from 'fastify';
import { existsSync } from 'node:fs';
import { STATUS_CODES } from 'node:http';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { GitReadError } from '../git/git.js';
import type { Logger } from 'pino';
import {
  hasOwnOrigin,
  isAllowedFetchSite,
  isApiUrl,
  isAuthenticated,
  refuseOrigin,
  refuseUnauthenticated,
  registerGuards,
  type SecurityOptions,
} from './guards.js';
import { registerSessionRoute } from './session.js';

/** Options of {@link buildApp}. */
export interface AppOptions {
  /** Directory of the `web/` build; the application is not served when it has no `index.html`. */
  staticDir: string;
  logger: Logger;
  /** The Host/Origin and session guards and `POST /api/session` (spec-004 §1–2): always on. */
  security: SecurityOptions;
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

/**
 * The longest route parameter, in UTF-16 code units of its percent-decoded value (spec-011 §4,
 * bug-019): an id is a file name (`<id>.md`, 255 bytes), so 252 characters at most.
 */
export const MAX_PARAM_LENGTH = 255;

function notFound(reply: FastifyReply): FastifyReply {
  return reply.code(404).send(envelope('not-found', 'Not found'));
}

/**
 * The body codes of the client errors the error handler does not name otherwise (task-063 D63-10,
 * the approver's Q3 a): a code that matches the status, `client-error` for any other 4xx. 400 is
 * `invalid-request` and 404 `not-found`, as before.
 */
const CLIENT_ERROR_CODES: Readonly<Record<number, string>> = {
  400: 'invalid-request',
  403: 'forbidden',
  404: 'not-found',
  412: 'precondition-failed',
  413: 'payload-too-large',
  415: 'unsupported-media-type',
  416: 'range-not-satisfiable',
};

/** The body code of the client error `status` (4xx). */
export function clientErrorCode(status: number): string {
  return CLIENT_ERROR_CODES[status] ?? 'client-error';
}

/** The route the static file plugin registers for every path (`wildcard: true`). */
const STATIC_ROUTE = '/*';

/**
 * Below every file-system name limit in use (ext4 and most file systems 255 bytes, eCryptfs 143) and
 * far below `PATH_MAX`: a path whose segments and length stay under these is never judged by a
 * `stat` (task-063 review round 1 F-3, no system call on an ordinary request).
 */
const SHORT_SEGMENT_BYTES = 128;
const SHORT_PATH_BYTES = 1024;

/**
 * bug-031 (task-063 D63-9): `true` when the file system refuses the static path `url` as too long
 * (`ENAMETOOLONG`, its own limit, not a constant). A path with an empty, `.` or `..` segment, or a
 * segment holding a backslash (a separator on Windows), is never judged here: the plugin's refusal of a
 * non-canonical path stands, and the `stat` stays inside `root`. A segment holding `\0` needs no
 * rule of its own: `stat` refuses it with `ERR_INVALID_ARG_VALUE`, never `ENAMETOOLONG`.
 */
async function isNameTooLong(root: string, url: string): Promise<boolean> {
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.split('?')[0] ?? '');
  } catch {
    return false;
  }
  const segments = pathname.split('/').slice(1);
  if (
    Buffer.byteLength(pathname) < SHORT_PATH_BYTES &&
    segments.every((s) => Buffer.byteLength(s) < SHORT_SEGMENT_BYTES)
  ) {
    return false;
  }
  if (segments.some((s) => s === '' || s === '.' || s === '..' || s.includes('\\'))) return false;
  try {
    await stat(path.join(root, ...segments));
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENAMETOOLONG';
  }
}

/** Build the application; call `ready()` before handing `routing` to a server. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const loggerInstance: FastifyBaseLogger = options.logger;
  const app = fastify({
    loggerInstance,
    routerOptions: { maxParamLength: MAX_PARAM_LENGTH },
    // Errors Fastify raises before routing (e.g. a malformed URL) get the envelope too.
    frameworkErrors: (error, request, reply) => {
      const fastifyReply = reply as unknown as FastifyReply;
      // The spec-004 §4 order holds here too: Host/Origin and, on /api, Sec-Fetch-Site (403), session
      // (401), then the 404 of a too-long parameter (spec-011 §4, C1: an unknown id on every method)
      // or the 400.
      if (!hasOwnOrigin(request.headers, request.raw.rawHeaders, options.security.port())) {
        return void refuseOrigin(fastifyReply);
      }
      if (isApiUrl(request.raw.url ?? '')) {
        if (!isAllowedFetchSite(request.raw.rawHeaders)) return void refuseOrigin(fastifyReply);
        if (!isAuthenticated(request.headers, options.security)) return void refuseUnauthenticated(fastifyReply);
      }
      if (error.code === 'FST_ERR_MAX_PARAM_LENGTH') return void notFound(fastifyReply);
      void fastifyReply.code(400).send(envelope('invalid-request', 'Invalid request'));
    },
  });
  // Before the static files and every route: the guards answer first (spec-004 §4 rows 1–2).
  registerGuards(app, options.security);
  registerSessionRoute(app, options.security);
  const hasWebBuild = existsSync(path.join(options.staticDir, 'index.html'));
  if (hasWebBuild) {
    // bug-031: a path the file system refuses as too long is missing — decided before the static
    // plugin runs (it would answer 403, and an answer re-sent from the error handler left its
    // stream's `close` listeners on the response: review round 1 F-3). The not-found handler
    // answers: 404 under /assets/, the application else. The static route only (GET and HEAD).
    app.addHook('preHandler', async (request, reply) => {
      if (request.routeOptions.url !== STATIC_ROUTE) return;
      if (await isNameTooLong(options.staticDir, request.url)) return reply.callNotFound();
    });
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
    // A client error keeps its status (400, 403, 413, 415, …), with a code that matches it.
    if (status >= 400 && status < 500)
      return reply
        .code(status)
        .send(
          envelope(
            clientErrorCode(status),
            status === 400 ? 'Invalid request' : (STATUS_CODES[status] ?? 'Client error'),
          ),
        );
    if (error instanceof GitReadError) {
      // Git's message may quote configuration values and paths (task-046 review rounds 3 m1, 4
      // minor-1): on any route, the kind and the exit only.
      request.log.error({ kind: 'git-read', ended: error.ended, exitCode: error.exitCode }, 'git read failed');
    } else request.log.error({ err: error }, 'request failed');
    return reply.code(500).send(envelope('internal', 'Internal error'));
  });
  app.setNotFoundHandler((request, reply) => {
    const pathname = request.url.split('?')[0] ?? '';
    const isApi = isApiUrl(request.url);
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
