// @vitest-environment jsdom
// task-041 (X-08.3, D41-5, D41-6): the application writes the UI setting Theme on <html> as
// `data-theme-setting` (`light` / `dark`; none for `system`) as soon as the settings are read, and
// follows every change of them (this tab's save, another tab's `settings` event). The inline script
// of index.html turns it into `data-theme` (its own test).
import type { UiSettings } from '@wingfoil-ui/contracts';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createQueryClient, settingsQuery } from '../../../web/src/api/queries.js';
import { applyThemeSetting, ThemeSetting } from '../../../web/src/settings/ThemeSetting.js';

const DEFAULTS: UiSettings = {
  autoFetch: true,
  fetchIntervalSeconds: 60,
  autoUpdate: false,
  autoPush: false,
  theme: 'system',
  confirmAgentLaunch: true,
  actionLogCap: 5000,
};

const attr = () => document.documentElement.getAttribute('data-theme-setting');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-theme-setting');
});

it.each([
  ['light', 'light'],
  ['dark', 'dark'],
  ['system', null],
  [undefined, null],
] as const)('applyThemeSetting(%s) → data-theme-setting %s', (theme, value) => {
  document.documentElement.setAttribute('data-theme-setting', 'dark');
  applyThemeSetting(theme);
  expect(attr()).toBe(value);
});

it('applies the stored theme once read, then follows the cached settings', async () => {
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ ...DEFAULTS, theme: 'light' }), { status: 200 }));
  const client = createQueryClient();
  render(
    <QueryClientProvider client={client}>
      <ThemeSetting />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(attr()).toBe('light'));
  act(() => client.setQueryData(settingsQuery().queryKey, { ...DEFAULTS, theme: 'dark' }));
  await waitFor(() => expect(attr()).toBe('dark'));
  act(() => client.setQueryData(settingsQuery().queryKey, DEFAULTS));
  await waitFor(() => expect(attr()).toBeNull());
});

it('leaves the system theme in place while the settings cannot be read', async () => {
  vi.stubGlobal(
    'fetch',
    async () => new Response(JSON.stringify({ error: { code: 'internal', message: 'x' } }), { status: 500 }),
  );
  const client = createQueryClient();
  render(
    <QueryClientProvider client={client}>
      <ThemeSetting />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(client.getQueryState(settingsQuery().queryKey)?.status).toBe('error'));
  expect(attr()).toBeNull();
});
