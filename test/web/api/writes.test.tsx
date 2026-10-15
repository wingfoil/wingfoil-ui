// @vitest-environment jsdom
// task-037 — the governed-write mutation (`web/src/api/writes.ts`, D37-10): the path, method and
// body per verb, and the project's queries read again after a success and after a refusal.
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { createQueryClient } from '../../../web/src/api/queries.js';
import { postElementWrite, useElementWrite } from '../../../web/src/api/writes.js';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fn = vi.fn(
    async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

const OK = { result: {}, commits: [{ sha: 'a'.repeat(40), subject: 'wf(t): approve e' }], push: { status: 'off' } };

it('posts each verb to its route with its body, the ids encoded', async () => {
  const fetch = stubFetch(200, OK);
  await postElementWrite('p 1', 'e/1', 'approve', { expectedStatus: 's2', reason: 'ok' });
  expect(fetch.mock.calls[0]?.[0]).toBe('/api/p/p%201/elements/e%2F1/approve');
  const init = fetch.mock.calls[0]?.[1] as RequestInit;
  expect(init.method).toBe('POST');
  expect(JSON.parse(String(init.body))).toEqual({ expectedStatus: 's2', reason: 'ok' });
});

function wrapper() {
  const queryClient = createQueryClient();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, invalidate };
}

it.each([
  ['submit', undefined, { expectedStatus: 's1' }],
  ['reject', 'no', { expectedStatus: 's1', reason: 'no' }],
] as const)('useElementWrite %s sends %o and invalidates the project', async (verb, reason, body) => {
  const fetch = stubFetch(200, OK);
  const { Wrapper, invalidate } = wrapper();
  const { result } = renderHook(() => useElementWrite(), { wrapper: Wrapper });
  result.current.mutate({ pid: 'p1', eid: 'e1', verb, expectedStatus: 's1', ...(reason ? { reason } : {}) });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual(OK);
  expect(fetch.mock.calls[0]?.[0]).toBe(`/api/p/p1/elements/e1/${verb}`);
  expect(JSON.parse(String((fetch.mock.calls[0]?.[1] as RequestInit).body))).toEqual(body);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['p', 'p1'] });
});

it('a refusal is the ApiError and the project is read again (RP-12)', async () => {
  stubFetch(409, { error: { code: 'element-changed', message: 'x' } });
  const { Wrapper, invalidate } = wrapper();
  const { result } = renderHook(() => useElementWrite(), { wrapper: Wrapper });
  result.current.mutate({ pid: 'p1', eid: 'e1', verb: 'approve', expectedStatus: 's2', reason: 'ok' });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error?.code).toBe('element-changed');
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['p', 'p1'] });
});
