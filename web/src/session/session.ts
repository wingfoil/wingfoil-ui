/**
 * The page's session with the console (spec-004 §2, REQ-SEC-02). The start URL carries the token in
 * its fragment, which the browser never sends: on load the fragment is removed from the address bar
 * and the token exchanged with `POST /api/session` for the `HttpOnly` session cookie. A page opened
 * without a token (a reload) relies on that cookie. A 401 anywhere — the exchange, an API call, the
 * event stream's probe — means the console no longer knows this page (stopped or started again):
 * the session is **lost** for good and the shell shows the lost-session notice (decision W3-7).
 */
import { useSyncExternalStore } from 'react';

/** `connecting` until the bootstrap ends, then `connected` or `lost` (final). */
export type SessionStatus = 'connecting' | 'connected' | 'lost';

let status: SessionStatus = 'connecting';
const listeners = new Set<() => void>();

function setStatus(next: SessionStatus): void {
  if (status === next || status === 'lost') return;
  status = next;
  for (const l of [...listeners]) l();
}

/** The current status. */
export function sessionStatus(): SessionStatus {
  return status;
}

/** Calls `listener` on every status change; returns the unsubscribe function. */
export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The console refused this page's session (a 401): lost for good. */
export function markSessionLost(): void {
  setStatus('lost');
}

/** Back to `connecting` (tests only: a page has one session). */
export function resetSession(): void {
  status = 'connecting';
  listeners.clear();
}

/** The session status as React state. */
export function useSessionStatus(): SessionStatus {
  return useSyncExternalStore(subscribeSession, sessionStatus);
}

/** The `token` of a URL fragment (`#token=…`), if any. */
export function fragmentToken(hash: string): string | undefined {
  if (!hash.startsWith('#')) return undefined;
  const token = new URLSearchParams(hash.slice(1)).get('token');
  return token || undefined;
}

/**
 * Bootstrap the session before the first render: take the token out of the address bar
 * (`history.replaceState`, path and query kept) and exchange it with `POST /api/session`.
 */
export async function bootstrapSession(): Promise<SessionStatus> {
  const token = fragmentToken(window.location.hash);
  if (token === undefined) {
    setStatus('connected');
    return status;
  }
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  try {
    const response = await fetch('/api/session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Authorization: `Bearer ${token}` },
    });
    setStatus(response.status === 204 ? 'connected' : 'lost');
  } catch {
    setStatus('lost');
  }
  return status;
}
