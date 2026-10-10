// @vitest-environment jsdom
// The project list mutations shared by the switcher (task-015) and the Add project dialog
// (task-014): DELETE /api/projects/:pid (spec-004 §3, 204), and the cache after a removal — the
// entry dropped from the list, every query of the project forgotten; POST /api/projects and
// POST /api/projects/clone (201 with the item), the item put into the cached list, a refusal reading
// the list again and an abort leaving it alone.
import type { ProjectListResponse } from '@wingfoil-ui/contracts';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { ApiError } from '../../../web/src/api/client.js';
import {
  addProject,
  cloneProject,
  forgetProject,
  rememberProject,
  removeProject,
  useAddLocalProject,
  useCloneProject,
  useRemoveProject,
} from '../../../web/src/api/projects.js';
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

const NEW: ProjectListResponse['projects'][number] = {
  id: 'p_c',
  name: 'kanban',
  path: '/home/test/projects/kanban',
  remote: 'file:///srv/remotes/kanban.git',
  availability: 'ok',
};

function wrapperOf(client: ReturnType<typeof createQueryClient>) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

it('addProject sends POST /api/projects {path} and returns the 201 item', async () => {
  const fn = stubFetch(201, NEW);
  await expect(addProject('~/projects/kanban')).resolves.toEqual(NEW);
  const [url, init] = fn.mock.calls[0]!;
  expect(url).toBe('/api/projects');
  expect(init?.method).toBe('POST');
  expect(JSON.parse(init?.body as string)).toEqual({ path: '~/projects/kanban' });
});

it('cloneProject sends POST /api/projects/clone {url, directory}, without an empty directory', async () => {
  const fn = stubFetch(201, NEW);
  await expect(cloneProject('file:///srv/remotes/kanban.git', '~/work/kanban-copy')).resolves.toEqual(NEW);
  await cloneProject('file:///srv/remotes/kanban.git', '');
  await cloneProject('file:///srv/remotes/kanban.git');
  expect(fn.mock.calls.map(([url]) => url)).toEqual([
    '/api/projects/clone',
    '/api/projects/clone',
    '/api/projects/clone',
  ]);
  expect(fn.mock.calls.map(([, init]) => JSON.parse(init?.body as string))).toEqual([
    { url: 'file:///srv/remotes/kanban.git', directory: '~/work/kanban-copy' },
    { url: 'file:///srv/remotes/kanban.git' },
    { url: 'file:///srv/remotes/kanban.git' },
  ]);
});

it('passes the abort signal to fetch', async () => {
  const fn = stubFetch(201, NEW);
  const controller = new AbortController();
  await addProject('/x', controller.signal);
  await cloneProject('file:///x.git', '/y', controller.signal);
  expect(fn.mock.calls.map(([, init]) => init?.signal)).toEqual([controller.signal, controller.signal]);
});

it('rememberProject appends the item once and leaves an unread list unread', () => {
  const client = createQueryClient();
  rememberProject(client, NEW);
  expect(client.getQueryData(projectsQuery().queryKey)).toBeUndefined();
  client.setQueryData(projectsQuery().queryKey, LIST);
  rememberProject(client, NEW);
  rememberProject(client, NEW);
  expect(client.getQueryData(projectsQuery().queryKey)?.projects.map((p) => p.id)).toEqual(['p_a', 'p_b', 'p_c']);
});

it('useAddLocalProject puts the new item into the cached list', async () => {
  stubFetch(201, NEW);
  const client = createQueryClient();
  client.setQueryData(projectsQuery().queryKey, LIST);
  const { result } = renderHook(() => useAddLocalProject(), { wrapper: wrapperOf(client) });
  await act(async () => {
    await expect(result.current.mutateAsync({ path: '/home/test/projects/kanban' })).resolves.toEqual(NEW);
  });
  expect(client.getQueryData(projectsQuery().queryKey)?.projects.map((p) => p.id)).toEqual(['p_a', 'p_b', 'p_c']);
});

it('useCloneProject puts the new item into the cached list', async () => {
  const fn = stubFetch(201, NEW);
  const client = createQueryClient();
  client.setQueryData(projectsQuery().queryKey, LIST);
  const { result } = renderHook(() => useCloneProject(), { wrapper: wrapperOf(client) });
  await act(() =>
    result.current.mutateAsync({ url: 'file:///srv/remotes/kanban.git', directory: '~/projects/kanban' }),
  );
  expect(JSON.parse(fn.mock.calls[0]![1]?.body as string)).toEqual({
    url: 'file:///srv/remotes/kanban.git',
    directory: '~/projects/kanban',
  });
  expect(client.getQueryData(projectsQuery().queryKey)?.projects.map((p) => p.id)).toEqual(['p_a', 'p_b', 'p_c']);
});

it('a refusal exposes the ApiError, keeps the cached list and reads it again', async () => {
  stubFetch(422, { error: { code: 'folder-not-found', message: 'x', detail: { path: '/tmp/does-not-exist' } } });
  const client = createQueryClient();
  client.setQueryData(projectsQuery().queryKey, LIST);
  const { result } = renderHook(() => useAddLocalProject(), { wrapper: wrapperOf(client) });
  act(() => result.current.mutate({ path: '/tmp/does-not-exist' }));
  await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
  expect(result.current.error).toMatchObject({ code: 'folder-not-found', detail: { path: '/tmp/does-not-exist' } });
  expect(client.getQueryData(projectsQuery().queryKey)?.projects).toHaveLength(2);
  await waitFor(() => expect(client.getQueryState(projectsQuery().queryKey)?.isInvalidated).toBe(true));
});

it('an aborted clone leaves the cached list alone (no read again)', async () => {
  const fn = vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }),
  );
  vi.stubGlobal('fetch', fn);
  const client = createQueryClient();
  client.setQueryData(projectsQuery().queryKey, LIST);
  const controller = new AbortController();
  const { result } = renderHook(() => useCloneProject(), { wrapper: wrapperOf(client) });
  act(() => result.current.mutate({ url: 'file:///x.git', directory: '/y', signal: controller.signal }));
  await waitFor(() => expect(fn).toHaveBeenCalled());
  act(() => controller.abort());
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(client.getQueryState(projectsQuery().queryKey)?.isInvalidated).toBe(false);
});

it('an unanswered add is the unreachable error', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }),
  );
  const client = createQueryClient();
  const { result } = renderHook(() => useAddLocalProject(), { wrapper: wrapperOf(client) });
  act(() => result.current.mutate({ path: '/x' }));
  await waitFor(() => expect(result.current.error).toMatchObject({ status: 0, code: 'unreachable' }));
});
