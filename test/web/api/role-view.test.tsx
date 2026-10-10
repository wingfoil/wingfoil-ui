// @vitest-environment jsdom
// task-016 — the role view mutation (spec-004 §3, W4-20): PUT /api/p/:pid/role-view {role} → 204,
// then the header and the directives of the project are read again (the server computes
// `directives[].mine` from the stored role view); a refusal reads the header again. The project is
// in the variables (review R1).
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { setRoleView, useSetRoleView } from '../../../web/src/api/projects.js';
import { createQueryClient, directivesQuery, projectHeaderQuery } from '../../../web/src/api/queries.js';
import { queryKeys } from '../../../web/src/api/query-keys.js';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body?: unknown) {
  const fn = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

it('setRoleView sends PUT /api/p/:pid/role-view with {role}, the id encoded', async () => {
  const fn = stubFetch(204);
  await setRoleView('p_a/..', 'developer');
  const [url, init] = fn.mock.calls[0]!;
  expect(url).toBe('/api/p/p_a%2F../role-view');
  expect(init?.method).toBe('PUT');
  expect(JSON.parse(String(init?.body))).toEqual({ role: 'developer' });
});

it('setRoleView throws the API error (403 not-in-team)', async () => {
  stubFetch(403, { error: { code: 'not-in-team', message: 'Not in team' } });
  await expect(setRoleView('p_a', 'developer')).rejects.toMatchObject({ status: 403, code: 'not-in-team' });
});

function setup() {
  const client = createQueryClient();
  for (const key of [
    projectHeaderQuery('p_a').queryKey,
    directivesQuery('p_a').queryKey,
    queryKeys.project('p_a', 'directives', 'testing'),
    queryKeys.project('p_a', 'elements', { archived: false }),
    projectHeaderQuery('p_b').queryKey,
  ]) {
    client.setQueryData(key, { x: 1 });
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useSetRoleView(), { wrapper });
  const stale = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;
  return { client, hook, stale };
}

it('useSetRoleView invalidates the header and every directives query of the project, nothing else', async () => {
  stubFetch(204);
  const { hook, stale } = setup();
  await act(() => hook.result.current.mutateAsync({ pid: 'p_a', role: 'developer' }));
  expect(stale(projectHeaderQuery('p_a').queryKey)).toBe(true);
  expect(stale(directivesQuery('p_a').queryKey)).toBe(true);
  expect(stale(queryKeys.project('p_a', 'directives', 'testing'))).toBe(true);
  expect(stale(queryKeys.project('p_a', 'elements', { archived: false }))).toBe(false);
  expect(stale(projectHeaderQuery('p_b').queryKey)).toBe(false);
});

it('useSetRoleView reads the header again after a refusal and keeps the error', async () => {
  stubFetch(400, { error: { code: 'invalid-request', message: 'Bad' } });
  const { hook, stale } = setup();
  await act(async () => {
    await hook.result.current.mutateAsync({ pid: 'p_a', role: 'nope' }).catch(() => undefined);
  });
  await waitFor(() => expect(hook.result.current.error).toMatchObject({ code: 'invalid-request' }));
  expect(stale(projectHeaderQuery('p_a').queryKey)).toBe(true);
  expect(stale(directivesQuery('p_a').queryKey)).toBe(false);
});

it('useSetRoleView refreshes the project of the variables, not another one (review R1)', async () => {
  stubFetch(204);
  const { client, hook, stale } = setup();
  client.setQueryData(directivesQuery('p_b').queryKey, { entries: [], warnings: [] });
  await act(() => hook.result.current.mutateAsync({ pid: 'p_b', role: 'developer' }));
  expect(stale(projectHeaderQuery('p_b').queryKey)).toBe(true);
  expect(stale(directivesQuery('p_b').queryKey)).toBe(true);
  expect(stale(projectHeaderQuery('p_a').queryKey)).toBe(false);
  expect(stale(directivesQuery('p_a').queryKey)).toBe(false);
});
