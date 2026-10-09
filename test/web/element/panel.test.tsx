// @vitest-environment jsdom
// task-018 — the element panel (US-G-01; ux-reference §4.2) at component level, on the whole
// application with a stubbed API: the route `/p/$pid/e/$eid`, the two reads, the sections, the
// degraded answers, Close/Escape, the page title and the catalogue (every text a key).
import type { ElementDetail, MemoryHistory } from '@wingfoil-ui/contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { keyCatalogue } from '../../../web/scripts/catalogue.mjs';
import { stopEventStream } from '../../../web/src/api/events.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { resetSession } from '../../../web/src/session/session.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';

const PID = 'p_fx';
const EID = 'el-002-reset';
const BASE = `/api/p/${PID}/elements/${EID}`;

const DETAIL: ElementDetail = {
  element: {
    path: 'docs/el.md',
    id: EID,
    title: 'Password reset',
    type: 'kind-a',
    status: 's1',
    tags: [],
    localChanges: false,
  },
  frontmatter: { id: EID, type: 'kind-a', title: 'Password reset', status: 's1', ref: ['US-1', 'US-2'], link_ref: '' },
  body: '<!-- scaffold -->\n\n## Context\n\nUsers forget passwords.\n',
  descriptor: {
    id: EID,
    type: 'kind-a',
    status: 's1',
    kind: 'first',
    tone: 'neutral',
    verbs: [],
    actor: { kind: 'none' },
    rejection: { by: 'Morgan', reason: 'Missing acceptance criteria', at: '2026-09-29T15:20:04+00:00' },
  },
  required: [
    { field: 'id', missing: false },
    { field: 'link_ref', missing: true },
  ],
  states: { sequence: ['s1', 's2', 's3'], gates: { s2: { reject: 's1' } } },
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
    {
      sha: '2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      author: 'Jordan <jordan@example.test>',
      timestamp: '2026-09-29T15:20:03+00:00',
      operation: 'submit',
      from: 's1',
      to: 's2',
      approver: null,
      reason: null,
      subject: 'wf(x): submit',
    },
    {
      sha: '3333333ccccccccccccccccccccccccccccccccc',
      author: 'Morgan <morgan@example.test>',
      timestamp: '2026-09-29T15:20:04+00:00',
      operation: 'reject',
      from: 's2',
      to: 's1',
      approver: 'Morgan <morgan@example.test> (approver)',
      reason: 'Missing acceptance criteria',
      subject: 'wf(x): reject',
    },
    {
      sha: '4444444ddddddddddddddddddddddddddddddddd',
      author: 'Casey <casey@example.test>',
      timestamp: '2026-09-29T15:20:05+00:00',
      operation: null,
      from: null,
      to: null,
      approver: null,
      reason: null,
      subject: 'docs: typo',
    },
  ],
};

/** Each chip of the state machine: its visible name, its position (data) and its accessible text. */
function chipsOf(list: HTMLElement): { name: string; position: string; label: string }[] {
  return within(list)
    .getAllByRole('listitem')
    .map((li) => ({
      name: li.querySelector('[aria-hidden="true"]')?.textContent ?? '',
      position: li.dataset['position'] ?? '',
      label: li.querySelector('.visually-hidden')?.textContent ?? '',
    }));
}

function api(over: FakeApi = {}): FakeApi {
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'kanban', path: '/x', remote: null, availability: 'available' }] },
    },
    [BASE]: { status: 200, body: DETAIL },
    [`${BASE}/history`]: { status: 200, body: HISTORY },
    // task-019: the panel's Directives section reads the project's directives and header.
    [`/api/p/${PID}/directives`]: { status: 200, body: { entries: [], warnings: [] } },
    [`/api/p/${PID}`]: { status: 200, body: { identity: { kind: 'no-identity' }, roleViews: [], roleView: null } },
    ...over,
  };
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

it('shows the element: type, id, title, chips, banner, summary, missing field, references, history', async () => {
  const fetch = stubApi(api());
  renderApp(`/p/${PID}/e/${EID}`);
  const dialog = await screen.findByRole('dialog', { name: 'Password reset' });
  const d = within(dialog);
  expect(d.getByText('kind-a')).toBeTruthy();
  expect(d.getByText(EID)).toBeTruthy();
  // State machine: s1 current (rejected back), s2/s3 future; the current chip takes the tone as data.
  const list = d.getByRole('list', { name: 'State machine' });
  expect(chipsOf(list)).toEqual([
    { name: 's1', position: 'current', label: 's1, current state' },
    { name: 's2', position: 'future', label: 's2, future state' },
    { name: 's3', position: 'future', label: 's3, future state' },
  ]);
  const chips = within(list).getAllByRole('listitem');
  expect(chips[0]?.getAttribute('aria-current')).toBe('step');
  expect(chips[0]?.className).toContain('tone-neutral');
  expect(d.getByText('Rejected by Morgan: Missing acceptance criteria')).toBeTruthy();
  expect(d.getByText('Users forget passwords.')).toBeTruthy();
  expect(d.getByText('link_ref — required field, missing')).toBeTruthy();
  expect(d.queryByText('id — required field, missing')).toBeNull();
  expect(d.getByText('US-1')).toBeTruthy();
  expect(d.getByText('US-2')).toBeTruthy();
  // History, newest first, with who, transition, reason and the short hash.
  await d.findByText('submitted by Jordan');
  const history = d.getAllByRole('listitem');
  const lines = history.filter((li) => li.className === 'history-entry').map((li) => li.textContent ?? '');
  expect(lines).toHaveLength(4);
  expect(lines[0]).toContain('edited outside a WingFoil verb by Casey');
  expect(lines[1]).toContain('rejected by Morgan');
  expect(lines[1]).toContain('s2 → s1');
  expect(lines[1]).toContain('“Missing acceptance criteria”');
  expect(lines[2]).toContain('submitted by Jordan');
  expect(lines[2]).toContain('2222222');
  expect(lines[3]).toContain('created by Jordan');
  expect(d.getByText('2222222').getAttribute('title')).toBe(HISTORY.entries[1]?.sha);
  // Read-only: no Edit, no verb.
  expect(d.getAllByRole('button').map((b) => b.textContent)).toEqual(['Close']);
  await waitFor(() => expect(document.title).toBe(`kanban · ${EID} — WingFoil UI`));
  // The element and its history, plus the project's directives and header (task-019, once per
  // project); nothing per reference.
  const paths = fetch.mock.calls.map((c) => String(c[0])).filter((p) => p.startsWith(`/api/p/`));
  expect(new Set(paths)).toEqual(new Set([BASE, `${BASE}/history`, `/api/p/${PID}/directives`, `/api/p/${PID}`]));
});

it('shows the sequence unmarked and the current state after it when it is outside the sequence', async () => {
  stubApi(api({ [BASE]: { status: 200, body: { ...DETAIL, element: { ...DETAIL.element, status: 'x9' } } } }));
  renderApp(`/p/${PID}/e/${EID}`);
  const list = await screen.findByRole('list', { name: 'State machine' });
  expect(chipsOf(list)).toEqual([
    { name: 's1', position: 'other', label: 's1, state of the sequence' },
    { name: 's2', position: 'other', label: 's2, state of the sequence' },
    { name: 's3', position: 'other', label: 's3, state of the sequence' },
    { name: 'x9', position: 'current', label: 'x9, current state' },
  ]);
});

it('degrades without the type definitions: only the current state, a notice, no required fields', async () => {
  const { descriptor: _d, required: _r, states: _s, ...rest } = DETAIL;
  stubApi(api({ [BASE]: { status: 200, body: rest } }));
  renderApp(`/p/${PID}/e/${EID}`);
  const list = await screen.findByRole('list', { name: 'State machine' });
  expect(chipsOf(list)).toEqual([{ name: 's1', position: 'current', label: 's1, current state' }]);
  expect(screen.getByText('The type definitions could not be read: only the current state is shown.')).toBeTruthy();
  expect(screen.queryByText(/Rejected by/)).toBeNull();
});

it('says when there is no summary, no other field, no history, and marks local changes and an events error', async () => {
  stubApi(
    api({
      [BASE]: {
        status: 200,
        body: {
          ...DETAIL,
          element: { ...DETAIL.element, localChanges: true },
          frontmatter: { id: EID, type: 'kind-a', title: 'Password reset', status: 's1' },
          body: '<!-- only -->\n',
          descriptor: { ...DETAIL.descriptor!, rejection: { by: 'Morgan', reason: null, at: 'x' } },
          required: [],
          eventsError: { code: 'internal', message: 'x' },
        },
      },
      [`${BASE}/history`]: { status: 200, body: { ...HISTORY, entries: [] } },
    }),
  );
  renderApp(`/p/${PID}/e/${EID}`);
  expect(await screen.findByText('No summary in the document.')).toBeTruthy();
  expect(screen.getByText('No other fields in the document.')).toBeTruthy();
  expect(await screen.findByText('No history yet.')).toBeTruthy();
  expect(screen.getByText('Rejected by Morgan')).toBeTruthy();
  expect(screen.getByText('This element has local changes that are not committed.')).toBeTruthy();
  expect(
    screen.getByText('The repository history could not be read: the rejection banner may be missing.'),
  ).toBeTruthy();
});

it('renders an empty field as a dash next to its name', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/e/${EID}`);
  const dash = await screen.findByText('—');
  expect(dash.closest('.field-row')?.textContent).toBe('link_ref—');
});

it('renders a read error of the element and of the history from the catalogue', async () => {
  stubApi(
    api({
      [BASE]: {
        status: 502,
        body: { error: { code: 'read-error', message: 'x', detail: { file: 'docs/el.md', kind: 'shape' } } },
      },
    }),
  );
  renderApp(`/p/${PID}/e/${EID}`);
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('docs/el.md');
  expect(screen.getByRole('dialog', { name: EID })).toBeTruthy();
});

it('renders a failed history read inside the history section', async () => {
  stubApi(
    api({ [`${BASE}/history`]: { status: 502, body: { error: { code: 'cli-output', message: 'bad output' } } } }),
  );
  renderApp(`/p/${PID}/e/${EID}`);
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).not.toContain('bad output');
  expect(screen.getByText('Users forget passwords.')).toBeTruthy();
});

it('says the element is loading while the read is pending', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/e/${EID}`);
  expect(await screen.findByText('Loading the element…')).toBeTruthy();
});

it('closes with Escape to the project (its Memory list, W3-22) when opened from its URL (no page to go back to), focus on main', async () => {
  stubApi(api());
  const { router } = renderApp(`/p/${PID}/e/${EID}`);
  await screen.findByRole('dialog', { name: 'Password reset' });
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(router.state.location.pathname).toBe(`/p/${PID}/memory`));
  expect(screen.queryByRole('dialog')).toBeNull();
  await waitFor(() => expect(document.activeElement?.id).toBe('main'));
});

it('closes with Close back to the page it was opened from (history back), focus on main', async () => {
  stubApi(api());
  const { router } = renderApp('/');
  await screen.findByRole('heading', { level: 1, name: 'Projects' });
  await router.navigate({ to: '/p/$pid/e/$eid', params: { pid: PID, eid: EID } });
  await userEvent.click(await screen.findByRole('button', { name: 'Close' }));
  // Back to `/` — not the `/p/$pid` fallback.
  await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  expect(screen.queryByRole('dialog')).toBeNull();
  await waitFor(() => expect(document.activeElement?.id).toBe('main'));
});

it('leaves the focus where the destination put it', async () => {
  stubApi(api());
  const { router } = renderApp('/');
  const add = await screen.findByRole('button', { name: 'Add project…' });
  await router.navigate({ to: '/p/$pid/e/$eid', params: { pid: PID, eid: EID } });
  await screen.findByRole('dialog', { name: 'Password reset' });
  // A destination that focuses its own element (task-017: the row of the element) keeps it.
  const unsubscribe = router.subscribe('onResolved', () =>
    document.querySelector<HTMLElement>('.button-primary')?.focus(),
  );
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  await waitFor(() => expect(document.activeElement?.textContent).toBe(add.textContent));
  unsubscribe();
});

it('applies any descriptor tone as data on the current chip only (e.g. attention)', async () => {
  stubApi(
    api({ [BASE]: { status: 200, body: { ...DETAIL, descriptor: { ...DETAIL.descriptor!, tone: 'attention' } } } }),
  );
  renderApp(`/p/${PID}/e/${EID}`);
  const list = await screen.findByRole('list', { name: 'State machine' });
  const chips = within(list).getAllByRole('listitem');
  expect(chips[0]?.classList.contains('tone-attention')).toBe(true);
  expect(chips.slice(1).some((c) => /\btone-/.test(c.className))).toBe(false);
});

it('names a deprecate in the history without a state name (W3-21)', async () => {
  const last = HISTORY.entries[3]!;
  stubApi(
    api({
      [`${BASE}/history`]: {
        status: 200,
        body: { ...HISTORY, entries: [{ ...last, operation: 'deprecate', from: 's1', to: 'x0' }] },
      },
    }),
  );
  renderApp(`/p/${PID}/e/${EID}`);
  expect(await screen.findByText('marked obsolete by Casey')).toBeTruthy();
});

it('makes the scrollable body a focusable, named region (keyboard scrolling)', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/e/${EID}`);
  const dialog = await screen.findByRole('dialog', { name: 'Password reset' });
  const body = within(dialog).getByRole('region', { name: 'Element details' });
  expect(body.tabIndex).toBe(0);
  expect(body.className).toContain('drawer-body');
});

it('focuses inside the panel and keeps the focus there', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/e/${EID}`);
  const dialog = await screen.findByRole('dialog', { name: 'Password reset' });
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  await userEvent.tab();
  expect(dialog.contains(document.activeElement)).toBe(true);
});

it('shows only catalogue keys with the key catalogue (spec-008 §6)', async () => {
  stubApi(api());
  const keys = keyCatalogue(en);
  renderApp(`/p/${PID}/e/${EID}`, keys);
  const dialog = await screen.findByRole('dialog');
  await within(dialog).findByText('element.history.entry submit Jordan');
  const d = within(dialog);
  expect(d.getByText('element.rejection.withReason Morgan Missing acceptance criteria')).toBeTruthy();
  expect(d.getByText('element.required.missing link_ref')).toBeTruthy();
  expect(d.getByText('element.summary.title')).toBeTruthy();
  expect(d.getByText('common.action.close')).toBeTruthy();
});
