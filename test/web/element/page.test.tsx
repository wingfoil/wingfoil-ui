// @vitest-environment jsdom
// task-062 — the element page (spec-011 §2, §3; ux-reference §4.2 v0.3, N5): `/p/$pid/e/$eid` in the
// main region (not a dialog), Close and Escape back in history or to the Memory list, a short id
// rewritten to the full id with the answer seeded (D62-4), the candidates of an ambiguous one
// (D62-5), and the refusal of path-syntax ids (D62-9).
import type { ElementDetail, ElementRefusalBody, MemoryHistory } from '@wingfoil-ui/contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { keyCatalogue } from '../../../web/scripts/catalogue.mjs';
import { stopEventStream } from '../../../web/src/api/events.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { resetSession } from '../../../web/src/session/session.js';
import { header } from '../dna/data.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';

const PID = 'p_fx';
const EID = 'el-002-reset';
const SHORT = 'el-002';
const API = `/api/p/${PID}/elements`;

const DETAIL: ElementDetail = {
  element: {
    path: 'docs/el.md',
    id: EID,
    shortId: SHORT,
    title: 'Password reset',
    type: 'kind-a',
    status: 's1',
    tags: [],
    localChanges: false,
  },
  frontmatter: { id: EID, type: 'kind-a', title: 'Password reset', status: 's1' },
  body: 'Users forget passwords.\n',
  states: { sequence: ['s1', 's2'], gates: {} },
};

const HISTORY: MemoryHistory = {
  id: EID,
  path: 'docs/el.md',
  entries: [
    {
      sha: '1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      author: 'Jordan <jordan@example.test>',
      timestamp: '2026-09-29T15:20:02+00:00',
      operation: 'add',
      from: null,
      to: 's1',
      approver: null,
      reason: null,
      subject: 'wf(x): add',
    },
  ],
};

const AMBIGUOUS: ElementRefusalBody = {
  error: {
    code: 'ambiguous-id',
    message: 'Ambiguous id',
    detail: {
      candidates: [
        { id: 'el-001-login', shortId: 'el-001', title: 'Login form', type: 'kind-a', status: 's1' },
        { id: 'el-001-login-copy', shortId: 'el-001', title: 'Login \\u202e copy', type: 'kind-a', status: 's2' },
      ],
      more: 3,
    },
  },
};

function api(over: FakeApi = {}): FakeApi {
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'kanban', path: '/x', remote: null, availability: 'available' }] },
    },
    [`${API}/${EID}`]: { status: 200, body: DETAIL },
    [`${API}/${EID}/history`]: { status: 200, body: HISTORY },
    [`/api/p/${PID}/directives`]: { status: 200, body: { entries: [], warnings: [] } },
    [`/api/p/${PID}`]: { status: 200, body: header({ kind: 'no-identity' }) },
    ...over,
  };
}

/** The paths the stub API was asked for. */
function asked(fetch: ReturnType<typeof vi.fn>): string[] {
  return fetch.mock.calls.map((c) => String(c[0]));
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

it('shows the element as a page of the main region, named by its level-1 title, not as a dialog (N5)', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/e/${EID}`);
  const page = await screen.findByRole('region', { name: 'Password reset' });
  expect(screen.getByRole('main').contains(page)).toBe(true);
  expect(within(page).getByRole('heading', { level: 1, name: 'Password reset' })).toBeTruthy();
  expect(within(page).getByText(EID)).toBeTruthy();
  expect(within(page).getByText('Users forget passwords.')).toBeTruthy();
  expect(screen.queryByRole('dialog')).toBeNull();
  // The sidebar stays: the page is a view of the project layout.
  expect(screen.getByRole('navigation', { name: 'Project views' })).toBeTruthy();
  // The heading takes the focus on open (as the drawer's did).
  await waitFor(() => expect(document.activeElement?.textContent).toBe('Password reset'));
});

it('closes with Escape to the Memory list when opened from its address (spec-011 §2), focus on main', async () => {
  stubApi(api({ [`${API}`]: { status: 200, body: { elements: [], warnings: [] } } }));
  const { router } = renderApp(`/p/${PID}/e/${EID}`);
  await screen.findByRole('region', { name: 'Password reset' });
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(router.state.location.pathname).toBe(`/p/${PID}/memory`));
  await waitFor(() => expect(document.activeElement?.id).toBe('main'));
});

it('closes with Close back to where it was opened inside the console', async () => {
  stubApi(api());
  const { router } = renderApp('/');
  await screen.findByRole('heading', { level: 1, name: 'Projects' });
  await router.navigate({ to: '/p/$pid/e/$eid', params: { pid: PID, eid: EID } });
  const page = await screen.findByRole('region', { name: 'Password reset' });
  await userEvent.click(within(page).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/'));
});

it('closes with Escape pressed inside the page only, and not after an inner control handled it', async () => {
  stubApi(api());
  const { router } = renderApp(`/p/${PID}/e/${EID}`);
  const page = await screen.findByRole('region', { name: 'Password reset' });
  screen.getByRole('link', { name: 'Skip to content' }).focus();
  await userEvent.keyboard('{Escape}');
  expect(router.state.location.pathname).toBe(`/p/${PID}/e/${EID}`);
  const heading = within(page).getByRole('heading', { level: 1 });
  heading.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') e.preventDefault();
  });
  heading.focus();
  await userEvent.keyboard('{Escape}');
  expect(router.state.location.pathname).toBe(`/p/${PID}/e/${EID}`);
});

it('rewrites a short id to the full id, replacing the entry, with one element read (D62-4)', async () => {
  const fetch = stubApi(api({ [`${API}/${SHORT}`]: { status: 200, body: DETAIL } }));
  const { router } = renderApp('/');
  await screen.findByRole('heading', { level: 1, name: 'Projects' });
  await router.navigate({ to: '/p/$pid/e/$eid', params: { pid: PID, eid: SHORT } });
  await waitFor(() => expect(router.state.location.pathname).toBe(`/p/${PID}/e/${EID}`));
  const page = await screen.findByRole('region', { name: 'Password reset' });
  await within(page).findByText('created by Jordan');
  // The full id is shown; the answer was seeded: no read of the full id's element.
  expect(within(page).getByText(EID)).toBeTruthy();
  const reads = asked(fetch);
  expect(reads.filter((p) => p === `${API}/${SHORT}`)).toHaveLength(1);
  expect(reads).not.toContain(`${API}/${EID}`);
  expect(reads).toContain(`${API}/${EID}/history`);
  // The short entry was replaced: Back returns to where the page was opened, not to the short form.
  router.history.back();
  await waitFor(() => expect(router.state.location.pathname).toBe('/'));
});

it('never shows the 404 a short id gets from the history (D57-5)', async () => {
  stubApi(api({ [`${API}/${SHORT}`]: { status: 200, body: DETAIL } }));
  renderApp(`/p/${PID}/e/${SHORT}`);
  const page = await screen.findByRole('region', { name: 'Password reset' });
  await within(page).findByText('created by Jordan');
  expect(within(page).queryByRole('alert')).toBeNull();
});

it('lists the candidates of an ambiguous short id, each a link to its page, instead of not found (D62-5)', async () => {
  stubApi(api({ [`${API}/el-001`]: { status: 409, body: AMBIGUOUS } }));
  renderApp(`/p/${PID}/e/el-001`);
  const list = await screen.findByRole('list', { name: 'el-001 names several elements' });
  const links = within(list).getAllByRole('link');
  expect(links.map((a) => a.getAttribute('href'))).toEqual([
    `/p/${PID}/e/el-001-login`,
    `/p/${PID}/e/el-001-login-copy`,
  ]);
  expect(links[0]?.textContent).toContain('Login form');
  // The server's escapes are shown as text.
  expect(links[1]?.textContent).toContain('Login \\u202e copy');
  expect(links[1]?.textContent).toContain('el-001-login-copy');
  expect(screen.getByText('and 3 more elements')).toBeTruthy();
  expect(screen.queryByText('Not found')).toBeNull();
  // A candidate opens its page.
  await userEvent.click(links[1]!);
  await waitFor(() => expect(screen.queryByRole('list', { name: 'el-001 names several elements' })).toBeNull());
});

it('shows a 409 whose detail is not the contract shape as an error, not as candidates', async () => {
  stubApi(
    api({
      [`${API}/el-001`]: {
        status: 409,
        body: { error: { code: 'ambiguous-id', message: 'x', detail: { candidates: [{ id: 7 }], more: 0 } } },
      },
    }),
  );
  renderApp(`/p/${PID}/e/el-001`);
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByRole('link', { name: /el-001/ })).toBeNull();
});

it('shows not found for an unknown id, the address as heading', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/e/task-46`);
  const page = await screen.findByRole('region', { name: 'task-46' });
  expect(await within(page).findByRole('alert')).toBeTruthy();
});

it('shows only catalogue keys for the candidates with the key catalogue (spec-008 §6)', async () => {
  stubApi(api({ [`${API}/el-001`]: { status: 409, body: AMBIGUOUS } }));
  renderApp(`/p/${PID}/e/el-001`, keyCatalogue(en));
  expect(await screen.findByRole('list', { name: 'element.candidates.title el-001' })).toBeTruthy();
  expect(screen.getByText('element.candidates.more 3')).toBeTruthy();
});
