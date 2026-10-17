// @vitest-environment jsdom
// task-041 (D41-3, D41-7; spec-004 §3, RP-28; review round 1 R1, R2): `PUT /api/settings` takes the
// whole object. The query cache holds server answers only; a save sends the last answer with the
// pending changes up to its own, one request at a time; the page shows the last answer with every
// pending change (`useSettingsView`); a refusal reads the settings again and reports the change.
import type { UiSettings } from '@wingfoil-ui/contracts';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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
  // The cache holds server answers only (the page shows the pending change, review R1).
  expect(cache()).toEqual(DEFAULTS);
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
  // Only the first request is out, with the changes up to its own.
  expect(api.calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
  api.release();
  await waitFor(() => expect(api.waiting()).toBe(1));
  expect(cache()).toEqual({ ...DEFAULTS, autoPush: true });
  api.release();
  await waitFor(() => expect(saved).toHaveLength(2));
  expect(api.calls.filter((c) => c.method === 'PUT').map((c) => c.body)).toEqual([
    { ...DEFAULTS, autoPush: true },
    { ...DEFAULTS, autoPush: true, theme: 'dark' },
  ]);
  expect(cache()).toEqual({ ...DEFAULTS, autoPush: true, theme: 'dark' });
});

it('a refusal reads the settings again and reports the failed change', async () => {
  const api = stubSettings({ fail: true });
  const { hook, cache, failed } = setup();
  act(() => hook.result.current.mutate({ autoUpdate: true }));
  await waitFor(() => expect(api.waiting()).toBe(1));
  expect(cache()).toEqual(DEFAULTS);
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

it("a change made while a save is on its way survives that save's answer", async () => {
  const api = stubSettings();
  const { hook, cache, saved } = setup();
  act(() => hook.result.current.mutate({ autoPush: true }));
  await waitFor(() => expect(api.waiting()).toBe(1));
  // The first request is out without the second change.
  act(() => hook.result.current.mutate({ theme: 'dark' }));
  expect(api.calls.filter((c) => c.method === 'PUT').map((c) => c.body)).toEqual([{ ...DEFAULTS, autoPush: true }]);
  api.release();
  await waitFor(() => expect(saved).toHaveLength(1));
  // The cache takes the first answer; the waiting change is still pending (shown: review R1 tests).
  expect(cache()).toEqual({ ...DEFAULTS, autoPush: true });
  await waitFor(() => expect(api.waiting()).toBe(1));
  api.release();
  await waitFor(() => expect(saved).toHaveLength(2));
  expect(api.calls.filter((c) => c.method === 'PUT').map((c) => c.body)).toEqual([
    { ...DEFAULTS, autoPush: true },
    { ...DEFAULTS, autoPush: true, theme: 'dark' },
  ]);
  expect(cache()).toEqual({ ...DEFAULTS, autoPush: true, theme: 'dark' });
});

// --- Review round 1 (R1, R2): the settings shown and sent are the last server answer plus every
// save still pending, in the order they were made; a `settings` event (another tab, or the echo of
// an earlier save) that reads the settings again while saves are pending neither loses a change
// nor flips a control back; a failed change is left out of every later request.

/** A settings API whose PUTs wait for `release()`; `failAt` lists the PUTs (1-based) answered 500. */
function gatedApi(failAt: number[] = []) {
  const state = { stored: { ...DEFAULTS } as UiSettings };
  const puts: UiSettings[] = [];
  const pending: (() => void)[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'PUT') {
        const body = JSON.parse(String(init!.body)) as UiSettings;
        puts.push(body);
        const n = puts.length;
        await new Promise<void>((r) => pending.push(r));
        if (failAt.includes(n)) {
          return new Response(JSON.stringify({ error: { code: 'internal', message: 'x' } }), { status: 500 });
        }
        state.stored = body;
      }
      return new Response(JSON.stringify(state.stored), { status: 200 });
    }),
  );
  return { state, puts, release: () => pending.shift()?.(), waiting: () => pending.length };
}

/** The save hook and the settings as the page shows them, on a client that observes the query. */
async function viewSetup() {
  const { useSettingsView } = await import('../../../web/src/api/settings.js');
  const client = createQueryClient();
  client.setQueryData(settingsQuery().queryKey, DEFAULTS);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => ({ save: useSaveSettings(), view: useSettingsView() }), { wrapper });
  // TanStack Query notifies observers on a timer: give the render a few ticks after each step.
  const settle = () => act(() => new Promise((r) => setTimeout(r, 20)));
  const event = async () => {
    await act(async () => client.invalidateQueries({ queryKey: settingsQuery().queryKey }));
    await settle();
  };
  return { client, hook, event, settle, shown: () => hook.result.current.view.settings };
}

it("R1 — another tab's settings event while one save is out and one waits loses nothing", async () => {
  const api = gatedApi();
  const { client, hook, event, settle, shown } = await viewSetup();
  act(() => hook.result.current.save.mutate({ autoPush: true }));
  await waitFor(() => expect(api.waiting()).toBe(1));
  act(() => hook.result.current.save.mutate({ theme: 'dark' }));
  await settle();
  expect(shown()).toEqual({ ...DEFAULTS, autoPush: true, theme: 'dark' });
  await event();
  // No flicker: the pending changes stay shown over the fresh read.
  expect(shown()).toEqual({ ...DEFAULTS, autoPush: true, theme: 'dark' });
  api.release();
  await waitFor(() => expect(api.waiting()).toBe(1));
  expect(shown()).toEqual({ ...DEFAULTS, autoPush: true, theme: 'dark' });
  api.release();
  await waitFor(() => expect(client.isMutating()).toBe(0));
  expect(api.puts.map((p) => [p.autoPush, p.theme])).toEqual([
    [true, 'system'],
    [true, 'dark'],
  ]);
  expect(api.state.stored).toEqual({ ...DEFAULTS, autoPush: true, theme: 'dark' });
  await waitFor(() => expect(shown()).toEqual({ ...DEFAULTS, autoPush: true, theme: 'dark' }));
});

it('R1 — the echo of a save while two more are pending loses nothing', async () => {
  const api = gatedApi();
  const { client, hook, event, shown } = await viewSetup();
  act(() => hook.result.current.save.mutate({ autoPush: true }));
  await waitFor(() => expect(api.waiting()).toBe(1));
  act(() => hook.result.current.save.mutate({ theme: 'dark' }));
  act(() => hook.result.current.save.mutate({ autoUpdate: true }));
  api.release();
  // The second save is out; the first save's own `settings` event comes back now.
  await waitFor(() => expect(api.waiting()).toBe(1));
  await event();
  expect(shown()).toEqual({ ...DEFAULTS, autoPush: true, theme: 'dark', autoUpdate: true });
  api.release();
  await waitFor(() => expect(api.waiting()).toBe(1));
  await event();
  expect(shown()).toEqual({ ...DEFAULTS, autoPush: true, theme: 'dark', autoUpdate: true });
  api.release();
  await waitFor(() => expect(client.isMutating()).toBe(0));
  expect(api.state.stored).toEqual({ ...DEFAULTS, autoPush: true, theme: 'dark', autoUpdate: true });
  expect(api.puts.at(-1)).toEqual({ ...DEFAULTS, autoPush: true, theme: 'dark', autoUpdate: true });
});

it('R2 — a refused change is left out of the next request, the shown settings and the cache', async () => {
  const api = gatedApi([1]);
  const { client, hook, shown } = await viewSetup();
  act(() => hook.result.current.save.mutate({ autoUpdate: true }));
  await waitFor(() => expect(api.waiting()).toBe(1));
  act(() => hook.result.current.save.mutate({ theme: 'dark' }));
  api.release();
  await waitFor(() => expect(api.waiting()).toBe(1));
  api.release();
  await waitFor(() => expect(client.isMutating()).toBe(0));
  expect(api.puts[1]).toEqual({ ...DEFAULTS, theme: 'dark' });
  expect(api.state.stored.autoUpdate).toBe(false);
  await waitFor(() => expect(shown()).toEqual({ ...DEFAULTS, theme: 'dark' }));
  expect(client.getQueryData(settingsQuery().queryKey)).toEqual({ ...DEFAULTS, theme: 'dark' });
});

it('R1 — a read sent before a save was stored and answered after it does not put the old state back', async () => {
  let stored: UiSettings = { ...DEFAULTS };
  const puts: UiSettings[] = [];
  const gates: { kind: string; open: () => void }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'PUT') {
        const body = JSON.parse(String(init!.body)) as UiSettings;
        puts.push(body);
        await new Promise<void>((r) => gates.push({ kind: 'PUT', open: r }));
        stored = body;
        return new Response(JSON.stringify(stored), { status: 200 });
      }
      // The state at the time of the request, answered when released.
      const snapshot = { ...stored };
      await new Promise<void>((r) => gates.push({ kind: 'GET', open: r }));
      return new Response(JSON.stringify(snapshot), { status: 200 });
    }),
  );
  const { client, hook, settle, shown } = await viewSetup();
  const open = (kind: string) => {
    const i = gates.findIndex((g) => g.kind === kind);
    gates.splice(i, 1)[0]!.open();
  };
  act(() => hook.result.current.save.mutate({ autoPush: true }));
  await waitFor(() => expect(gates.map((g) => g.kind)).toEqual(['PUT']));
  // Another tab's event: a read goes out before the save is stored.
  // Not inside act(): this read stays out across later steps.
  void client.invalidateQueries({ queryKey: settingsQuery().queryKey });
  await waitFor(() => expect(gates.map((g) => g.kind)).toEqual(['PUT', 'GET']));
  act(() => hook.result.current.save.mutate({ theme: 'dark' }));
  open('PUT');
  await waitFor(() => expect(puts).toHaveLength(2));
  // The old read answers now, after the first save's answer.
  open('GET');
  await settle();
  expect(shown()).toEqual({ ...DEFAULTS, autoPush: true, theme: 'dark' });
  open('PUT');
  await waitFor(() => expect(client.isMutating()).toBe(0));
  expect(puts[1]).toEqual({ ...DEFAULTS, autoPush: true, theme: 'dark' });
  await settle();
  while (gates.length > 0) gates.shift()!.open();
  await settle();
  expect(client.getQueryData(settingsQuery().queryKey)).toEqual({ ...DEFAULTS, autoPush: true, theme: 'dark' });
});

it('review R2-1 — a read sent after the save was stored, cancelled by its answer, is sent again', async () => {
  let stored: UiSettings = { ...DEFAULTS };
  const gates: { kind: string; open: () => void }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'PUT') {
        stored = JSON.parse(String(init!.body)) as UiSettings;
        const answer = { ...stored };
        await new Promise<void>((r) => gates.push({ kind: 'PUT', open: r }));
        return new Response(JSON.stringify(answer), { status: 200 });
      }
      const snapshot = { ...stored };
      await new Promise<void>((r) => gates.push({ kind: 'GET', open: r }));
      return new Response(JSON.stringify(snapshot), { status: 200 });
    }),
  );
  const { client, hook, settle, shown } = await viewSetup();
  act(() => hook.result.current.save.mutate({ autoPush: true }));
  await waitFor(() => expect(gates.map((g) => g.kind)).toEqual(['PUT']));
  // Another tab saves after ours was stored; its event sends a read.
  stored = { ...stored, theme: 'dark' };
  // Not inside act(): this read stays out across later steps.
  void client.invalidateQueries({ queryKey: settingsQuery().queryKey });
  await waitFor(() => expect(gates.map((g) => g.kind)).toEqual(['PUT', 'GET']));
  // Our answer arrives before the newer read's.
  gates.splice(0, 1)[0]!.open();
  await waitFor(() => expect(client.isMutating()).toBe(0));
  // Answer every read, the one sent again included.
  for (let i = 0; i < 20 && shown()?.theme !== 'dark'; i++) {
    while (gates.length > 0) gates.shift()!.open();
    await settle();
  }
  expect(shown()).toEqual({ ...DEFAULTS, autoPush: true, theme: 'dark' });
  expect(client.getQueryData(settingsQuery().queryKey)).toEqual({ ...DEFAULTS, autoPush: true, theme: 'dark' });
});
