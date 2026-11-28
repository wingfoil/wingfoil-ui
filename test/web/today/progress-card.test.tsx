// @vitest-environment jsdom
// task-065 AC-1, AC-2, US-T-12 … US-T-15, X-10.4 (D65-3 … D65-11; ux-reference §4.1 v0.3; spec-012
// §3) — Today's progress card on the whole application with a stubbed API: its place (greeting, the
// ui.yaml warning, the card, Your roles, Requires you), the scope, the figures as links to the Memory
// list's figure filter, the reasons in place of a figure, the read-only phase figures, the
// completion's explanation on keyboard focus (the shared `web/src/progress/` module), the notes, a
// failed read inside the card, the announcement of a changed figure and the tab title.
import type { ProjectHeader, Progress, Today } from '@wingfoil-ui/contracts';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { progressQuery } from '../../../web/src/api/queries.js';
import { resetSession } from '../../../web/src/session/session.js';
import { header } from '../project/header-data.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';

const PID = 'p_a';
const HEADER = `/api/p/${PID}`;
const TODAY = `/api/p/${PID}/today?view=approver`;
const PROGRESS = `/api/p/${PID}/progress`;

function morgan(over: Partial<ProjectHeader> = {}): ProjectHeader {
  return header({
    identity: { kind: 'member', email: 'morgan@example.test', name: 'Morgan', roles: ['approver', 'tech-lead'] },
    roleViews: ['approver', 'tech-lead'],
    roleView: 'approver',
    ...over,
  });
}

const TODAY_BODY: Today = {
  view: 'approver',
  requiresYou: [],
  waitingOnOthers: [],
  summary: [
    { role: 'approver', count: 0 },
    { role: 'tech-lead', count: 0 },
  ],
};

const NEEDS = { state: 'read-only', reason: { code: 'needs-version', minVersion: '0.3.0' } } as const;

function progress(over: Partial<Progress> = {}, figures: Partial<Progress['figures']> = {}): Progress {
  return {
    ui: { source: 'file' },
    mode: 'sequence',
    scope: {
      type: 'kind-r',
      current: { id: 'minor-v0.1', title: 'Minor v0.1', type: 'kind-r', status: 'planning', tone: 'active' },
      basis: 'derived',
    },
    figures: {
      completion: {
        state: 'shown',
        value: 0.25,
        percent: 25,
        references: [
          { id: 'US-M-01', element: false, done: 1, total: 2, percent: 50 },
          { id: 'US-S-01', element: false, done: 0, total: 1, percent: 0 },
        ],
        referencesCount: 2,
        ids: ['k-001-a', 'k-002-b'],
      },
      phase: NEEDS,
      phaseCompletion: NEEDS,
      iterated: { state: 'shown', type: 'kind-a', done: 1, total: 4, ids: ['k-001-a'], doneIds: [] },
      openDefects: { state: 'shown', type: 'kind-d', count: 1, ids: ['d-001-x'] },
      pendingGates: { state: 'shown', count: 3, ids: ['g-001-x'] },
      ...figures,
    },
    unreadable: [],
    capped: [],
    ...over,
  };
}

function api(body: Progress | null = progress(), over: FakeApi = {}): FakeApi {
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'demo', path: '/x', remote: null, availability: 'available' }] },
    },
    [HEADER]: { status: 200, body: morgan() },
    [TODAY]: { status: 200, body: TODAY_BODY },
    ...(body === null ? {} : { [PROGRESS]: { status: 200, body } }),
    ...over,
  };
}

const card = () => screen.getByRole('region', { name: 'Progress' });
const figures = () => within(card()).getByRole('list', { name: 'Figures' });

/**
 * Hover `el` as a pointer user does: the pointer moves on the page first, so React Aria's
 * interaction modality is `pointer` when the hover starts (its tooltip counts no other hover).
 */
async function hoverAsPointerUser(user: ReturnType<typeof userEvent.setup>, el: HTMLElement): Promise<void> {
  await user.pointer({ target: document.body });
  await user.hover(el);
}

/** Open Today and wait for the progress card's figures. */
async function openCard(): Promise<ReturnType<typeof renderApp>> {
  const app = renderApp(`/p/${PID}/today`);
  await waitFor(() => expect(within(card()).queryByRole('list', { name: 'Figures' })).not.toBeNull());
  return app;
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

describe('AC-1 — the card on Today', () => {
  it('sits after the greeting and the ui.yaml warning, before Your roles and Requires you (Q3 (b)); not a .today-card', async () => {
    stubApi(
      api(
        progress({
          ui: { source: 'ignored', warning: { code: 'ui-config-ignored', failure: 'progress.mode must be x' } },
        }),
      ),
    );
    await openCard();
    await screen.findByRole('region', { name: 'Your roles' });
    const order = [
      screen.getByRole('heading', { level: 1 }),
      document.querySelector<HTMLElement>('.ui-yaml-warning')!,
      card(),
      screen.getByRole('region', { name: 'Your roles' }),
      screen.getByRole('region', { name: 'Requires you' }),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(document.querySelector('.ui-yaml-warning')?.textContent).toBe('ui.yaml ignored: progress.mode must be x');
    expect(card().classList.contains('today-card')).toBe(false);
  });

  it('names the current scope by its id, title and state pill, the id a link to its side panel (D65-4)', async () => {
    stubApi(api());
    await openCard();
    const link = within(card()).getByRole('link', { name: 'minor-v0.1 Minor v0.1' });
    expect(link.getAttribute('href')).toBe(`/p/${PID}/today?panel=minor-v0.1`);
    expect(within(card()).getByText('planning').classList.contains('state-pill')).toBe(true);
  });

  it('says "No current <type>" without a current element and "Whole project" without a scope type', async () => {
    stubApi(api(progress({ scope: { type: 'release', current: null, basis: null } })));
    const first = await openCard();
    expect(within(card()).getByText('No current release')).toBeTruthy();
    first.unmount();
    cleanup();
    stubApi(api(progress({ mode: 'flow', scope: { type: null, current: null, basis: null } })));
    await openCard();
    expect(within(card()).getByText('Whole project')).toBeTruthy();
  });

  it('shows every shown figure as a link to the Memory list’s figure filter, in the order of §4.1 (Q2 (b))', async () => {
    stubApi(api());
    await openCard();
    const items = within(figures())
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(items).toEqual([
      'Project completion 25 %',
      'Phase — needs WingFoil 0.3 (this project: 0.2.2)',
      'Phase completion — needs WingFoil 0.3',
      'Iterated: kind-a 1/4',
      'Open: kind-d 1',
      'Pending gates 3',
    ]);
    for (const [name, code] of [
      ['Project completion 25 %', 'completion'],
      ['Iterated: kind-a 1/4', 'iterated'],
      ['Open: kind-d 1', 'open-defects'],
      ['Pending gates 3', 'pending-gates'],
    ] as const) {
      expect(within(figures()).getByRole('link', { name }).getAttribute('href')).toBe(
        `/p/${PID}/memory?figure=${code}`,
      );
    }
    // The read-only figures are texts, never links.
    expect(within(figures()).getAllByRole('link')).toHaveLength(4);
  });

  it('shows the reason of an unavailable completion in its place, not a link (T-12.2, T-12.6)', async () => {
    stubApi(api(progress({}, { completion: { state: 'unavailable', reason: { code: 'no-reference-categories' } } })));
    const first = await openCard();
    const item = within(figures()).getAllByRole('listitem')[0]!;
    expect(item.textContent).toBe('Completion needs references — see Configuration › Taxonomy');
    expect(within(item).getByRole('link', { name: 'Configuration › Taxonomy' }).getAttribute('href')).toBe(
      `/p/${PID}/configuration/taxonomy`,
    );
    expect(within(figures()).queryByRole('link', { name: /^Project completion/ })).toBeNull();
    first.unmount();
    cleanup();
    stubApi(api(progress({}, { completion: { state: 'unavailable', reason: { code: 'no-linked-elements' } } })));
    await openCard();
    expect(within(figures()).getAllByRole('listitem')[0]!.textContent).toBe('No references linked in minor-v0.1');
  });

  it('leaves out an unavailable iterated or open-defects figure (Q7 (a))', async () => {
    stubApi(
      api(
        progress(
          {},
          {
            iterated: { state: 'unavailable', reason: { code: 'no-iterates-type' } },
            openDefects: { state: 'unavailable', reason: { code: 'no-defects-type' } },
          },
        ),
      ),
    );
    await openCard();
    expect(within(figures()).queryByText(/^Iterated/)).toBeNull();
    expect(within(figures()).queryByText(/^Open:/)).toBeNull();
    expect(within(figures()).getByRole('link', { name: 'Pending gates 3' })).toBeTruthy();
  });

  it('names the unreadable and capped elements in notes', async () => {
    stubApi(api(progress({ unreadable: ['k-009-x', 'k-010-y'], capped: ['k-011-z'] })));
    await openCard();
    expect(
      within(card()).getByText('2 elements could not be read: the figures leave them out — k-009-x, k-010-y'),
    ).toBeTruthy();
    expect(within(card()).getByText('1 element was counted on its first 200 values only — k-011-z')).toBeTruthy();
  });

  it('shows a failed read as an error inside the card, the rest of Today still shown', async () => {
    stubApi(
      api(null, {
        [PROGRESS]: {
          status: 502,
          body: { error: { code: 'read-error', message: 'x', detail: { file: '.wingfoil/memory.yaml' } } },
        },
      }),
    );
    renderApp(`/p/${PID}/today`);
    await waitFor(() => expect(within(card()).getByRole('alert')).toBeTruthy());
    expect(within(card()).queryByRole('list', { name: 'Figures' })).toBeNull();
    expect(await screen.findByRole('region', { name: 'Requires you' })).toBeTruthy();
  });

  it('announces a changed figure once, politely, and not a refetch with the same figures', async () => {
    stubApi(api());
    const { queryClient } = await openCard();
    const status = screen.getByRole('status', { name: 'Progress updates' });
    expect(status.textContent).toBe('');
    act(() => {
      queryClient.setQueryData(progressQuery(PID).queryKey, progress());
    });
    expect(status.textContent).toBe('');
    act(() => {
      queryClient.setQueryData(
        progressQuery(PID).queryKey,
        progress({}, { pendingGates: { state: 'shown', count: 2, ids: ['g-001-x'] } }),
      );
    });
    await waitFor(() => expect(status.textContent).toBe('Progress updated: Pending gates 2'));
  });

  it('announces a figure turned into its reason, a scope change, and a figure that left (review round 1, F-2)', async () => {
    stubApi(api());
    const { queryClient } = await openCard();
    const status = screen.getByRole('status', { name: 'Progress updates' });
    act(() => {
      queryClient.setQueryData(
        progressQuery(PID).queryKey,
        progress({}, { completion: { state: 'unavailable', reason: { code: 'no-linked-elements' } } }),
      );
    });
    await waitFor(() => expect(status.textContent).toBe('Progress updated: No references linked in minor-v0.1'));
    act(() => {
      queryClient.setQueryData(
        progressQuery(PID).queryKey,
        progress(
          {
            scope: {
              type: 'kind-r',
              current: {
                id: 'minor-v0.2',
                title: 'Minor v0.2',
                type: 'kind-r',
                status: 'in-development',
                tone: 'active',
              },
              basis: 'derived',
            },
          },
          { completion: { state: 'unavailable', reason: { code: 'no-linked-elements' } } },
        ),
      );
    });
    await waitFor(() =>
      expect(status.textContent).toBe(
        'Progress updated: minor-v0.2 Minor v0.2, in-development, No references linked in minor-v0.2',
      ),
    );
    act(() => {
      queryClient.setQueryData(
        progressQuery(PID).queryKey,
        progress(
          {
            scope: {
              type: 'kind-r',
              current: {
                id: 'minor-v0.2',
                title: 'Minor v0.2',
                type: 'kind-r',
                status: 'in-development',
                tone: 'active',
              },
              basis: 'derived',
            },
          },
          {
            completion: { state: 'unavailable', reason: { code: 'no-linked-elements' } },
            iterated: { state: 'unavailable', reason: { code: 'no-iterates-type' } },
          },
        ),
      );
    });
    await waitFor(() => expect(status.textContent).toBe('Progress updated'));
  });

  it('announces a no-linked completion with no current element as the project (task-067 review round 2, R2-1)', async () => {
    stubApi(api());
    const { queryClient } = await openCard();
    const status = screen.getByRole('status', { name: 'Progress updates' });
    act(() => {
      queryClient.setQueryData(
        progressQuery(PID).queryKey,
        progress(
          { scope: { type: null, current: null, basis: null } },
          { completion: { state: 'unavailable', reason: { code: 'no-linked-elements' } } },
        ),
      );
    });
    await waitFor(() => expect(status.textContent).toContain('No references linked in the project'));
    expect(status.textContent).not.toMatch(/linked in ,|linked in $/);
  });

  it('announces nothing when only the header’s version arrives after the figures (gates run 43863969804)', async () => {
    // The progress read answers before the project header: the phase text gains "(this project:
    // 0.2.2)" once the header is read — not a change of the figures.
    const fetch = stubApi(api());
    const answer = fetch.getMockImplementation() as (url: string) => Promise<Response>;
    let release: () => void = () => undefined;
    const header = new Promise<void>((r) => {
      release = r;
    });
    fetch.mockImplementation(async (url: string) => {
      if (url === HEADER) await header;
      return answer(url);
    });
    renderApp(`/p/${PID}/today`);
    await waitFor(() => expect(within(card()).queryByRole('list', { name: 'Figures' })).not.toBeNull());
    const status = screen.getByRole('status', { name: 'Progress updates' });
    release();
    await waitFor(() =>
      expect(within(figures()).getAllByRole('listitem')[1]!.textContent).toBe(
        'Phase — needs WingFoil 0.3 (this project: 0.2.2)',
      ),
    );
    expect(status.textContent).toBe('');
  });

  it('names no project version in the phase text until the header is read (review round 2, R2-1)', async () => {
    const fetch = stubApi(api());
    const answer = fetch.getMockImplementation() as (url: string) => Promise<Response>;
    fetch.mockImplementation((url: string) => (url === HEADER ? new Promise<Response>(() => undefined) : answer(url)));
    renderApp(`/p/${PID}/today`);
    await waitFor(() => expect(within(card()).queryByRole('list', { name: 'Figures' })).not.toBeNull());
    expect(within(figures()).getAllByRole('listitem')[1]!.textContent).toBe('Phase — needs WingFoil 0.3');
  });

  it('marks the announced texts as a list of message elements (`.intl-list`, X-09.1)', async () => {
    stubApi(api());
    const { queryClient } = await openCard();
    act(() => {
      queryClient.setQueryData(
        progressQuery(PID).queryKey,
        progress({}, { pendingGates: { state: 'shown', count: 2, ids: ['g-001-x'] } }),
      );
    });
    const status = screen.getByRole('status', { name: 'Progress updates' });
    await waitFor(() => expect(status.querySelector('.intl-list')?.textContent).toBe('Pending gates 2'));
  });

  it('shows its loading status until /progress answers (review round 1, F-5)', async () => {
    const fetch = stubApi(api(null));
    const answer = fetch.getMockImplementation() as (url: string) => Promise<Response>;
    fetch.mockImplementation((url: string) =>
      url === PROGRESS ? new Promise<Response>(() => undefined) : answer(url),
    );
    renderApp(`/p/${PID}/today`);
    await waitFor(() => expect(within(card()).getByText('Reading the progress…').getAttribute('role')).toBe('status'));
    expect(within(card()).queryByRole('list', { name: 'Figures' })).toBeNull();
  });
});

describe('US-T-15 — the read-only phase figures', () => {
  for (const [reason, phase, phaseCompletion] of [
    [
      { code: 'not-in-release' },
      'Phase — comes with a later WingFoil UI release',
      'Phase completion — comes with a later WingFoil UI release',
    ],
    [
      { code: 'unsupported-version', range: { min: '0.2.2', max: '0.3.x' } },
      'Phase — supported 0.2.2 to 0.3.x',
      'Phase completion — supported 0.2.2 to 0.3.x',
    ],
    [{ code: 'not-released' }, 'Phase — in no released WingFoil yet', 'Phase completion — in no released WingFoil yet'],
  ] as const) {
    it(`renders the ${reason.code} reason`, async () => {
      const figure = { state: 'read-only', reason } as Progress['figures']['phase'];
      stubApi(api(progress({}, { phase: figure, phaseCompletion: figure })));
      await openCard();
      const items = within(figures())
        .getAllByRole('listitem')
        .map((li) => li.textContent);
      expect(items[1]).toBe(phase);
      expect(items[2]).toBe(phaseCompletion);
    });
  }
});

describe('US-T-14 — the completion explanation (web/src/progress/)', () => {
  it('opens on keyboard focus as the figure’s accessible description; Escape closes it', async () => {
    stubApi(api());
    const user = userEvent.setup();
    await openCard();
    const link = within(figures()).getByRole('link', { name: 'Project completion 25 %' });
    const text =
      'Mean of reference completion over 2 references with at least 1 linked element: US-M-01 50 %, US-S-01 0 %';
    for (let i = 0; i < 60 && document.activeElement !== link; i++) await user.tab();
    expect(document.activeElement).toBe(link);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toBe(text);
    const described = (link.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent)
      .join(' ');
    expect(described).toBe(text);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('opens on hover and closes when the pointer leaves (T-14.1; gates run 43853390662: no tooltip on hover)', async () => {
    stubApi(api());
    const user = userEvent.setup();
    await openCard();
    const link = within(figures()).getByRole('link', { name: 'Project completion 25 %' });
    await hoverAsPointerUser(user, link);
    expect((await screen.findByRole('tooltip')).textContent).toBe(
      'Mean of reference completion over 2 references with at least 1 linked element: US-M-01 50 %, US-S-01 0 %',
    );
    await user.unhover(link);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('renders each reference of the explanation as its own message element (X-09.1; gates run 43856118608)', async () => {
    stubApi(api());
    const user = userEvent.setup();
    await openCard();
    await hoverAsPointerUser(user, within(figures()).getByRole('link', { name: 'Project completion 25 %' }));
    const tooltip = await screen.findByRole('tooltip');
    expect([...tooltip.querySelectorAll('.progress-reference')].map((el) => el.textContent)).toEqual([
      'US-M-01 50 %',
      'US-S-01 0 %',
    ]);
  });

  it('says "1 reference" in the singular (review round 1, F-5)', async () => {
    stubApi(
      api(
        progress(
          {},
          {
            completion: {
              state: 'shown',
              value: 0.5,
              percent: 50,
              references: [{ id: 'US-M-01', element: false, done: 1, total: 2, percent: 50 }],
              referencesCount: 1,
              ids: ['k-001-a'],
            },
          },
        ),
      ),
    );
    const user = userEvent.setup();
    await openCard();
    await hoverAsPointerUser(user, within(figures()).getByRole('link', { name: 'Project completion 50 %' }));
    expect((await screen.findByRole('tooltip')).textContent).toBe(
      'Mean of reference completion over 1 reference with at least 1 linked element: US-M-01 50 %',
    );
  });

  it('says "and <n> more" past the listed references', async () => {
    const references = Array.from({ length: 10 }, (_, i) => ({
      id: `US-${String(i + 1).padStart(2, '0')}`,
      done: 1,
      total: 1,
      percent: 100,
    }));
    stubApi(
      api(
        progress(
          {},
          {
            completion: {
              state: 'shown',
              value: 1,
              percent: 100,
              references,
              referencesCount: 13,
              ids: ['k-001-a'],
            },
          },
        ),
      ),
    );
    const user = userEvent.setup();
    await openCard();
    const link = within(figures()).getByRole('link', { name: 'Project completion 100 %' });
    for (let i = 0; i < 60 && document.activeElement !== link; i++) await user.tab();
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toBe(
      `Mean of reference completion over 13 references with at least 1 linked element: ${references
        .map((r) => `${r.id} 100 %`)
        .join(', ')}, and 3 more`,
    );
  });
});

describe('X-10.4 — the completion in the tab title (Q4 (a): Today only)', () => {
  it('"<project> · <n> % · Today" when the completion is shown', async () => {
    stubApi(api());
    await openCard();
    await waitFor(() => expect(document.title).toBe('demo · 25 % · Today — WingFoil UI'));
  });

  it('no percentage when the completion is not shown', async () => {
    stubApi(api(progress({}, { completion: { state: 'unavailable', reason: { code: 'no-linked-elements' } } })));
    await openCard();
    await waitFor(() => expect(document.title).toBe('demo · Today — WingFoil UI'));
  });
});
