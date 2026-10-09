// @vitest-environment jsdom
// The project list mutations shared by the switcher (task-015) and the Add project dialog
// (task-014): DELETE /api/projects/:pid (spec-004 §3, 204), and the cache after a removal — the
// entry dropped from the list, every query of the project forgotten.
import type { ProjectListResponse } from '@wingfoil-ui/contracts';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { ApiError } from '../../../web/src/api/client.js';
import { forgetProject, removeProject, useRemoveProject } from '../../../web/src/api/projects.js';
import { createQueryClient, projectsQuery } from '../../../web/src/api/queries.js';
import { queryKeys } from '../../../web/src/api/query-keys.js';

afterEach(() => vi.unstubAllGlobals());

const LIST: ProjectListResponse = {
  projects: [
    { id: 'p_a', name: 'a', path: '/x/a', remote: '', availability: 'ok' },
    { id: 'p_b', name: 'b', path: '/x/b', remote: '', availability: 'ok' },
  ],
};

function stubFetch(status: number, body?: unknown) {
  const fn = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

it('removeProject sends DELETE /api/projects/:pid with the id encoded', async () => {
  const fn = stubFetch(204);
  await removeProject('p_a/..');
  const [url, init] = fn.mock.calls[0]!;
  expect(url).toBe('/api/projects/p_a%2F..');
  expect(init?.method).toBe('DELETE');
});

it('removeProject throws the API error (404 not-found)', async () => {
  stubFetch(404, { error: { code: 'not-found', message: 'Not found' } });
  await expect(removeProject('p_x')).rejects.toMatchObject({ status: 404, code: 'not-found' });
});

it('forgetProject drops the entry and every query of the project', () => {
  const client = createQueryClient();
  client.setQueryData(projectsQuery().queryKey, LIST);
  client.setQueryData(queryKeys.project('p_a', 'config'), { x: 1 });
  client.setQueryData(queryKeys.project('p_b', 'config'), { x: 2 });
  forgetProject(client, 'p_a');
  expect(client.getQueryData(projectsQuery().queryKey)?.projects.map((p) => p.id)).toEqual(['p_b']);
  expect(client.getQueryData(queryKeys.project('p_a', 'config'))).toBeUndefined();
  expect(client.getQueryData(queryKeys.project('p_b', 'config'))).toEqual({ x: 2 });
});

it('forgetProject leaves an unread list unread', () => {
  const client = createQueryClient();
  forgetProject(client, 'p_a');
  expect(client.getQueryData(projectsQuery().queryKey)).toBeUndefined();
});

it('useRemoveProject runs onRemoved before forgetting the project', async () => {
  stubFetch(204);
  const client = createQueryClient();
  client.setQueryData(projectsQuery().queryKey, LIST);
  const seen: (string[] | undefined)[] = [];
  const onRemoved = vi.fn(async () => {
    seen.push(client.getQueryData(projectsQuery().queryKey)?.projects.map((p) => p.id));
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useRemoveProject({ onRemoved }), { wrapper });
  await act(() => result.current.mutateAsync('p_a'));
  expect(onRemoved).toHaveBeenCalledWith('p_a');
  expect(seen).toEqual([['p_a', 'p_b']]);
  expect(client.getQueryData(projectsQuery().queryKey)?.projects.map((p) => p.id)).toEqual(['p_b']);
});

it('useRemoveProject handles a 404 not-found as already removed (another tab, R5)', async () => {
  stubFetch(404, { error: { code: 'not-found', message: 'Not found' } });
  const client = createQueryClient();
  client.setQueryData(projectsQuery().queryKey, LIST);
  const onRemoved = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useRemoveProject({ onRemoved }), { wrapper });
  await act(() => result.current.mutateAsync('p_a'));
  expect(onRemoved).toHaveBeenCalledWith('p_a');
  expect(client.getQueryData(projectsQuery().queryKey)?.projects.map((p) => p.id)).toEqual(['p_b']);
});

it('useRemoveProject keeps the list on another refusal, exposes the ApiError and reads the list again', async () => {
  stubFetch(500, { error: { code: 'internal', message: 'x' } });
  const client = createQueryClient();
  client.setQueryData(projectsQuery().queryKey, LIST);
  const onRemoved = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useRemoveProject({ onRemoved }), { wrapper });
  act(() => result.current.mutate('p_a'));
  await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
  expect(result.current.error?.code).toBe('internal');
  expect(onRemoved).not.toHaveBeenCalled();
  expect(client.getQueryData(projectsQuery().queryKey)?.projects).toHaveLength(2);
  await waitFor(() => expect(client.getQueryState(projectsQuery().queryKey)?.isInvalidated).toBe(true));
});
