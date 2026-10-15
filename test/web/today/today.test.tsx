// @vitest-environment jsdom
// task-036 — Today (US-T-01…US-T-06, US-T-11; ux-reference §4.1; D36-1…D36-11) on the whole
// application with a stubbed API: the landing route, the greeting and the role view line, Requires
// you rows with one action each opening the element panel, Waiting on others with who must act,
// the empty state, a refusal never shown as empty, unidentified users (How to join), the role view
// in the query key, the refresh and its announcement.
import type { ActionDescriptor, ProjectHeader, Today, TodayActionRow, TodayRow } from '@wingfoil-ui/contracts';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { todayQuery } from '../../../web/src/api/queries.js';
import { queryKeys } from '../../../web/src/api/query-keys.js';
import { resetSession } from '../../../web/src/session/session.js';
import { header, riley } from '../project/header-data.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';

const PID = 'p_a';
const HEADER = `/api/p/${PID}`;
const TODAY = `/api/p/${PID}/today`;
const DAYS_3 = new Date(Date.now() - 3 * 86_400_000 - 600_000).toISOString();

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

function action(
  id: string,
  status: string,
  act: TodayActionRow['action'],
  over: Partial<ActionDescriptor> = {},
): TodayActionRow {
  return {
    element: { id, type: id.split('-')[0]!, title: `Title of ${id}`, status, localChanges: false },
    descriptor: descriptor(id, { status, ...over }),
    action: act,
  };
}

function waiting(id: string, status: string, actor: ActionDescriptor['actor']): TodayRow {
  return {
    element: { id, type: id.split('-')[0]!, title: `Title of ${id}`, status, localChanges: false },
    descriptor: descriptor(id, { status, actor, tone: 'neutral' }),
  };
}

const MORGAN_TODAY: Today = {
  view: 'approver',
  requiresYou: [
    action('task-001-login', 'pending', 'approve', { since: DAYS_3 }),
    action('bug-001-crash', 'triage', 'approve', { since: DAYS_3 }),
  ],
  waitingOnOthers: [
    waiting('task-002-reset', 'draft', {
      kind: 'member',
      member: { name: 'Jordan', email: 'jordan@example.test' },
      basis: 'submitter',
    }),
    waiting('task-004-timeout', 'draft', {
      kind: 'member',
      member: { name: 'Jordan', email: 'jordan@example.test' },
      basis: 'creator',
    }),
    waiting('task-005-other', 'doing', { kind: 'member', member: { name: 'Sam', email: 'sam@example.test' } }),
    waiting('rel-001-minor', 'planning', { kind: 'engine' }),
    waiting('adr-001-gate', 'proposed', { kind: 'role', role: 'architect', members: ['Alex', 'Casey'] }),
    waiting('adr-002-nobody', 'proposed', { kind: 'role', role: 'qa', members: [] }),
  ],
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
    ...over,
  };
}

function paths(fetch: ReturnType<typeof stubApi>): string[] {
  return fetch.mock.calls.map((c) => String(c[0])).filter((p) => p.startsWith('/api/p/'));
}

const requiresYou = () => screen.getByRole('region', { name: 'Requires you' });
const waitingCard = () => screen.getByRole('region', { name: 'Waiting on others' });
const rowsOf = (region: HTMLElement) => within(region).queryAllByRole('listitem');

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

it('opens a project on Today and shows the sidebar entry first and current (US-T-01, D36-1, D36-2)', async () => {
  stubApi(api());
  const { router } = renderApp(`/p/${PID}`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 2 things require you' });
  expect(router.state.location.pathname).toBe(`/p/${PID}/today`);
  const nav = screen.getByRole('navigation', { name: 'Project views' });
  const links = within(nav).getAllByRole('link');
  expect(links[0]?.textContent).toBe('Today');
  expect(links[0]?.getAttribute('aria-current')).toBe('page');
  // The heading-less first group: Today's list has no label, the others keep theirs.
  expect(within(nav).getAllByRole('list')[0]?.hasAttribute('aria-labelledby')).toBe(false);
  await waitFor(() => expect(document.title).toBe('demo · Today — WingFoil UI'));
});

it('greets with the count and the role view, and reads Today for that view only (T-01.1, D36-5)', async () => {
  const fetch = stubApi(api());
  const { queryClient } = renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 2 things require you' });
  expect(screen.getByText('Role view: approver')).toBeTruthy();
  expect(new Set(paths(fetch))).toEqual(new Set([HEADER, `${TODAY}?view=approver`]));
  // One cache entry per role view, shared with the bell (D31-6).
  expect(todayQuery(PID, 'approver').queryKey).toEqual(queryKeys.project(PID, 'today', { view: 'approver' }));
  expect(queryClient.getQueryData(todayQuery(PID, 'approver').queryKey)).toEqual(MORGAN_TODAY);
});

it('lists Requires you in the API order with type, title, reason, state and one action (T-02.1, T-02.2)', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 2 things require you' });
  const rows = rowsOf(requiresYou());
  expect(rows).toHaveLength(2);
  const first = rows[0]!;
  expect(within(first).getByText('task').className).toContain('type-tag');
  expect(within(first).getByRole('link', { name: 'Title of task-001-login' }).getAttribute('href')).toBe(
    `/p/${PID}/e/task-001-login`,
  );
  expect(first.querySelector('.today-reason')?.textContent).toBe('pending for 3 days');
  expect(within(first).getByText('pending', { selector: '.state-pill' }).className).toContain('tone-human');
  for (const row of rows) expect(within(row).getAllByRole('button')).toHaveLength(1);
  const button = within(first).getByRole('button');
  expect(button.textContent).toBe('Approve');
  expect(button.getAttribute('aria-label')).toBe('Approve task-001-login');
  expect(within(rows[1]!).getByRole('button', { name: 'Approve bug-001-crash' })).toBeTruthy();
});

it('labels each action and gives the reasons of rework and undeclared states (T-03.1, T-04.1, T-05.1, D36-7)', async () => {
  const body: Today = {
    view: 'approver',
    requiresYou: [
      action('task-002-reset', 'draft', 'rework', {
        rejection: { by: 'Morgan', reason: 'Missing acceptance criteria', at: DAYS_3 },
        tone: 'neutral',
      }),
      action('task-003-plain', 'draft', 'rework', { rejection: { by: 'Alex', reason: null, at: DAYS_3 } }),
      action('task-004-timeout', 'draft', 'submit'),
      action('task-006-review', 'in-review', 'review', { since: DAYS_3 }),
      action('note-002-retro', 'on-hold', 'resolve', { since: DAYS_3 }),
    ],
    waitingOnOthers: [],
  };
  stubApi(api({ [`${TODAY}?view=approver`]: { status: 200, body } }));
  renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 5 things require you' });
  const rows = rowsOf(requiresYou());
  const reason = (i: number) => rows[i]!.querySelector('.today-reason');
  expect(reason(0)?.textContent).toBe('Rejected by Morgan: Missing acceptance criteria');
  expect(reason(0)?.className).toContain('today-reason-rejection');
  expect(reason(1)?.textContent).toBe('Rejected by Alex');
  expect(reason(2)?.textContent).toBe('draft');
  expect(reason(3)?.textContent).toBe('in-review for 3 days');
  expect(reason(4)?.textContent).toBe('Action required — state on-hold is not declared for note');
  expect(rows.map((r) => within(r).getByRole('button').textContent)).toEqual([
    'Submit',
    'Submit',
    'Submit',
    'Review',
    'Open',
  ]);
});

it('opens the element panel from the action, with no write (D36-3)', async () => {
  const fetch = stubApi(api());
  const user = userEvent.setup();
  const { router } = renderApp(`/p/${PID}/today`);
  const button = await screen.findByRole('button', { name: 'Approve task-001-login' });
  button.focus();
  await user.keyboard('{Enter}');
  await waitFor(() => expect(router.state.location.pathname).toBe(`/p/${PID}/e/task-001-login`));
  // task-037 (G-04.3, D37-1): a gate opens with its reason focused.
  expect(router.state.location.state.gateFocus).toBe(true);
  expect(
    fetch.mock.calls.some(
      (c) => (c[1] as RequestInit | undefined)?.method === 'POST' && String(c[0]).startsWith('/api/p/'),
    ),
  ).toBe(false);
});

it('asks no reason focus for an action that is not a gate (task-037, D37-1)', async () => {
  const body: Today = {
    view: 'approver',
    requiresYou: [action('task-004-timeout', 'draft', 'submit')],
    waitingOnOthers: [],
  };
  stubApi(api({ [`${TODAY}?view=approver`]: { status: 200, body } }));
  const { router } = renderApp(`/p/${PID}/today`);
  await userEvent.click(await screen.findByRole('button', { name: 'Submit task-004-timeout' }));
  await waitFor(() => expect(router.state.location.pathname).toBe(`/p/${PID}/e/task-004-timeout`));
  expect(router.state.location.state.gateFocus).toBe(false);
});

it('lists Waiting on others with who must act (T-11.1, T-11.2, T-06.1, D36-6)', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 2 things require you' });
  const rows = rowsOf(waitingCard());
  expect(rows.map((r) => r.querySelector('.today-who')?.textContent)).toEqual([
    'Jordan (submitter) must act',
    'Jordan (creator) must act',
    'Sam must act',
    'Waiting for the workflow engine',
    'Reserved to architect — Alex, Casey',
    'Reserved to qa',
  ]);
  // The members are their own text (data for the catalogue check).
  expect(rows[4]!.querySelector('.today-members')?.textContent).toBe('Alex, Casey');
  expect(within(rows[0]!).getByRole('link').getAttribute('href')).toBe(`/p/${PID}/e/task-002-reset`);
  expect(within(waitingCard()).queryAllByRole('button')).toEqual([]);
});

it('says that nothing requires the user, and hides an empty Waiting on others (D36-4)', async () => {
  stubApi(
    api({
      [`${TODAY}?view=approver`]: { status: 200, body: { view: 'approver', requiresYou: [], waitingOnOthers: [] } },
    }),
  );
  renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, nothing requires you' });
  expect(within(requiresYou()).getByText('Nothing requires you')).toBeTruthy();
  expect(rowsOf(requiresYou())).toEqual([]);
  expect(screen.queryByRole('region', { name: 'Waiting on others' })).toBeNull();
});

it('shows a refused Today as an error, never as "Nothing requires you" (D31-3)', async () => {
  stubApi(
    api({
      [`${TODAY}?view=approver`]: { status: 500, body: { error: { code: 'internal', message: 'x' } } },
    }),
  );
  renderApp(`/p/${PID}/today`);
  const alert = await screen.findByRole('alert');
  expect(alert.closest('.today')).not.toBeNull();
  expect(screen.queryByText('Nothing requires you')).toBeNull();
  expect(screen.queryByRole('region', { name: 'Requires you' })).toBeNull();
  expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeTruthy();
});

it('shows the header error when the project header cannot be read', async () => {
  const fetch = stubApi(api({ [HEADER]: { status: 500, body: { error: { code: 'internal', message: 'x' } } } }));
  renderApp(`/p/${PID}/today`);
  await waitFor(() => expect(document.querySelectorAll('.today [role="alert"]')).toHaveLength(1));
  expect(paths(fetch).some((p) => p.startsWith(TODAY))).toBe(false);
});

it('shows a loading status until Today is read', async () => {
  stubApi(api({ [`${TODAY}?view=approver`]: { status: 200, body: MORGAN_TODAY } }));
  renderApp(`/p/${PID}/today`);
  expect(await screen.findByText('Reading Today…')).toBeTruthy();
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 2 things require you' });
  expect(screen.queryByText('Reading Today…')).toBeNull();
});

it('opens Today read-only for a user not in the team, with How to join (T-01.2, D36-8)', async () => {
  const fetch = stubApi(
    api({
      [HEADER]: { status: 200, body: riley() },
      [TODAY]: { status: 200, body: { view: null, requiresYou: null, waitingOnOthers: MORGAN_TODAY.waitingOnOthers } },
    }),
  );
  const user = userEvent.setup();
  renderApp(`/p/${PID}/today`);
  const sentence = await screen.findByText(/You are not in this project's team/);
  expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Requires you' })).toBeNull();
  expect(rowsOf(waitingCard())).toHaveLength(6);
  expect(screen.queryByText(/^Role view:/)).toBeNull();
  // No `?view=` without a role view (D31-5).
  expect(paths(fetch).filter((p) => p.startsWith(TODAY))).toEqual([TODAY]);
  const join = within(sentence.closest('.today-identity') as HTMLElement).getByRole('button', { name: 'How to join' });
  await user.click(join);
  expect(await screen.findByRole('dialog', { name: 'How to join this project' })).toBeTruthy();
});

const UNIDENTIFIED: [string, ProjectHeader['identity']][] = [
  ['No identity', { kind: 'no-identity' }],
  ['Ambiguous', { kind: 'ambiguous', email: 'twin@example.test', members: ['Morgan', 'Alex'] }],
];

for (const [label, identity] of UNIDENTIFIED) {
  it(`points other unidentified users to the read-only notice, without How to join (D36-8): ${label}`, async () => {
    stubApi(
      api({
        [HEADER]: { status: 200, body: header({ identity, roleViews: [], roleView: null }) },
        [TODAY]: { status: 200, body: { view: null, requiresYou: null, waitingOnOthers: [] } },
      }),
    );
    renderApp(`/p/${PID}/today`);
    const note = await screen.findByText('Today cannot list what requires you: see the read-only notice above.');
    expect(within(note.closest('.today-identity') as HTMLElement).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Requires you' })).toBeNull();
  });
}

it('greets a member holding no role without a role view line', async () => {
  stubApi(
    api({
      [HEADER]: {
        status: 200,
        body: header({
          identity: { kind: 'member', email: 'x@example.test', name: 'Noa', roles: [] },
          roleViews: [],
          roleView: null,
        }),
      },
      [TODAY]: {
        status: 200,
        body: { view: null, requiresYou: [action('task-001-login', 'draft', 'submit')], waitingOnOthers: [] },
      },
    }),
  );
  renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Noa, 1 thing requires you' });
  expect(screen.queryByText(/^Role view:/)).toBeNull();
});

it('follows the role view: a new view reads its own Today (T-02.3)', async () => {
  const fake = api({
    [`${HEADER}/role-view`]: { status: 204 },
    [`${TODAY}?view=tech-lead`]: { status: 200, body: { view: 'tech-lead', requiresYou: [], waitingOnOthers: [] } },
  });
  const fetch = stubApi(fake);
  const user = userEvent.setup();
  renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 2 things require you' });
  // The server stores the view; the header read next carries it.
  fake[HEADER] = { status: 200, body: morgan('tech-lead') };
  await user.click(screen.getByRole('button', { name: /Role view/ }));
  await user.click(await screen.findByRole('option', { name: 'tech-lead' }));
  await screen.findByRole('heading', { level: 1, name: 'Morgan, nothing requires you' });
  expect(screen.getByText('Role view: tech-lead')).toBeTruthy();
  expect(paths(fetch)).toContain(`${TODAY}?view=tech-lead`);
  // The first read of another view is not an update (D36-11, review F1).
  expect(screen.getByRole('status', { name: 'Today updates' }).textContent).toBe('');
});

it('refreshes on a repository change and announces the new count (D36-11)', async () => {
  const fake = api();
  stubApi(fake);
  const { queryClient } = renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 2 things require you' });
  const region = screen.getByRole('status', { name: 'Today updates' });
  expect(region.textContent).toBe('');
  fake[`${TODAY}?view=approver`] = {
    status: 200,
    body: { ...MORGAN_TODAY, requiresYou: MORGAN_TODAY.requiresYou!.slice(1) },
  };
  // What the `repo` event does (api/events.ts): every query of the project is invalidated.
  await act(() => queryClient.invalidateQueries({ queryKey: queryKeys.project(PID) }));
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 1 thing requires you' });
  await waitFor(() => expect(region.textContent).toBe('Requires you updated: 1 item'));
  expect(rowsOf(requiresYou())).toHaveLength(1);
});

it('announces nothing when only Waiting on others changed (review F1)', async () => {
  const fake = api();
  stubApi(fake);
  const { queryClient } = renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 2 things require you' });
  // Requires you equal (a new body), Waiting on others one row shorter.
  fake[`${TODAY}?view=approver`] = {
    status: 200,
    body: JSON.parse(JSON.stringify({ ...MORGAN_TODAY, waitingOnOthers: MORGAN_TODAY.waitingOnOthers.slice(1) })),
  };
  await act(() => queryClient.invalidateQueries({ queryKey: queryKeys.project(PID) }));
  await waitFor(() => expect(rowsOf(waitingCard())).toHaveLength(5));
  expect(screen.getByRole('status', { name: 'Today updates' }).textContent).toBe('');
});

it('announces nothing when another project opens on Today (review F1)', async () => {
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
      [`/api/p/${OTHER}/today?view=approver`]: {
        status: 200,
        body: { ...MORGAN_TODAY, requiresYou: MORGAN_TODAY.requiresYou!.slice(1) },
      },
    }),
  );
  const { router } = renderApp(`/p/${PID}/today`);
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 2 things require you' });
  await act(() => router.navigate({ to: '/p/$pid/today', params: { pid: OTHER } }));
  await screen.findByRole('heading', { level: 1, name: 'Morgan, 1 thing requires you' });
  expect(screen.getByRole('status', { name: 'Today updates' }).textContent).toBe('');
});
