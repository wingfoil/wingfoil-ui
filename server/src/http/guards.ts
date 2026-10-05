/**
 * The request guards (spec-004 §1–2, §4 rows 1–2): every request passes the Host and Origin
 * checks (403 `forbidden-origin`, REQ-SEC-03), then every `/api/` request — the event stream
 * included — passes the `Sec-Fetch-Site` check (403, spec-004 §1 amended 2026-10-05) and needs
 * the session cookie or the start token (401 `unauthenticated`, REQ-SEC-02). The static
 * application files are exempt from the session only. Both checks answer in an `onRequest`
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

/** Number of `Host` headers in `rawHeaders` (Node keeps only the first in `headers`). */
function hostHeaderCount(rawHeaders: readonly string[]): number {
  let count = 0;
  for (let i = 0; i < rawHeaders.length; i += 2) if (rawHeaders[i]?.toLowerCase() === 'host') count += 1;
  return count;
}

/**
 * `true` when the request has exactly one `Host` header, the console's own, and an Origin, when
 * present, that is the console's own too. `rawHeaders` is the request's `rawHeaders` list.
 */
export function hasOwnOrigin(
  headers: IncomingHttpHeaders,
  rawHeaders: readonly string[],
  port: number | undefined,
): boolean {
  if (hostHeaderCount(rawHeaders) !== 1 || !isAllowedHost(headers.host, port)) return false;
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
  const value = pathname.toLowerCase();
  return value === '/api' || value.startsWith('/api/');
}

/** The `Sec-Fetch-Site` values the API accepts: the console's own page, or a user-typed request. */
const OWN_FETCH_SITES = new Set(['same-origin', 'none']);

/**
 * `true` when `rawHeaders` hold no `Sec-Fetch-Site` header (scripts, tests, older browsers: the
 * Host/Origin checks judge them) or exactly one, `same-origin` or `none` (spec-004 §1, amended
 * 2026-10-05). A page served by another local port is `same-site` for the browser — cookies
 * ignore ports — and its no-cors GET carries no `Origin`: refused here.
 */
export function isAllowedFetchSite(rawHeaders: readonly string[]): boolean {
  const values: string[] = [];
  for (let i = 0; i < rawHeaders.length; i += 2) {
    if (rawHeaders[i]?.toLowerCase() === 'sec-fetch-site') values.push((rawHeaders[i + 1] ?? '').trim().toLowerCase());
  }
  if (values.length === 0) return true;
  return values.length === 1 && OWN_FETCH_SITES.has(values[0]!);
}

/**
 * `true` when the request URL `url` (path and query) is under `/api`: as written, or with its
 * percent-encoded ASCII characters decoded (`/%61pi/…`); never throws on a malformed encoding.
 */
export function isApiUrl(url: string): boolean {
  const pathname = url.split('?')[0] ?? '';
  const decoded = pathname.replace(/%([0-7][0-9a-f])/gi, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  return isApiPath(pathname) || isApiPath(decoded);
}

/** `true` for a request that reaches the API: by its matched route or by its URL. */
function reachesApi(request: FastifyRequest): boolean {
  const route = request.routeOptions.url;
  return (route !== undefined && isApiPath(route)) || isApiUrl(request.url);
}

/** `true` when `headers` carry this start's token or a session opened with it. */
export function isAuthenticated(headers: IncomingHttpHeaders, options: SecurityOptions): boolean {
  const { authentication } = options;
  const token = bearerToken(headers);
  if (token !== undefined && authentication.verifyToken(token)) return true;
  const port = options.port();
  if (port === undefined) return false;
  return cookieValues(headers.cookie, sessionCookieName(port)).some((id) => authentication.verifySession(id));
}

/** The 403 refusal of a foreign Host or Origin. */
export function refuseOrigin(reply: FastifyReply): FastifyReply {
  return reply.code(403).send(envelope('forbidden-origin', 'Forbidden origin'));
}

/** The 401 refusal of a request without a valid session or token. */
export function refuseUnauthenticated(reply: FastifyReply): FastifyReply {
  return reply.code(401).send(envelope('unauthenticated', 'Authentication required'));
}

/** Register the guards; call before any route or plugin so that they cover every request. */
export function registerGuards(app: FastifyInstance, options: SecurityOptions): void {
  app.addHook('onRequest', async (request, reply) => {
    const { rawHeaders } = request.raw;
    if (!hasOwnOrigin(request.headers, rawHeaders, options.port())) return refuseOrigin(reply);
    if (!reachesApi(request)) return undefined; // static files: no session, no Sec-Fetch-Site check
    if (!isAllowedFetchSite(rawHeaders)) return refuseOrigin(reply);
    if (!isAuthenticated(request.headers, options)) return refuseUnauthenticated(reply);
    return undefined;
  });
}
