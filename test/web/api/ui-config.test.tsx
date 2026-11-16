// @vitest-environment jsdom
// task-079 — the preset write's mutation (`web/src/api/ui-config.ts`, D79-7; review round 1 F-1): the
// path, method and body; the toast raised by the mutation's own callbacks even when the component that
// started the write is gone (D38-11); the project's queries read again after a success and after a
// refusal (`onSettled`, not awaited).
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createQueryClient } from '../../../web/src/api/queries.js';
import { postUiPreset, useUiPresetWrite } from '../../../web/src/api/ui-config.js';
import { getToasts, resetToasts } from '../../../web/src/shell/toasts.js';

const OK = {
  result: { file: '.wingfoil/ui.yaml', preset: 'kanban' },
  commits: [{ sha: 'a'.repeat(40), subject: 'chore(ui): apply the Kanban preset' }],
  push: { status: 'off' },
};

beforeEach(() => resetToasts());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** `fetch` answering `status` with `body`, held until `release()` when `hold` is set. */
function stubFetch(status: number, body: unknown, hold = false) {
  let release: () => void = () => {};
  const gate = hold ? new Promise<void>((r) => (release = r)) : Promise.resolve();
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => {
    await gate;
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fn);
  return { fn, release: () => release() };
}

function wrapper() {
  const queryClient = createQueryClient();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, invalidate };
}

it('posts {preset} to the project’s preset route, the id encoded', async () => {
  const { fn } = stubFetch(200, OK);
  expect(await postUiPreset('p 1', 'sw-life-cycle')).toEqual(OK);
  expect(fn.mock.calls[0]?.[0]).toBe('/api/p/p%201/ui-config/preset');
  const init = fn.mock.calls[0]?.[1] as RequestInit;
  expect(init.method).toBe('POST');
  expect(JSON.parse(String(init.body))).toEqual({ preset: 'sw-life-cycle' });
});

it('F-1 — the success toast is raised after the caller unmounted, and the project is read again', async () => {
  const { release } = stubFetch(200, OK, true);
  const { Wrapper, invalidate } = wrapper();
  const { result, unmount } = renderHook(() => useUiPresetWrite(), { wrapper: Wrapper });
  result.current.mutate({ pid: 'p1', preset: 'kanban' });
  await waitFor(() => expect(result.current.isPending).toBe(true));
  unmount();
  release();
  await waitFor(() => expect(getToasts().map((t) => [t.key, t.tone])).toEqual([['preset:p1', 'success']]));
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['p', 'p1'] }));
});

it('F-1 — the refusal toast is raised after the caller unmounted, and the project is read again', async () => {
  const { release } = stubFetch(
    422,
    {
      error: { code: 'ui-config-invalid', message: 'x', detail: { failure: 'missing required key version' } },
    },
    true,
  );
  const { Wrapper, invalidate } = wrapper();
  const { result, unmount } = renderHook(() => useUiPresetWrite(), { wrapper: Wrapper });
  result.current.mutate({ pid: 'p1', preset: 'kanban' });
  await waitFor(() => expect(result.current.isPending).toBe(true));
  unmount();
  release();
  await waitFor(() => expect(getToasts().map((t) => [t.key, t.tone])).toEqual([['preset:p1', 'error']]));
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['p', 'p1'] }));
});

it('a failed auto-push makes the success toast sticky', async () => {
  stubFetch(200, { ...OK, push: { status: 'failed', code: 'push-timeout' } });
  const { Wrapper } = wrapper();
  const { result } = renderHook(() => useUiPresetWrite(), { wrapper: Wrapper });
  result.current.mutate({ pid: 'p1', preset: 'kanban' });
  await waitFor(() => expect(getToasts()).toHaveLength(1));
  expect(getToasts()[0]).toMatchObject({ key: 'preset:p1', tone: 'success', sticky: true });
});
