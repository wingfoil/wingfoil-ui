// @vitest-environment jsdom
// The project switcher (task-015; ux-reference §3, decisions W4-1…W4-7): the projects in stored
// order with name and path, links with opaque ids only (X-05.1), the switch to the same view of the
// other project (W4-5, S-16.2), the unavailable entries (W4-3, S-19.1, S-10.2), the list read again
// on every opening (W4-4, S-19.2), the removal with confirmation (W4-2, S-18.1, S-18.2) and the
// keyboard.
import type { ProjectListItem } from '@wingfoil-ui/contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { resetSession } from '../../../web/src/session/session.js';
import { renderApp, serverInfo } from './render.js';

const ALPHA: ProjectListItem = {
  id: 'p_alpha',
  name: 'alpha',
  path: '/home/test/projects/alpha',
  remote: '',
  availability: 'ok',
};
const BETA: ProjectListItem = {
  id: 'p_beta',
  name: 'beta',
  path: '/home/test/projects/beta',
  remote: '',
  availability: 'ok',
};

interface Call {
  method: string;
  url: string;
}

/** A fake API holding a project list: GET reads it, DELETE removes from it (or answers `remove`). */
function fakeApi(projects: ProjectListItem[], remove?: { status: number; body?: unknown } | 'unreachable') {
  let list = [...projects];
  const calls: Call[] = [];
  const respond = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ method, url });
      if (url === '/api/server') return respond(200, serverInfo().body);
      if (url === '/api/projects') return respond(200, { projects: list });
      const m = /^\/api\/projects\/([^/]+)$/.exec(url);
      if (m && method === 'DELETE') {
        if (remove === 'unreachable') throw new TypeError('Failed to fetch');
        if (remove) return respond(remove.status, remove.body);
        list = list.filter((p) => p.id !== decodeURIComponent(m[1]!));
        return respond(204);
      }
      return respond(404, { error: { code: 'not-found', message: 'Not found' } });
    }),
  );
  return {
    calls,
    count: (method: string, url: string) => calls.filter((c) => c.method === method && c.url === url).length,
  };
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

async function openSwitcher(user: ReturnType<typeof userEvent.setup>, name: string | RegExp = 'Projects') {
  await user.click(await screen.findByRole('button', { name }));
  return screen.findByRole('grid', { name: 'Projects' });
}

it('lists the projects in stored order with name and path, and links by opaque id', async () => {
  fakeApi([BETA, ALPHA]);
  const user = userEvent.setup();
  renderApp('/');
  const grid = await openSwitcher(user);
  const rows = await within(grid).findAllByRole('row');
  expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining('beta'), expect.stringContaining('alpha')]);
  expect(within(rows[0]!).getByText('/home/test/projects/beta')).toBeTruthy();
  // React Aria renders a link row with `data-href` (the router's href) and opens it on press.
  const links = grid.querySelectorAll('[data-href]');
  expect([...links].map((a) => a.getAttribute('data-href'))).toEqual(['/p/p_beta', '/p/p_alpha']);
  expect(screen.getByText('Added projects stay saved in this UI.')).toBeTruthy();
});

it('opens "Add project…" from the switcher: the dialog frame of the shell', async () => {
  fakeApi([ALPHA]);
  const user = userEvent.setup();
  renderApp('/');
  await openSwitcher(user);
  const dialog = screen.getByRole('dialog', { name: 'Projects' });
  await user.click(within(dialog).getByRole('button', { name: 'Add project…' }));
  expect(await screen.findByRole('dialog', { name: 'Add project' })).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole('grid', { name: 'Projects' })).toBeNull());
});

it('names the open project on the trigger and marks its row', async () => {
  fakeApi([ALPHA, BETA]);
  const user = userEvent.setup();
  renderApp('/p/p_alpha/dna');
  const trigger = await screen.findByRole('button', { name: 'Projects: alpha' });
  expect(trigger.textContent).toBe('alpha');
  const grid = await openSwitcher(user, 'Projects: alpha');
  const [first, second] = await within(grid).findAllByRole('row');
  expect(within(first!).getByText('current project')).toBeTruthy();
  expect(within(second!).queryByText('current project')).toBeNull();
});

it('switches to the same view of the other project and closes the switcher (W4-5)', async () => {
  fakeApi([ALPHA, BETA]);
  const user = userEvent.setup();
  const { router } = renderApp('/p/p_alpha/dna');
  const grid = await openSwitcher(user, 'Projects: alpha');
  const link = grid.querySelector('[data-href="/p/p_beta/dna"]');
  expect(link).not.toBeNull();
  await user.click(within(grid).getByText('beta'));
  await waitFor(() => expect(router.state.location.pathname).toBe('/p/p_beta/dna'));
  await waitFor(() => expect(screen.queryByRole('grid', { name: 'Projects' })).toBeNull());
  expect(await screen.findByRole('button', { name: 'Projects: beta' })).toBeTruthy();
});

it('operates from the keyboard: open, move between rows, open a project', async () => {
  fakeApi([ALPHA, BETA]);
  const user = userEvent.setup();
  const { router } = renderApp('/');
  const trigger = await screen.findByRole('button', { name: 'Projects' });
  trigger.focus();
  await user.keyboard('{Enter}');
  const grid = await screen.findByRole('grid', { name: 'Projects' });
  await waitFor(() => expect(grid.contains(document.activeElement)).toBe(true));
  await user.keyboard('{ArrowDown}');
  await waitFor(() => expect(document.activeElement?.textContent).toContain('beta'));
  await user.keyboard('{Enter}');
  await waitFor(() => expect(router.state.location.pathname).toBe('/p/p_beta/memory'));
});

it('reaches Remove from a row with Tab, then "Add project…"', async () => {
  fakeApi([ALPHA, BETA]);
  const user = userEvent.setup();
  renderApp('/');
  const trigger = await screen.findByRole('button', { name: 'Projects' });
  trigger.focus();
  await user.keyboard('{Enter}');
  const grid = await screen.findByRole('grid', { name: 'Projects' });
  await waitFor(() => expect(document.activeElement?.textContent).toContain('alpha'));
  await user.tab();
  expect(document.activeElement).toBe(within(grid).getByRole('button', { name: 'Remove alpha' }));
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add project…' }));
  await user.tab({ shift: true });
  await waitFor(() => expect(grid.contains(document.activeElement)).toBe(true));
  await user.tab();
  expect(document.activeElement).toBe(within(grid).getByRole('button', { name: 'Remove alpha' }));
  await user.keyboard('{Enter}');
  expect(await screen.findByRole('alertdialog', { name: 'Remove alpha from the list?' })).toBeTruthy();
});

it('closes with Escape and gives the focus back to the trigger', async () => {
  fakeApi([ALPHA]);
  const user = userEvent.setup();
  renderApp('/');
  await openSwitcher(user);
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('grid')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Projects' })));
});

it('reads the list again on every opening (W4-4, S-19.2)', async () => {
  const api = fakeApi([ALPHA]);
  const user = userEvent.setup();
  renderApp('/');
  await screen.findByRole('button', { name: 'Projects' });
  await waitFor(() => expect(api.count('GET', '/api/projects')).toBe(1));
  await openSwitcher(user);
  await waitFor(() => expect(api.count('GET', '/api/projects')).toBe(2));
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('grid')).toBeNull());
  await openSwitcher(user);
  await waitFor(() => expect(api.count('GET', '/api/projects')).toBe(3));
});

it('marks the unavailable entries with their reason, without a link, and keeps Remove (W4-3)', async () => {
  fakeApi([
    { ...ALPHA, availability: 'folder-not-found' },
    { ...BETA, availability: 'not-wingfoil' },
    {
      id: 'p_gamma',
      name: 'gamma',
      path: '/home/test/projects/gamma',
      remote: '',
      availability: 'cli-not-found',
      command: 'npm install --save-dev wingfoil',
    },
  ]);
  const user = userEvent.setup();
  renderApp('/');
  const grid = await openSwitcher(user);
  const rows = await within(grid).findAllByRole('row');
  expect(within(rows[0]!).getByText('Unavailable — folder not found')).toBeTruthy();
  expect(within(rows[1]!).getByText('Unavailable — no .wingfoil/ folder')).toBeTruthy();
  expect(within(rows[2]!).getByText('Unavailable — WingFoil CLI not found')).toBeTruthy();
  expect(within(rows[2]!).getByText('npm install --save-dev wingfoil')).toBeTruthy();
  expect(grid.querySelectorAll('[data-href]')).toHaveLength(0);
  for (const name of ['alpha', 'beta', 'gamma']) {
    expect(within(grid).getByRole('button', { name: `Remove ${name}` })).toBeTruthy();
  }
  expect(within(rows[0]!).getByText('/home/test/projects/alpha')).toBeTruthy();
});

it('removes a project after confirmation (S-18.1) and gives the focus back to the trigger', async () => {
  const api = fakeApi([ALPHA, BETA]);
  const user = userEvent.setup();
  const { router } = renderApp('/p/p_alpha/dna');
  const grid = await openSwitcher(user, 'Projects: alpha');
  await user.click(within(grid).getByRole('button', { name: 'Remove beta' }));
  const confirm = await screen.findByRole('alertdialog', { name: 'Remove beta from the list?' });
  expect(within(confirm).getByText('Its folder and its files are not touched.')).toBeTruthy();
  expect(screen.queryByRole('grid')).toBeNull();
  await user.click(within(confirm).getByRole('button', { name: 'Remove' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(api.count('DELETE', '/api/projects/p_beta')).toBe(1);
  expect(router.state.location.pathname).toBe('/p/p_alpha/dna');
  const trigger = screen.getByRole('button', { name: 'Projects: alpha' });
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  const again = await openSwitcher(user, 'Projects: alpha');
  await waitFor(() => expect(within(again).getAllByRole('row')).toHaveLength(1));
  expect(within(again).queryByText('beta')).toBeNull();
});

it('goes to the start page when the open project is removed (W4-2)', async () => {
  fakeApi([ALPHA, BETA]);
  const user = userEvent.setup();
  const { router } = renderApp('/p/p_alpha/dna');
  const grid = await openSwitcher(user, 'Projects: alpha');
  await user.click(within(grid).getByRole('button', { name: 'Remove alpha' }));
  const confirm = await screen.findByRole('alertdialog');
  await user.click(within(confirm).getByRole('button', { name: 'Remove' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  const trigger = await screen.findByRole('button', { name: 'Projects' });
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

it.each(['button', 'Escape'] as const)('cancels the removal with %s (S-18.2)', async (how) => {
  const api = fakeApi([ALPHA]);
  const user = userEvent.setup();
  renderApp('/');
  const grid = await openSwitcher(user);
  await user.click(within(grid).getByRole('button', { name: 'Remove alpha' }));
  const confirm = await screen.findByRole('alertdialog');
  await waitFor(() => expect(document.activeElement).toBe(within(confirm).getByRole('button', { name: 'Cancel' })));
  if (how === 'button') await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
  else await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(api.count('DELETE', '/api/projects/p_alpha')).toBe(0);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Projects' })));
  const again = await openSwitcher(user);
  expect(await within(again).findByText('alpha')).toBeTruthy();
});

it.each([
  [{ status: 404, body: { error: { code: 'not-found', message: 'Not found' } } }, 'Not found'],
  ['unreachable', 'The console cannot be reached: check that it is still running in its terminal.'],
] as const)('shows a refused or unanswered removal inside the dialog', async (answer, text) => {
  fakeApi([ALPHA], answer);
  const user = userEvent.setup();
  renderApp('/');
  const grid = await openSwitcher(user);
  await user.click(within(grid).getByRole('button', { name: 'Remove alpha' }));
  const confirm = await screen.findByRole('alertdialog');
  await user.click(within(confirm).getByRole('button', { name: 'Remove' }));
  expect(await within(confirm).findByText(text)).toBeTruthy();
  expect(screen.getByRole('alertdialog')).toBeTruthy();
});

it('says when the list is empty and when it cannot be read', async () => {
  fakeApi([]);
  const user = userEvent.setup();
  renderApp('/');
  const grid = await openSwitcher(user);
  expect(await within(grid).findByText('No project in the list')).toBeTruthy();
});

it('shows the error of the list read inside the switcher', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url === '/api/server'
        ? new Response(JSON.stringify(serverInfo().body), { status: 200 })
        : new Response(JSON.stringify({ error: { code: 'internal', message: 'x' } }), { status: 500 }),
    ),
  );
  const user = userEvent.setup();
  renderApp('/');
  await user.click(await screen.findByRole('button', { name: 'Projects' }));
  const dialog = await screen.findByRole('dialog', { name: 'Projects' });
  expect(
    await within(dialog).findByText('Something went wrong in the console: see its log in the terminal'),
  ).toBeTruthy();
  expect(within(dialog).getByRole('button', { name: 'Add project…' })).toBeTruthy();
});
