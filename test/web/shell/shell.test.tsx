// @vitest-environment jsdom
// The web shell (task-013; ux-reference §2–§3, decisions W3-1, W3-2, W3-6, W3-7): the start page with
// the project switcher and "Add project…", the dialog frame, the shell warnings of GET
// /api/server (spec-006 §4), the lost-session page, the project layout and the page title.
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { AppIntlProvider } from '../../../web/src/i18n/index.js';
import { markSessionLost, resetSession } from '../../../web/src/session/session.js';
import { ProjectNav } from '../../../web/src/routes/project.js';
import { renderApp, serverInfo, stubApi } from './render.js';

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

it('shows the start page: landmarks, heading, the switcher and "Add project…", and its title', async () => {
  stubApi({ '/api/server': serverInfo() });
  renderApp('/');
  expect(await screen.findByRole('heading', { level: 1, name: 'Projects' })).toBeTruthy();
  expect(screen.getByRole('banner')).toBeTruthy();
  expect(screen.getByRole('main')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Skip to content' }).getAttribute('href')).toBe('#main');
  expect(screen.getByRole('button', { name: 'Projects' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Add project…' })).toBeTruthy();
  await waitFor(() => expect(document.title).toBe('Projects — WingFoil UI'));
});

it('opens the switcher menu from the keyboard and offers "Add project…"', async () => {
  stubApi({ '/api/server': serverInfo() });
  const user = userEvent.setup();
  renderApp('/');
  const trigger = await screen.findByRole('button', { name: 'Projects' });
  trigger.focus();
  await user.keyboard('{Enter}');
  const menu = await screen.findByRole('menu');
  expect(within(menu).getByRole('menuitem', { name: 'Add project…' })).toBeTruthy();
  await user.keyboard('{Enter}');
  const dialog = await screen.findByRole('dialog', { name: 'Add project' });
  expect(dialog).toBeTruthy();
});

it('opens the Add project dialog frame, traps the focus and gives it back on close', async () => {
  stubApi({ '/api/server': serverInfo() });
  const user = userEvent.setup();
  renderApp('/');
  const add = await screen.findByRole('button', { name: 'Add project…' });
  await user.click(add);
  const dialog = await screen.findByRole('dialog', { name: 'Add project' });
  expect(dialog.contains(document.activeElement)).toBe(true);
  await user.tab();
  expect(dialog.contains(document.activeElement)).toBe(true);
  await user.click(within(dialog).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(add));
});

it('closes the dialog with Escape', async () => {
  stubApi({ '/api/server': serverInfo() });
  const user = userEvent.setup();
  renderApp('/');
  await user.click(await screen.findByRole('button', { name: 'Add project…' }));
  await screen.findByRole('dialog');
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

it('shows the state warnings of GET /api/server and dismisses them one by one', async () => {
  stubApi({
    '/api/server': serverInfo([
      { key: 'state.corruptKept', args: { file: 'state.json.corrupt-20261006T080000Z' } },
      { key: 'state.newerVersion', args: {} },
      { key: 'state.somethingUnknown', args: {} },
    ]),
  });
  const user = userEvent.setup();
  renderApp('/');
  const region = await screen.findByRole('region', { name: 'Console warnings' });
  await within(region).findByText(/kept as state\.json\.corrupt-20261006T080000Z/);
  expect(within(region).getByText('Project list saved by a newer WingFoil UI — changes are not saved')).toBeTruthy();
  expect(within(region).queryByText(/somethingUnknown/)).toBeNull();
  const dismiss = within(region).getAllByRole('button', { name: 'Dismiss this warning' });
  expect(dismiss).toHaveLength(2);
  await user.click(dismiss[0]!);
  expect(within(region).queryByText(/kept as/)).toBeNull();
  expect(within(region).getByText(/newer WingFoil UI/)).toBeTruthy();
});

it('shows no warning region without warnings', async () => {
  stubApi({ '/api/server': serverInfo() });
  renderApp('/');
  await screen.findByRole('heading', { level: 1 });
  await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
  expect(screen.queryByRole('region', { name: 'Console warnings' })).toBeNull();
});

it('replaces the page with the lost-session notice when the session is lost', async () => {
  stubApi({ '/api/server': serverInfo() });
  renderApp('/');
  await screen.findByRole('heading', { level: 1, name: 'Projects' });
  markSessionLost();
  expect(await screen.findByRole('heading', { level: 1, name: 'Not connected to the console' })).toBeTruthy();
  expect(screen.getByText(/Open the URL printed in the terminal/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Add project…' })).toBeNull();
  await waitFor(() => expect(document.title).toBe('Not connected — WingFoil UI'));
});

it('loses the session when GET /api/server answers 401', async () => {
  stubApi({ '/api/server': { status: 401, body: { error: { code: 'unauthenticated', message: 'x' } } } });
  renderApp('/');
  expect(await screen.findByRole('heading', { level: 1, name: 'Not connected to the console' })).toBeTruthy();
});

it('shows a not-found page with a way back for an unknown path', async () => {
  stubApi({ '/api/server': serverInfo() });
  const user = userEvent.setup();
  renderApp('/no/such/page');
  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeTruthy();
  await waitFor(() => expect(document.title).toBe('Page not found — WingFoil UI'));
  const banner = screen.getByRole('banner');
  // A React Aria link: navigates through the router (jsdom would not follow a plain anchor).
  await user.click(screen.getByRole('link', { name: 'Back to the projects' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Projects' })).toBeTruthy();
  expect(screen.getByRole('banner')).toBe(banner);
});

it('renders the project layout with its views navigation and main landmark', async () => {
  stubApi({ '/api/server': serverInfo() });
  renderApp('/p/p_kanbankanban');
  expect(await screen.findByRole('navigation', { name: 'Project views' })).toBeTruthy();
  expect(screen.getByRole('main')).toBeTruthy();
});

it('renders the sidebar groups with links to the views of the current project', async () => {
  // The registry of task-013 is empty: ProjectNav is rendered alone with a sample group.
  const root = createRootRoute({
    component: () => (
      <ProjectNav
        pid="p_x"
        groups={[
          {
            id: 'work',
            label: { id: 'shell.nav.group.work' },
            items: [{ id: 'one', label: { id: 'projects.start.title' }, to: '/p/$pid', order: 10 }],
          },
        ]}
      />
    ),
  });
  const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ['/'] }) });
  render(
    <AppIntlProvider>
      <RouterProvider router={router} />
    </AppIntlProvider>,
  );
  const nav = await screen.findByRole('navigation', { name: 'Project views' });
  expect(within(nav).getByText('Work')).toBeTruthy();
  expect(within(nav).getByRole('link', { name: 'Projects' }).getAttribute('href')).toBe('/p/p_x');
});
