// @vitest-environment jsdom
// task-061 — the Today cards in v0.3 (US-T-02 T-02.4 … T-02.7; ux-reference §4.1 v0.3; D61-4 …
// D61-10) on the whole application with a stubbed API: the type and state filters of each card with
// their counts, a filter applying to its own card only, the 10-row limit with "Show all (<n>)" and
// "Show fewer", the entry date with the full time as its accessible description, the short id the
// API serves, and a held gate's row filtered and limited like the others.
import type { ActionDescriptor, ProjectHeader, Today, TodayActionRow, TodayRow } from '@wingfoil-ui/contracts';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { todayQuery } from '../../../web/src/api/queries.js';
import { queryKeys } from '../../../web/src/api/query-keys.js';
import { resetSession } from '../../../web/src/session/session.js';
import { header } from '../project/header-data.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';

const PID = 'p_a';
const HEADER = `/api/p/${PID}`;
const TODAY = `/api/p/${PID}/today`;
const SINCE = '2026-09-29T15:20:01.000Z';

function morgan(roleView = 'approver'): ProjectHeader {
  return header({
    identity: { kind: 'member', email: 'morgan@example.test', name: 'Morgan', roles: ['approver', 'tech-lead'] },
    roleViews: ['approver', 'tech-lead'],
    roleView,
  });
}

function descriptor(id: string, over: Partial<ActionDescriptor> = {}): ActionDescriptor {
  return { id, type: 'task', status: 's', kind: 'gate', tone: 'human', verbs: [], actor: { kind: 'none' }, ...over };
}

/** A Requires you row; `shortId` as the API would serve it (`undefined`: none). */
function action(id: string, status: string, over: Partial<ActionDescriptor> = {}, shortId?: string): TodayActionRow {
  return {
    element: {
      id,
      ...(shortId === undefined ? {} : { shortId }),
      type: id.split('-')[0]!,
      title: `Title of ${id}`,
      status,
      localChanges: false,
    },
    descriptor: descriptor(id, { status, ...over }),
    action: 'approve',
  };
}

function waiting(id: string, status: string, over: Partial<ActionDescriptor> = {}, shortId?: string): TodayRow {
  return {
    element: {
      id,
      ...(shortId === undefined ? {} : { shortId }),
      type: id.split('-')[0]!,
      title: `Title of ${id}`,
      status,
      localChanges: false,
    },
    descriptor: descriptor(id, {
      status,
      tone: 'neutral',
      actor: { kind: 'member', member: { name: 'Jordan', email: 'jordan@example.test' } },
      ...over,
    }),
  };
}

const MORGAN_TODAY: Today = {
  view: 'approver',
  requiresYou: [
    action('task-001-login-form', 'pending', { since: SINCE }, 'task-001'),
    action('bug-001-crash-on-save', 'pending', { since: SINCE }, 'bug-001'),
  ],
  waitingOnOthers: [
    waiting('task-002-password-reset', 'draft', { since: SINCE }, 'task-002'),
    waiting('task-004-session-timeout', 'draft', {}, 'task-004'),
    waiting('minor-v0.1', 'planning', { since: SINCE }),
  ],
};

/** `n` pending tasks numbered from `from`, each with its short id. */
function pending(n: number, from = 101): TodayActionRow[] {
  return Array.from({ length: n }, (_, i) =>
    action(`task-${from + i}-more`, 'pending', { since: SINCE }, `task-${from + i}`),
  );
}

function api(over: FakeApi = {}): FakeApi {
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'demo', path: '/x', remote: null, availability: 'available' }] },
    },
    [HEADER]: { status: 200, body: morgan() },
    [`${TODAY}?view=approver`]: { status: 200, body: MORGAN_TODAY },
    ...over,
  };
}

const requiresYou = () => screen.getByRole('region', { name: 'Requires you' });
const waitingCard = () => screen.getByRole('region', { name: 'Waiting on others' });
const rowsOf = (region: HTMLElement) => [...region.querySelectorAll<HTMLElement>('li[data-eid]')];
/** The accessible description `aria-describedby` gives `el` (the texts of its ids, in order). */
const computeAccessibleDescription = (el: HTMLElement): string =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter((id) => id !== '')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');
const idsOf = (region: HTMLElement) => rowsOf(region).map((li) => li.dataset['eid']);
/** The filter `label` ("Type" or "State") of a card: its trigger button. */
const filterOf = (region: HTMLElement, label: string) =>
  within(region).getByRole('button', { name: new RegExp(` ${label}$`) });

/** The accessible names of the options of the open listbox, then close it with Escape. */
async function optionsOf(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement): Promise<string[]> {
  await user.click(trigger);
  const names = within(await screen.findByRole('listbox'))
    .getAllByRole('option')
    .map((o) => o.textContent ?? '');
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  return names;
}

/** Choose `option` in the filter `trigger`. */
async function choose(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, option: string): Promise<void> {
  await user.click(trigger);
  await user.click(within(await screen.findByRole('listbox')).getByRole('option', { name: option }));
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

it('filters a card by type and by state, with the counts of its rows (T-02.4, D61-4, D61-5)', async () => {
  const user = userEvent.setup();
  stubApi(api());
  renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 2 things require you' });
  const type = filterOf(requiresYou(), 'Type');
  expect(type.textContent).toBe('All (2)');
  expect(await optionsOf(user, type)).toEqual(['All (2)', 'bug (1)', 'task (1)']);
  await choose(user, type, 'bug (1)');
  await waitFor(() => expect(idsOf(requiresYou())).toEqual(['bug-001-crash-on-save']));
  expect(filterOf(requiresYou(), 'Type').textContent).toBe('bug (1)');
  // The state filter counts the card's rows, whatever the type filter chose.
  expect(await optionsOf(user, filterOf(requiresYou(), 'State'))).toEqual(['All (2)', 'pending (2)']);
  // The other card is not filtered (AC-3), and its filters stay on All.
  expect(idsOf(waitingCard())).toEqual(['task-002-password-reset', 'task-004-session-timeout', 'minor-v0.1']);
  expect(filterOf(waitingCard(), 'Type').textContent).toBe('All (3)');
  expect(await optionsOf(user, filterOf(waitingCard(), 'State'))).toEqual(['All (3)', 'draft (2)', 'planning (1)']);
  // The greeting keeps counting every row of Requires you (S4).
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Morgan, 2 things require you');
});

it('filters Waiting on others alone, and both filters combine (AC-3, D61-4)', async () => {
  const user = userEvent.setup();
  stubApi(api());
  renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 2 things require you' });
  await choose(user, filterOf(waitingCard(), 'State'), 'draft (2)');
  await waitFor(() => expect(idsOf(waitingCard())).toEqual(['task-002-password-reset', 'task-004-session-timeout']));
  expect(idsOf(requiresYou())).toEqual(['task-001-login-form', 'bug-001-crash-on-save']);
  await choose(user, filterOf(waitingCard(), 'Type'), 'minor (1)');
  await waitFor(() => expect(idsOf(waitingCard())).toEqual([]));
  expect(within(waitingCard()).getByText('No row matches the filters')).toBeTruthy();
  await choose(user, filterOf(waitingCard(), 'State'), 'All (3)');
  await waitFor(() => expect(idsOf(waitingCard())).toEqual(['minor-v0.1']));
});

it('falls back to All when the chosen value leaves the card after a refetch (D61-6)', async () => {
  const user = userEvent.setup();
  const fake = api();
  stubApi(fake);
  const { queryClient } = renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 2 things require you' });
  await choose(user, filterOf(requiresYou(), 'Type'), 'bug (1)');
  await waitFor(() => expect(idsOf(requiresYou())).toEqual(['bug-001-crash-on-save']));
  fake[`${TODAY}?view=approver`] = {
    status: 200,
    body: { ...MORGAN_TODAY, requiresYou: [MORGAN_TODAY.requiresYou![0]!, ...pending(1)] },
  };
  await act(() => queryClient.invalidateQueries({ queryKey: queryKeys.project(PID) }));
  await waitFor(() => expect(idsOf(requiresYou())).toEqual(['task-001-login-form', 'task-101-more']));
  expect(filterOf(requiresYou(), 'Type').textContent).toBe('All (2)');
  expect(await optionsOf(user, filterOf(requiresYou(), 'Type'))).toEqual(['All (2)', 'task (2)']);
});

it('shows no filters on an empty card (D61-5)', async () => {
  stubApi(
    api({
      [`${TODAY}?view=approver`]: { status: 200, body: { view: 'approver', requiresYou: [], waitingOnOthers: [] } },
    }),
  );
  renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, nothing requires you' });
  expect(within(requiresYou()).getByText('Nothing requires you')).toBeTruthy();
  expect(within(requiresYou()).queryAllByRole('button')).toEqual([]);
});

it('shows the first 10 rows, then all of them, then 10 again, the focus kept (T-02.6, D61-7)', async () => {
  const user = userEvent.setup();
  const rows = [...MORGAN_TODAY.requiresYou!, ...pending(11)];
  stubApi(api({ [`${TODAY}?view=approver`]: { status: 200, body: { ...MORGAN_TODAY, requiresYou: rows } } }));
  renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 13 things require you' });
  expect(idsOf(requiresYou())).toEqual(rows.slice(0, 10).map((r) => r.element.id));
  const toggle = within(requiresYou()).getByRole('button', { name: 'Show all (13)' });
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  const list = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
  expect(list?.tagName).toBe('UL');
  expect(requiresYou().contains(list)).toBe(true);
  await user.click(toggle);
  await waitFor(() => expect(rowsOf(requiresYou())).toHaveLength(13));
  expect(toggle.textContent).toBe('Show fewer');
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(document.activeElement).toBe(toggle);
  await user.keyboard('{Enter}');
  await waitFor(() => expect(rowsOf(requiresYou())).toHaveLength(10));
  expect(document.activeElement).toBe(toggle);
  expect(toggle.textContent).toBe('Show all (13)');
  // No toggle on a card of at most 10 rows.
  expect(within(waitingCard()).queryByRole('button', { name: /^Show / })).toBeNull();
});

it('applies the filters before the limit (D61-4, D61-7)', async () => {
  const user = userEvent.setup();
  const rows = [...MORGAN_TODAY.requiresYou!, ...pending(11)];
  stubApi(api({ [`${TODAY}?view=approver`]: { status: 200, body: { ...MORGAN_TODAY, requiresYou: rows } } }));
  renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 13 things require you' });
  await choose(user, filterOf(requiresYou(), 'Type'), 'task (12)');
  await waitFor(() => expect(within(requiresYou()).getByRole('button', { name: 'Show all (12)' })).toBeTruthy());
  expect(rowsOf(requiresYou())).toHaveLength(10);
  expect(idsOf(requiresYou())).not.toContain('bug-001-crash-on-save');
  await choose(user, filterOf(requiresYou(), 'Type'), 'bug (1)');
  await waitFor(() => expect(idsOf(requiresYou())).toEqual(['bug-001-crash-on-save']));
  expect(within(requiresYou()).queryByRole('button', { name: /^Show / })).toBeNull();
});

it('filters and limits a held gate’s row like the others (AC-3, D61-10)', async () => {
  const user = userEvent.setup();
  const held = (n: number): TodayRow =>
    waiting(`rel-${n}-held`, 'releasing', {
      tone: 'human',
      actor: { kind: 'role', role: 'approver', members: ['Morgan'] },
      approveHeld: { condition: 'never', reason: { code: 'held-by-config' } },
    });
  const rows = [...MORGAN_TODAY.waitingOnOthers, ...Array.from({ length: 9 }, (_, i) => held(i + 1))];
  stubApi(api({ [`${TODAY}?view=approver`]: { status: 200, body: { ...MORGAN_TODAY, waitingOnOthers: rows } } }));
  renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 2 things require you' });
  expect(rowsOf(waitingCard())).toHaveLength(10);
  expect(within(waitingCard()).getByRole('button', { name: 'Show all (12)' })).toBeTruthy();
  await choose(user, filterOf(waitingCard(), 'State'), 'releasing (9)');
  await waitFor(() => expect(rowsOf(waitingCard())).toHaveLength(9));
  expect(rowsOf(waitingCard()).map((li) => li.querySelector('.today-who')?.textContent)).toEqual(
    Array.from({ length: 9 }, () => 'Approved outside the console (ui.yaml)'),
  );
});

it('shows when each element entered its state, the full time as its description (T-02.5, D61-8)', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 2 things require you' });
  const medium = new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(SINCE));
  const full = new Intl.DateTimeFormat('en', { dateStyle: 'full', timeStyle: 'long' }).format(new Date(SINCE));
  const time = rowsOf(requiresYou())[0]!.querySelector<HTMLElement>('time.today-since')!;
  expect(time.textContent).toBe(`since ${medium}`);
  expect(time.getAttribute('datetime')).toBe(SINCE);
  const described = document.getElementById(time.getAttribute('aria-describedby') ?? '');
  expect(described?.textContent).toBe(full);
  expect(described?.hidden).toBe(true);
  // The reason stays as in v0.2 (T-02.1).
  expect(rowsOf(requiresYou())[0]!.querySelector('.today-reason')?.textContent).toMatch(/^pending for /);
  // Waiting on others too; a row without `since` shows no date (AC-3).
  const [withSince, withoutSince] = rowsOf(waitingCard());
  expect(withSince!.querySelector('time.today-since')?.textContent).toBe(`since ${medium}`);
  expect(withoutSince!.querySelector('time.today-since')).toBeNull();
});

it('names each row by the short id the API serves, else its full id (T-02.7, D61-9)', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 2 things require you' });
  expect(rowsOf(requiresYou()).map((li) => li.querySelector('.today-id')?.textContent)).toEqual([
    'task-001',
    'bug-001',
  ]);
  expect(rowsOf(waitingCard()).map((li) => li.querySelector('.today-id')?.textContent)).toEqual([
    'task-002',
    'task-004',
    'minor-v0.1',
  ]);
  // The action keeps the full id in its name (Q4 (a)).
  expect(within(requiresYou()).getByRole('button', { name: 'Approve task-001-login-form' })).toBeTruthy();
});

it('resets the filters when the role view changes, to a view already read too (D61-6, review F-2)', async () => {
  const user = userEvent.setup();
  const fake = api({
    [`${TODAY}?view=tech-lead`]: { status: 200, body: { ...MORGAN_TODAY, view: 'tech-lead' } },
  });
  stubApi(fake);
  const { queryClient } = renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 2 things require you' });
  // The other view is read already: the switch shows it at once, with no "Reading Today…" between
  // the two (the cards would otherwise be remounted by the loading state, whatever their key).
  await queryClient.prefetchQuery(todayQuery(PID, 'tech-lead'));
  await choose(user, filterOf(requiresYou(), 'Type'), 'bug (1)');
  await waitFor(() => expect(idsOf(requiresYou())).toEqual(['bug-001-crash-on-save']));
  fake[HEADER] = { status: 200, body: morgan('tech-lead') };
  await act(() => queryClient.invalidateQueries({ queryKey: queryKeys.project(PID) }));
  await screen.findByText('Role view: tech-lead');
  await waitFor(() => expect(idsOf(requiresYou())).toEqual(['task-001-login-form', 'bug-001-crash-on-save']));
  expect(filterOf(requiresYou(), 'Type').textContent).toBe('All (2)');
  expect(screen.queryByText('Reading Today…')).toBeNull();
});

it('does not bring back a chosen value that fell back to All (D61-6, review F-1)', async () => {
  const user = userEvent.setup();
  const fake = api();
  stubApi(fake);
  const { queryClient } = renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 2 things require you' });
  await choose(user, filterOf(requiresYou(), 'Type'), 'bug (1)');
  await waitFor(() => expect(idsOf(requiresYou())).toEqual(['bug-001-crash-on-save']));
  // The bug leaves the card: the filter is All again.
  fake[`${TODAY}?view=approver`] = {
    status: 200,
    body: { ...MORGAN_TODAY, requiresYou: [MORGAN_TODAY.requiresYou![0]!, ...pending(1)] },
  };
  await act(() => queryClient.invalidateQueries({ queryKey: queryKeys.project(PID) }));
  await waitFor(() => expect(idsOf(requiresYou())).toEqual(['task-001-login-form', 'task-101-more']));
  expect(filterOf(requiresYou(), 'Type').textContent).toBe('All (2)');
  // A bug comes back: the card stays on All, it is not filtered again by itself.
  fake[`${TODAY}?view=approver`] = { status: 200, body: MORGAN_TODAY };
  await act(() => queryClient.invalidateQueries({ queryKey: queryKeys.project(PID) }));
  await waitFor(() => expect(filterOf(requiresYou(), 'Type').textContent).toBe('All (2)'));
  await waitFor(() => expect(idsOf(requiresYou())).toEqual(['task-001-login-form', 'bug-001-crash-on-save']));
});

it('moves the focus to the card’s heading when a refetch removes the focused toggle (review F-5)', async () => {
  const user = userEvent.setup();
  const many = {
    ...MORGAN_TODAY,
    waitingOnOthers: [...MORGAN_TODAY.waitingOnOthers, ...pending(9).map(({ action: _, ...row }) => row)],
  };
  const fake = api({ [`${TODAY}?view=approver`]: { status: 200, body: many } });
  stubApi(fake);
  const { queryClient } = renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 2 things require you' });
  const toggle = within(waitingCard()).getByRole('button', { name: 'Show all (12)' });
  await user.click(toggle);
  expect(document.activeElement).toBe(toggle);
  fake[`${TODAY}?view=approver`] = { status: 200, body: MORGAN_TODAY };
  await act(() => queryClient.invalidateQueries({ queryKey: queryKeys.project(PID) }));
  await waitFor(() => expect(rowsOf(waitingCard())).toHaveLength(3));
  await waitFor(() =>
    expect(document.activeElement).toBe(within(waitingCard()).getByRole('heading', { name: 'Waiting on others' })),
  );
});

it('describes a row’s link by the full time it entered its state (review F-3)', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 2 things require you' });
  const full = new Intl.DateTimeFormat('en', { dateStyle: 'full', timeStyle: 'long' }).format(new Date(SINCE));
  const [withSince, withoutSince] = rowsOf(waitingCard());
  expect(computeAccessibleDescription(within(withSince!).getByRole('link'))).toBe(full);
  expect(computeAccessibleDescription(within(withoutSince!).getByRole('link'))).toBe('');
  const title = within(rowsOf(requiresYou())[0]!).getByRole('link', { name: 'Title of task-001-login-form' });
  expect(computeAccessibleDescription(title)).toBe(full);
});
