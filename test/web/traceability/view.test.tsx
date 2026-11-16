// @vitest-environment jsdom
// task-067 — the Traceability page at component level, on the whole application with a stubbed API
// (ux-reference §4.8 v0.3; spec-012 §4; D67-1 … D67-12, D67-14): the sidebar entry and the route,
// the table (columns, the element and pattern reference cells, chips with their names, tooltips on
// focus closed with Escape, the completion text), the figures, the scope, category and status
// filters as `aria-pressed` groups kept in the URL, the search, the polite row count after a filter
// change, the empty states and *Clear filters*, a failed read as an error, the ui.yaml warning and
// note with *Use preset* (Q3 (a)), the missing-references section and the notices. The inline detail
// and the refresh are task-081's (W3-3).
import type { ProjectHeader, Traceability, TraceabilityElement, TraceabilityReference } from '@wingfoil-ui/contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { resetSession } from '../../../web/src/session/session.js';
import { BO, header, OUTSIDER } from '../dna/data.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';

const PID = 'p_fx';
const BASE = `/api/p/${PID}`;
const CURRENT = `${BASE}/traceability?scope=current`;
const PROJECT = `${BASE}/traceability?scope=project`;
const PAGE = `/p/${PID}/traceability`;

function el(
  id: string,
  shortId: string,
  title: string,
  status: string,
  tone: 'done' | 'human' | 'neutral',
  done = false,
): TraceabilityElement {
  return {
    path: `docs/${id}.md`,
    id,
    shortId,
    title,
    type: id.split('-')[0] ?? 'x',
    status,
    tags: [],
    localChanges: false,
    descriptor: { id, type: 'x', status, kind: done ? 'last' : 'work', tone, verbs: [], actor: { kind: 'none' } },
    done,
    inScope: true,
  };
}

const ELEMENTS: TraceabilityElement[] = [
  el('dl-001-first-decision', 'dl-001', 'First decision', 's-ok', 'done', true),
  el('k-002-memory-list', 'k-002', 'Memory list', 's-done', 'done', true),
  el('k-003-element-panel', 'k-003', 'Element panel', 's-open', 'human'),
  el('k-004-themes', 'k-004', 'Themes', 's-open', 'neutral'),
];

function ref(id: string, extra: Partial<TraceabilityReference>): TraceabilityReference {
  return {
    id,
    category: 'requirement',
    element: false,
    linked: [],
    done: 0,
    total: 0,
    percent: null,
    status: 'not-started',
    ...extra,
  };
}

const REFERENCES: TraceabilityReference[] = [
  ref('dl-001-first-decision', {
    category: 'decision',
    element: true,
    linked: ['k-004-themes'],
    total: 1,
    percent: 0,
  }),
  ref('US-M-01', {
    linked: ['k-002-memory-list', 'k-003-element-panel'],
    done: 1,
    total: 2,
    percent: 50,
    status: 'in-progress' as TraceabilityReference['status'],
  }),
  ref('US-S-01', { linked: ['k-004-themes'], total: 1, percent: 0 }),
];

function answer(over: Partial<Traceability> = {}): Traceability {
  return {
    ui: { source: 'file' },
    patterns: true,
    scope: {
      type: 'release',
      current: { id: 'minor-v0.1', title: 'Minor', type: 'release', status: 'planning', tone: 'active' },
      applied: 'current',
    },
    figures: {
      completion: {
        state: 'shown',
        value: 0.25,
        percent: 25,
        references: [
          { id: 'US-M-01', done: 1, total: 2, percent: 50 },
          { id: 'US-S-01', done: 0, total: 1, percent: 0 },
        ],
        referencesCount: 2,
        ids: ['k-002-memory-list', 'k-003-element-panel', 'k-004-themes'],
      },
      phaseCompletion: { state: 'read-only', reason: { code: 'not-in-release' } },
      coverage: { state: 'shown', carrying: 3, total: 5, percent: 60 },
      referencesWithoutElements: 0,
    },
    references: REFERENCES,
    missing: [{ id: 'k-004-themes', categories: ['requirement'] }],
    elements: ELEMENTS,
    unreadable: [],
    capped: [],
    ...over,
  };
}

function api(over: FakeApi = {}, who: ProjectHeader = header(BO)): FakeApi {
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'demo', path: '/x', remote: null, availability: 'available' }] },
    },
    [BASE]: { status: 200, body: who },
    [CURRENT]: { status: 200, body: answer() },
    [PROJECT]: {
      status: 200,
      body: answer({
        scope: { ...answer().scope, applied: 'project' },
        references: [
          ...REFERENCES,
          ref('US-S-09', { linked: ['dl-001-first-decision'], done: 1, total: 1, percent: 100, status: 'completed' }),
          ref('US-X-01', { status: 'no-elements' }),
        ],
        figures: { ...answer().figures, referencesWithoutElements: 1 },
      }),
    },
    ...over,
  };
}

function table(): HTMLElement {
  return screen.getByRole('table', { name: 'References' });
}

/** The reference ids of the table's rows, in order. */
function rowIds(): string[] {
  return within(table())
    .getAllByRole('row')
    .slice(1)
    .map((r) => r.getAttribute('data-ref') ?? '');
}

async function opened(path = PAGE): Promise<ReturnType<typeof renderApp>> {
  const app = renderApp(path);
  await screen.findByRole('table', { name: 'References' });
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

describe('AC-1 — the page (D67-1, D67-7)', () => {
  it('is a sidebar entry of the Work group with its heading and page title', async () => {
    stubApi(api());
    await opened();
    const nav = screen.getByRole('navigation', { name: 'Project views' });
    expect(within(nav).getByRole('link', { name: 'Traceability' }).getAttribute('href')).toBe(PAGE);
    expect(screen.getByRole('heading', { level: 1, name: 'Traceability' })).toBeTruthy();
  });

  it('renders three columns and the rows in the server order', async () => {
    stubApi(api());
    await opened();
    expect(
      within(table())
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Reference', 'Linked elements', 'Completion']);
    expect(rowIds()).toEqual(['dl-001-first-decision', 'US-M-01', 'US-S-01']);
  });

  it('shows an element reference with its category, short id link, title and state pill', async () => {
    stubApi(api());
    await opened();
    const row = within(table()).getAllByRole('row')[1] as HTMLElement;
    const cell = within(row).getAllByRole('cell')[0] as HTMLElement;
    expect(cell.querySelector('.type-tag')?.textContent).toBe('decision');
    const link = within(cell).getByRole('link', { name: 'dl-001' });
    expect(link.getAttribute('href')).toBe(`/p/${PID}/e/dl-001-first-decision`);
    expect(cell.textContent).toContain('First decision');
    expect(cell.querySelector('.state-pill.tone-done')?.textContent).toBe('s-ok');
  });

  it('shows a pattern reference by its category and id only: no link, no title, no hover card (R-01.6)', async () => {
    stubApi(api());
    await opened();
    const row = within(table()).getAllByRole('row')[2] as HTMLElement;
    const cell = within(row).getAllByRole('cell')[0] as HTMLElement;
    expect(cell.textContent).toBe('requirementUS-M-01');
    expect(within(cell).queryByRole('link')).toBeNull();
    expect(within(cell).queryByRole('button')).toBeNull();
    expect(cell.querySelector('[title]')).toBeNull();
  });

  it('labels each chip by its short id, its tone, a link to the element page and the name "short id — title — state"', async () => {
    stubApi(api());
    await opened();
    const row = within(table()).getAllByRole('row')[2] as HTMLElement;
    const chips = within(within(row).getAllByRole('cell')[1] as HTMLElement).getAllByRole('link');
    expect(chips.map((c) => c.textContent)).toEqual(['k-002', 'k-003']);
    expect(chips[0]?.getAttribute('aria-label')).toBe('k-002 — Memory list — s-done');
    expect(chips[1]?.className).toContain('tone-human');
    expect(chips[1]?.getAttribute('href')).toBe(`/p/${PID}/e/k-003-element-panel`);
  });

  it('opens the chip tooltip on focus with the full title, id and state, and closes it with Escape', async () => {
    stubApi(api());
    const user = userEvent.setup();
    await opened();
    const chip = within(table()).getByRole('link', { name: 'k-003 — Element panel — s-open' });
    while (document.activeElement !== chip) await user.tab();
    const tip = await screen.findByRole('tooltip');
    expect(tip.textContent).toContain('Element panel');
    expect(tip.textContent).toContain('k-003-element-panel');
    expect(tip.textContent).toContain('s-open');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('shows the completion as a bar with "50 % · 1/2", and "—" with no linked element', async () => {
    stubApi(api());
    await opened(`${PAGE}?scope=project`);
    const completion = (id: string): string =>
      within(table())
        .getAllByRole('row')
        .find((r) => r.getAttribute('data-ref') === id)
        ?.querySelectorAll('td')[2]?.textContent ?? '';
    expect(completion('US-M-01')).toBe('50 % · 1/2');
    expect(completion('US-X-01')).toBe('—');
  });

  it('a failed read is an error, never an empty state', async () => {
    stubApi(api({ [CURRENT]: { status: 502, body: { error: { code: 'read-error', message: 'x' } } } }));
    renderApp(PAGE);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText(/No references found/)).toBeNull();
  });
});

describe("AC-1 — figures (D67-6; the completion and phase cards from task-065's web/src/progress/, Q1 (a))", () => {
  it('explains the completion on keyboard focus as its accessible description (T-14.2 text)', async () => {
    stubApi(api());
    const user = userEvent.setup();
    await opened();
    const link = within(screen.getByRole('region', { name: 'Figures' })).getByRole('link', {
      name: 'Project completion 25 %',
    });
    while (document.activeElement !== link) await user.tab();
    const tip = await screen.findByRole('tooltip');
    expect(tip.textContent).toBe(
      'Mean of reference completion over 2 references with at least 1 linked element: US-M-01 50 %, US-S-01 0 %',
    );
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('shows the completion, the phase card and the coverage', async () => {
    stubApi(api());
    await opened();
    const figures = screen.getByRole('region', { name: 'Figures' });
    expect(figures.textContent).toContain('Project completion 25 %');
    expect(figures.textContent).toContain('Phase completion');
    expect(figures.textContent).toContain('Reference coverage 3/5');
    expect(figures.textContent).not.toContain('without elements');
  });

  it('names the references without elements with the whole project', async () => {
    stubApi(api());
    await opened(`${PAGE}?scope=project`);
    expect(screen.getByRole('region', { name: 'Figures' }).textContent).toContain('1 reference without elements');
  });

  it('explains an unavailable coverage with a link to Configuration › Taxonomy', async () => {
    stubApi(
      api({
        [CURRENT]: {
          status: 200,
          body: answer({
            figures: { ...answer().figures, coverage: { state: 'unavailable', reason: { code: 'no-requires' } } },
          }),
        },
      }),
    );
    await opened();
    const figures = screen.getByRole('region', { name: 'Figures' });
    expect(figures.textContent).toContain('No type requires references — see Configuration › Taxonomy');
    expect(within(figures).getByRole('link', { name: 'see Configuration › Taxonomy' }).getAttribute('href')).toBe(
      `/p/${PID}/configuration/taxonomy`,
    );
    // No requires: no missing-references section.
    expect(screen.queryByRole('heading', { name: /Elements missing required references/ })).toBeNull();
  });
});

describe('AC-1, AC-3 — scope, filters and search in the address (D67-2, D67-5, D67-8)', () => {
  it('offers the scope as two toggle buttons, the current one pressed, and moves to the whole project', async () => {
    stubApi(api());
    const user = userEvent.setup();
    const { router } = await opened();
    const scope = screen.getByRole('group', { name: 'Scope' });
    const current = within(scope).getByRole('button', { name: 'minor-v0.1 (current release)' });
    const whole = within(scope).getByRole('button', { name: 'Whole project' });
    expect(current.getAttribute('aria-pressed')).toBe('true');
    expect(whole.getAttribute('aria-pressed')).toBe('false');
    expect(rowIds()).not.toContain('US-S-09');
    await user.click(whole);
    await waitFor(() => expect(rowIds()).toContain('US-S-09'));
    expect(router.state.location.search).toEqual({ scope: 'project' });
    expect(
      within(screen.getByRole('group', { name: 'Scope' }))
        .getByRole('button', { name: 'Whole project' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('hides the scope control when there is no current element', async () => {
    stubApi(
      api({
        [CURRENT]: { status: 200, body: answer({ scope: { type: null, current: null, applied: 'project' } }) },
      }),
    );
    await opened();
    expect(screen.queryByRole('group', { name: 'Scope' })).toBeNull();
  });

  it('filters by category with counts in the names, keeps it in the URL and announces the rows politely', async () => {
    stubApi(api());
    const user = userEvent.setup();
    const { router } = await opened();
    const category = screen.getByRole('group', { name: 'Category' });
    expect(
      within(category)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['All, 3 references', 'decision, 1 reference', 'requirement, 2 references']);
    const status = screen.getByRole('status', { name: 'Traceability updates' });
    expect(status.textContent).toBe('');
    await user.click(within(category).getByRole('button', { name: 'requirement, 2 references' }));
    await waitFor(() => expect(rowIds()).toEqual(['US-M-01', 'US-S-01']));
    expect(router.state.location.search).toEqual({ category: 'requirement' });
    expect(
      within(category).getByRole('button', { name: 'requirement, 2 references' }).getAttribute('aria-pressed'),
    ).toBe('true');
    await waitFor(() => expect(status.textContent).toBe('2 references'));
  });

  it('filters by status within the category; "No elements" only with the whole project', async () => {
    stubApi(api());
    const user = userEvent.setup();
    const { router } = await opened(`${PAGE}?category=requirement`);
    const status = screen.getByRole('group', { name: 'Status' });
    expect(
      within(status)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['All, 2 references', 'Completed, 0 references', 'In progress, 1 reference', 'Not started, 1 reference']);
    await user.click(within(status).getByRole('button', { name: 'In progress, 1 reference' }));
    await waitFor(() => expect(rowIds()).toEqual(['US-M-01']));
    expect(router.state.location.search).toEqual({ category: 'requirement', status: 'partial' });
    cleanup();
    stopEventStream();
    await opened(`${PAGE}?scope=project`);
    expect(
      within(screen.getByRole('group', { name: 'Status' })).getByRole('button', { name: 'No elements, 1 reference' }),
    ).toBeTruthy();
  });

  it('searches the ids and the element titles, case-insensitively', async () => {
    stubApi(api());
    const user = userEvent.setup();
    const { router } = await opened();
    await user.type(screen.getByRole('searchbox', { name: 'Search references' }), 'FIRST');
    await waitFor(() => expect(rowIds()).toEqual(['dl-001-first-decision']));
    expect(router.state.location.search).toEqual({ q: 'FIRST' });
  });

  it('says "No reference matches" when the filters match nothing, and Clear filters keeps the scope', async () => {
    stubApi(api());
    const user = userEvent.setup();
    const { router } = renderApp(`${PAGE}?scope=project&status=completed&category=decision`);
    expect(await screen.findByText('No reference matches')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(rowIds()).toHaveLength(5));
    expect(router.state.location.search).toEqual({ scope: 'project' });
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search references' }));
  });

  it('ignores a category the answer does not list', async () => {
    stubApi(api());
    await opened(`${PAGE}?category=spec`);
    expect(rowIds()).toHaveLength(3);
    expect(
      within(screen.getByRole('group', { name: 'Category' }))
        .getByRole('button', { name: 'All, 3 references' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });
});

describe('AC-1 — empty states (D67-12)', () => {
  it('asks for taxonomy patterns when there is none (R-01.4)', async () => {
    stubApi(api({ [CURRENT]: { status: 200, body: answer({ references: [], patterns: false }) } }));
    renderApp(PAGE);
    expect(await screen.findByText('No references found — declare taxonomy patterns in ui.yaml')).toBeTruthy();
  });

  it('says no element carries a matching value when patterns exist', async () => {
    stubApi(api({ [CURRENT]: { status: 200, body: answer({ references: [] }) } }));
    renderApp(PAGE);
    expect(
      await screen.findByText(
        "No references found — no element carries a value matching the taxonomy patterns or another element's id",
      ),
    ).toBeTruthy();
  });
});

describe('AC-2 — ui.yaml warning and note (D67-11, Q3 (a))', () => {
  it('shows the warning of an ignored file and the note, without Use preset (a file exists)', async () => {
    stubApi(
      api({
        [CURRENT]: {
          status: 200,
          body: answer({
            ui: {
              source: 'ignored',
              warning: { code: 'ui-config-ignored', failure: 'progress.mode must be sequence or flow (found spiral)' },
            },
          }),
        },
      }),
    );
    const { container } = await opened();
    expect(container.querySelector('.ui-yaml-warning')?.textContent).toBe(
      'ui.yaml ignored: progress.mode must be sequence or flow (found spiral)',
    );
    const note = screen
      .getByText(/^No ui.yaml — only references to other Memory elements are recognised/)
      .closest('p') as HTMLElement;
    expect(within(note).getByRole('link', { name: 'Configuration › Taxonomy' }).getAttribute('href')).toBe(
      `/p/${PID}/configuration/taxonomy`,
    );
    expect(within(note).queryByRole('link', { name: 'Use preset' })).toBeNull();
  });

  it('offers Use preset without a file to a member of the team, not to an outsider', async () => {
    stubApi(api({ [CURRENT]: { status: 200, body: answer({ ui: { source: 'none' } }) } }));
    await opened();
    const note = () => screen.getByText(/^No ui.yaml — only references/).closest('p') as HTMLElement;
    await waitFor(() =>
      expect(within(note()).getByRole('link', { name: 'Use preset' }).getAttribute('href')).toBe(
        `/p/${PID}/configuration/taxonomy`,
      ),
    );
    cleanup();
    stopEventStream();
    stubApi(api({ [CURRENT]: { status: 200, body: answer({ ui: { source: 'none' } }) } }, header(OUTSIDER)));
    await opened();
    expect(within(note()).queryByRole('link', { name: 'Use preset' })).toBeNull();
  });

  it('shows no note with a valid file', async () => {
    stubApi(api());
    await opened();
    expect(screen.queryByText(/^No ui.yaml/)).toBeNull();
  });
});

describe('AC-1 — missing references and notices (D67-10, D67-12)', () => {
  it('lists the elements missing required references with Show in Memory', async () => {
    stubApi(api());
    await opened();
    const heading = screen.getByRole('heading', { name: 'Elements missing required references (1)' });
    const section = heading.closest('section') as HTMLElement;
    expect(within(section).getByRole('link', { name: 'Show in Memory' }).getAttribute('href')).toBe(
      `/p/${PID}/memory?missing=refs`,
    );
    const row = within(section).getByRole('link', { name: /Themes/ });
    expect(row.getAttribute('href')).toBe(`/p/${PID}/e/k-004-themes`);
    expect(row.textContent).toContain('k-004');
    expect(row.textContent).toContain('needs requirement');
    expect(row.querySelector('.memory-badge-missing')?.textContent).toBe('missing refs');
  });

  it('says every element carries its required references when none is missing', async () => {
    stubApi(api({ [CURRENT]: { status: 200, body: answer({ missing: [] }) } }));
    await opened();
    expect(screen.getByRole('heading', { name: 'Elements missing required references (0)' })).toBeTruthy();
    expect(screen.getByText('Every element carries its required references')).toBeTruthy();
  });

  it('names the unreadable and capped elements and a failed events read', async () => {
    stubApi(
      api({
        [CURRENT]: {
          status: 200,
          body: answer({
            unreadable: ['k-009-broken'],
            capped: ['k-008-big'],
            eventsError: { code: 'git-failed', message: 'x' },
          }),
        },
      }),
    );
    await opened();
    expect(screen.getByText(/1 element could not be read: its references are not counted — k-009-broken/)).toBeTruthy();
    expect(screen.getByText(/1 element was indexed on its first 200 values only — k-008-big/)).toBeTruthy();
    expect(screen.getByText(/The repository history could not be read/)).toBeTruthy();
  });
});

describe('review round 1', () => {
  it('F-1 — under Whole project the completion is no link to the figure filter, its explanation still on focus', async () => {
    stubApi(api());
    const user = userEvent.setup();
    await opened(`${PAGE}?scope=project`);
    const figures = screen.getByRole('region', { name: 'Figures' });
    expect(within(figures).queryByRole('link', { name: /^Project completion/ })).toBeNull();
    expect(figures.textContent).toContain('Project completion 25 %');
    const trigger = figures.querySelector<HTMLElement>('.progress-completion-trigger');
    expect(trigger).not.toBeNull();
    while (document.activeElement !== trigger) await user.tab();
    expect((await screen.findByRole('tooltip')).textContent).toContain(
      'Mean of reference completion over 2 references',
    );
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('F-1 — on the release scope the completion keeps its link to the figure filter', async () => {
    stubApi(api());
    await opened();
    const link = within(screen.getByRole('region', { name: 'Figures' })).getByRole('link', {
      name: 'Project completion 25 %',
    });
    expect(link.getAttribute('href')).toBe(`/p/${PID}/memory?figure=completion`);
  });

  it('F-2 — no linked element: the current scope named, or "the project" with the whole project', async () => {
    const noLinked = { state: 'unavailable' as const, reason: { code: 'no-linked-elements' as const } };
    stubApi(
      api({
        [CURRENT]: { status: 200, body: answer({ figures: { ...answer().figures, completion: noLinked } }) },
        [PROJECT]: {
          status: 200,
          body: answer({
            scope: { ...answer().scope, applied: 'project' },
            figures: { ...answer().figures, completion: noLinked },
          }),
        },
      }),
    );
    await opened();
    expect(screen.getByRole('region', { name: 'Figures' }).textContent).toContain('No references linked in minor-v0.1');
    cleanup();
    stopEventStream();
    await opened(`${PAGE}?scope=project`);
    expect(screen.getByRole('region', { name: 'Figures' }).textContent).toContain(
      'No references linked in the project',
    );
  });

  it('F-3 — the search field shows its placeholder', async () => {
    stubApi(api());
    await opened();
    expect(screen.getByRole('searchbox', { name: 'Search references' }).getAttribute('placeholder')).toBe(
      'Search references',
    );
  });

  it('F-5 — a failed read of the other scope keeps the scope control and the focus on it', async () => {
    stubApi(api({ [PROJECT]: { status: 502, body: { error: { code: 'read-error', message: 'x' } } } }));
    const user = userEvent.setup();
    await opened();
    await user.click(
      within(screen.getByRole('group', { name: 'Scope' })).getByRole('button', { name: 'Whole project' }),
    );
    expect(await screen.findByRole('alert')).toBeTruthy();
    const scope = screen.getByRole('group', { name: 'Scope' });
    const whole = within(scope).getByRole('button', { name: 'Whole project' });
    expect(whole.getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(whole);
    await user.click(within(scope).getByRole('button', { name: 'minor-v0.1 (current release)' }));
    await waitFor(() => expect(rowIds()).toEqual(['dl-001-first-decision', 'US-M-01', 'US-S-01']));
  });

  it('F-6 — typing fast keeps every key: the field and the address end with the whole text', async () => {
    stubApi(api());
    const user = userEvent.setup({ delay: null });
    const { router } = await opened();
    const field = screen.getByRole('searchbox', { name: 'Search references' });
    await user.type(field, 'first decision');
    expect((field as HTMLInputElement).value).toBe('first decision');
    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'first decision' }));
    expect((field as HTMLInputElement).value).toBe('first decision');
    await waitFor(() => expect(rowIds()).toEqual(['dl-001-first-decision']));
  });

  it('F-8 — a failed events read names what this page shows', async () => {
    stubApi(api({ [CURRENT]: { status: 200, body: answer({ eventsError: { code: 'git-failed', message: 'x' } }) } }));
    await opened();
    expect(
      screen.getByText('The repository history could not be read: the references and figures are shown without it.'),
    ).toBeTruthy();
  });
});
