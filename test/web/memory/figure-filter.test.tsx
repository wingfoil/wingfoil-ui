// @vitest-environment jsdom
// task-066 AC-3 — the figure filter `/p/<pid>/memory?figure=<code>` (US-T-13, TQ-4 (a); spec-012 §3
// *Figure filters*; D66-8, D66-9) at component level, one test per case: the elements whose full id
// is in the figure's `ids` of the `/progress` answer Today shares, the other filters cleared, the
// active filter named by the figure with *Clear filter* (focus on the heading); an unknown code or a
// figure not shown → the unfiltered list, no active filter; the ids never in the address. The e2e
// from Today is task-065's (T-13.1 … T-13.4).
import type { ElementList, ListedElement, Progress, ProjectConfig } from '@wingfoil-ui/contracts';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { queryKeys } from '../../../web/src/api/query-keys.js';
import { resetSession } from '../../../web/src/session/session.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';

const PID = 'p_fx';
const LIST = `/api/p/${PID}/elements`;
const ARCHIVED = `/api/p/${PID}/elements?archived=true`;
const CONFIG = `/api/p/${PID}/config`;
const PROGRESS = `/api/p/${PID}/progress`;

function el(id: string, type: string, status: string): ListedElement {
  return {
    path: `docs/${type}/${id}.md`,
    id,
    title: `Title of ${id}`,
    type,
    status,
    tags: [],
    localChanges: false,
    descriptor: {
      id,
      type,
      status,
      kind: 'work',
      tone: 'neutral',
      bucket: 'waiting',
      verbs: [],
      actor: { kind: 'none' },
    },
  };
}

const ELEMENTS: ElementList = {
  elements: [
    el('k-001-alpha', 'kind-a', 's1'),
    el('k-002-beta', 'kind-a', 's2'),
    el('m-001-delta', 'kind-m', 'm1'),
    el('d-001-defect', 'kind-d', 'd1'),
    el('g-001-gate', 'kind-g', 'g1'),
  ],
  warnings: [],
};

const CONFIG_BODY: ProjectConfig = {
  dna: { error: { code: 'internal', message: 'x' } },
  paths: { error: { code: 'internal', message: 'x' } },
  workflows: { error: { code: 'internal', message: 'x' } },
  types: { data: { version: 1, types: { 'kind-a': { path: 'a/{id}.md', states: { sequence: ['s1', 's2'] } } } } },
};

const READ_ONLY = { state: 'read-only', reason: { code: 'not-in-release' } } as const;

function progress(over: Partial<Progress['figures']> = {}): Progress {
  return {
    ui: { source: 'file' },
    mode: 'sequence',
    scope: { type: null, current: null, basis: null },
    figures: {
      completion: {
        state: 'shown',
        value: 0.5,
        percent: 50,
        references: [],
        referencesCount: 1,
        ids: ['k-001-alpha', 'k-002-beta'],
      },
      phase: READ_ONLY,
      phaseCompletion: READ_ONLY,
      iterated: { state: 'shown', type: 'kind-a', done: 1, total: 2, ids: ['k-002-beta', 'k-001-alpha'], doneIds: [] },
      openDefects: { state: 'shown', type: 'kind-d', count: 1, ids: ['d-001-defect'] },
      pendingGates: { state: 'shown', count: 2, ids: ['g-001-gate', 'm-001-delta', 'x-009-archived'] },
      ...over,
    },
    unreadable: [],
    capped: [],
  };
}

function api(over: FakeApi = {}): FakeApi {
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'demo', path: '/x', remote: null, availability: 'available' }] },
    },
    [CONFIG]: { status: 200, body: CONFIG_BODY },
    [LIST]: { status: 200, body: ELEMENTS },
    [ARCHIVED]: { status: 200, body: ELEMENTS },
    [PROGRESS]: { status: 200, body: progress() },
    ...over,
  };
}

function rows(): string[] {
  return within(screen.getByRole('list', { name: 'Elements' }))
    .queryAllByRole('link')
    .map((a) => a.dataset['eid'] ?? '');
}

function activeName(): string | null | undefined {
  return screen.queryByRole('group', { name: 'Active filter' })?.querySelector('.memory-active-name')?.textContent;
}

function paths(fetch: ReturnType<typeof stubApi>): string[] {
  return fetch.mock.calls.map((c) => String(c[0])).filter((p) => p.startsWith('/api/p/'));
}

const ALL = ['k-001-alpha', 'k-002-beta', 'm-001-delta', 'd-001-defect', 'g-001-gate'];

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

describe('AC-3 — the figure filter', () => {
  for (const [code, ids, label] of [
    ['completion', ['k-001-alpha', 'k-002-beta'], 'Project completion'],
    ['iterated', ['k-001-alpha', 'k-002-beta'], 'Iterated: kind-a'],
    ['open-defects', ['d-001-defect'], 'Open: kind-d'],
    ['pending-gates', ['m-001-delta', 'g-001-gate'], 'Pending gates'],
  ] as const) {
    it(`AC-3 ${code} — lists the figure's elements in list order, the other filters cleared, named "${label}"`, async () => {
      stubApi(api());
      renderApp(`/p/${PID}/memory?figure=${code}&type=kind-a&bucket=done`);
      await waitFor(() => expect(rows()).toEqual(ids));
      // The type and the bucket of the address are cleared: the state row offers the buckets.
      expect(within(screen.getByRole('list', { name: 'States' })).getAllByRole('link')).toHaveLength(5);
      expect(activeName()).toBe(label);
      // The counts of the filter rows stay those of the whole list.
      expect(screen.getByRole('link', { name: /^All types,/ }).textContent).toBe('All types5');
    });
  }

  it('AC-3 clear — the unfiltered list, no active filter, no figure in the URL, the focus on the heading', async () => {
    stubApi(api());
    const user = userEvent.setup();
    const { router } = renderApp(`/p/${PID}/memory?figure=pending-gates`);
    await waitFor(() => expect(rows()).toEqual(['m-001-delta', 'g-001-gate']));
    await user.click(screen.getByRole('link', { name: 'Clear filter' }));
    await waitFor(() => expect(rows()).toEqual(ALL));
    expect(router.state.location.search).toEqual({});
    expect(activeName()).toBeUndefined();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Memory' })));
  });

  it('AC-3 unknown code — the unfiltered list, no active filter, no /progress read', async () => {
    const fetch = stubApi(api());
    renderApp(`/p/${PID}/memory?figure=bogus`);
    await waitFor(() => expect(rows()).toEqual(ALL));
    expect(activeName()).toBeUndefined();
    expect(paths(fetch)).not.toContain(PROGRESS);
  });

  it('AC-3 a figure not shown — the unfiltered list, no active filter, for each unavailable reason', async () => {
    const cases: [string, Partial<Progress['figures']>][] = [
      ['completion', { completion: { state: 'unavailable', reason: { code: 'no-reference-categories' } } }],
      ['completion', { completion: { state: 'unavailable', reason: { code: 'no-linked-elements' } } }],
      ['iterated', { iterated: { state: 'unavailable', reason: { code: 'no-iterates-type' } } }],
      ['open-defects', { openDefects: { state: 'unavailable', reason: { code: 'no-defects-type' } } }],
    ];
    for (const [code, figures] of cases) {
      stubApi(api({ [PROGRESS]: { status: 200, body: progress(figures) } }));
      renderApp(`/p/${PID}/memory?figure=${code}`);
      await waitFor(() => expect(rows()).toEqual(ALL));
      expect(activeName()).toBeUndefined();
      cleanup();
      stopEventStream();
    }
  });

  it('AC-3 /progress fails — a notice and the unfiltered list, no active filter', async () => {
    stubApi(api({ [PROGRESS]: { status: 502, body: { error: { code: 'internal', message: 'x' } } } }));
    renderApp(`/p/${PID}/memory?figure=pending-gates`);
    await screen.findByText('The figure could not be read: the list is not filtered.');
    expect(rows()).toEqual(ALL);
    expect(activeName()).toBeUndefined();
  });

  it('AC-3 ids never in the address — every navigation keeps the address free of element ids', async () => {
    stubApi(api());
    const user = userEvent.setup();
    const { router } = renderApp(`/p/${PID}/memory?figure=completion`);
    await waitFor(() => expect(rows()).toEqual(['k-001-alpha', 'k-002-beta']));
    expect(router.state.location.href).toBe(`/p/${PID}/memory?figure=completion`);
    await user.click(screen.getByRole('link', { name: /^kind-a,/ }));
    await waitFor(() => expect(router.state.location.search).toEqual({ type: 'kind-a' }));
    expect(router.state.location.href).not.toMatch(/k-00/);
  });

  it('AC-3 a repo refresh — the rows follow the figure of the next state', async () => {
    const fake = api();
    stubApi(fake);
    const { queryClient } = renderApp(`/p/${PID}/memory?figure=pending-gates`);
    await waitFor(() => expect(rows()).toEqual(['m-001-delta', 'g-001-gate']));
    fake[PROGRESS] = {
      status: 200,
      body: progress({ pendingGates: { state: 'shown', count: 1, ids: ['g-001-gate'] } }),
    };
    await act(() => queryClient.invalidateQueries({ queryKey: queryKeys.project(PID) }));
    await waitFor(() => expect(rows()).toEqual(['g-001-gate']));
  });

  it('AC-3 no /progress read without a figure, and none for a plain list (TT-PERF-05)', async () => {
    const fetch = stubApi(api());
    renderApp(`/p/${PID}/memory`);
    await waitFor(() => expect(rows()).toEqual(ALL));
    expect(paths(fetch)).not.toContain(PROGRESS);
  });

  it('AC-3 waits for /progress before showing the rows (no unfiltered flash)', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((r) => (release = r));
    const fake = api();
    const fn = vi.fn(async (url: string) => {
      if (url === PROGRESS) await held;
      const a = fake[url] ?? { status: 404, body: { error: { code: 'not-found', message: 'x' } } };
      return new Response(JSON.stringify(a.body), {
        status: a.status,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fn);
    renderApp(`/p/${PID}/memory?figure=open-defects`);
    await screen.findByText('Loading the Memory list…');
    await waitFor(() => expect(fn.mock.calls.map((c) => String(c[0]))).toContain(LIST));
    expect(screen.queryByRole('list', { name: 'Elements' })).toBeNull();
    release();
    await waitFor(() => expect(rows()).toEqual(['d-001-defect']));
  });
});
