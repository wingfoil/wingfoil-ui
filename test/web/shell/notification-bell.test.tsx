// @vitest-environment jsdom
// task-042 — the notification bell (US-S-21; ux-reference §3 *Notifications*; spec-003 §5;
// D42-1…D42-4) on the whole application with a stubbed API: the count (the length of Requires
// you, from the Today query shared with Today), the panel (*To unblock* = the Requires you rows,
// *Updates* = the last 10 Memory events, read only while the panel is open), its keyboard
// behaviour, the unidentified and refused states, and the count after a repository change.
import type { MemoryEventEntry, MemoryEventsPage, ProjectHeader, Today, TodayActionRow } from '@wingfoil-ui/contracts';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { queryKeys } from '../../../web/src/api/query-keys.js';
import { resetSession } from '../../../web/src/session/session.js';
import { header, riley } from '../project/header-data.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from './render.js';

const PID = 'p_a';
const HEADER = `/api/p/${PID}`;
const TODAY = `/api/p/${PID}/today`;
const EVENTS = `/api/p/${PID}/events/memory?limit=10`;
const DAYS_3 = new Date(Date.now() - 3 * 86_400_000 - 600_000).toISOString();

function morgan(): ProjectHeader {
  return header({
    identity: { kind: 'member', email: 'morgan@example.test', name: 'Morgan', roles: ['approver', 'tech-lead'] },
    roleViews: ['approver', 'tech-lead'],
    roleView: 'approver',
  });
}

function row(id: string, act: TodayActionRow['action']): TodayActionRow {
  return {
    element: { id, type: id.split('-')[0]!, title: `Title of ${id}`, status: 'pending', localChanges: false },
    descriptor: {
      id,
      type: id.split('-')[0]!,
      status: 'pending',
      kind: 'gate',
      tone: 'human',
      verbs: [],
      actor: { kind: 'none' },
      since: DAYS_3,
    },
    action: act,
  };
}

const MORGAN_TODAY: Today = {
  view: 'approver',
  requiresYou: [row('task-001-login', 'approve'), row('bug-001-crash', 'approve')],
  waitingOnOthers: [],
};

function event(over: Partial<MemoryEventEntry>): MemoryEventEntry {
  return {
    sha: 'a'.repeat(40),
    timestamp: DAYS_3,
    author: 'Jordan <jordan@example.test>',
    operation: 'submit',
    type: 'task',
    id: 'task-001-login',
    from: 'draft',
    to: 'pending',
    approver: null,
    reason: null,
    ...over,
  };
}

const EVENTS_PAGE: MemoryEventsPage = {
  events: [
    event({ sha: '3'.repeat(40) }),
    event({
      sha: '2'.repeat(40),
      operation: 'approve',
      id: 'task-003-logout',
      from: 'pending',
      to: 'approved',
      approver: 'Morgan <morgan@example.test> (approver)',
    }),
    event({ sha: '1'.repeat(40), operation: 'add', id: 'task-004-timeout', from: null, to: null }),
  ],
  more: true,
};

function api(over: FakeApi = {}): FakeApi {
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'demo', path: '/x', remote: null, availability: 'available' }] },
    },
    [HEADER]: { status: 200, body: morgan() },
    [`${TODAY}?view=approver`]: { status: 200, body: MORGAN_TODAY },
    [EVENTS]: { status: 200, body: EVENTS_PAGE },
    ...over,
  };
}

/** The paths the page fetched so far (of the last stubbed `fetch`). */
function fetchCalls(): string[] {
  return (globalThis.fetch as unknown as ReturnType<typeof stubApi>).mock.calls.map((c) => String(c[0]));
}

function paths(fetch: ReturnType<typeof stubApi>): string[] {
  return fetch.mock.calls.map((c) => String(c[0])).filter((p) => p.startsWith('/api/p/'));
}

const banner = () => screen.getByRole('banner');
const bell = async (name: string | RegExp = /^Notifications/) =>
  within(await screen.findByRole('banner')).findByRole('button', { name });
const panel = () => screen.findByRole('dialog', { name: 'Notifications' });
const section = (dialog: HTMLElement, name: string) => within(dialog).getByRole('region', { name });

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

it('shows no bell outside a project (D42-1)', async () => {
  stubApi(api());
  renderApp('/');
  await screen.findByRole('heading', { level: 1, name: 'Projects' });
  expect(within(banner()).queryByRole('button', { name: /^Notifications/ })).toBeNull();
});

it('counts the items to unblock, sharing the Today read of the role view (S-21.1, D42-4)', async () => {
  const fetch = stubApi(api());
  renderApp(`/p/${PID}/today`);
  const button = await bell('Notifications, 2 to unblock');
  expect(button.querySelector('.bell-count')?.textContent).toBe('2');
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 2 things require you' });
  // One read for Today and the bell (D31-6); no Updates while the panel is closed (D42-2).
  expect(paths(fetch).filter((p) => p.startsWith(TODAY))).toEqual([`${TODAY}?view=approver`]);
  expect(paths(fetch)).not.toContain(EVENTS);
});

it('reads Today for the bell on every project view, not only on Today (D42-1)', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/team`);
  expect(await bell('Notifications, 2 to unblock')).toBeTruthy();
});

it('shows no count when nothing requires the user (S-21.2)', async () => {
  stubApi(api({ [`${TODAY}?view=approver`]: { status: 200, body: { ...MORGAN_TODAY, requiresYou: [] } } }));
  const user = userEvent.setup();
  renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, nothing requires you' });
  const button = await bell('Notifications');
  expect(button.querySelector('.bell-count')).toBeNull();
  await user.click(button);
  const dialog = await panel();
  expect(within(section(dialog, 'To unblock')).getByText('Nothing to unblock')).toBeTruthy();
  expect(within(section(dialog, 'To unblock')).queryAllByRole('listitem')).toEqual([]);
});

it('opens with the keyboard, lists the Requires you rows and closes with Escape (S-21.1, D42-3)', async () => {
  stubApi(api());
  const user = userEvent.setup();
  renderApp(`/p/${PID}/today`);
  const button = await bell('Notifications, 2 to unblock');
  button.focus();
  await user.keyboard('{Enter}');
  const dialog = await panel();
  const items = within(section(dialog, 'To unblock')).getAllByRole('listitem');
  expect(items.map((i) => i.getAttribute('data-eid'))).toEqual(['task-001-login', 'bug-001-crash']);
  const link = within(items[0]!).getByRole('link', { name: 'Title of task-001-login' });
  expect(link.getAttribute('href')).toBe(`/p/${PID}/e/task-001-login`);
  expect(items[0]!.querySelector('.bell-verb')?.textContent).toBe('Approve');
  expect(within(dialog).getByRole('link', { name: 'Open Today' }).getAttribute('href')).toBe(`/p/${PID}/today`);
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(button));
});

it('opens the element panel from a row with the gate reason focused, and closes (D42-3, D37-1)', async () => {
  stubApi(api());
  const user = userEvent.setup();
  const { router } = renderApp(`/p/${PID}/today`);
  await user.click(await bell('Notifications, 2 to unblock'));
  const dialog = await panel();
  await user.click(within(dialog).getByRole('link', { name: 'Title of bug-001-crash' }));
  await waitFor(() => expect(router.state.location.pathname).toBe(`/p/${PID}/e/bug-001-crash`));
  expect(router.state.location.state.gateFocus).toBe(true);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull());
});

it('reads the last 10 Memory events only when the panel opens, newest first as received (S-21.1, D42-2)', async () => {
  const fetch = stubApi(api());
  const user = userEvent.setup();
  renderApp(`/p/${PID}/today`);
  const button = await bell('Notifications, 2 to unblock');
  expect(paths(fetch)).not.toContain(EVENTS);
  await user.click(button);
  const dialog = await panel();
  const updates = section(dialog, 'Updates');
  await waitFor(() => expect(within(updates).getAllByRole('listitem')).toHaveLength(3));
  expect(paths(fetch)).toContain(EVENTS);
  const items = within(updates).getAllByRole('listitem');
  expect(items.map((i) => i.querySelector('.bell-update-what')?.textContent)).toEqual([
    'submitted by Jordan',
    'signed off by Morgan',
    'created by Jordan',
  ]);
  expect(items.map((i) => i.querySelector('.bell-update-transition')?.textContent ?? null)).toEqual([
    'draft → pending',
    'pending → approved',
    null,
  ]);
  expect(within(items[1]!).getByRole('link', { name: 'task-003-logout' }).getAttribute('href')).toBe(
    `/p/${PID}/e/task-003-logout`,
  );
  expect(items[0]!.querySelector('time')?.textContent).toBe('3 days ago');
  expect(items[0]!.querySelector('time')?.getAttribute('dateTime')).toBe(DAYS_3);
});

it('says when there is no Memory event yet', async () => {
  stubApi(api({ [EVENTS]: { status: 200, body: { events: [], more: false } } }));
  const user = userEvent.setup();
  renderApp(`/p/${PID}/today`);
  await user.click(await bell('Notifications, 2 to unblock'));
  const dialog = await panel();
  expect(await within(section(dialog, 'Updates')).findByText('No Memory event yet')).toBeTruthy();
});

it('shows a refused Updates read as an error inside the panel', async () => {
  stubApi(api({ [EVENTS]: { status: 500, body: { error: { code: 'internal', message: 'x' } } } }));
  const user = userEvent.setup();
  renderApp(`/p/${PID}/today`);
  await user.click(await bell('Notifications, 2 to unblock'));
  const dialog = await panel();
  expect(await within(section(dialog, 'Updates')).findByRole('alert')).toBeTruthy();
});

it('shows a refused Today as an error inside the panel only, never as "Nothing to unblock" (D31-3)', async () => {
  stubApi(api({ [`${TODAY}?view=approver`]: { status: 500, body: { error: { code: 'internal', message: 'x' } } } }));
  const user = userEvent.setup();
  renderApp(`/p/${PID}/team`);
  const button = await bell('Notifications');
  // The refusal is known (the Today read answered) before the absence of an alert is asserted.
  await waitFor(() => expect(fetchCalls().some((c) => c.startsWith(`${TODAY}?view=approver`))).toBe(true));
  await user.click(button);
  const dialog = await panel();
  const toUnblock = section(dialog, 'To unblock');
  expect(await within(toUnblock).findByRole('alert')).toBeTruthy();
  expect(button.querySelector('.bell-count')).toBeNull();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull());
  expect(within(banner()).queryByRole('alert')).toBeNull();
  expect(within(toUnblock).queryByText('Nothing to unblock')).toBeNull();
});

it('points a user who is not identified to the read-only notice, with the Updates (D42-1)', async () => {
  stubApi(
    api({
      [HEADER]: { status: 200, body: riley() },
      [TODAY]: { status: 200, body: { view: null, requiresYou: null, waitingOnOthers: [] } },
    }),
  );
  const user = userEvent.setup();
  renderApp(`/p/${PID}/today`);
  const button = await bell('Notifications');
  await screen.findByText(/You are not in this project's team/);
  expect(button.querySelector('.bell-count')).toBeNull();
  await user.click(button);
  const dialog = await panel();
  expect(
    within(section(dialog, 'To unblock')).getByText(
      'Nothing to unblock: you are not identified in the team (see the read-only notice).',
    ),
  ).toBeTruthy();
  await waitFor(() => expect(within(section(dialog, 'Updates')).getAllByRole('listitem')).toHaveLength(3));
});

it('updates the count after a repository change (S-21.3)', async () => {
  const fake = api();
  stubApi(fake);
  const { queryClient } = renderApp(`/p/${PID}/team`);
  await bell('Notifications, 2 to unblock');
  fake[`${TODAY}?view=approver`] = {
    status: 200,
    body: { ...MORGAN_TODAY, requiresYou: MORGAN_TODAY.requiresYou!.slice(1) },
  };
  // What a write and the `repo` event do: every query of the project is invalidated.
  await act(() => queryClient.invalidateQueries({ queryKey: queryKeys.project(PID) }));
  expect(await bell('Notifications, 1 to unblock')).toBeTruthy();
});

it('shows no count of one project in another (keyed by the project)', async () => {
  const OTHER = 'p_b';
  stubApi(
    api({
      '/api/projects': {
        status: 200,
        body: {
          projects: [
            { id: PID, name: 'demo', path: '/x', remote: null, availability: 'available' },
            { id: OTHER, name: 'other', path: '/y', remote: null, availability: 'available' },
          ],
        },
      },
      [`/api/p/${OTHER}`]: { status: 200, body: { ...morgan(), id: OTHER } },
    }),
  );
  const { router } = renderApp(`/p/${PID}/team`);
  await bell('Notifications, 2 to unblock');
  await act(() => router.navigate({ to: '/p/$pid/team', params: { pid: OTHER } }));
  // The other project's Today is refused (unknown path → 404): no count is carried over.
  await waitFor(() =>
    expect(within(banner()).getByRole('button', { name: /^Notifications/ }).textContent).not.toContain('2'),
  );
  expect(
    within(banner())
      .getByRole('button', { name: /^Notifications/ })
      .getAttribute('aria-label'),
  ).toBe('Notifications');
});

it('shows no count once a refetch of Today is refused (review R6)', async () => {
  const fake = api();
  stubApi(fake);
  const { queryClient } = renderApp(`/p/${PID}/team`);
  await bell('Notifications, 2 to unblock');
  fake[`${TODAY}?view=approver`] = { status: 500, body: { error: { code: 'internal', message: 'x' } } };
  await act(() => queryClient.invalidateQueries({ queryKey: queryKeys.project(PID) }));
  expect(await bell('Notifications')).toBeTruthy();
  expect((await bell('Notifications')).querySelector('.bell-count')).toBeNull();
});

it('opens the element panel from To unblock with the gate reason focused (review R4, G-04.3)', async () => {
  const EID = 'task-001-login';
  const descriptor = {
    id: EID,
    type: 'task',
    status: 'pending',
    kind: 'gate' as const,
    tone: 'human' as const,
    verbs: [
      { verb: 'approve' as const, to: 'approved', role: 'approver', enabled: true },
      { verb: 'reject' as const, to: 'draft', role: 'approver', enabled: true },
    ],
    actor: { kind: 'role' as const, role: 'approver', members: ['Morgan'] },
  };
  stubApi(
    api({
      [`/api/p/${PID}/elements/${EID}`]: {
        status: 200,
        body: {
          element: {
            path: 'docs/t.md',
            id: EID,
            title: 'Title of task-001-login',
            type: 'task',
            status: 'pending',
            tags: [],
            localChanges: false,
          },
          frontmatter: { id: EID, type: 'task', title: 'Title of task-001-login', status: 'pending' },
          body: 'Summary.\n',
          descriptor,
          required: [],
          states: { sequence: ['draft', 'pending', 'approved'], gates: { pending: { reject: 'draft' } } },
        },
      },
      [`/api/p/${PID}/elements/${EID}/history`]: { status: 200, body: { id: EID, path: 'docs/t.md', entries: [] } },
      [`/api/p/${PID}/directives`]: { status: 200, body: { entries: [], warnings: [] } },
    }),
  );
  const user = userEvent.setup();
  renderApp(`/p/${PID}/team`);
  await user.click(await bell('Notifications, 2 to unblock'));
  const dialog = await panel();
  await user.click(within(dialog).getByRole('link', { name: 'Title of task-001-login' }));
  const reason = await screen.findByRole('textbox', { name: 'Reason, recorded in the commit' });
  await waitFor(() => expect(document.activeElement).toBe(reason));
});
