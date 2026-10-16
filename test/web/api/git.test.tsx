// @vitest-environment jsdom
// task-039 — the transport mutation (`web/src/api/git.ts`, D39-2): the route and its empty body,
// the header's repository set from a 200, the header read again after an error, and the page's own
// abort reported as `cancelled` (the server answers 500 `internal` to a client that has left).
import type { ProjectHeader } from '@wingfoil-ui/contracts';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { CANCELLED, postGitOperation, useGitOperation } from '../../../web/src/api/git.js';
import { createQueryClient, projectHeaderQuery } from '../../../web/src/api/queries.js';
import { header } from '../project/header-data.js';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fn = vi.fn(
    async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

function wrapper() {
  const queryClient = createQueryClient();
  queryClient.setQueryData(projectHeaderQuery('p1').queryKey, header());
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, invalidate, queryClient };
}

it('posts to the route of the operation with no body', async () => {
  const fetch = stubFetch(200, { repository: header().repository });
  await postGitOperation('p 1', 'fetch');
  expect(fetch.mock.calls[0]?.[0]).toBe('/api/p/p%201/git/fetch');
  const init = fetch.mock.calls[0]?.[1] as RequestInit;
  expect(init.method).toBe('POST');
  expect(init.body).toBeUndefined();
});

it('a 200 sets the header repository from the response, without a read', async () => {
  const repository = { ...header().repository, copy: 'behind' as const, behind: 1, state: 's2' };
  stubFetch(200, { repository });
  const { Wrapper, invalidate, queryClient } = wrapper();
  const { result } = renderHook(() => useGitOperation(), { wrapper: Wrapper });
  result.current.mutate({ pid: 'p1', op: 'fetch' });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  const cached = queryClient.getQueryData<ProjectHeader>(projectHeaderQuery('p1').queryKey);
  expect(cached?.repository).toEqual(repository);
  expect(cached?.conditions).toEqual(['has-remote']);
  expect(invalidate).not.toHaveBeenCalled();
});

it('an error is the ApiError and the header is read again', async () => {
  stubFetch(422, { error: { code: 'git-refused', message: 'fatal: x' } });
  const { Wrapper, invalidate } = wrapper();
  const { result } = renderHook(() => useGitOperation(), { wrapper: Wrapper });
  result.current.mutate({ pid: 'p1', op: 'fetch' });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error?.code).toBe('git-refused');
  expect(invalidate).toHaveBeenCalledWith({ queryKey: projectHeaderQuery('p1').queryKey });
});

it('the page aborting its request is reported as cancelled', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    ),
  );
  const { Wrapper } = wrapper();
  const { result } = renderHook(() => useGitOperation(), { wrapper: Wrapper });
  const controller = new AbortController();
  result.current.mutate({ pid: 'p1', op: 'fetch', signal: controller.signal });
  await waitFor(() => expect(result.current.isPending).toBe(true));
  controller.abort();
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error?.code).toBe(CANCELLED);
});
