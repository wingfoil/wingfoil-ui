// @vitest-environment jsdom
// task-080 — Recent activity on Today (US-T-08; ux-reference §4.1 item 6 and v0.3; spec-012 §6;
// D80-1 … D80-8) on the whole application with a stubbed API: the last 5 Memory events of
// `GET /events/memory?limit=5` in the answer's order, one row each — the element id (a link to its
// side panel), "from → to" or the operation's word, the name by the bell's rule, the age with the
// full time as the link's description —, its own loading, error and empty states, shown whatever
// Today's own read (Q2 (a)), the last card of Today, a silent refresh on a repository change.
import type { MemoryEventEntry, MemoryEventsPage, ProjectHeader, Today } from '@wingfoil-ui/contracts';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { memoryEventsQuery } from '../../../web/src/api/queries.js';
import { queryKeys } from '../../../web/src/api/query-keys.js';
import { resetSession } from '../../../web/src/session/session.js';
import { header } from '../project/header-data.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';

const PID = 'p_a';
const HEADER = `/api/p/${PID}`;
const TODAY = `/api/p/${PID}/today?view=approver`;
const EVENTS = `/api/p/${PID}/events/memory?limit=5`;
const HOURS_2 = new Date(Date.now() - 2 * 3_600_000 - 60_000).toISOString();
const DAYS_3 = new Date(Date.now() - 3 * 86_400_000 - 600_000).toISOString();
const MINUTES_5 = new Date(Date.now() - 5 * 60_000 - 10_000).toISOString();

function morgan(): ProjectHeader {
  return header({
    identity: { kind: 'member', email: 'morgan@example.test', name: 'Morgan', roles: ['approver', 'tech-lead'] },
    roleViews: ['approver', 'tech-lead'],
    roleView: 'approver',
  });
}

const MORGAN_TODAY: Today = {
  view: 'approver',
  requiresYou: [],
  waitingOnOthers: [
    {
      element: { id: 'task-002-reset', type: 'task', title: 'Reset', status: 'draft', localChanges: false },
      descriptor: {
        id: 'task-002-reset',
        type: 'task',
        status: 'draft',
        kind: 'gate',
        tone: 'neutral',
        verbs: [],
        actor: { kind: 'engine' },
      },
    },
  ],
};

function event(over: Partial<MemoryEventEntry>): MemoryEventEntry {
  return {
    sha: 'a'.repeat(40),
    timestamp: HOURS_2,
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

// Not in time order: the card keeps the answer's order (spec-004 §3, D80-1).
const PAGE: MemoryEventsPage = {
  events: [
    event({ sha: '5'.repeat(40), timestamp: DAYS_3 }),
    event({
      sha: '4'.repeat(40),
      timestamp: MINUTES_5,
      operation: 'approve',
      id: 'task-003-logout',
      from: 'pending',
      to: 'approved',
      author: 'Test Harness <morgan@example.test>',
      approver: 'Morgan <morgan@example.test> (approver)',
    }),
    event({ sha: '3'.repeat(40), operation: 'add', id: 'task-004-timeout', from: null, to: null }),
    event({ sha: '2'.repeat(40), operation: 'amend', id: 'adr-001-local', from: null, to: null, author: 'Alex <a@x>' }),
    event({ sha: '1'.repeat(40), operation: 'park', id: 'bug-001-crash', from: null, to: null, author: 'Sam <s@x>' }),
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
    [TODAY]: { status: 200, body: MORGAN_TODAY },
    [EVENTS]: { status: 200, body: PAGE },
    ...over,
  };
}

const card = () => screen.getByRole('region', { name: 'Recent activity' });
const rowsOf = (region: HTMLElement) => [...region.querySelectorAll<HTMLElement>('li')];
/** The row's text without its time: "<id> <what> · <name>". */
const lineOf = (li: HTMLElement) => li.querySelector('.today-activity-main')?.textContent;
/** The accessible description `aria-describedby` gives `el` (the texts of its ids, in order). */
const descriptionOf = (el: HTMLElement): string =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter((id) => id !== '')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');
const failed = { status: 500, body: { error: { code: 'internal', message: 'x' } } };

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

it('lists the events in the answer’s order: transition, created or the operation, and the name (T-08.1, D80-4)', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/today`);
  await waitFor(() => expect(rowsOf(card())).toHaveLength(5));
  expect(rowsOf(card()).map(lineOf)).toEqual([
    'task-001-login draft → pending · Jordan',
    // The approver of an approve, not the commit's author (the bell's rule).
    'task-003-logout pending → approved · Morgan',
    'task-004-timeout created · Jordan',
    'adr-001-local amended · Alex',
    'bug-001-crash parked · Sam',
  ]);
  expect(rowsOf(card()).map((li) => li.dataset['sha'])).toEqual(PAGE.events.map((e) => e.sha));
  // D80-4, D65-3: no `data-eid` (Today's opener restore), no class `today-card`.
  expect(card().querySelector('[data-eid]')).toBeNull();
  expect(card().classList.contains('today-card')).toBe(false);
  expect(card().classList.contains('today-activity')).toBe(true);
  expect(within(card()).getByRole('heading', { level: 2, name: 'Recent activity' })).toBeTruthy();
});

it('links each id to its side panel over Today, and shows no Timeline link (D80-4, D80-5)', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/today`);
  await waitFor(() => expect(rowsOf(card())).toHaveLength(5));
  const links = within(card()).getAllByRole('link');
  expect(links.map((a) => a.textContent)).toEqual(PAGE.events.map((e) => e.id));
  expect(links[0]!.getAttribute('href')).toBe(`/p/${PID}/today?panel=task-001-login`);
  expect(within(card()).queryByRole('link', { name: /timeline/i })).toBeNull();
});

it('shows the age of each event, its full time as the link’s description (D80-4)', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/today`);
  await waitFor(() => expect(rowsOf(card())).toHaveLength(5));
  const [first, second] = rowsOf(card());
  const time = first!.querySelector('time')!;
  expect(time.getAttribute('datetime')).toBe(DAYS_3);
  expect(time.textContent).toBe('3 days ago');
  expect(second!.querySelector('time')!.textContent).toBe('5 minutes ago');
  const full = new Intl.DateTimeFormat('en', { dateStyle: 'full', timeStyle: 'long' }).format(new Date(DAYS_3));
  expect(descriptionOf(within(first!).getByRole('link'))).toBe(full);
});

it('is the last card of Today, after Waiting on others (AC-2)', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/today`);
  await waitFor(() => expect(rowsOf(card())).toHaveLength(5));
  const sections = [...document.querySelectorAll<HTMLElement>('.today section')];
  expect(sections.at(-1)).toBe(card());
  expect(sections.at(-2)).toBe(screen.getByRole('region', { name: 'Waiting on others' }));
});

it('shows a loading status until the events are read', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/today`);
  expect(await screen.findByText('Reading recent activity…')).toBeTruthy();
  await waitFor(() => expect(rowsOf(card())).toHaveLength(5));
  expect(screen.queryByText('Reading recent activity…')).toBeNull();
});

it('shows a failed read as an error inside the card, the rest of Today shown (AC-2)', async () => {
  stubApi(api({ [EVENTS]: failed }));
  renderApp(`/p/${PID}/today`);
  const alert = await within(await screen.findByRole('region', { name: 'Recent activity' })).findByRole('alert');
  expect(alert).toBeTruthy();
  expect(screen.queryByText('No Memory event yet')).toBeNull();
  expect(screen.getByRole('region', { name: 'Waiting on others' })).toBeTruthy();
  expect(screen.getByRole('heading', { level: 1, name: 'Morgan, nothing requires you' })).toBeTruthy();
});

it('says that there is no Memory event yet', async () => {
  stubApi(api({ [EVENTS]: { status: 200, body: { events: [], more: false } } }));
  renderApp(`/p/${PID}/today`);
  expect(
    await within(await screen.findByRole('region', { name: 'Recent activity' })).findByText('No Memory event yet'),
  ).toBeTruthy();
});

it('is shown whatever Today’s own read: a refused Today (Q2 (a))', async () => {
  stubApi(api({ [TODAY]: failed }));
  renderApp(`/p/${PID}/today`);
  await waitFor(() => expect(rowsOf(card())).toHaveLength(5));
  expect(document.querySelectorAll('.today [role="alert"]')).toHaveLength(1);
});

it('reads the last 5 events with its own key, beside the bell’s 10 (D80-1)', async () => {
  const fetch = stubApi(api());
  const { queryClient } = renderApp(`/p/${PID}/today`);
  await waitFor(() => expect(rowsOf(card())).toHaveLength(5));
  expect(fetch.mock.calls.map((c) => String(c[0]))).toContain(EVENTS);
  expect(queryClient.getQueryData(memoryEventsQuery(PID, 5).queryKey)).toEqual(PAGE);
  expect(memoryEventsQuery(PID, 5).queryKey).toEqual(queryKeys.project(PID, 'events', 'memory', { limit: 5 }));
});

it('re-reads on a repository change without announcing it (AC-2, D80-6)', async () => {
  const fake = api();
  stubApi(fake);
  const { queryClient } = renderApp(`/p/${PID}/today`);
  await waitFor(() => expect(rowsOf(card())).toHaveLength(5));
  const approved = event({
    sha: '6'.repeat(40),
    operation: 'approve',
    from: 'pending',
    to: 'approved',
    approver: 'Morgan <morgan@example.test> (approver)',
    timestamp: new Date().toISOString(),
  });
  fake[EVENTS] = { status: 200, body: { events: [approved, ...PAGE.events.slice(0, 4)], more: true } };
  await act(() => queryClient.invalidateQueries({ queryKey: queryKeys.project(PID) }));
  await waitFor(() => expect(lineOf(rowsOf(card())[0]!)).toBe('task-001-login pending → approved · Morgan'));
  expect(rowsOf(card())).toHaveLength(5);
  expect(screen.getByRole('status', { name: 'Today updates' }).textContent).toBe('');
  expect(card().querySelector('[role="status"], [aria-live]')).toBeNull();
});
