// @vitest-environment jsdom
// task-017 — the Memory list (US-M-01, US-M-02, US-S-25; ux-reference §4.4) at component level, on
// the whole application with a stubbed API: the route and its sidebar entry, the index redirect
// (W3-22), filters as links kept in the URL, buckets from the descriptor, rows opening the panel and
// the focus back on the row (W3-23), the archived read on the first type selection (W3-24),
// undeclared states and types (W3-25), the age from `since` (W3-26), notices, the refresh
// announcement and the catalogue (every text a key).
import type { Bucket, ElementList, ListedElement, ProjectConfig } from '@wingfoil-ui/contracts';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { keyCatalogue } from '../../../web/scripts/catalogue.mjs';
import { stopEventStream } from '../../../web/src/api/events.js';
import { queryKeys } from '../../../web/src/api/query-keys.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { resetSession } from '../../../web/src/session/session.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';

const PID = 'p_fx';
const LIST = `/api/p/${PID}/elements`;
const ARCHIVED = `/api/p/${PID}/elements?archived=true`;
const CONFIG = `/api/p/${PID}/config`;

function el(
  id: string,
  type: string,
  status: string,
  extra: { bucket?: Bucket; tone?: string; local?: boolean; since?: string } = {},
): ListedElement {
  return {
    path: `docs/${type}/${id}.md`,
    id,
    title: `Title of ${id}`,
    type,
    status,
    tags: [],
    localChanges: extra.local ?? false,
    descriptor: {
      id,
      type,
      status,
      kind: 'work',
      tone: (extra.tone ?? 'neutral') as 'neutral',
      ...(extra.bucket ? { bucket: extra.bucket } : {}),
      verbs: [],
      actor: { kind: 'none' },
      ...(extra.since ? { since: extra.since } : {}),
    },
  };
}

const ELEMENTS: ElementList = {
  elements: [
    el('k-001-alpha', 'kind-a', 's2', { bucket: 'to-approve', tone: 'human', since: '2026-10-05T10:00:00Z' }),
    el('k-002-beta', 'kind-a', 's1', { bucket: 'waiting', local: true }),
    el('k-003-gamma', 'kind-a', 'odd', { bucket: 'in-progress', tone: 'active' }),
    el('m-001-delta', 'kind-m', 'm2', { bucket: 'to-approve', tone: 'human' }),
    el('z-001-stray', 'kind-z', 'q', { bucket: 'in-progress', tone: 'active' }),
  ],
  warnings: [],
};

const CONFIG_BODY: ProjectConfig = {
  dna: { error: { code: 'internal', message: 'x' } },
  paths: { error: { code: 'internal', message: 'x' } },
  workflows: { error: { code: 'internal', message: 'x' } },
  types: {
    data: {
      version: 1,
      types: {
        'kind-a': { path: 'a/{id}.md', states: { sequence: ['s1', 's2', 's3'] } },
        'kind-m': { path: 'm/{id}.md', states: { sequence: ['m1', 'm2'] } },
        'kind-e': { path: 'e/{id}.md', states: { sequence: ['e1'] } },
      },
    },
  },
};

const ARCHIVED_BODY: ElementList = {
  ...ELEMENTS,
  elements: [...ELEMENTS.elements, el('k-009-gone', 'kind-a', 's3')],
};

function api(over: FakeApi = {}): FakeApi {
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'demo', path: '/x', remote: null, availability: 'available' }] },
    },
    [CONFIG]: { status: 200, body: CONFIG_BODY },
    [LIST]: { status: 200, body: ELEMENTS },
    [ARCHIVED]: { status: 200, body: ARCHIVED_BODY },
    ...over,
  };
}

/** The type filter links (name → count text). */
function typeFilters(): string[] {
  return within(screen.getByRole('list', { name: 'Element types' }))
    .getAllByRole('link')
    .map((a) => a.textContent ?? '');
}

function stateFilters(): string[] {
  return within(screen.getByRole('list', { name: 'States' }))
    .getAllByRole('link')
    .map((a) => a.textContent ?? '');
}

function rows(): string[] {
  return within(screen.getByRole('list', { name: 'Elements' }))
    .queryAllByRole('link')
    .map((a) => a.dataset['eid'] ?? '');
}

function paths(fetch: ReturnType<typeof stubApi>): string[] {
  return fetch.mock.calls.map((c) => String(c[0])).filter((p) => p.startsWith('/api/p/'));
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

it('redirects the project to its Memory list and shows the sidebar entry as current (W3-22)', async () => {
  stubApi(api());
  const { router } = renderApp(`/p/${PID}`);
  await screen.findByRole('heading', { level: 1, name: 'Memory' });
  expect(router.state.location.pathname).toBe(`/p/${PID}/memory`);
  const nav = screen.getByRole('navigation', { name: 'Project views' });
  expect(within(nav).getByRole('link', { name: 'Memory' }).getAttribute('aria-current')).toBe('page');
  await waitFor(() => expect(document.title).toBe('demo · Memory — WingFoil UI'));
});

it('lists the declared types in order with counts, then undeclared types, and every element', async () => {
  const fetch = stubApi(api());
  renderApp(`/p/${PID}/memory`);
  await screen.findByText('Title of k-001-alpha');
  expect(typeFilters()).toEqual(['All types5', 'kind-a3', 'kind-m1', 'kind-e0', 'kind-z1']);
  expect(screen.getByText('3 types defined in .wingfoil/memory.yaml, each with its own life cycle.')).toBeTruthy();
  expect(rows()).toEqual(['k-001-alpha', 'k-002-beta', 'k-003-gamma', 'm-001-delta', 'z-001-stray']);
  // The landing reads the configuration and the non-archived list only (TT-PERF-05), nothing per row.
  expect(new Set(paths(fetch))).toEqual(new Set([CONFIG, LIST]));
});

it('filters all types by bucket, the four buckets in the header order with counts', async () => {
  stubApi(api());
  const user = userEvent.setup();
  const { router } = renderApp(`/p/${PID}/memory`);
  await screen.findByText('Title of k-001-alpha');
  expect(stateFilters()).toEqual(['All states5', 'To approve2', 'In progress2', 'Waiting/drafts/closed1', 'Done0']);
  await user.click(screen.getByRole('link', { name: /^To approve/ }));
  await waitFor(() => expect(rows()).toEqual(['k-001-alpha', 'm-001-delta']));
  expect(router.state.location.search).toEqual({ bucket: 'toApprove' });
  expect(screen.getByRole('link', { name: /^To approve/ }).getAttribute('aria-current')).toBe('page');
  await user.click(screen.getByRole('link', { name: /^Done/ }));
  await screen.findByText('No element matches these filters.');
});

it('lists one type with its states, undeclared ones after the sequence, and reads the archived list once (W3-24, W3-25)', async () => {
  const fetch = stubApi(api());
  const user = userEvent.setup();
  renderApp(`/p/${PID}/memory`);
  await screen.findByText('Title of k-001-alpha');
  await user.click(screen.getByRole('link', { name: /^kind-a,/ }));
  await waitFor(() => expect(rows()).toEqual(['k-001-alpha', 'k-002-beta', 'k-003-gamma', 'k-009-gone']));
  expect(stateFilters()).toEqual(['All states4', 's11', 's21', 's31', 'odd1']);
  // The type count stays on the non-archived elements.
  expect(typeFilters()[1]).toBe('kind-a3');
  await user.click(screen.getByRole('link', { name: /^s3,/ }));
  await waitFor(() => expect(rows()).toEqual(['k-009-gone']));
  await user.click(screen.getByRole('link', { name: /^kind-m,/ }));
  await waitFor(() => expect(rows()).toEqual(['m-001-delta']));
  expect(paths(fetch).filter((p) => p === ARCHIVED)).toHaveLength(1);
});

it('says a type has no element yet', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/memory?type=kind-e`);
  expect(await screen.findByText('No kind-e yet')).toBeTruthy();
  expect(stateFilters()).toEqual(['All states0', 'e10']);
});

it('shows the row: type tag, title, id, local changes, age, the state pill with the descriptor tone', async () => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-07T10:00:00Z') });
  stubApi(api());
  renderApp(`/p/${PID}/memory`);
  await screen.findByText('Title of k-001-alpha');
  const first = screen.getByRole('link', { name: /k-001-alpha/ });
  expect(first.getAttribute('href')).toBe(`/p/${PID}/e/k-001-alpha`);
  const r = within(first);
  expect(r.getByText('kind-a')).toBeTruthy();
  expect(r.getByText('2 days ago')).toBeTruthy();
  expect(r.getByText('s2').className).toContain('tone-human');
  expect(r.queryByText('local changes')).toBeNull();
  const second = within(screen.getByRole('link', { name: /k-002-beta/ }));
  expect(second.getByText('local changes')).toBeTruthy();
  expect(second.getByText('s1').className).toContain('tone-neutral');
  vi.useRealTimers();
});

it('opens the panel from a row and focuses that row again after Close (W3-23)', async () => {
  stubApi(
    api({
      [`${LIST}/k-003-gamma`]: { status: 404, body: { error: { code: 'not-found', message: 'x' } } },
      [`${LIST}/k-003-gamma/history`]: { status: 404, body: { error: { code: 'not-found', message: 'x' } } },
    }),
  );
  const user = userEvent.setup();
  const { router } = renderApp(`/p/${PID}/memory?type=kind-a`);
  await screen.findByText('Title of k-003-gamma');
  await user.click(screen.getByRole('link', { name: /k-003-gamma/ }));
  await screen.findByRole('dialog');
  expect(router.state.location.pathname).toBe(`/p/${PID}/e/k-003-gamma`);
  await user.click(screen.getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(router.state.location.pathname).toBe(`/p/${PID}/memory`));
  expect(router.state.location.search).toEqual({ type: 'kind-a' });
  await waitFor(() => expect((document.activeElement as HTMLElement | null)?.dataset['eid']).toBe('k-003-gamma'));
});

it('closes a panel opened by URL to the Memory list (W3-22 fallback)', async () => {
  stubApi(api());
  const { router } = renderApp(`/p/${PID}/e/k-001-alpha`);
  await screen.findByRole('dialog');
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(router.state.location.pathname).toBe(`/p/${PID}/memory`));
});

it('degrades without the type definitions: types from the elements, no buckets, a notice', async () => {
  const bare = ELEMENTS.elements.map(({ descriptor: _d, ...rest }) => rest);
  stubApi(
    api({
      [CONFIG]: {
        status: 200,
        body: {
          ...CONFIG_BODY,
          types: {
            error: { code: 'read-error', message: 'x', detail: { file: '.wingfoil/memory.yaml', kind: 'yaml' } },
          },
        },
      },
      [LIST]: {
        status: 200,
        body: { elements: bare, warnings: ['a CLI warning'], typesError: { code: 'read-error', message: 'x' } },
      },
    }),
  );
  renderApp(`/p/${PID}/memory`);
  await screen.findByText('Title of k-001-alpha');
  expect(typeFilters()).toEqual(['All types5', 'kind-a3', 'kind-m1', 'kind-z1']);
  expect(screen.queryByRole('list', { name: 'States' })).toBeNull();
  expect(
    screen.getByText('The type definitions could not be read: the lists show no buckets and no tones.'),
  ).toBeTruthy();
  expect(screen.getByText('a CLI warning')).toBeTruthy();
  // No descriptor, no tone class on the pill.
  const pill = within(screen.getByRole('link', { name: /k-001-alpha/ })).getByText('s2');
  expect(pill.className).not.toMatch(/tone-/);
});

it('notes an events error and renders a failed list read from the catalogue', async () => {
  stubApi(api({ [LIST]: { status: 200, body: { ...ELEMENTS, eventsError: { code: 'internal', message: 'x' } } } }));
  renderApp(`/p/${PID}/memory`);
  expect(
    await screen.findByText('The repository history could not be read: the ages of the states may be missing.'),
  ).toBeTruthy();
  cleanup();
  stopEventStream();
  stubApi(api({ [LIST]: { status: 502, body: { error: { code: 'cli-output', message: 'bad' } } } }));
  renderApp(`/p/${PID}/memory`);
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toBe('WingFoil answered with an output the UI does not understand');
});

it('announces a refresh that changed the list', async () => {
  const fake = api();
  stubApi(fake);
  const { queryClient } = renderApp(`/p/${PID}/memory`);
  await screen.findByText('Title of k-001-alpha');
  const status = screen.getByRole('status', { name: 'Memory list updates' });
  expect(status.textContent).toBe('');
  fake[LIST] = {
    status: 200,
    body: { ...ELEMENTS, elements: [el('k-001-alpha', 'kind-a', 's3', { bucket: 'done', tone: 'done' })] },
  };
  await act(() => queryClient.invalidateQueries({ queryKey: queryKeys.project(PID) }));
  await waitFor(() => expect(status.textContent).toBe('The list was updated.'));
  expect(rows()).toEqual(['k-001-alpha']);
});

it('shows only catalogue keys with the key catalogue (spec-008 §6)', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/memory`, keyCatalogue(en));
  await screen.findByText('Title of k-001-alpha');
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('memory.title');
  expect(screen.getByText('memory.bucket.toApprove')).toBeTruthy();
  expect(screen.getByText('memory.filter.allTypes')).toBeTruthy();
  expect(screen.getByText('memory.localChanges')).toBeTruthy();
});
