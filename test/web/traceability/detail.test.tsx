// @vitest-environment jsdom
// task-081 — the inline detail of a Traceability row and the page's refresh, on the whole
// application with a stubbed API (ux-reference §4.8 v0.3 *Inline detail*, *Refresh*,
// *Accessibility*; spec-012 §4; D81-3 … D81-8, Q1 (b), Q2 (b)): the row toggle (`aria-expanded`,
// `aria-controls` while open, one row at a time, the focus kept), the click on the row, the detail
// row (heading, element reference *Open*, completion, one link per linked element with who must
// act, the texts of Today's *Waiting on others*), and the open row across a refresh, a scope change
// and a project switch, the focus given to the table when the refresh removes it, no announcement.
import type {
  ActionDescriptor,
  ProjectHeader,
  Traceability,
  TraceabilityElement,
  TraceabilityReference,
} from '@wingfoil-ui/contracts';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { resetSession } from '../../../web/src/session/session.js';
import { BO, header } from '../dna/data.js';
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
  over: { done?: boolean; actor?: ActionDescriptor['actor']; held?: boolean; noDescriptor?: boolean } = {},
): TraceabilityElement {
  const done = over.done ?? false;
  return {
    path: `docs/${id}.md`,
    id,
    shortId,
    title,
    type: id.split('-')[0] ?? 'x',
    status,
    tags: [],
    localChanges: false,
    ...(over.noDescriptor
      ? {}
      : {
          descriptor: {
            id,
            type: 'x',
            status,
            kind: done ? 'last' : 'work',
            tone: done ? 'done' : 'human',
            verbs: [],
            actor: over.actor ?? { kind: 'none' },
            ...(over.held ? { approveHeld: { condition: 'never', reason: { code: 'held-by-config' } } } : {}),
          },
        }),
    done,
    inScope: true,
  };
}

const ELEMENTS: TraceabilityElement[] = [
  el('dl-001-first-decision', 'dl-001', 'First decision', 's-ok', { done: true }),
  el('k-002-memory-list', 'k-002', 'Memory list', 's-done', { done: true }),
  el('k-003-element-panel', 'k-003', 'Element panel', 's-open', { actor: { kind: 'engine' } }),
  el('k-004-themes', 'k-004', 'Themes', 's-open', {
    actor: { kind: 'member', member: { name: 'Jordan', email: 'j@example.test' }, basis: 'submitter' },
  }),
  el('k-005-role', 'k-005', 'Role gate', 's-gate', {
    actor: { kind: 'role', role: 'approver', members: ['Bo', 'Al'] },
  }),
  el('k-006-held', 'k-006', 'Held gate', 's-gate', {
    actor: { kind: 'role', role: 'approver', members: ['Bo'] },
    held: true,
  }),
  el('k-007-bare', 'k-007', 'No descriptor', 's-x', { noDescriptor: true }),
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
  ref('dl-001-first-decision', { category: 'decision', element: true, linked: ['k-004-themes'], total: 1, percent: 0 }),
  ref('US-M-01', {
    linked: ['k-002-memory-list', 'k-003-element-panel'],
    done: 1,
    total: 2,
    percent: 50,
    status: 'in-progress' as TraceabilityReference['status'],
  }),
  ref('US-S-01', {
    linked: ['k-004-themes', 'k-005-role', 'k-006-held', 'k-007-bare'],
    total: 4,
    percent: 0,
  }),
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
      completion: { state: 'unavailable', reason: { code: 'no-reference-categories' } },
      phaseCompletion: { state: 'read-only', reason: { code: 'not-in-release' } },
      coverage: { state: 'unavailable', reason: { code: 'no-requires' } },
      referencesWithoutElements: 0,
    },
    references: REFERENCES,
    missing: [],
    elements: ELEMENTS,
    unreadable: [],
    capped: [],
    ...over,
  } as Traceability;
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
        references: REFERENCES.filter((r) => r.id !== 'US-M-01'),
      }),
    },
    ...over,
  };
}

const table = () => screen.getByRole('table', { name: 'References' });
const toggle = (id: string) => within(table()).getByRole('button', { name: `Details of ${id}` });
const rowOf = (id: string) => table().querySelector<HTMLTableRowElement>(`tr[data-ref="${id}"]`)!;
const detailRow = () => table().querySelector<HTMLTableRowElement>('tr.trace-detail-row');
const items = () => within(detailRow()!).getAllByRole('listitem');

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

describe('AC-2 — the row toggle (D81-4)', () => {
  it('is a button named by the reference, aria-expanded, aria-controls naming the next row while open', async () => {
    stubApi(api());
    const user = userEvent.setup();
    await opened();
    const button = toggle('US-M-01');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.hasAttribute('aria-controls')).toBe(false);
    expect(detailRow()).toBeNull();
    await user.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const detail = detailRow()!;
    expect(button.getAttribute('aria-controls')).toBe(detail.id);
    expect(rowOf('US-M-01').nextElementSibling).toBe(detail);
    expect(detail.querySelector('td')?.getAttribute('colspan')).toBe('3');
    expect(document.activeElement).toBe(button);
    await user.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(detailRow()).toBeNull();
  });

  it('opens one row at a time, the focus on the pressed toggle; Enter and Space press it', async () => {
    stubApi(api());
    const user = userEvent.setup();
    await opened();
    toggle('US-M-01').focus();
    await user.keyboard('{Enter}');
    expect(toggle('US-M-01').getAttribute('aria-expanded')).toBe('true');
    toggle('US-S-01').focus();
    await user.keyboard(' ');
    expect(toggle('US-S-01').getAttribute('aria-expanded')).toBe('true');
    expect(toggle('US-M-01').getAttribute('aria-expanded')).toBe('false');
    expect(table().querySelectorAll('tr.trace-detail-row')).toHaveLength(1);
    expect(document.activeElement).toBe(toggle('US-S-01'));
  });

  it('a click on the row toggles it and focuses its toggle; a click on a link or a chip does not', async () => {
    stubApi(api());
    const user = userEvent.setup();
    const { router } = await opened();
    await user.click(rowOf('US-M-01').querySelector('td.trace-completion')!);
    expect(toggle('US-M-01').getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(toggle('US-M-01'));
    // A click on the element reference's link navigates and toggles nothing.
    await user.click(within(rowOf('dl-001-first-decision')).getByRole('link', { name: 'dl-001' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/p/${PID}/e/dl-001-first-decision`));
  });

  it('a click on a chip opens the element page, not the detail', async () => {
    stubApi(api());
    const user = userEvent.setup();
    const { router } = await opened();
    await user.click(within(rowOf('US-M-01').querySelectorAll('td')[1]!).getAllByRole('link')[0]!);
    await waitFor(() => expect(router.state.location.pathname).toBe(`/p/${PID}/e/k-002-memory-list`));
  });

  it('a click that ends a text selection toggles nothing', async () => {
    stubApi(api());
    await opened();
    const cell = rowOf('US-M-01').querySelector('td.trace-completion')!;
    const selection = vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      toString: () => 'selected',
    } as unknown as Selection);
    (cell as HTMLElement).click();
    selection.mockRestore();
    expect(toggle('US-M-01').getAttribute('aria-expanded')).toBe('false');
  });
});

describe('AC-1, AC-2 — the detail (D81-5)', () => {
  it('heads a pattern reference by its id, no link, the completion and each element with who must act', async () => {
    stubApi(api());
    const user = userEvent.setup();
    await opened();
    await user.click(toggle('US-S-01'));
    const detail = detailRow()!;
    const heading = within(detail).getByRole('heading', { level: 2 });
    expect(heading.textContent).toBe('US-S-01');
    expect(within(heading).queryByRole('link')).toBeNull();
    expect(within(detail).getByText('requirement')).toBeTruthy();
    expect(within(detail).getByText('Completion 0/4')).toBeTruthy();
    expect(within(detail).queryByRole('link', { name: 'Open' })).toBeNull();
    expect(items().map((li) => li.textContent)).toEqual([
      'k-004 · Themes · s-open · Jordan (submitter) must act',
      'k-005 · Role gate · s-gate · Reserved to approver — Bo, Al',
      'k-006 · Held gate · s-gate · Approved outside the console (ui.yaml)',
      'k-007 · No descriptor · s-x',
    ]);
    // Each item is one link to the element page in the main region (P2).
    const links = items().map((li) => within(li).getByRole('link'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      `/p/${PID}/e/k-004-themes`,
      `/p/${PID}/e/k-005-role`,
      `/p/${PID}/e/k-006-held`,
      `/p/${PID}/e/k-007-bare`,
    ]);
    // The state pill carries its tone and its name.
    expect(items()[0]!.querySelector('.state-pill.tone-human')?.textContent).toBe('s-open');
  });

  it('says nothing of who must act for a done element (R-01.2)', async () => {
    stubApi(api());
    const user = userEvent.setup();
    await opened();
    await user.click(toggle('US-M-01'));
    expect(items().map((li) => li.textContent)).toEqual([
      'k-002 · Memory list · s-done',
      'k-003 · Element panel · s-open · Waiting for the workflow engine',
    ]);
    expect(within(detailRow()!).getByText('Completion 1/2')).toBeTruthy();
  });

  it('shows an element reference with its title, state and Open, and "No linked element" for none', async () => {
    const references = [
      ...REFERENCES,
      ref('k-003-element-panel', { category: 'work', element: true, status: 'no-elements' }),
    ];
    stubApi(api({ [CURRENT]: { status: 200, body: answer({ references }) } }));
    const user = userEvent.setup();
    await opened();
    await user.click(toggle('k-003-element-panel'));
    const detail = detailRow()!;
    expect(within(detail).getByRole('heading', { level: 2 }).textContent).toBe('k-003-element-panel');
    expect(within(detail).getByText('Element panel')).toBeTruthy();
    expect(detail.querySelector('.trace-detail-head .state-pill')?.textContent).toBe('s-open');
    expect(within(detail).getByRole('link', { name: 'Open' }).getAttribute('href')).toBe(
      `/p/${PID}/e/k-003-element-panel`,
    );
    expect(within(detail).getByText('No linked element')).toBeTruthy();
    expect(within(detail).queryAllByRole('listitem')).toEqual([]);
  });
});

describe('AC-3 — refresh (D81-6, D81-7, Q1 (b))', () => {
  it('a refresh keeps the open row and the focus, shows the new elements and announces nothing', async () => {
    const fake = api();
    stubApi(fake);
    const user = userEvent.setup();
    const { queryClient } = await opened();
    await user.click(toggle('US-M-01'));
    const button = toggle('US-M-01');
    const status = screen.getByRole('status', { name: 'Traceability updates' });
    const linked = ['k-002-memory-list', 'k-003-element-panel', 'k-004-themes'];
    fake[CURRENT] = {
      status: 200,
      body: answer({
        references: [
          ...REFERENCES.map((r) => (r.id === 'US-M-01' ? { ...r, linked, total: 3 } : r)),
          ref('US-Z-01', { linked: ['k-004-themes'], total: 1, percent: 0 }),
        ],
      }),
    };
    await act(() => queryClient.invalidateQueries({ queryKey: ['p', PID] }));
    await waitFor(() => expect(items()).toHaveLength(3));
    expect(toggle('US-M-01')).toBe(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(button);
    expect(within(detailRow()!).getByText('Completion 1/3')).toBeTruthy();
    // Four rows now: a row-count change after a refresh is not announced (past F-7's pause too).
    await new Promise((r) => setTimeout(r, 700));
    expect(status.textContent).toBe('');
  });

  it('a refresh without the reference closes the detail and gives the focus to the table', async () => {
    const fake = api();
    stubApi(fake);
    const user = userEvent.setup();
    const { queryClient } = await opened();
    await user.click(toggle('US-M-01'));
    within(detailRow()!).getAllByRole('link')[0]!.focus();
    fake[CURRENT] = { status: 200, body: answer({ references: REFERENCES.filter((r) => r.id !== 'US-M-01') }) };
    await act(() => queryClient.invalidateQueries({ queryKey: ['p', PID] }));
    await waitFor(() => expect(rowOf('US-M-01')).toBeNull());
    expect(detailRow()).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(table()));
    expect(table().getAttribute('tabindex')).toBe('-1');
    // The reference coming back does not reopen it.
    fake[CURRENT] = { status: 200, body: answer() };
    await act(() => queryClient.invalidateQueries({ queryKey: ['p', PID] }));
    await waitFor(() => expect(rowOf('US-M-01')).not.toBeNull());
    expect(toggle('US-M-01').getAttribute('aria-expanded')).toBe('false');
  });

  it('a refresh that removes an unfocused row leaves the focus where it is', async () => {
    const fake = api();
    stubApi(fake);
    const user = userEvent.setup();
    const { queryClient } = await opened();
    await user.click(toggle('US-M-01'));
    const search = screen.getByRole('searchbox', { name: 'Search references' });
    search.focus();
    fake[CURRENT] = { status: 200, body: answer({ references: REFERENCES.filter((r) => r.id !== 'US-M-01') }) };
    await act(() => queryClient.invalidateQueries({ queryKey: ['p', PID] }));
    await waitFor(() => expect(rowOf('US-M-01')).toBeNull());
    expect(document.activeElement).toBe(search);
  });

  it('a filter that hides the open row keeps it open for when the row shows again', async () => {
    stubApi(api());
    const user = userEvent.setup();
    const { router } = await opened();
    await user.click(toggle('US-M-01'));
    await router.navigate({ to: '/p/$pid/traceability', params: { pid: PID }, search: { q: 'US-S' } });
    await waitFor(() => expect(rowOf('US-M-01')).toBeNull());
    expect(detailRow()).toBeNull();
    await router.navigate({ to: '/p/$pid/traceability', params: { pid: PID }, search: {} });
    await waitFor(() => expect(toggle('US-M-01').getAttribute('aria-expanded')).toBe('true'));
  });

  it('a scope change keeps the detail until the new answer, then closes it if absent', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    const fake = api();
    const fetch = stubApi(fake);
    const plain = fetch.getMockImplementation() as (url: string) => Promise<Response>;
    fetch.mockImplementation(async (url: string) => {
      if (url === PROJECT) await gate;
      return plain(url);
    });
    const user = userEvent.setup();
    await opened();
    await user.click(toggle('US-M-01'));
    await user.click(
      within(screen.getByRole('group', { name: 'Scope' })).getByRole('button', { name: 'Whole project' }),
    );
    // The previous answer on screen: the detail stays.
    expect(detailRow()).not.toBeNull();
    release();
    await waitFor(() => expect(rowOf('US-M-01')).toBeNull());
    expect(detailRow()).toBeNull();
  });

  it('a project switch opens nothing of the previous project', async () => {
    const OTHER = 'p_two';
    stubApi({
      ...api(),
      '/api/projects': {
        status: 200,
        body: {
          projects: [
            { id: PID, name: 'demo', path: '/x', remote: null, availability: 'available' },
            { id: OTHER, name: 'two', path: '/y', remote: null, availability: 'available' },
          ],
        },
      },
      [`/api/p/${OTHER}`]: { status: 200, body: { ...header(BO), id: OTHER, name: 'two' } },
      [`/api/p/${OTHER}/traceability?scope=current`]: { status: 200, body: answer() },
    });
    const user = userEvent.setup();
    const { router } = await opened();
    await user.click(toggle('US-M-01'));
    await router.navigate({ to: '/p/$pid/traceability', params: { pid: OTHER } });
    await waitFor(() => expect(router.state.location.pathname).toBe(`/p/${OTHER}/traceability`));
    await screen.findByRole('table', { name: 'References' });
    await waitFor(() => expect(toggle('US-M-01').getAttribute('aria-expanded')).toBe('false'));
    expect(detailRow()).toBeNull();
  });
});

describe('Q2 (b) — the events notice', () => {
  it('names who must act as what a failed events read degrades', async () => {
    stubApi(api({ [CURRENT]: { status: 200, body: answer({ eventsError: { code: 'git-failed', message: 'x' } }) } }));
    await opened();
    expect(screen.getByText('The repository history could not be read: who must act may be incomplete.')).toBeTruthy();
  });
});
