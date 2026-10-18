/**
 * The page's session with the console (spec-004 §2, REQ-SEC-02). The start URL carries the token in
 * its fragment, which the browser never sends: on load the fragment is removed from the address bar
 * and the token exchanged with `POST /api/session` for the `HttpOnly` session cookie. A page opened
 * without a token (a reload) relies on that cookie. A 401 anywhere — the exchange, an API call, the
 * event stream's probe — means the console no longer knows this page (stopped or started again):
 * the session is **lost** for good and the shell shows the lost-session notice (decision W3-7).
 *
 * A console URL pasted into a tab that already shows the console changes only the fragment, which
 * the browser does not reload for (bug-016): {@link watchFragmentToken} handles that case.
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
  stripFragment();
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

/** Remove the fragment from the address bar (path and query kept), as the bootstrap does. */
function stripFragment(): void {
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
}

/** Options of {@link watchFragmentToken}. */
export interface WatchFragmentOptions {
  /** Reloads the page (default `location.reload()`; tests). */
  reload?: () => void;
  /** Longest wait for the probe's answer (default 10 s; review round 2 S2-8). */
  probeTimeoutMs?: number;
}

/**
 * bug-016 (task-040, D40-7): when the fragment changes to one carrying a `token` — a console URL
 * pasted into this tab — a lost page reloads, so the fresh-tab bootstrap reads it, removes it from
 * the address bar and exchanges it, and every state of the page starts over. A page that is not lost
 * first asks the console whether it still knows it (`GET /api/server` with the session cookie, one
 * probe at a time): a 401 reloads the same way; an OK answer means the session is valid — the
 * fragment is removed and ignored (any other answer leaves it, as an unreachable console does), so a `#token=…` link in rendered content cannot end it (a failed exchange is final). A
 * fragment without a token (a skip link) is left alone. The token is only ever read from
 * `location.hash`, and is never kept, logged or shown. Returns the function that stops listening.
 */
export function watchFragmentToken(options: WatchFragmentOptions = {}): () => void {
  const reload = options.reload ?? (() => window.location.reload());
  const timeoutMs = options.probeTimeoutMs ?? 10_000;
  // One probe at a time: a storm of fragment changes sends no more (review round 1 S6).
  let probing = false;
  const onChange = (): void => {
    if (fragmentToken(window.location.hash) === undefined) return;
    if (status === 'lost') {
      reload();
      return;
    }
    if (probing) return;
    probing = true;
    void fetch('/api/server', { credentials: 'same-origin', signal: AbortSignal.timeout(timeoutMs) })
      .then(
        (response) => {
          if (fragmentToken(window.location.hash) === undefined) return;
          if (response.status === 401) reload();
          // Known to the console: the fragment is not needed. Any other answer leaves it (S5).
          else if (response.ok) stripFragment();
        },
        // The console is not reachable, or did not answer in time: the fragment stays, a reload by
        // the user retries it.
        () => undefined,
      )
      .finally(() => {
        probing = false;
      });
  };
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}
