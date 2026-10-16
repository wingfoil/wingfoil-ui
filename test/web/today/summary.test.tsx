// @vitest-environment jsdom
// task-042 — the all-roles summary on Today (US-S-23; spec-003 §5 `summary`; D42-5…D42-7): one
// line per role as the server sends it, at most 3 items and "N more", the current view marked,
// switching the role view from a line or from "N more" with the focus moved to Requires you, a
// refused switch, and no card without a summary.
import type { ProjectHeader, Today, TodayActionRow } from '@wingfoil-ui/contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { resetSession } from '../../../web/src/session/session.js';
import { header } from '../project/header-data.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';

const PID = 'p_a';
const HEADER = `/api/p/${PID}`;
const TODAY = `/api/p/${PID}/today`;
const ROLES = ['approver', 'developer', 'tech-lead'];

function alex(roleView: string): ProjectHeader {
  return header({
    identity: { kind: 'member', email: 'alex@example.test', name: 'Alex', roles: ROLES },
    roleViews: ROLES,
    roleView,
  });
}

function row(id: string): TodayActionRow {
  return {
    element: { id, type: 'task', title: `Title of ${id}`, status: 'pending', localChanges: false },
    descriptor: {
      id,
      type: 'task',
      status: 'pending',
      kind: 'gate',
      tone: 'human',
      verbs: [],
      actor: { kind: 'none' },
    },
    action: 'approve',
  };
}

const APPROVER_ROWS = ['task-001', 'task-002', 'task-003', 'task-004', 'task-005'].map(row);
const SUMMARY: NonNullable<Today['summary']> = [
  { role: 'approver', count: 5, items: APPROVER_ROWS.slice(0, 3), more: 2 },
  { role: 'developer', count: 0, items: [], more: 0 },
  { role: 'tech-lead', count: 1, items: [row('note-001')], more: 0 },
];

function today(view: string): Today {
  return {
    view,
    requiresYou: view === 'approver' ? APPROVER_ROWS : [],
    waitingOnOthers: [],
    summary: SUMMARY,
  };
}

function api(over: FakeApi = {}): FakeApi {
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'demo', path: '/x', remote: null, availability: 'available' }] },
    },
    [HEADER]: { status: 200, body: alex('developer') },
    [`${HEADER}/role-view`]: { status: 204 },
    [`${TODAY}?view=developer`]: { status: 200, body: today('developer') },
    [`${TODAY}?view=approver`]: { status: 200, body: today('approver') },
    ...over,
  };
}

const card = () => screen.findByRole('region', { name: 'Your roles' });
const lines = (region: HTMLElement) => Array.from(region.querySelectorAll<HTMLElement>('.today-summary-line'));

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

it('summarises each role in the order received, with its count and first items (S-23.1, S-23.4)', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/today`);
  const region = await card();
  const all = lines(region);
  expect(all.map((l) => l.querySelector('.today-summary-role')?.textContent)).toEqual([
    'approver · 5',
    'developer · 0',
    'tech-lead · 1',
  ]);
  const approver = all[0]!;
  const links = within(approver).getAllByRole('link');
  expect(links.map((l) => l.textContent)).toEqual(['Title of task-001', 'Title of task-002', 'Title of task-003']);
  expect(links[0]!.getAttribute('href')).toBe(`/p/${PID}/e/task-001`);
  expect(within(approver).getByRole('button', { name: '2 more for approver' }).textContent).toBe('2 more');
  // A role with nothing: only its count.
  expect(within(all[1]!).queryAllByRole('link')).toEqual([]);
  expect(within(all[2]!).queryByRole('button', { name: /more/ })).toBeNull();
});

it('places the summary between the greeting and Requires you (D42-5)', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/today`);
  const region = await card();
  const requires = screen.getByRole('region', { name: 'Requires you' });
  const greeting = screen.getByRole('heading', { level: 1 });
  expect(greeting.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(region.compareDocumentPosition(requires) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('marks the current role view, which is not a switch', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/today`);
  const current = lines(await card())[1]!;
  expect(current.getAttribute('aria-current')).toBe('true');
  expect(within(current).queryByRole('button')).toBeNull();
  expect(within(current).getByText('current view')).toBeTruthy();
});

it('switches the role view from a line and moves the focus to Requires you (S-23.2, D42-6)', async () => {
  const fake = api();
  const fetch = stubApi(fake);
  const user = userEvent.setup();
  renderApp(`/p/${PID}/today`);
  const region = await card();
  fake[HEADER] = { status: 200, body: alex('approver') };
  await user.click(within(region).getByRole('button', { name: 'approver · 5' }));
  const put = fetch.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'PUT');
  expect(String(put?.[0])).toBe(`${HEADER}/role-view`);
  expect(JSON.parse(String((put?.[1] as RequestInit).body))).toEqual({ role: 'approver' });
  await screen.findByText('Role view: approver');
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Requires you' })),
  );
  expect(within(screen.getByRole('region', { name: 'Requires you' })).getAllByRole('listitem')).toHaveLength(5);
});

it('switches the role view from "N more" (D42-7)', async () => {
  const fake = api();
  const fetch = stubApi(fake);
  const user = userEvent.setup();
  renderApp(`/p/${PID}/today`);
  const region = await card();
  fake[HEADER] = { status: 200, body: alex('approver') };
  await user.click(within(region).getByRole('button', { name: '2 more for approver' }));
  const put = fetch.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'PUT');
  expect(JSON.parse(String((put?.[1] as RequestInit).body))).toEqual({ role: 'approver' });
  await screen.findByText('Role view: approver');
});

it('shows a refused switch on Today, outside the summary card (review R2)', async () => {
  stubApi(
    api({ [`${HEADER}/role-view`]: { status: 400, body: { error: { code: 'invalid-request', message: 'x' } } } }),
  );
  const user = userEvent.setup();
  renderApp(`/p/${PID}/today`);
  const region = await card();
  await user.click(within(region).getByRole('button', { name: 'tech-lead · 1' }));
  const alert = await screen.findByRole('alert');
  expect(alert.closest('.today')).not.toBeNull();
  expect(alert.closest('.today-summary')).toBeNull();
  expect(screen.getByText('Role view: developer')).toBeTruthy();
});

it('keeps a refusal shown when the header read after it changes the role view (review R2)', async () => {
  const fake = api({
    [`${HEADER}/role-view`]: {
      status: 403,
      body: { error: { code: 'not-in-team', message: 'x', detail: { email: 'alex@example.test' } } },
    },
    [TODAY]: { status: 200, body: { view: null, requiresYou: null, waitingOnOthers: [] } },
  });
  stubApi(fake);
  const user = userEvent.setup();
  renderApp(`/p/${PID}/today`);
  const region = await card();
  // The user left the team meanwhile: the header read after the refusal has no role view.
  fake[HEADER] = {
    status: 200,
    body: header({
      identity: { kind: 'not-in-team', email: 'alex@example.test' },
      roleViews: [],
      roleView: null,
      readOnly: [{ code: 'not-in-team' }],
    }),
  };
  await user.click(within(region).getByRole('button', { name: 'approver · 5' }));
  await screen.findByText(/You are not in this project's team/);
  expect(screen.queryByRole('region', { name: 'Your roles' })).toBeNull();
  const alert = await screen.findByRole('alert');
  expect(alert.closest('.today')).not.toBeNull();
});

it('forgets the focus request of a refused switch (review R1)', async () => {
  const fake = api({
    [`${HEADER}/role-view`]: { status: 400, body: { error: { code: 'invalid-request', message: 'x' } } },
  });
  stubApi(fake);
  const user = userEvent.setup();
  renderApp(`/p/${PID}/today`);
  const region = await card();
  await user.click(within(region).getByRole('button', { name: 'approver · 5' }));
  await screen.findByRole('alert');
  // Later, the role view becomes approver by the header's selector: no jump of the focus.
  fake[`${HEADER}/role-view`] = { status: 204 };
  fake[HEADER] = { status: 200, body: alex('approver') };
  await user.click(screen.getByRole('button', { name: /Role view/ }));
  await user.click(await screen.findByRole('option', { name: 'approver' }));
  await screen.findByText('Role view: approver');
  await screen.findByRole('region', { name: 'Requires you' });
  expect(document.activeElement).not.toBe(screen.getByRole('heading', { level: 2, name: 'Requires you' }));
  // The refusal does not outlive the header read of a later successful switch (review round 2, R2-1).
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
});

it('describes what a role line does (review R7)', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/today`);
  const region = await card();
  // The accessible description: the text of the element its `aria-describedby` names.
  const description = (el: HTMLElement) =>
    (el.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .map((id) => (id ? document.getElementById(id)?.textContent : undefined))
      .join(' ')
      .trim();
  expect(description(within(region).getByRole('button', { name: 'approver · 5' }))).toBe('Switches the role view');
  expect(description(within(region).getByRole('button', { name: '2 more for approver' }))).toBe(
    'Switches the role view',
  );
});

it('shows no summary when the server sends none (S-23.3)', async () => {
  stubApi(
    api({
      [HEADER]: { status: 200, body: header() },
      [`${TODAY}?view=developer`]: { status: 200, body: { view: 'developer', requiresYou: [], waitingOnOthers: [] } },
    }),
  );
  renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Jordan, nothing requires you' });
  expect(screen.queryByRole('region', { name: 'Your roles' })).toBeNull();
});
