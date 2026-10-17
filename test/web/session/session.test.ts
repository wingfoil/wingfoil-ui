// @vitest-environment jsdom
// spec-004 §2 (REQ-SEC-02; X-02.1 browser side, closed in task-015): the token is read from the URL
// fragment, removed from the address bar, exchanged with POST /api/session; a 401 loses the session.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bootstrapSession,
  markSessionLost,
  resetSession,
  sessionStatus,
  subscribeSession,
  watchFragmentToken,
} from '../../../web/src/session/session.js';

const TOKEN = 'A'.repeat(43);

beforeEach(() => {
  resetSession();
  history.replaceState(null, '', '/');
});
afterEach(() => vi.unstubAllGlobals());

function fetchAnswering(status: number): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async () => new Response(null, { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

it('starts connecting', () => {
  expect(sessionStatus()).toBe('connecting');
});

it('exchanges the fragment token for the session and removes the fragment', async () => {
  history.replaceState(null, '', `/p/x?q=1#token=${TOKEN}`);
  const fetchFn = fetchAnswering(204);
  expect(await bootstrapSession()).toBe('connected');
  expect(location.hash).toBe('');
  expect(location.pathname + location.search).toBe('/p/x?q=1');
  expect(fetchFn).toHaveBeenCalledTimes(1);
  const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('/api/session');
  expect(init.method).toBe('POST');
  expect(init.credentials).toBe('same-origin');
  expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${TOKEN}`);
  expect(init.body).toBeUndefined();
});

it('removes the fragment before the request answers', async () => {
  history.replaceState(null, '', `/#token=${TOKEN}`);
  let hashDuringFetch: string | undefined;
  vi.stubGlobal('fetch', async () => {
    hashDuringFetch = location.hash;
    return new Response(null, { status: 204 });
  });
  await bootstrapSession();
  expect(hashDuringFetch).toBe('');
});

it('uses the existing cookie when there is no token (reload)', async () => {
  const fetchFn = fetchAnswering(204);
  expect(await bootstrapSession()).toBe('connected');
  expect(fetchFn).not.toHaveBeenCalled();
});

it('leaves a fragment that holds no token alone', async () => {
  history.replaceState(null, '', '/#section');
  fetchAnswering(204);
  await bootstrapSession();
  expect(location.hash).toBe('#section');
});

it.each([401, 403, 500])('loses the session when the exchange answers %s', async (status) => {
  history.replaceState(null, '', `/#token=${TOKEN}`);
  fetchAnswering(status);
  expect(await bootstrapSession()).toBe('lost');
  expect(location.hash).toBe('');
});

it('loses the session when the console cannot be reached', async () => {
  history.replaceState(null, '', `/#token=${TOKEN}`);
  vi.stubGlobal('fetch', async () => {
    throw new TypeError('network');
  });
  expect(await bootstrapSession()).toBe('lost');
});

it('notifies subscribers once when the session is lost, and stays lost', async () => {
  const listener = vi.fn();
  const unsubscribe = subscribeSession(listener);
  markSessionLost();
  markSessionLost();
  expect(sessionStatus()).toBe('lost');
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
  fetchAnswering(204);
  expect(await bootstrapSession()).toBe('lost');
});

// bug-016 (task-040, D40-7): a token pasted into a tab that already shows the console changes only
// the fragment (no reload by the browser). A lost page reloads, so the fresh-tab bootstrap above reads,
// strips and exchanges it; a page whose session the console still knows strips it and keeps its
// session (a `#token=` link in rendered content cannot end it); other fragments are left alone.
describe('watchFragmentToken (bug-016)', () => {
  const paste = (hash: string) => {
    history.replaceState(null, '', `/p/x${hash}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
  let stop: (() => void) | undefined;
  afterEach(() => stop?.());

  it('a lost page reloads on a token fragment, with no request of its own', () => {
    const reload = vi.fn();
    const fetchFn = fetchAnswering(204);
    markSessionLost();
    stop = watchFragmentToken({ reload });
    paste(`#token=${TOKEN}`);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(fetchFn).not.toHaveBeenCalled();
    // The reload's bootstrap removes it: still there now.
    expect(location.hash).toBe(`#token=${TOKEN}`);
  });

  it('a connected page whose session the console rejects (401) reloads', async () => {
    const reload = vi.fn();
    const fetchFn = fetchAnswering(401);
    await bootstrapSession();
    stop = watchFragmentToken({ reload });
    paste(`#token=${TOKEN}`);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/server');
    expect(new Headers(init.headers).get('authorization')).toBeNull();
  });

  it('a connected page the console still knows strips the fragment and keeps its session', async () => {
    const reload = vi.fn();
    fetchAnswering(200);
    await bootstrapSession();
    stop = watchFragmentToken({ reload });
    paste(`?q=1#token=${TOKEN}`);
    await vi.waitFor(() => expect(location.hash).toBe(''));
    expect(location.pathname + location.search).toBe('/p/x?q=1');
    expect(reload).not.toHaveBeenCalled();
    expect(sessionStatus()).toBe('connected');
  });

  it('a fragment without a token (a skip link) does nothing', async () => {
    const reload = vi.fn();
    const fetchFn = fetchAnswering(200);
    markSessionLost();
    stop = watchFragmentToken({ reload });
    paste('#main');
    expect(reload).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(location.hash).toBe('#main');
  });

  it('the token is never written to the console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    fetchAnswering(401);
    await bootstrapSession();
    stop = watchFragmentToken({ reload: () => undefined });
    paste(`#token=${TOKEN}`);
    await new Promise((r) => setTimeout(r, 0));
    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(TOKEN);
      spy.mockRestore();
    }
  });

  it('S5 — an answer that is neither OK nor 401 leaves the fragment and the page alone', async () => {
    const reload = vi.fn();
    fetchAnswering(204);
    await bootstrapSession();
    fetchAnswering(503);
    stop = watchFragmentToken({ reload });
    paste(`#token=${TOKEN}`);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(reload).not.toHaveBeenCalled();
    expect(location.hash).toBe(`#token=${TOKEN}`);
  });

  it('S6 — a storm of fragment changes sends one probe at a time', async () => {
    const reload = vi.fn();
    fetchAnswering(204);
    await bootstrapSession();
    let answer: (r: Response) => void = () => {};
    const fetchFn = vi.fn(() => new Promise<Response>((r) => (answer = r)));
    vi.stubGlobal('fetch', fetchFn);
    stop = watchFragmentToken({ reload });
    for (let i = 0; i < 5; i++) paste(`#token=${TOKEN}${i}`);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    answer(new Response(null, { status: 200 }));
    await vi.waitFor(() => expect(location.hash).toBe(''));
    paste(`#token=${TOKEN}`);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('S2-8 — a probe that gets no answer in time leaves the fragment, as an unreachable console', async () => {
    const reload = vi.fn();
    fetchAnswering(204);
    await bootstrapSession();
    const fetchFn = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('timed out', 'TimeoutError')));
        }),
    );
    vi.stubGlobal('fetch', fetchFn);
    stop = watchFragmentToken({ reload, probeTimeoutMs: 20 });
    paste(`#token=${TOKEN}`);
    await new Promise((r) => setTimeout(r, 60));
    expect(reload).not.toHaveBeenCalled();
    expect(location.hash).toBe(`#token=${TOKEN}`);
    // The guard is free again: the next change probes.
    paste(`#token=${TOKEN}x`);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('stops listening once disposed', () => {
    const reload = vi.fn();
    markSessionLost();
    watchFragmentToken({ reload })();
    paste(`#token=${TOKEN}`);
    expect(reload).not.toHaveBeenCalled();
  });
});
