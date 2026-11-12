// @vitest-environment jsdom
// task-077 — the side panel in the address (spec-011 §2, §6; ux-reference §4.2 v0.3; D77-1 … D77-7):
// Today's rows and the bell's items open the element in a non-modal side panel over the current
// view, addressed by `?panel=<full id>`; opening pushes (only when no panel is open, Q2), closing
// goes back or removes the parameter, every other parameter is kept, `panel=` is ignored on the
// element page, a short value is replaced in place, a 409 lists `?panel=` candidates, hostile values
// answer *not found* and navigate nowhere (AC-4), and the focus returns to the opener (bug-018).
import type { ElementDetail, ElementRefusalBody, MemoryHistory, ProjectHeader, Today } from '@wingfoil-ui/contracts';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { onPanelClosed, trackPanel } from '../../../web/src/element/side-panel.js';
import { resetSession } from '../../../web/src/session/session.js';
import { header } from '../project/header-data.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';

const PID = 'p_a';
const API = `/api/p/${PID}/elements`;
const TODAY = `/api/p/${PID}/today?view=approver`;
const EID = 'task-001-login';
const OTHER = 'task-002-reset';

function morgan(): ProjectHeader {
  return header({
    identity: { kind: 'member', email: 'morgan@example.test', name: 'Morgan', roles: ['approver', 'tech-lead'] },
    roleViews: ['approver', 'tech-lead'],
    roleView: 'approver',
  });
}

function detail(id: string, title: string): ElementDetail {
  return {
    element: {
      path: `docs/${id}.md`,
      id,
      shortId: id.split('-').slice(0, 2).join('-'),
      title,
      type: 'task',
      status: 's1',
      tags: [],
      localChanges: false,
    },
    frontmatter: { id, type: 'task', title, status: 's1' },
    body: 'A body.\n',
    states: { sequence: ['s1', 's2'], gates: {} },
  };
}

function history(id: string): MemoryHistory {
  return { id, path: `docs/${id}.md`, entries: [] };
}

function row(id: string, title: string) {
  return {
    element: { id, type: 'task', title, status: 'pending', localChanges: false },
    descriptor: {
      id,
      type: 'task',
      status: 'pending',
      kind: 'gate' as const,
      tone: 'human' as const,
      verbs: [],
      actor: { kind: 'none' as const },
    },
  };
}

const TODAY_BODY: Today = {
  view: 'approver',
  requiresYou: [{ ...row(EID, 'Login form'), action: 'approve' }],
  waitingOnOthers: [row(OTHER, 'Password reset')],
};

const AMBIGUOUS: ElementRefusalBody = {
  error: {
    code: 'ambiguous-id',
    message: 'Ambiguous id',
    detail: {
      candidates: [
        { id: EID, shortId: 'task-001', title: 'Login form', type: 'task', status: 's1' },
        { id: 'task-001-login-copy', shortId: 'task-001', title: 'Login copy', type: 'task', status: 's1' },
      ],
      more: 0,
    },
  },
};

function api(over: FakeApi = {}): FakeApi {
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: {
        projects: [
          { id: PID, name: 'demo', path: '/x', remote: null, availability: 'available' },
          { id: 'p_b', name: 'other', path: '/y', remote: null, availability: 'available' },
        ],
      },
    },
    [`/api/p/${PID}`]: { status: 200, body: morgan() },
    [TODAY]: { status: 200, body: TODAY_BODY },
    [`/api/p/${PID}/directives`]: { status: 200, body: { entries: [], warnings: [] } },
    [`/api/p/${PID}/events/memory?limit=10`]: { status: 200, body: { events: [] } },
    [`${API}/${EID}`]: { status: 200, body: detail(EID, 'Login form') },
    [`${API}/${EID}/history`]: { status: 200, body: history(EID) },
    [`${API}/${OTHER}`]: { status: 200, body: detail(OTHER, 'Password reset') },
    [`${API}/${OTHER}/history`]: { status: 200, body: history(OTHER) },
    ...over,
  };
}

/** The element requests the stub API saw. */
function elementReads(fetch: ReturnType<typeof stubApi>): string[] {
  return fetch.mock.calls.map((c) => String(c[0])).filter((p) => p.includes('/elements'));
}

const panel = (name: string) => screen.findByRole('dialog', { name });
const todayHeading = () => screen.findByRole('heading', { level: 1, name: 'Morgan, 1 thing requires you' });
const requiresYou = () => screen.getByRole('region', { name: 'Requires you' });
const waitingCard = () => screen.getByRole('region', { name: 'Waiting on others' });
const frame = () => act(async () => new Promise((r) => requestAnimationFrame(() => r(undefined))));

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

it('opens a Requires you title in the side panel over Today: a push, Today kept, its heading focused (G-01.8, D77-4)', async () => {
  stubApi(api());
  const user = userEvent.setup();
  const { router } = renderApp(`/p/${PID}/today`);
  await todayHeading();
  const before = router.history.length;
  const link = within(requiresYou()).getByRole('link', { name: 'Login form' });
  expect(link.getAttribute('href')).toBe(`/p/${PID}/today?panel=${EID}`);
  await user.click(link);
  const dialog = await panel('Login form');
  expect(router.state.location.pathname).toBe(`/p/${PID}/today`);
  expect(router.state.location.search).toEqual({ panel: EID });
  expect(router.history.length).toBe(before + 1);
  // Today stays shown under the panel (task-061 Q3), the panel is outside the main region.
  expect(screen.getByRole('heading', { level: 1, name: 'Morgan, 1 thing requires you' })).toBeTruthy();
  expect(screen.getByRole('main').contains(dialog)).toBe(false);
  expect(dialog.hasAttribute('data-element-view')).toBe(true);
  expect(within(dialog).getByRole('heading', { level: 2, name: 'Login form' })).toBeTruthy();
  await waitFor(() => expect(document.activeElement?.textContent).toBe('Login form'));
  expect(dialog.contains(document.activeElement)).toBe(true);
});

it('closes with Close back in history, the focus on the opener; Forward reopens (AC-3, D77-5, D77-7)', async () => {
  stubApi(api());
  const user = userEvent.setup();
  const { router } = renderApp(`/p/${PID}/today`);
  await todayHeading();
  await user.click(within(requiresYou()).getByRole('link', { name: 'Login form' }));
  const dialog = await panel('Login form');
  await user.click(within(dialog).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Login form' })).toBeNull());
  expect(router.state.location.search).toEqual({});
  await waitFor(() =>
    expect(document.activeElement).toBe(within(requiresYou()).getByRole('link', { name: 'Login form' })),
  );
  act(() => router.history.forward());
  expect(await panel('Login form')).toBeTruthy();
});

it('opens from the Requires you action with the gate focus request and closes with Escape to the action', async () => {
  stubApi(api());
  const user = userEvent.setup();
  const { router } = renderApp(`/p/${PID}/today`);
  await user.click(await screen.findByRole('button', { name: `Approve ${EID}` }));
  await panel('Login form');
  expect(router.state.location.search).toEqual({ panel: EID });
  expect(router.state.location.state.panelPushed).toBe(true);
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Login form' })).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: `Approve ${EID}` })));
});

it('keeps the panel on a fresh load, and closes it by replacing the entry without panel=, focus on main (G-01.8, AC-3)', async () => {
  stubApi(api());
  const user = userEvent.setup();
  const { router } = renderApp(`/p/${PID}/today?panel=${EID}`);
  const dialog = await panel('Login form');
  await todayHeading();
  const before = router.history.length;
  await user.click(within(dialog).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Login form' })).toBeNull());
  expect(router.state.location.pathname).toBe(`/p/${PID}/today`);
  expect(router.state.location.search).toEqual({});
  expect(router.history.length).toBe(before);
  await waitFor(() => expect(document.activeElement?.id).toBe('main'));
});

it('opens a bell item over the current view keeping its other parameters; closes to main (S-21.4, AC-3)', async () => {
  stubApi(api());
  const user = userEvent.setup();
  const { router } = renderApp(`/p/${PID}/directives?show=all`);
  await user.click(await screen.findByRole('button', { name: 'Notifications, 1 to unblock' }));
  const bell = await screen.findByRole('dialog', { name: 'Notifications' });
  const link = within(bell).getByRole('link', { name: 'Login form' });
  await user.click(link);
  const dialog = await panel('Login form');
  expect(router.state.location.pathname).toBe(`/p/${PID}/directives`);
  expect(router.state.location.search).toEqual({ show: 'all', panel: EID });
  expect(router.state.location.state.gateFocus).toBe(true);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull());
  await frame();
  await frame();
  expect(dialog.contains(document.activeElement)).toBe(true);
  await user.click(within(dialog).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Login form' })).toBeNull());
  expect(router.state.location.search).toEqual({ show: 'all' });
  await waitFor(() => expect(document.activeElement?.id).toBe('main'));
});

it('opens a bell item on the element page as that item’s element page (Q1 (a), AC-2)', async () => {
  stubApi(api());
  const user = userEvent.setup();
  const { router } = renderApp(`/p/${PID}/e/${OTHER}`);
  await screen.findByRole('region', { name: 'Password reset' });
  await user.click(await screen.findByRole('button', { name: 'Notifications, 1 to unblock' }));
  const bell = await screen.findByRole('dialog', { name: 'Notifications' });
  const link = within(bell).getByRole('link', { name: 'Login form' });
  expect(link.getAttribute('href')).toBe(`/p/${PID}/e/${EID}`);
  await user.click(link);
  await screen.findByRole('region', { name: 'Login form' });
  expect(router.state.location.pathname).toBe(`/p/${PID}/e/${EID}`);
  expect(screen.queryByRole('dialog', { name: 'Login form' })).toBeNull();
});

it('ignores panel= on the element page: no panel, no read of its value (spec-011 §2)', async () => {
  const fetch = stubApi(api());
  renderApp(`/p/${PID}/e/${OTHER}?panel=${EID}`);
  await screen.findByRole('region', { name: 'Password reset' });
  await frame();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(elementReads(fetch).some((p) => p.includes(EID))).toBe(false);
});

it('replaces a short value by the full id in place, with one element read (spec-011 §2, D77-3)', async () => {
  const fetch = stubApi(api({ [`${API}/task-001`]: { status: 200, body: detail(EID, 'Login form') } }));
  const { router } = renderApp(`/p/${PID}/today?panel=task-001`);
  const dialog = await panel('Login form');
  await waitFor(() => expect(router.state.location.search).toEqual({ panel: EID }));
  const before = router.history.length;
  expect(router.state.location.pathname).toBe(`/p/${PID}/today`);
  expect(within(dialog).getByText(EID)).toBeTruthy();
  await frame();
  expect(elementReads(fetch).filter((p) => p === `${API}/${EID}`)).toEqual([]);
  expect(router.history.length).toBe(before);
});

it('lists the candidates of an ambiguous value as ?panel= links on the same view, replacing the entry (D77-3)', async () => {
  stubApi(api({ [`${API}/task-001`]: { status: 409, body: AMBIGUOUS } }));
  const user = userEvent.setup();
  const { router } = renderApp(`/p/${PID}/today?panel=task-001`);
  const list = await screen.findByRole('list', { name: 'task-001 names several elements' });
  const links = within(list).getAllByRole('link');
  expect(links.map((a) => a.getAttribute('href'))).toEqual([
    `/p/${PID}/today?panel=${EID}`,
    `/p/${PID}/today?panel=task-001-login-copy`,
  ]);
  const before = router.history.length;
  await user.click(links[0]!);
  await panel('Login form');
  expect(router.state.location.search).toEqual({ panel: EID });
  expect(router.history.length).toBe(before);
});

it('replaces the value when another element opens while the panel is open: one Close returns to the view (Q2 (a))', async () => {
  stubApi(api());
  const user = userEvent.setup();
  const { router } = renderApp(`/p/${PID}/today`);
  await todayHeading();
  await user.click(within(requiresYou()).getByRole('link', { name: 'Login form' }));
  await panel('Login form');
  const opened = router.history.length;
  await user.click(within(waitingCard()).getByRole('link', { name: /Password reset/ }));
  const dialog = await panel('Password reset');
  expect(router.state.location.search).toEqual({ panel: OTHER });
  expect(router.history.length).toBe(opened);
  await user.click(within(dialog).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(router.state.location.search).toEqual({});
  await waitFor(() =>
    expect(document.activeElement).toBe(within(waitingCard()).getByRole('link', { name: /Password reset/ })),
  );
});

it('gives the focus back to the opener after the browser’s Back too (D77-7)', async () => {
  stubApi(api());
  const user = userEvent.setup();
  const { router } = renderApp(`/p/${PID}/today`);
  await todayHeading();
  await user.click(within(requiresYou()).getByRole('link', { name: 'Login form' }));
  await panel('Login form');
  act(() => router.history.back());
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Login form' })).toBeNull());
  await waitFor(() =>
    expect(document.activeElement).toBe(within(requiresYou()).getByRole('link', { name: 'Login form' })),
  );
});

it('goes back once on a double Escape (task-062 N-3)', async () => {
  stubApi(api());
  const user = userEvent.setup();
  const { router } = renderApp('/');
  await screen.findByRole('heading', { level: 1, name: 'Projects' });
  await act(async () => router.navigate({ to: '/p/$pid/today', params: { pid: PID } }));
  await todayHeading();
  await user.click(within(requiresYou()).getByRole('link', { name: 'Login form' }));
  const dialog = await panel('Login form');
  const back = vi.spyOn(router.history, 'back');
  fireEvent.keyDown(dialog, { key: 'Escape' });
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(back).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(router.state.location.pathname).toBe(`/p/${PID}/today`));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Login form' })).toBeNull());
});

it('keeps Today mounted: an expanded card stays expanded through the panel (task-061 Q3)', async () => {
  const many: Today = {
    view: 'approver',
    requiresYou: Array.from({ length: 12 }, (_, i) => ({
      ...row(`task-1${String(i).padStart(2, '0')}-x`, `Row ${i}`),
      action: 'approve' as const,
    })),
    waitingOnOthers: [],
  };
  stubApi(
    api({
      [TODAY]: { status: 200, body: many },
      [`${API}/task-100-x`]: { status: 200, body: detail('task-100-x', 'Row 0') },
      [`${API}/task-100-x/history`]: { status: 200, body: history('task-100-x') },
    }),
  );
  const user = userEvent.setup();
  renderApp(`/p/${PID}/today`);
  await user.click(await screen.findByRole('button', { name: 'Show all (12)' }));
  await user.click(within(requiresYou()).getByRole('link', { name: 'Row 0' }));
  const dialog = await panel('Row 0');
  await user.click(within(dialog).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Row 0' })).toBeNull());
  expect(screen.getByRole('button', { name: 'Show fewer' })).toBeTruthy();
});

it('does not reset the scroll of the view when the panel opens (D77-4)', async () => {
  stubApi(api());
  const scrollTo = vi.fn();
  vi.stubGlobal('scrollTo', scrollTo);
  const user = userEvent.setup();
  renderApp(`/p/${PID}/today`);
  await todayHeading();
  scrollTo.mockClear();
  await user.click(within(requiresYou()).getByRole('link', { name: 'Login form' }));
  await panel('Login form');
  await frame();
  expect(scrollTo).not.toHaveBeenCalled();
});

// AC-4 (spec-011 §6, §8): a hostile value is only ever looked up as an element id of this project.
it.each([
  ['../x', '..%2Fx'],
  ['https://example.test/x', 'https%3A%2F%2Fexample.test%2Fx'],
  ['%2e%2e', null],
  ['.', null],
  ['..', null],
  ['', null],
  ['123', null],
  ['a&panel=b', null],
  ['task-009-elsewhere', 'task-009-elsewhere'],
])('shows not found for panel=%j and navigates nowhere (AC-4)', async (raw, encoded) => {
  const fetch = stubApi(api());
  const search = `?panel=${raw}`;
  const { router } = renderApp(`/p/${PID}/today${search}`);
  const dialog = await screen.findByRole('dialog');
  expect(await within(dialog).findByRole('alert')).toBeTruthy();
  await todayHeading();
  const before = router.history.length;
  await frame();
  const reads = elementReads(fetch);
  // Only this project's element path, with the value as one encoded segment (none when refused).
  expect(reads).toEqual(encoded === null ? [] : [`${API}/${encoded}`, `${API}/${encoded}/history`]);
  expect(router.state.location.pathname).toBe(`/p/${PID}/today`);
  expect(router.history.length).toBe(before);
  // No footer, no link built from the value.
  expect(dialog.querySelector('.element-footer-slot')).toBeNull();
  expect(within(dialog).queryAllByRole('link')).toEqual([]);
});

it('signals a close only once no panel of the project is mounted (React strict mode remounts in development)', async () => {
  const seen: string[] = [];
  const off = onPanelClosed((pid) => {
    seen.push(pid);
    return true;
  });
  try {
    const first = trackPanel('p_x');
    first();
    const second = trackPanel('p_x');
    await Promise.resolve();
    expect(seen).toEqual([]);
    second();
    await Promise.resolve();
    expect(seen).toEqual(['p_x']);
  } finally {
    off();
  }
});
