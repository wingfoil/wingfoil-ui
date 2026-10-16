// @vitest-environment jsdom
// task-041 — Configuration › UI settings (US-C-07, C-07.1; ux-reference §4.11; D41-1 … D41-4,
// D41-8, D41-9, D41-13) on the whole application with a stubbed API: the seven settings with their
// values, each control saving the whole object on its own, the number fields' validation, the
// declared residual of Auto-update and the WingFoil 0.3 note as the switches' descriptions, the
// "Saved" status and the alert of a failed save, the sidebar entry and the catalogue.
import type { UiSettings } from '@wingfoil-ui/contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { keyCatalogue } from '../../../web/scripts/catalogue.mjs';
import { stopEventStream } from '../../../web/src/api/events.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { resetSession } from '../../../web/src/session/session.js';
import { BASE, BO, header, PID, projectApi } from '../dna/data.js';
import { renderApp } from '../shell/render.js';

const DEFAULTS: UiSettings = {
  autoFetch: true,
  fetchIntervalSeconds: 60,
  autoUpdate: false,
  autoPush: false,
  theme: 'system',
  confirmAgentLaunch: true,
  actionLogCap: 5000,
};

const PAGE = `/p/${PID}/configuration/ui-settings`;

interface Options {
  stored?: UiSettings;
  /** Answer of every PUT (default: store and echo the body). */
  put?: { status: number; body: unknown };
  /** Answer of GET /api/settings (default: the stored settings). */
  get?: { status: number; body: unknown };
}

/** The project API plus a settings API recording every PUT body. */
function stubAll(options: Options = {}) {
  let stored = { ...(options.stored ?? DEFAULTS) };
  const puts: UiSettings[] = [];
  const api = projectApi({ [BASE]: { status: 200, body: header(BO, 'r-dev') } });
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (url === '/api/settings') {
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as UiSettings;
        puts.push(body);
        if (options.put) return json(options.put.status, options.put.body);
        stored = body;
        return json(200, stored);
      }
      return options.get ? json(options.get.status, options.get.body) : json(200, stored);
    }
    const a = api[url] ?? { status: 404, body: { error: { code: 'not-found', message: 'Not found' } } };
    return json(a.status, a.body);
  });
  vi.stubGlobal('fetch', fn);
  return { puts };
}

beforeEach(() => {
  resetSession();
  vi.stubGlobal(
    'EventSource',
    class {
      addEventListener(): void {}
      close(): void {}
    },
  );
});
afterEach(() => {
  cleanup();
  stopEventStream();
  vi.unstubAllGlobals();
});

const sw = (name: string) => screen.getByRole('switch', { name });
const checked = (el: HTMLElement) => (el as HTMLInputElement).checked;

async function openPage(): Promise<void> {
  expect(await screen.findByRole('heading', { level: 1, name: 'Configuration' })).toBeTruthy();
  await screen.findByRole('switch', { name: 'Auto-fetch' });
}

it('C-07.1 — shows every setting with its default', async () => {
  stubAll();
  renderApp(PAGE);
  await openPage();
  expect(checked(sw('Auto-fetch'))).toBe(true);
  expect(checked(sw('Auto-update'))).toBe(false);
  expect(checked(sw('Auto-push'))).toBe(false);
  expect(checked(sw('Confirm agent launch'))).toBe(true);
  expect(checked(screen.getByRole('radio', { name: 'System' }))).toBe(true);
  expect(checked(screen.getByRole('radio', { name: 'Light' }))).toBe(false);
  expect(checked(screen.getByRole('radio', { name: 'Dark' }))).toBe(false);
  expect((screen.getByRole('textbox', { name: 'Fetch interval (seconds)' }) as HTMLInputElement).value).toBe('60');
  expect((screen.getByRole('textbox', { name: 'Entries kept' }) as HTMLInputElement).value).toBe('5000');
  expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeTruthy();
  expect(document.title).toBe('demo · Configuration — WingFoil UI');
});

it('shows stored values, not the defaults', async () => {
  stubAll({ stored: { ...DEFAULTS, autoPush: true, theme: 'dark', fetchIntervalSeconds: 15, autoFetch: false } });
  renderApp(PAGE);
  await openPage();
  expect(checked(sw('Auto-fetch'))).toBe(false);
  expect(checked(sw('Auto-push'))).toBe(true);
  expect(checked(screen.getByRole('radio', { name: 'Dark' }))).toBe(true);
  expect((screen.getByRole('textbox', { name: 'Fetch interval (seconds)' }) as HTMLInputElement).value).toBe('15');
});

it('describes Auto-update with its declared residual and the user guide section (D41-8, W4-16)', async () => {
  stubAll();
  renderApp(PAGE);
  await openPage();
  const description = sw('Auto-update').getAttribute('aria-describedby') ?? '';
  const text = description
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');
  expect(text).toContain(
    'Auto-update does what git pull does, on a timer: incoming commits can run commands your own git configuration points at (filter drivers, credential helpers, aliases). Leave it off if your configuration runs scripts from your projects.',
  );
  expect(text).toContain('Before you turn Auto-update on');
  expect(text).toContain('docs/user-guide.md');
  // `git pull` is shown as code.
  expect(screen.getByText('git pull').tagName).toBe('CODE');
});

it('notes that Confirm agent launch takes effect from WingFoil 0.3 (RP-15, D41-13)', async () => {
  stubAll();
  renderApp(PAGE);
  await openPage();
  const ids = (sw('Confirm agent launch').getAttribute('aria-describedby') ?? '').split(' ');
  expect(ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ')).toContain('WingFoil 0.3');
});

it('saves a switch on its own with the whole object and says so (D41-3, D41-9)', async () => {
  const { puts } = stubAll();
  renderApp(PAGE);
  await openPage();
  const user = userEvent.setup();
  await user.click(sw('Auto-push'));
  await waitFor(() => expect(puts).toEqual([{ ...DEFAULTS, autoPush: true }]));
  await waitFor(() => expect(checked(sw('Auto-push'))).toBe(true));
  expect(await screen.findByText('Settings saved')).toBeTruthy();
  expect(screen.getByText('Settings saved').closest('[role="status"]')).toBeTruthy();
});

it('saves the theme from the radio group', async () => {
  const { puts } = stubAll();
  renderApp(PAGE);
  await openPage();
  await userEvent.setup().click(screen.getByRole('radio', { name: 'Light' }));
  await waitFor(() => expect(puts).toEqual([{ ...DEFAULTS, theme: 'light' }]));
});

it('saves a number on Enter or when the field is left, once valid; an invalid one is an error, nothing sent (D41-4)', async () => {
  const { puts } = stubAll();
  renderApp(PAGE);
  await openPage();
  const user = userEvent.setup();
  const interval = screen.getByRole('textbox', { name: 'Fetch interval (seconds)' });
  await user.clear(interval);
  await user.type(interval, '10{Enter}');
  expect(await screen.findByText('Enter a whole number of seconds from 15 to 3600.')).toBeTruthy();
  expect(interval.getAttribute('aria-invalid')).toBe('true');
  expect(puts).toEqual([]);
  await user.clear(interval);
  await user.type(interval, '15{Enter}');
  await waitFor(() => expect(puts).toEqual([{ ...DEFAULTS, fetchIntervalSeconds: 15 }]));
  expect(screen.queryByText('Enter a whole number of seconds from 15 to 3600.')).toBeNull();
  const cap = screen.getByRole('textbox', { name: 'Entries kept' });
  await user.clear(cap);
  await user.type(cap, '200');
  await user.tab();
  await waitFor(() => expect(puts).toHaveLength(2));
  expect(puts[1]).toEqual({ ...DEFAULTS, fetchIntervalSeconds: 15, actionLogCap: 200 });
  // Unchanged value: nothing sent (left untouched, or typed again).
  await user.click(cap);
  await user.tab();
  await user.clear(cap);
  await user.type(cap, '200');
  await user.tab();
  expect(puts).toHaveLength(2);
  // Escape puts the stored value back.
  await user.clear(cap);
  await user.type(cap, '99{Escape}');
  expect((cap as HTMLInputElement).value).toBe('200');
});

it('reports a failed save in an alert naming the setting, and shows the stored value again', async () => {
  const s = stubAll({ put: { status: 500, body: { error: { code: 'internal', message: 'boom' } } } });
  renderApp(PAGE);
  await openPage();
  const user = userEvent.setup();
  await user.click(sw('Auto-update'));
  const alert = await screen.findByRole('alert');
  expect(within(alert).getByText('Auto-update was not saved.')).toBeTruthy();
  expect(alert.textContent).not.toContain('boom');
  await waitFor(() => expect(checked(sw('Auto-update'))).toBe(false));
  expect(s.puts).toHaveLength(1);
});

it('clears the alert at the next successful save', async () => {
  let fail = true;
  const s = stubAll();
  const inner = globalThis.fetch as unknown as (url: string, init?: RequestInit) => Promise<Response>;
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url === '/api/settings' && init?.method === 'PUT' && fail) {
      fail = false;
      return new Response(JSON.stringify({ error: { code: 'internal', message: 'x' } }), { status: 500 });
    }
    return inner(url, init);
  });
  renderApp(PAGE);
  await openPage();
  const user = userEvent.setup();
  await user.click(sw('Auto-push'));
  expect(await screen.findByRole('alert')).toBeTruthy();
  await waitFor(() => expect(checked(sw('Auto-push'))).toBe(false));
  await user.click(sw('Auto-push'));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(s.puts).toEqual([{ ...DEFAULTS, autoPush: true }]);
});

it('shows a loading status, then a read error from the catalogue', async () => {
  stubAll({ get: { status: 500, body: { error: { code: 'internal', message: 'secret text' } } } });
  renderApp(PAGE);
  expect(await screen.findByRole('heading', { level: 1, name: 'Configuration' })).toBeTruthy();
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('The settings could not be read.');
  expect(alert.textContent).not.toContain('secret text');
});

it('is reached from the sidebar Configuration entry; /configuration opens UI settings', async () => {
  stubAll();
  const { router } = renderApp(`/p/${PID}/configuration`);
  await openPage();
  expect(router.state.location.pathname).toBe(PAGE);
  const nav = screen.getByRole('navigation', { name: 'Project views' });
  expect(within(nav).getByRole('link', { name: 'Configuration' }).getAttribute('aria-current')).toBe('page');
  const tabs = screen.getByRole('navigation', { name: 'Configuration sections' });
  expect(within(tabs).getByRole('link', { name: 'UI settings' }).getAttribute('aria-current')).toBe('page');
});

it('renders every text from the catalogue (key build)', async () => {
  stubAll();
  renderApp(PAGE, keyCatalogue(en));
  expect(await screen.findByRole('heading', { level: 1, name: 'settings.title' })).toBeTruthy();
  await screen.findByRole('switch', { name: 'settings.autoFetch.label' });
  for (const id of ['settings.autoUpdate.label', 'settings.autoPush.label', 'settings.confirmAgentLaunch.label']) {
    expect(screen.getByRole('switch', { name: id })).toBeTruthy();
  }
  for (const id of ['settings.theme.system', 'settings.theme.light', 'settings.theme.dark']) {
    expect(screen.getByRole('radio', { name: id })).toBeTruthy();
  }
});
