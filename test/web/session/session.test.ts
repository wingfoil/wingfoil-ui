// @vitest-environment jsdom
// spec-004 §2 (REQ-SEC-02; X-02.1 browser side, closed in task-015): the token is read from the URL
// fragment, removed from the address bar, exchanged with POST /api/session; a 401 loses the session.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  bootstrapSession,
  markSessionLost,
  resetSession,
  sessionStatus,
  subscribeSession,
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
