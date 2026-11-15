// @vitest-environment jsdom
// task-066 — the Memory list's v0.3 filters at component level, on the whole application with a
// stubbed API (ux-reference §4.4 v0.3; D66-3 … D66-7): AC-1 the states of a bucket as sub-options
// (N7), kept in the URL; AC-2 the filter "Missing required references" with its count from the
// server's flags, the badge "missing refs" and its description, the notes of `unreadable` and
// `capped`; the active filter and its *Clear filter* (focus on the heading).
import type { Bucket, ElementList, ListedElement, ProjectConfig, UiCategory, UiConfig } from '@wingfoil-ui/contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keyCatalogue } from '../../../web/scripts/catalogue.mjs';
import { stopEventStream } from '../../../web/src/api/events.js';
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
  bucket: Bucket,
  extra: { tone?: string; missing?: UiCategory[] } = {},
): ListedElement {
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
      tone: (extra.tone ?? 'neutral') as 'neutral',
      bucket,
      verbs: [],
      actor: { kind: 'none' },
    },
    ...(extra.missing ? { missingCategories: extra.missing } : {}),
  };
}

const ELEMENTS: ListedElement[] = [
  el('k-001-alpha', 'kind-a', 's2', 'to-approve', { tone: 'human', missing: ['requirement'] }),
  el('k-002-beta', 'kind-a', 's1', 'waiting'),
  el('m-001-delta', 'kind-m', 'm1', 'waiting', { missing: ['requirement', 'feature'] }),
  el('m-002-eps', 'kind-m', 's1', 'waiting'),
  el('z-001-stray', 'kind-z', 'q', 'waiting', { tone: 'active' }),
  el('k-003-gamma', 'kind-a', 's3', 'done', { tone: 'done' }),
];

function list(over: Partial<ElementList> = {}): ElementList {
  return {
    elements: ELEMENTS,
    warnings: [],
    missingReferences: { shown: true, unreadable: [], capped: [] },
    ...over,
  };
}

function ui(requires: string[]): UiConfig {
  const valued = <T,>(value: T) => ({ value, origin: 'declared' as const });
  return {
    status: { source: 'file' },
    taxonomy: {
      categories: [],
      patterns: valued([]),
      requires: valued(requires.map((type) => ({ type, categories: ['requirement' as const] }))),
    },
    progress: {
      mode: valued('sequence' as const),
      scope: { ...valued(null), current: null },
      phases: valued([]),
      iterates: valued(null),
      defects: valued(null),
    },
    holds: valued([]),
    artifacts: valued([]),
  };
}

function config(requires: string[] = ['kind-a', 'kind-m']): ProjectConfig {
  return {
    dna: { error: { code: 'internal', message: 'x' } },
    paths: { error: { code: 'internal', message: 'x' } },
    workflows: { error: { code: 'internal', message: 'x' } },
    types: {
      data: {
        version: 1,
        types: {
          'kind-a': { path: 'a/{id}.md', states: { sequence: ['s1', 's2', 's3'] } },
          'kind-m': { path: 'm/{id}.md', states: { sequence: ['m1', 's1'] } },
          'kind-e': { path: 'e/{id}.md', states: { sequence: ['e1'] } },
        },
      },
    },
    ui: ui(requires),
  };
}

function api(over: FakeApi = {}): FakeApi {
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'demo', path: '/x', remote: null, availability: 'available' }] },
    },
    [CONFIG]: { status: 200, body: config() },
    [LIST]: { status: 200, body: list() },
    [ARCHIVED]: { status: 200, body: list() },
    ...over,
  };
}

function linksOf(name: string): string[] {
  return within(screen.getByRole('list', { name }))
    .getAllByRole('link')
    .map((a) => a.textContent ?? '');
}

function rows(): string[] {
  return within(screen.getByRole('list', { name: 'Elements' }))
    .queryAllByRole('link')
    .map((a) => a.dataset['eid'] ?? '');
}

const MISSING = 'Missing required references';

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

describe('AC-1 — the states of a bucket (N7)', () => {
  it('lists the states of the selected bucket by name with counts, a shared name once, in D66-3 order', async () => {
    stubApi(api());
    const user = userEvent.setup();
    const { router } = renderApp(`/p/${PID}/memory`);
    await screen.findByText('Title of k-001-alpha');
    // No bucket selected: no sub-row.
    expect(screen.queryByRole('list', { name: /^In / })).toBeNull();
    await user.click(screen.getByRole('link', { name: /^Waiting\/drafts\/closed,/ }));
    await waitFor(() => expect(rows()).toEqual(['k-002-beta', 'm-001-delta', 'm-002-eps', 'z-001-stray']));
    expect(router.state.location.search).toEqual({ bucket: 'waiting' });
    // kind-a's sequence (s1), kind-m's (m1; s1 already listed), then the undeclared type's q.
    expect(linksOf('In Waiting/drafts/closed')).toEqual(['s12', 'm11', 'q1']);
    // The v0.1 state row is unchanged.
    expect(linksOf('States')).toEqual([
      'All states6',
      'To approve1',
      'In progress0',
      'Waiting/drafts/closed4',
      'Done1',
    ]);
  });

  it('narrows the bucket to one state, keeps both in the URL, names the active filter and restores it on a new load', async () => {
    stubApi(api());
    const user = userEvent.setup();
    const { router } = renderApp(`/p/${PID}/memory?bucket=waiting`);
    const sub = await screen.findByRole('list', { name: 'In Waiting/drafts/closed' });
    await user.click(within(sub).getByRole('link', { name: 's1, 2 elements' }));
    await waitFor(() => expect(rows()).toEqual(['k-002-beta', 'm-002-eps']));
    expect(router.state.location.search).toEqual({ bucket: 'waiting', state: 's1' });
    expect(within(sub).getByRole('link', { name: 's1, 2 elements' }).getAttribute('aria-current')).toBe('page');
    const active = screen.getByRole('group', { name: 'Active filter' });
    expect(active.querySelector('.memory-active-name')?.textContent).toBe('Waiting/drafts/closed · s1');
    cleanup();
    stopEventStream();
    renderApp(`/p/${PID}/memory?bucket=waiting&state=s1`);
    await waitFor(() => expect(rows()).toEqual(['k-002-beta', 'm-002-eps']));
    expect(screen.getByRole('group', { name: 'Active filter' }).textContent).toContain('Waiting/drafts/closed · s1');
  });

  it('names a bucket alone as the active filter; a state the bucket no longer holds lists nothing', async () => {
    stubApi(api());
    renderApp(`/p/${PID}/memory?bucket=done&state=s1`);
    await screen.findByText('No element matches these filters.');
    expect(screen.getByRole('group', { name: 'Active filter' }).textContent).toContain('Done · s1');
    cleanup();
    stopEventStream();
    renderApp(`/p/${PID}/memory?bucket=done`);
    await waitFor(() => expect(rows()).toEqual(['k-003-gamma']));
    expect(screen.getByRole('group', { name: 'Active filter' }).querySelector('.memory-active-name')?.textContent).toBe(
      'Done',
    );
  });

  it('clears the active filter to the bare list and moves the focus to the heading', async () => {
    stubApi(api());
    const user = userEvent.setup();
    const { router } = renderApp(`/p/${PID}/memory?bucket=waiting&state=s1`);
    await waitFor(() => expect(rows()).toEqual(['k-002-beta', 'm-002-eps']));
    // Not the current page: it leads elsewhere (review round 1, F-1).
    expect(screen.getByRole('link', { name: 'Clear filter' }).hasAttribute('aria-current')).toBe(false);
    await user.click(screen.getByRole('link', { name: 'Clear filter' }));
    await waitFor(() => expect(rows()).toHaveLength(6));
    expect(router.state.location.search).toEqual({});
    expect(screen.queryByRole('group', { name: 'Active filter' })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Memory' })));
  });

  it('drops a state with neither type nor bucket; with a type, the state filters and no active filter are v0.1', async () => {
    stubApi(api());
    renderApp(`/p/${PID}/memory?state=s1`);
    await waitFor(() => expect(rows()).toHaveLength(6));
    expect(screen.queryByRole('group', { name: 'Active filter' })).toBeNull();
    cleanup();
    stopEventStream();
    renderApp(`/p/${PID}/memory?type=kind-a&state=s1`);
    await waitFor(() => expect(rows()).toEqual(['k-002-beta']));
    expect(linksOf('States')).toEqual(['All states3', 's11', 's21', 's31']);
    expect(screen.queryByRole('group', { name: 'Active filter' })).toBeNull();
    expect(screen.queryByRole('list', { name: /^In / })).toBeNull();
  });
});

describe('AC-2 — missing required references (M2)', () => {
  it('offers the filter with its count, lists the flagged rows, keeps it in the URL and names it as the active filter', async () => {
    stubApi(api());
    const user = userEvent.setup();
    const { router } = renderApp(`/p/${PID}/memory`);
    await screen.findByText('Title of k-001-alpha');
    expect(linksOf('Reference filters')).toEqual([`${MISSING}2`]);
    await user.click(screen.getByRole('link', { name: `${MISSING}, 2 elements` }));
    await waitFor(() => expect(rows()).toEqual(['k-001-alpha', 'm-001-delta']));
    expect(router.state.location.search).toEqual({ missing: 'refs' });
    expect(screen.getByRole('link', { name: `${MISSING}, 2 elements` }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('group', { name: 'Active filter' }).querySelector('.memory-active-name')?.textContent).toBe(
      MISSING,
    );
  });

  it('shows the count 0 when nothing is missing (TQ-5 (a), M-04.3)', async () => {
    stubApi(
      api({ [LIST]: { status: 200, body: list({ elements: ELEMENTS.map(({ missingCategories: _, ...e }) => e) }) } }),
    );
    renderApp(`/p/${PID}/memory`);
    await screen.findByText('Title of k-001-alpha');
    expect(screen.getByRole('link', { name: `${MISSING}, 0 elements` })).toBeTruthy();
  });

  it('hides the filter when nothing is required, when the server sends no flag section, and with typesError', async () => {
    const bodies: ElementList[] = [
      list({ missingReferences: { shown: false, unreadable: [], capped: [] } }),
      (({ missingReferences: _, ...rest }) => rest)(list()),
      (({ missingReferences: _, ...rest }) => ({ ...rest, typesError: { code: 'read-error', message: 'x' } }))(list()),
    ];
    for (const body of bodies) {
      stubApi(api({ [LIST]: { status: 200, body } }));
      renderApp(`/p/${PID}/memory`);
      await screen.findByText('Title of k-001-alpha');
      expect(screen.queryByRole('list', { name: 'Reference filters' })).toBeNull();
      expect(screen.queryByText(MISSING)).toBeNull();
      cleanup();
      stopEventStream();
    }
  });

  it('with a type, offers the filter only when requires names that type, counting its rows', async () => {
    stubApi(api({ [CONFIG]: { status: 200, body: config(['kind-m']) } }));
    const user = userEvent.setup();
    const { router } = renderApp(`/p/${PID}/memory?type=kind-m`);
    await waitFor(() => expect(rows()).toEqual(['m-001-delta', 'm-002-eps']));
    await user.click(await screen.findByRole('link', { name: `${MISSING}, 1 element` }));
    await waitFor(() => expect(rows()).toEqual(['m-001-delta']));
    expect(router.state.location.search).toEqual({ type: 'kind-m', missing: 'refs' });
    await user.click(screen.getByRole('link', { name: /^kind-a,/ }));
    await waitFor(() => expect(rows()).toEqual(['k-001-alpha', 'k-002-beta', 'k-003-gamma']));
    expect(screen.queryByRole('list', { name: 'Reference filters' })).toBeNull();
  });

  it('is exclusive with a bucket: missing=refs wins, the bucket link is not current', async () => {
    stubApi(api());
    renderApp(`/p/${PID}/memory?missing=refs&bucket=done`);
    await waitFor(() => expect(rows()).toEqual(['k-001-alpha', 'm-001-delta']));
    expect(screen.getByRole('group', { name: 'Active filter' }).querySelector('.memory-active-name')?.textContent).toBe(
      MISSING,
    );
    expect(screen.queryByRole('list', { name: /^In / })).toBeNull();
    expect(screen.getByRole('link', { name: /^Done,/ }).getAttribute('aria-current')).toBeNull();
  });

  it('badges every flagged row whatever the filter, its description naming the missing categories', async () => {
    stubApi(api());
    renderApp(`/p/${PID}/memory`);
    await screen.findByText('Title of k-001-alpha');
    const flagged = document.querySelector<HTMLElement>('.memory-row[data-eid="m-001-delta"]')!;
    const badge = flagged.querySelector('.memory-badge-missing')!;
    expect(badge.textContent).toBe('missing refs');
    expect(badge.getAttribute('title')).toBe('Missing required references: requirement and feature');
    const described = document.getElementById(flagged.getAttribute('aria-describedby') ?? '');
    expect(described?.textContent).toBe('Missing required references: requirement and feature');
    const plain = document.querySelector<HTMLElement>('.memory-row[data-eid="k-002-beta"]')!;
    expect(plain.querySelector('.memory-badge-missing')).toBeNull();
    expect(plain.hasAttribute('aria-describedby')).toBe(false);
    expect(document.querySelectorAll('.memory-badge-missing')).toHaveLength(2);
  });

  it('names the elements whose file was not read and those checked on their first 200 values only', async () => {
    stubApi(
      api({
        [LIST]: {
          status: 200,
          body: list({
            missingReferences: { shown: true, unreadable: ['x-001-broken'], capped: ['y-001-big', 'y-002-big'] },
          }),
        },
      }),
    );
    renderApp(`/p/${PID}/memory`);
    await screen.findByText('Title of k-001-alpha');
    expect(screen.getByText('1 element could not be read: its references are not checked — x-001-broken')).toBeTruthy();
    expect(
      screen.getByText('2 elements were checked on their first 200 values only — y-001-big and y-002-big'),
    ).toBeTruthy();
  });

  it('shows only catalogue keys with the key catalogue (spec-008 §6)', async () => {
    stubApi(
      api({
        [LIST]: {
          status: 200,
          body: list({ missingReferences: { shown: true, unreadable: ['x-001-broken'], capped: ['y-001-big'] } }),
        },
      }),
    );
    renderApp(`/p/${PID}/memory?bucket=waiting&state=s1`, keyCatalogue(en));
    await screen.findByText('memory.filter.missing');
    expect(screen.getByText('memory.filter.missing')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'memory.active.label' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'memory.filter.bucketStates memory.bucket.waiting' })).toBeTruthy();
    expect(screen.getByText('memory.active.clear')).toBeTruthy();
    expect(document.querySelector('.memory-active-name')?.textContent).toBe(
      'memory.active.bucketState memory.bucket.waiting s1',
    );
  });
});

describe('review round 1', () => {
  it('F-2, F-4 — ignores missing=refs where the filter is not offered: rows, active filter and notes', async () => {
    const notes = { unreadable: ['x-001-broken'], capped: ['y-001-big'] };
    const cases: [string, FakeApi][] = [
      [
        '/memory?missing=refs',
        { [LIST]: { status: 200, body: list({ missingReferences: { shown: false, ...notes } }) } },
      ],
      [
        '/memory?missing=refs',
        { [LIST]: { status: 200, body: (({ missingReferences: _, ...rest }) => rest)(list()) } },
      ],
      [
        '/memory?missing=refs',
        {
          [LIST]: {
            status: 200,
            body: (({ missingReferences: _, ...rest }) => ({
              ...rest,
              typesError: { code: 'read-error', message: 'x' },
            }))(list()),
          },
        },
      ],
      [
        '/memory?type=kind-a&missing=refs',
        {
          [CONFIG]: { status: 200, body: config(['kind-m']) },
          [LIST]: { status: 200, body: list({ missingReferences: { shown: true, ...notes } }) },
        },
      ],
    ];
    for (const [path, over] of cases) {
      stubApi(api(over));
      renderApp(`/p/${PID}${path}`);
      await screen.findByText('Title of k-001-alpha');
      const expected = path.includes('type=')
        ? ['k-001-alpha', 'k-002-beta', 'k-003-gamma']
        : ELEMENTS.map((e) => e.id);
      await waitFor(() => expect(rows()).toEqual(expected));
      expect(screen.queryByRole('group', { name: 'Active filter' })).toBeNull();
      expect(screen.queryByText(/references are not checked|first 200 values/)).toBeNull();
      cleanup();
      stopEventStream();
    }
  });

  it('F-5 — marks the filters the list applies as current, whatever else the address carries', async () => {
    stubApi(api());
    renderApp(`/p/${PID}/memory?type=kind-a&bucket=done&figure=bogus`);
    await waitFor(() => expect(rows()).toEqual(['k-001-alpha', 'k-002-beta', 'k-003-gamma']));
    expect(screen.getByRole('link', { name: /^kind-a,/ }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: /^All types,/ }).hasAttribute('aria-current')).toBe(false);
    cleanup();
    stopEventStream();
    renderApp(`/p/${PID}/memory?missing=refs&bucket=done&panel=`);
    await waitFor(() => expect(rows()).toEqual(['k-001-alpha', 'm-001-delta']));
    expect(screen.getByRole('link', { name: `${MISSING}, 2 elements` }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: /^Done,/ }).hasAttribute('aria-current')).toBe(false);
  });

  it('F-5 — marks a bucket "true" while one of its states is selected, the state "page"', async () => {
    stubApi(api());
    renderApp(`/p/${PID}/memory?bucket=waiting&state=s1`);
    const sub = await screen.findByRole('list', { name: 'In Waiting/drafts/closed' });
    expect(screen.getByRole('link', { name: /^Waiting\/drafts\/closed,/ }).getAttribute('aria-current')).toBe('true');
    expect(within(sub).getByRole('link', { name: 's1, 2 elements' }).getAttribute('aria-current')).toBe('page');
    expect(within(sub).getByRole('link', { name: 'm1, 1 element' }).hasAttribute('aria-current')).toBe(false);
  });
});

describe('review round 2', () => {
  it('R2-1 — a type with missing=refs waits for /config before showing rows (no unfiltered flash)', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((r) => (release = r));
    const fake = api({ [CONFIG]: { status: 200, body: config(['kind-m']) } });
    const fn = vi.fn(async (url: string) => {
      if (url === CONFIG) await held;
      const a = fake[url] ?? { status: 404, body: { error: { code: 'not-found', message: 'x' } } };
      return new Response(JSON.stringify(a.body), {
        status: a.status,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fn);
    renderApp(`/p/${PID}/memory?type=kind-m&missing=refs`);
    await screen.findByText('Loading the Memory list…');
    await waitFor(() => expect(fn.mock.calls.map((c) => String(c[0]))).toContain(LIST));
    expect(screen.queryByRole('list', { name: 'Elements' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Active filter' })).toBeNull();
    release();
    await waitFor(() => expect(rows()).toEqual(['m-001-delta']));
    expect(screen.getByRole('group', { name: 'Active filter' }).querySelector('.memory-active-name')?.textContent).toBe(
      MISSING,
    );
  });
});
