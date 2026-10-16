// @vitest-environment jsdom
// task-041 (D41-3, D41-7; spec-004 §3, RP-28): `PUT /api/settings` takes the whole object. The save
// hook sends the cached settings with the change, one request at a time (later changes wait and are
// carried by their own request), updates the cache at once (optimistic) and takes the server's
// answer; a refusal reads the settings again and reports the change that failed.
import type { UiSettings } from '@wingfoil-ui/contracts';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { createQueryClient, settingsQuery } from '../../../web/src/api/queries.js';
import { putSettings, useSaveSettings } from '../../../web/src/api/settings.js';

const DEFAULTS: UiSettings = {
  autoFetch: true,
  fetchIntervalSeconds: 60,
  autoUpdate: false,
  autoPush: false,
  theme: 'system',
  confirmAgentLaunch: true,
  actionLogCap: 5000,
};

afterEach(() => vi.unstubAllGlobals());

interface Call {
  method: string;
  url: string;
  body?: unknown;
}

/** A settings API: GET answers `stored`; PUT stores and echoes the body after `gate()` releases it, or fails. */
function stubSettings(options: { fail?: boolean } = {}) {
  let stored: UiSettings = { ...DEFAULTS };
  const calls: Call[] = [];
  const pending: (() => void)[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body === undefined ? undefined : (JSON.parse(String(init.body)) as UiSettings);
    calls.push({ method, url, ...(body ? { body } : {}) });
    if (method === 'PUT') {
      await new Promise<void>((r) => pending.push(r));
      if (options.fail) {
        return new Response(JSON.stringify({ error: { code: 'invalid-request', message: 'x' } }), { status: 400 });
      }
      stored = body!;
    }
    return new Response(JSON.stringify(stored), { status: 200 });
  });
  vi.stubGlobal('fetch', fn);
  return {
    calls,
    release: () => pending.shift()?.(),
    waiting: () => pending.length,
  };
}

function setup(cached: UiSettings | null = DEFAULTS) {
  const client = createQueryClient();
  if (cached) client.setQueryData(settingsQuery().queryKey, cached);
  const saved: Partial<UiSettings>[] = [];
  const failed: [string, Partial<UiSettings>][] = [];
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    () =>
      useSaveSettings({
        onSaved: (change) => saved.push(change),
        onFailed: (error, change) => failed.push([error.code, change]),
      }),
    { wrapper },
  );
  return { client, hook, saved, failed, cache: () => client.getQueryData(settingsQuery().queryKey) };
}

it('putSettings sends PUT /api/settings with the whole object and returns the stored settings', async () => {
  const api = stubSettings();
  const done = putSettings({ ...DEFAULTS, autoPush: true });
  await waitFor(() => expect(api.waiting()).toBe(1));
  api.release();
  expect(await done).toEqual({ ...DEFAULTS, autoPush: true });
  expect(api.calls).toEqual([{ method: 'PUT', url: '/api/settings', body: { ...DEFAULTS, autoPush: true } }]);
});

it('sends the cached settings with the change, shows it at once and keeps the answer', async () => {
  const api = stubSettings();
  const { hook, cache, saved } = setup();
  act(() => hook.result.current.mutate({ autoPush: true }));
  await waitFor(() => expect(api.waiting()).toBe(1));
  expect(cache()).toEqual({ ...DEFAULTS, autoPush: true });
  api.release();
  await waitFor(() => expect(saved).toEqual([{ autoPush: true }]));
  expect(api.calls).toEqual([{ method: 'PUT', url: '/api/settings', body: { ...DEFAULTS, autoPush: true } }]);
  expect(cache()).toEqual({ ...DEFAULTS, autoPush: true });
});

it('runs one request at a time: a second change waits and is sent with the first one', async () => {
  const api = stubSettings();
  const { hook, cache, saved } = setup();
  act(() => hook.result.current.mutate({ autoPush: true }));
  act(() => hook.result.current.mutate({ theme: 'dark' }));
  await waitFor(() => expect(api.waiting()).toBe(1));
  expect(cache()).toEqual({ ...DEFAULTS, autoPush: true, theme: 'dark' });
  // Only the first request is out.
  expect(api.calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
  api.release();
  await waitFor(() => expect(api.waiting()).toBe(1));
  // The first answer does not hide the second change while it waits.
  expect(cache()).toEqual({ ...DEFAULTS, autoPush: true, theme: 'dark' });
  api.release();
  await waitFor(() => expect(saved).toHaveLength(2));
  expect(api.calls.filter((c) => c.method === 'PUT').map((c) => c.body)).toEqual([
    { ...DEFAULTS, autoPush: true, theme: 'dark' },
    { ...DEFAULTS, autoPush: true, theme: 'dark' },
  ]);
  expect(cache()).toEqual({ ...DEFAULTS, autoPush: true, theme: 'dark' });
});

it('a refusal reads the settings again (the change is undone) and reports the failed change', async () => {
  const api = stubSettings({ fail: true });
  const { hook, cache, failed } = setup();
  act(() => hook.result.current.mutate({ autoUpdate: true }));
  await waitFor(() => expect(api.waiting()).toBe(1));
  expect(cache()).toEqual({ ...DEFAULTS, autoUpdate: true });
  api.release();
  await waitFor(() => expect(failed).toEqual([['invalid-request', { autoUpdate: true }]]));
  await waitFor(() => expect(cache()).toEqual(DEFAULTS));
  expect(api.calls.map((c) => c.method)).toEqual(['PUT', 'GET']);
});

it('sends nothing before the settings were read', async () => {
  const api = stubSettings();
  const { hook, failed } = setup(null);
  act(() => hook.result.current.mutate({ autoPush: true }));
  await waitFor(() => expect(failed).toHaveLength(1));
  expect(api.calls.filter((c) => c.method === 'PUT')).toEqual([]);
});
