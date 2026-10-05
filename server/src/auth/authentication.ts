/**
 * The authentication port (adr-002) and its local adapter: the per-start session token and the
 * browser sessions derived from it (spec-004 §2, REQ-SEC-02). Everything lives in memory: a new
 * start invalidates every token and session, and nothing is written to disk.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Who is calling: the start token and the sessions opened with it. */
export interface Authentication {
  /** `true` when `token` is this start's token. */
  verifyToken(token: string): boolean;
  /** Open a new browser session; returns its id (random, never derived from the token). */
  openSession(): string;
  /** `true` when `sessionId` is a session opened by this start. */
  verifySession(sessionId: string): boolean;
}

/** Most sessions kept at once; opening one more evicts the oldest (bounded memory). */
export const MAX_SESSIONS = 64;

/** SHA-256 of `value`: equal-length digests let the comparison run in constant time. */
function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/** The in-memory adapter for the start token `token` (spec-004 §2). */
export function createTokenAuthentication(token: string): Authentication {
  if (token.length === 0) throw new Error('the session token must not be empty');
  const expected = digest(token);
  const sessions = new Set<string>();
  return {
    verifyToken: (candidate) => timingSafeEqual(digest(candidate), expected),
    openSession: () => {
      const id = randomBytes(32).toString('base64url');
      sessions.add(id);
      // A Set iterates in insertion order: the first id is the oldest.
      if (sessions.size > MAX_SESSIONS) sessions.delete(sessions.values().next().value as string);
      return id;
    },
    // The ids are 256-bit random values: a Set lookup reveals nothing usable through timing.
    verifySession: (sessionId) => sessions.has(sessionId),
  };
}
