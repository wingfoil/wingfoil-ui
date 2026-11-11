// @vitest-environment jsdom
// task-063 (adr-003 D6, AC-2, AC-3; D63-1 … D63-7): a page the console no longer recognises
// recovers in place once the browser holds a session again — on a message of the same-origin
// channel `wfui-session` or when the user returns to it, one probe of `GET /api/server` with the
// cookie at a time, a reload of its own address on an OK answer. A fake channel and dispatched
// visibility and focus events stand for the browser (headless engines report every page visible).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchSessionRecovery, ownAddress } from '../../../web/src/session/recovery.js';
import { markSessionLost, resetSession, SESSION_CHANNEL } from '../../../web/src/session/session.js';

/** A same-process stand-in of `BroadcastChannel`: delivers to the other instances of one name. */
class FakeChannel {
  static readonly open = new Set<FakeChannel>();
  onmessage: ((event: MessageEvent) => void) | null = null;
  closed = false;
  constructor(readonly name: string) {
    FakeChannel.open.add(this);
  }
  postMessage(data: unknown): void {
    for (const other of FakeChannel.open) {
      if (other !== this && other.name === this.name && !other.closed) {
        queueMicrotask(() => other.onmessage?.(new MessageEvent('message', { data })));
      }
    }
  }
  close(): void {
    this.closed = true;
    FakeChannel.open.delete(this);
  }
}

/** Another tab of the same origin. */
const otherTab = () => new FakeChannel(SESSION_CHANNEL);
const flush = () => new Promise((r) => setTimeout(r, 0));

let visibility: DocumentVisibilityState = 'visible';
function setVisibility(next: DocumentVisibilityState): void {
  visibility = next;
  document.dispatchEvent(new Event('visibilitychange'));
}
/** The user leaves the tab and comes back to it. */
function leaveAndReturn(): void {
  window.dispatchEvent(new Event('blur'));
  setVisibility('hidden');
  setVisibility('visible');
  window.dispatchEvent(new Event('focus'));
}

function fetchAnswering(status: number): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async () => new Response(null, { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

/** A fetch whose answers the test gives, one per call. */
function fetchControlled(): { fn: ReturnType<typeof vi.fn>; answer: (status: number) => void } {
  const pending: ((r: Response) => void)[] = [];
  const fn = vi.fn(() => new Promise<Response>((resolve) => pending.push(resolve)));
  vi.stubGlobal('fetch', fn);
  return { fn, answer: (status) => pending.shift()?.(new Response(null, { status })) };
}

let stop: (() => void) | undefined;
let reload: ReturnType<typeof vi.fn<(address: string) => void>>;

beforeEach(() => {
  resetSession();
  FakeChannel.open.clear();
  vi.stubGlobal('BroadcastChannel', FakeChannel);
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  history.replaceState(null, '', '/p/p_abc/e/task-001-login-form?panel=x');
  reload = vi.fn<(address: string) => void>();
});
afterEach(() => {
  stop?.();
  stop = undefined;
  vi.unstubAllGlobals();
});

describe('triggers (D63-3)', () => {
  it('a lost page probes on a message and reloads its own address on an OK answer', async () => {
    const fetchFn = fetchAnswering(200);
    markSessionLost();
    stop = watchSessionRecovery({ reload });
    otherTab().postMessage(null);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledWith(`${location.origin}/p/p_abc/e/task-001-login-form?panel=x`);
  });

  it('a page that is not lost never probes', async () => {
    const fetchFn = fetchAnswering(200);
    stop = watchSessionRecovery({ reload });
    otherTab().postMessage(null);
    leaveAndReturn();
    await flush();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('probes on a return: hidden then visible, blur then focus, once per return', async () => {
    const fetchFn = fetchAnswering(401);
    markSessionLost();
    stop = watchSessionRecovery({ reload });
    leaveAndReturn();
    await flush();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    // Only the tab's visibility, then only the window's focus: one probe each.
    setVisibility('hidden');
    setVisibility('visible');
    await flush();
    expect(fetchFn).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
    await flush();
    expect(fetchFn).toHaveBeenCalledTimes(3);
    // Visible or focused again without leaving first: nothing.
    setVisibility('visible');
    window.dispatchEvent(new Event('focus'));
    await flush();
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(reload).not.toHaveBeenCalled();
  });

  it('is not armed at load: a focus or a visible page without leaving first does not probe', async () => {
    const fetchFn = fetchAnswering(200);
    markSessionLost();
    stop = watchSessionRecovery({ reload });
    window.dispatchEvent(new Event('focus'));
    setVisibility('visible');
    await flush();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('Q1 — a message heard before the loss probes once at the loss, then is forgotten', async () => {
    const fetchFn = fetchAnswering(401);
    stop = watchSessionRecovery({ reload });
    otherTab().postMessage(null);
    await flush();
    expect(fetchFn).not.toHaveBeenCalled();
    markSessionLost();
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    await flush();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('without BroadcastChannel the return still recovers', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    fetchAnswering(200);
    markSessionLost();
    stop = watchSessionRecovery({ reload });
    leaveAndReturn();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('stops listening once disposed', async () => {
    const fetchFn = fetchAnswering(200);
    markSessionLost();
    watchSessionRecovery({ reload })();
    otherTab().postMessage(null);
    leaveAndReturn();
    await flush();
    expect(fetchFn).not.toHaveBeenCalled();
    expect([...FakeChannel.open].filter((c) => c.onmessage !== null)).toEqual([]);
  });
});

describe('the probe (D63-4)', () => {
  it('GET /api/server with the cookie only: no header, no body, a 10 s timeout', async () => {
    const fetchFn = fetchAnswering(401);
    markSessionLost();
    stop = watchSessionRecovery({ reload });
    otherTab().postMessage(null);
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/server');
    expect(init.method ?? 'GET').toBe('GET');
    expect(init.credentials).toBe('same-origin');
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeUndefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('one probe at a time; a message during a probe asks for exactly one more', async () => {
    const { fn, answer } = fetchControlled();
    markSessionLost();
    stop = watchSessionRecovery({ reload });
    const tab = otherTab();
    tab.postMessage(null);
    await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
    tab.postMessage(null);
    tab.postMessage(null);
    leaveAndReturn();
    await flush();
    expect(fn).toHaveBeenCalledTimes(1);
    answer(401);
    await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
    answer(200);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403, 500, 502])('a %s answer leaves the notice and frees the guard', async (status) => {
    const fetchFn = fetchAnswering(status);
    markSessionLost();
    stop = watchSessionRecovery({ reload });
    const tab = otherTab();
    tab.postMessage(null);
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    await flush();
    tab.postMessage(null);
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
    expect(reload).not.toHaveBeenCalled();
  });

  it('a network failure and a probe with no answer in time leave the notice and free the guard', async () => {
    const fetchFn = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('timed out', 'TimeoutError')));
        }),
    );
    vi.stubGlobal('fetch', fetchFn);
    markSessionLost();
    stop = watchSessionRecovery({ reload, probeTimeoutMs: 20 });
    const tab = otherTab();
    tab.postMessage(null);
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 60));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    tab.postMessage(null);
    await flush();
    await flush();
    tab.postMessage(null);
    await flush();
    await flush();
    expect(reload).not.toHaveBeenCalled();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it('reloads once: later answers and triggers do nothing', async () => {
    const fetchFn = fetchAnswering(200);
    markSessionLost();
    stop = watchSessionRecovery({ reload });
    otherTab().postMessage(null);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    otherTab().postMessage(null);
    leaveAndReturn();
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe('what never happens (AC-3)', () => {
  it("the message's content is never read: a token-like payload changes nothing", async () => {
    const fetchFn = fetchAnswering(200);
    markSessionLost();
    stop = watchSessionRecovery({ reload });
    otherTab().postMessage({ token: 'A'.repeat(43), path: '//evil.test/x', next: 'https://evil.test' });
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/server');
    expect(JSON.stringify(init)).not.toContain('A'.repeat(43));
    expect(reload).toHaveBeenCalledWith(`${location.origin}/p/p_abc/e/task-001-login-form?panel=x`);
  });

  it('the reload address is absolute, of the page origin, without the fragment', () => {
    expect(ownAddress('http://127.0.0.1:4870//evil.test/x?q=1#main')).toBe('http://127.0.0.1:4870//evil.test/x?q=1');
    expect(ownAddress('http://127.0.0.1:4870/p/a/e/b?panel=c#token=x')).toBe('http://127.0.0.1:4870/p/a/e/b?panel=c');
    expect(ownAddress('http://127.0.0.1:4870/')).toBe('http://127.0.0.1:4870/');
  });

  it('no reload loop: a reloaded page that loses its session again does not probe on its own', async () => {
    const fetchFn = fetchAnswering(200);
    // A fresh page (after the reload): no message heard, not armed; a later read answers 401.
    stop = watchSessionRecovery({ reload });
    markSessionLost();
    window.dispatchEvent(new Event('focus'));
    await flush();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('nothing is logged', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    fetchAnswering(401);
    markSessionLost();
    stop = watchSessionRecovery({ reload });
    otherTab().postMessage(null);
    leaveAndReturn();
    await flush();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
