// @vitest-environment jsdom
// spec-004 §5: the same-origin API client — the error envelope, X-Repo-State, 204, and a 401
// losing the session.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ApiError, apiGet, apiRequest } from '../../../web/src/api/client.js';
import { resetSession, sessionStatus } from '../../../web/src/session/session.js';

beforeEach(() => resetSession());
afterEach(() => vi.unstubAllGlobals());

function answer(status: number, body?: unknown, headers: Record<string, string> = {}): ReturnType<typeof vi.fn> {
  const fn = vi.fn(
    async () =>
      new Response(body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', ...headers },
      }),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

it('GETs a same-origin API path with the session cookie and returns the body and repository state', async () => {
  const fetchFn = answer(200, { projects: [] }, { 'X-Repo-State': 'abc.def' });
  const result = await apiRequest<{ projects: unknown[] }>('GET', '/api/projects');
  expect(result).toEqual({ data: { projects: [] }, status: 200, repoState: 'abc.def' });
  const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('/api/projects');
  expect(init.credentials).toBe('same-origin');
  expect(new Headers(init.headers).get('accept')).toBe('application/json');
});

it('sends a JSON body and reads a 204 as no data', async () => {
  const fetchFn = answer(204);
  const result = await apiRequest('PUT', '/api/p/p_1/role-view', { role: 'developer' });
  expect(result).toEqual({ data: undefined, status: 204, repoState: null });
  const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
  expect(init.method).toBe('PUT');
  expect(init.body).toBe(JSON.stringify({ role: 'developer' }));
  expect(new Headers(init.headers).get('content-type')).toBe('application/json');
});

it('apiGet returns the data only', async () => {
  answer(200, { version: '0.0.0' });
  expect(await apiGet('/api/server')).toEqual({ version: '0.0.0' });
});

it('refuses a path outside the same-origin API', async () => {
  answer(200, {});
  await expect(apiGet('https://example.test/api/x')).rejects.toThrow(/same-origin/);
  await expect(apiGet('/elsewhere')).rejects.toThrow(/same-origin/);
  await expect(apiGet('//evil.test/api/x')).rejects.toThrow(/same-origin/);
});

it('throws the envelope of an error answer as an ApiError', async () => {
  answer(422, { error: { code: 'folder-not-found', message: 'Folder not found', detail: { path: '/tmp/x' } } });
  const error = await apiGet('/api/projects').catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({
    status: 422,
    code: 'folder-not-found',
    message: 'Folder not found',
    detail: { path: '/tmp/x' },
  });
  expect(sessionStatus()).toBe('connecting');
});

it('reads a body that is not an envelope as an internal error', async () => {
  answer(502, '<html>bad gateway</html>');
  await expect(apiGet('/api/server')).rejects.toMatchObject({ status: 502, code: 'internal' });
});

it('loses the session on a 401', async () => {
  answer(401, { error: { code: 'unauthenticated', message: 'Unauthenticated' } });
  await expect(apiGet('/api/server')).rejects.toMatchObject({ status: 401, code: 'unauthenticated' });
  expect(sessionStatus()).toBe('lost');
});

it('passes an abort signal', async () => {
  const fetchFn = answer(200, {});
  const controller = new AbortController();
  await apiGet('/api/server', controller.signal);
  const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
  expect(init.signal).toBe(controller.signal);
});

it('turns a network failure into the client-side unreachable error, never internal', async () => {
  vi.stubGlobal('fetch', async () => {
    throw new TypeError('Failed to fetch');
  });
  await expect(apiGet('/api/server')).rejects.toMatchObject({ status: 0, code: 'unreachable' });
  expect(sessionStatus()).toBe('connecting');
});

it('keeps an abort an abort', async () => {
  const controller = new AbortController();
  controller.abort();
  vi.stubGlobal('fetch', async () => {
    throw new DOMException('aborted', 'AbortError');
  });
  await expect(apiGet('/api/server', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
});
