/**
 * Recovery in place of a page the console no longer recognises (adr-003 D6, task-063): a lost page
 * — its session refused with a 401, the console stopped and started again on the same port —
 * reloads its own address once the browser holds a session again, so the requested page opens
 * without the user doing anything but opening the new console URL in any tab of this browser.
 *
 * - A tab whose token exchange succeeds posts an empty message on the same-origin
 *   `BroadcastChannel` {@link SESSION_CHANNEL} ({@link announceSession}, called by the bootstrap).
 * - A lost page probes `GET /api/server` with its cookie only — on that message, when the user
 *   returns to it (once per return), or at the loss when a message was heard just before it. One
 *   probe at a time, with the 10 s timeout of `watchFragmentToken`; an OK answer reloads the page,
 *   anything else leaves the lost-session notice.
 *
 * What never happens: the message's content is never read, and no token, session id or path
 * crosses tabs; nothing is logged; no exchange is retried (a failed exchange stays final, bug-016);
 * nothing is added to the address and no redirect parameter exists. The status `lost` stays final
 * inside the page: the only way out is a full load, so no state of the dead session survives.
 */
import { ownAddress, PROBE_TIMEOUT_MS, SESSION_CHANNEL, sessionStatus, subscribeSession } from './session.js';

/** Options of {@link watchSessionRecovery}. */
export interface RecoveryOptions {
  /** Loads `address` in place of the page (default `location.replace`; tests). */
  reload?: (address: string) => void;
  /** Longest wait for the probe's answer (default 10 s, as `watchFragmentToken`). */
  probeTimeoutMs?: number;
}

/**
 * Listen for the moments a lost page may have a session again and recover it by a reload of its
 * own address. Returns the function that stops listening.
 */
export function watchSessionRecovery(options: RecoveryOptions = {}): () => void {
  const reload = options.reload ?? ((address: string) => window.location.replace(address));
  const timeoutMs = options.probeTimeoutMs ?? PROBE_TIMEOUT_MS;
  let probing = false;
  // A message that arrived during a probe asks for one more after it (never a queue).
  let again = false;
  // A message heard while the page was not lost yet (Q1): probed once at the loss.
  let heard = false;
  // Armed when the user leaves the page; a return probes once (not armed at load).
  let armed = false;
  let reloading = false;

  const probe = (): void => {
    if (reloading || sessionStatus() !== 'lost') return;
    probing = true;
    void fetch('/api/server', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) })
      .then(
        (response) => {
          if (response.ok) {
            reloading = true;
            reload(ownAddress(window.location.href));
          }
        },
        // Not reachable or no answer in time: the notice stays.
        () => undefined,
      )
      .finally(() => {
        probing = false;
        if (again) {
          again = false;
          probe();
        }
      });
  };

  const onMessage = (): void => {
    if (sessionStatus() !== 'lost') {
      heard = true;
      return;
    }
    if (probing) again = true;
    else probe();
  };
  const onReturn = (): void => {
    if (!armed) return;
    armed = false;
    if (!probing) probe();
  };
  const onLeave = (): void => {
    armed = true;
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') onLeave();
    else if (document.visibilityState === 'visible') onReturn();
  };

  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(SESSION_CHANNEL) : undefined;
  // The event is a hint only: its data is never read.
  if (channel) channel.onmessage = () => onMessage();
  const unsubscribe = subscribeSession(() => {
    if (heard && sessionStatus() === 'lost') {
      heard = false;
      if (!probing) probe();
    }
  });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', onLeave);
  window.addEventListener('focus', onReturn);
  return () => {
    if (channel) {
      channel.onmessage = null;
      channel.close();
    }
    unsubscribe();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('blur', onLeave);
    window.removeEventListener('focus', onReturn);
  };
}
