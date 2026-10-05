/**
 * `POST /api/session` (spec-004 §2): exchanges the start token, sent as
 * `Authorization: Bearer <token>`, for the session cookie
 * `wfui_session_<port>=<session id>; HttpOnly; SameSite=Strict; Path=/` — no `Max-Age`: it ends
 * with the browser session. Answers 204 without a body.
 */
import type { FastifyInstance } from 'fastify';
import { envelope } from './app.js';
import { bearerToken, sessionCookieName, type SecurityOptions } from './guards.js';

/** Path of the session exchange. */
export const SESSION_PATH = '/api/session';

/** Register `POST /api/session`. A session cookie alone does not open another session. */
export function registerSessionRoute(app: FastifyInstance, options: SecurityOptions): void {
  app.post(SESSION_PATH, async (request, reply) => {
    const token = bearerToken(request.headers);
    const port = options.port();
    if (token === undefined || port === undefined || !options.authentication.verifyToken(token)) {
      return reply.code(401).send(envelope('unauthenticated', 'Authentication required'));
    }
    const sessionId = options.authentication.openSession();
    return reply
      .header('set-cookie', `${sessionCookieName(port)}=${sessionId}; HttpOnly; SameSite=Strict; Path=/`)
      .code(204)
      .send();
  });
}
