/**
 * The request guards (spec-004 §1–2, §4 rows 1–2): every request passes the Host and Origin
 * checks (403 `forbidden-origin`, REQ-SEC-03), then every `/api/` request — the event stream
 * included — needs the session cookie or the start token (401 `unauthenticated`, REQ-SEC-02). The
 * static application files are exempt from the session only. Both checks answer in an `onRequest`
 * hook, before any handler runs: a refused request starts no process.
 */
import type { IncomingHttpHeaders } from 'node:http';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Authentication } from '../auth/authentication.js';
import { envelope } from './app.js';

/** What the guards need: who may call, and the port the console listens on. */
export interface SecurityOptions {
  authentication: Authentication;
  /**
   * The listening port (the Host, the Origin and the cookie name carry it); `undefined` while
   * unknown, when every request is refused.
   */
  port: () => number | undefined;
}

/** Prefix of the session cookie's name; the port follows (cookies are not scoped by port). */
export const SESSION_COOKIE_PREFIX = 'wfui_session_';

/** The host names of the console's own origin (spec-004 §1). */
const OWN_HOSTS = ['127.0.0.1', 'localhost', '[::1]'] as const;

/** Name of the session cookie of the console listening on `port`: `wfui_session_<port>`. */
export function sessionCookieName(port: number): string {
  return `${SESSION_COOKIE_PREFIX}${port}`;
}

/** `true` when `host` (the `Host` header) is `127.0.0.1:<port>`, `localhost:<port>` or `[::1]:<port>`. */
export function isAllowedHost(host: string | undefined, port: number | undefined): boolean {
  if (host === undefined || port === undefined) return false;
  const value = host.toLowerCase();
  return OWN_HOSTS.some((name) => value === `${name}:${port}`);
}

/** `true` when `origin` (the `Origin` header) is the console's own: `http://<own host>:<port>`. */
export function isAllowedOrigin(origin: string, port: number | undefined): boolean {
  if (port === undefined) return false;
  const value = origin.toLowerCase();
  return OWN_HOSTS.some((name) => value === `http://${name}:${port}`);
}

/** `true` when the request's Host, and its Origin when present, are the console's own. */
export function hasOwnOrigin(headers: IncomingHttpHeaders, port: number | undefined): boolean {
  if (!isAllowedHost(headers.host, port)) return false;
  return headers.origin === undefined || isAllowedOrigin(headers.origin, port);
}

/** The token of an `Authorization: Bearer <token>` header. */
export function bearerToken(headers: IncomingHttpHeaders): string | undefined {
  const match = /^Bearer (\S+)$/.exec(headers.authorization ?? '');
  return match?.[1];
}

/** Every value of the cookie `name` in the `Cookie` header. */
function cookieValues(header: string | undefined, name: string): string[] {
  if (header === undefined) return [];
  const values: string[] = [];
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq >= 0 && part.slice(0, eq).trim() === name) values.push(part.slice(eq + 1).trim());
  }
  return values;
}

function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/');
}

/** `true` for a request that reaches the API: by its route, its path or its decoded path. */
function reachesApi(request: FastifyRequest): boolean {
  const route = request.routeOptions.url;
  if (route !== undefined && isApiPath(route)) return true;
  const pathname = request.url.split('?')[0] ?? '';
  if (isApiPath(pathname)) return true;
  try {
    return isApiPath(decodeURIComponent(pathname));
  } catch {
    return true; // undecodable: never served as a static file, refuse rather than guess
  }
}

/** `true` when the request carries this start's token or a session opened with it. */
export function isAuthenticated(request: FastifyRequest, options: SecurityOptions): boolean {
  const { authentication } = options;
  const token = bearerToken(request.headers);
  if (token !== undefined && authentication.verifyToken(token)) return true;
  const port = options.port();
  if (port === undefined) return false;
  return cookieValues(request.headers.cookie, sessionCookieName(port)).some((id) => authentication.verifySession(id));
}

/** The 403 refusal of a foreign Host or Origin. */
export function refuseOrigin(reply: FastifyReply): FastifyReply {
  return reply.code(403).send(envelope('forbidden-origin', 'Forbidden origin'));
}

/** Register the guards; call before any route or plugin so that they cover every request. */
export function registerGuards(app: FastifyInstance, options: SecurityOptions): void {
  app.addHook('onRequest', async (request, reply) => {
    if (!hasOwnOrigin(request.headers, options.port())) return refuseOrigin(reply);
    if (reachesApi(request) && !isAuthenticated(request, options)) {
      return reply.code(401).send(envelope('unauthenticated', 'Authentication required'));
    }
    return undefined;
  });
}
