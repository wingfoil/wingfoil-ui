// @vitest-environment jsdom
// task-019 — the Team view (US-R-07; ux-reference §4.10; W3-39, W3-44) at component level, on the
// whole application with a stubbed API: member cards (initials, name, email, roles, "you", pending
// gates from the descriptors), agents in their own section, the filters in the URL, the reads,
// a failed DNA and the catalogue (every text a key).
import type { ElementList, ListedElement } from '@wingfoil-ui/contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { keyCatalogue } from '../../../web/scripts/catalogue.mjs';
import { stopEventStream } from '../../../web/src/api/events.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { resetSession } from '../../../web/src/session/session.js';
import { renderApp, stubApi } from '../shell/render.js';
import { BASE, BO, config, header, PID, projectApi } from '../dna/data.js';

function gate(id: string, members: string[]): ListedElement {
  return {
    path: `docs/${id}.md`,
    id,
    title: id,
    type: 'kind-a',
    status: 's2',
    tags: [],
    localChanges: false,
    descriptor: {
      id,
      type: 'kind-a',
      status: 's2',
      kind: 'gate',
      tone: 'human',
      verbs: [],
      actor: { kind: 'role', role: 'r-approve', members },
    },
  };
}

const ELEMENTS: ElementList = { elements: [gate('e1', ['Ann Lee']), gate('e2', ['Ann Lee'])], warnings: [] };

const API = projectApi({
  [BASE]: { status: 200, body: header(BO, 'r-dev') },
  [`${BASE}/config`]: { status: 200, body: config() },
  [`${BASE}/elements`]: { status: 200, body: ELEMENTS },
});

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

/** The member cards' names, in order. */
function cards(): string[] {
  return within(screen.getByRole('list', { name: 'Members' }))
    .queryAllByRole('listitem')
    .filter((li) => li.classList.contains('member-card'))
    .map((li) => li.querySelector('.member-name-text')?.textContent ?? '');
}

it('shows a card per member with roles, "you" and the pending gates, and the agents apart', async () => {
  const fetch = stubApi(API);
  renderApp(`/p/${PID}/team`);
  expect(await screen.findByRole('heading', { level: 1, name: 'Team' })).toBeTruthy();
  await waitFor(() => expect(cards()).toEqual(['Ann Lee', 'Bo', 'Cy']));
  const ann = within(screen.getByRole('listitem', { name: 'Ann Lee' }));
  expect(ann.getByText('AL')).toBeTruthy();
  expect(ann.getByText('ann@x.test')).toBeTruthy();
  expect(ann.getByText('r-approve')).toBeTruthy();
  expect(ann.getByText('r-lead')).toBeTruthy();
  await waitFor(() => expect(ann.getByText('2 pending gates')).toBeTruthy());
  expect(ann.queryByText('you')).toBeNull();
  const bo = within(screen.getByRole('listitem', { name: 'Bo' }));
  expect(bo.getByText('you')).toBeTruthy();
  expect(bo.getByText('No pending gate')).toBeTruthy();
  // A member without email: no email line.
  expect(within(screen.getByRole('listitem', { name: 'Cy' })).queryByText('@', { exact: false })).toBeNull();
  const agents = within(screen.getByRole('region', { name: 'Agents' }));
  expect(agents.getByText('Bot')).toBeTruthy();
  expect(agents.getByText('executes as r-dev, r-qa · never approves')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Team' }).getAttribute('aria-current')).toBe('page');
  expect(document.title).toBe('demo · Team — WingFoil UI');
  const reads = new Set(fetch.mock.calls.map((c) => String(c[0])).filter((p) => p.startsWith(BASE)));
  // Plus the notification bell's Today read of the role view (task-042, D42-1).
  expect(reads).toEqual(new Set([BASE, `${BASE}/config`, `${BASE}/elements`, `${BASE}/today?view=r-dev`]));
});

it('filters by pending gates, role and text, kept in the URL', async () => {
  stubApi(API);
  const { router } = renderApp(`/p/${PID}/team`);
  const user = userEvent.setup();
  await waitFor(() => expect(cards()).toEqual(['Ann Lee', 'Bo', 'Cy']));
  await screen.findByText('2 pending gates');
  await user.click(screen.getByRole('checkbox', { name: 'With pending gates' }));
  await waitFor(() => expect(cards()).toEqual(['Ann Lee']));
  expect(router.state.location.search).toEqual({ gates: 1 });
  await user.click(screen.getByRole('checkbox', { name: 'With pending gates' }));
  await waitFor(() => expect(cards()).toEqual(['Ann Lee', 'Bo', 'Cy']));
  await user.click(screen.getByRole('link', { name: 'r-qa' }));
  await waitFor(() => expect(cards()).toEqual(['Cy']));
  expect(screen.getByRole('link', { name: 'r-qa' }).getAttribute('aria-current')).toBe('page');
  await user.click(screen.getByRole('link', { name: 'All roles' }));
  await waitFor(() => expect(cards()).toEqual(['Ann Lee', 'Bo', 'Cy']));
  await user.type(screen.getByRole('searchbox', { name: 'Search by name or email' }), 'BO@');
  await waitFor(() => expect(cards()).toEqual(['Bo']));
  expect(router.state.location.search).toEqual({ q: 'BO@' });
});

it('keeps the search field on the URL through back and forward (review F8)', async () => {
  stubApi(API);
  const { router } = renderApp(`/p/${PID}/team?q=Ann`);
  const field = await screen.findByRole('searchbox', { name: 'Search by name or email' });
  await waitFor(() => expect(cards()).toEqual(['Ann Lee']));
  expect((field as HTMLInputElement).value).toBe('Ann');
  await router.navigate({ to: '/p/$pid/team', params: { pid: PID }, search: { q: 'Cy' } });
  await waitFor(() => expect((field as HTMLInputElement).value).toBe('Cy'));
  await waitFor(() => expect(cards()).toEqual(['Cy']));
  router.history.back();
  await waitFor(() => expect((field as HTMLInputElement).value).toBe('Ann'));
  router.history.forward();
  await waitFor(() => expect((field as HTMLInputElement).value).toBe('Cy'));
  await router.navigate({ to: '/p/$pid/team', params: { pid: PID }, search: {} });
  await waitFor(() => expect((field as HTMLInputElement).value).toBe(''));
  // Typing still drives the URL, character by character, without the field jumping back.
  const user = userEvent.setup();
  await user.type(field, 'Bo Ray');
  expect((field as HTMLInputElement).value).toBe('Bo Ray');
  await waitFor(() => expect(router.state.location.search).toEqual({ q: 'Bo Ray' }));
});

it('says when no member matches the filters', async () => {
  stubApi(API);
  renderApp(`/p/${PID}/team?q=nobody`);
  expect(await screen.findByText('No member matches these filters.')).toBeTruthy();
});

it('shows the cards without pending gates when the elements cannot be read', async () => {
  stubApi({ ...API, [`${BASE}/elements`]: { status: 500, body: { error: { code: 'internal', message: 'x' } } } });
  renderApp(`/p/${PID}/team`);
  expect(await screen.findByText('The pending gates could not be read.')).toBeTruthy();
  expect(cards()).toEqual(['Ann Lee', 'Bo', 'Cy']);
  expect(screen.queryByText('No pending gate')).toBeNull();
});

it('shows a failed DNA read with the CLI message', async () => {
  stubApi({
    ...API,
    [`${BASE}/config`]: { status: 200, body: config({ error: { code: 'cli-refused', message: 'bad dna' } }) },
  });
  renderApp(`/p/${PID}/team`);
  const alert = await screen.findByRole('alert');
  expect(within(alert).getByText('bad dna')).toBeTruthy();
});

it('renders every text from the catalogue (key build)', async () => {
  stubApi(API);
  renderApp(`/p/${PID}/team`, keyCatalogue(en));
  expect(await screen.findByText('team.title')).toBeTruthy();
  expect(await screen.findByText('team.member.pendingGates 2')).toBeTruthy();
  expect(screen.getByText('team.member.you')).toBeTruthy();
});
