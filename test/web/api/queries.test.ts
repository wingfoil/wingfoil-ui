// @vitest-environment jsdom
// The query client never polls (REQ-INT-09) and retries only a transport failure; the shell's
// queries read their routes.
import { afterEach, expect, it, vi } from 'vitest';
import { ApiError } from '../../../web/src/api/client.js';
import { createQueryClient, projectsQuery, serverQuery } from '../../../web/src/api/queries.js';
import { queryKeys, type ProjectQueryKey } from '../../../web/src/api/query-keys.js';

afterEach(() => vi.unstubAllGlobals());

it('keeps data fresh until an event invalidates it, without refetch on focus or reconnect', () => {
  const q = createQueryClient().getDefaultOptions().queries!;
  expect(q.staleTime).toBe(Infinity);
  expect(q.refetchOnWindowFocus).toBe(false);
  expect(q.refetchOnReconnect).toBe(false);
  const retry = q.retry as (count: number, error: unknown) => boolean;
  expect(retry(0, new ApiError(404, 'not-found', 'x', undefined))).toBe(false);
  expect(retry(0, new TypeError('network'))).toBe(true);
  expect(retry(1, new TypeError('network'))).toBe(false);
});

it.each([
  ['/api/server', serverQuery, ['server']],
  ['/api/projects', projectsQuery, ['projects']],
] as const)('%s', async (path, query, key) => {
  const fetchFn = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
  vi.stubGlobal('fetch', fetchFn);
  const client = createQueryClient();
  expect(query().queryKey).toEqual(key);
  expect(await client.fetchQuery(query() as never)).toEqual({ ok: true });
  expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toBe(path);
});

it('builds every project key under the ["p", pid] prefix that a repo event invalidates', () => {
  const key: ProjectQueryKey = queryKeys.project('p_a', 'elements', { archived: false });
  expect(key).toEqual(['p', 'p_a', 'elements', { archived: false }]);
  expect(queryKeys.project('p_a')).toEqual(['p', 'p_a']);
});
