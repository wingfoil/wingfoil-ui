// @vitest-environment jsdom
// task-085 AC-1 (D85-3, D85-4; review F1) — the rest of the rendering sites of the keys: Today (rows,
// filters, role summary, reasons, recent activity, progress card), the notification bell, the header's
// role view, the element page (topline, state machine, candidates, gate footer, directives),
// Traceability, Configuration (Progress, Taxonomy) and the DNA's agents and path categories. Each
// screen is rendered with keys holding U+202E, ESC and U+200B and swept as a whole: no text node and
// no accessible-name attribute holds a raw character, the escaped key is shown, and a plain key is
// shown unchanged (AC-2). The raw value still addresses (`data-eid`, links) where the screen has one.
import type {
  ElementDetail,
  ElementRefusalBody,
  MemoryEventsPage,
  Progress,
  Today,
  Traceability,
} from '@wingfoil-ui/contracts';
import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { AppIntlProvider } from '../../../web/src/i18n/index.js';
import { CompletionExplanation } from '../../../web/src/progress/Completion.js';
import { resetSession } from '../../../web/src/session/session.js';
import { neutralise } from '../../../server/src/git/redact.js';
import { dnaBody } from '../../../server/src/http/serialise.js';
import { UI_DECLARED, uiApi } from '../configuration/data.js';
import { BASE, config, DNA, projectApi } from '../dna/data.js';
import { header } from '../project/header-data.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';

const RAW_CHARS = ['\u202e', '\x1b', '\u200b'];
const hasRaw = (text: string | null | undefined): boolean => RAW_CHARS.some((c) => (text ?? '').includes(c));
const SHOWN = (s: string): string =>
  s.replaceAll('\u202e', '\\u202e').replaceAll('\x1b', '\\x1b').replaceAll('\u200b', '\\u200b');

/** Every raw hostile character of `root`: in a text node or in an attribute (accessible names). */
function rawHits(root: Element): string[] {
  const hits: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      if (hasRaw(n.nodeValue)) hits.push(`text:${JSON.stringify(n.nodeValue)}`);
      continue;
    }
    const el = n as Element;
    for (const a of ['aria-label', 'title', 'aria-description', 'alt', 'placeholder']) {
      if (hasRaw(el.getAttribute(a))) hits.push(`${a}:${JSON.stringify(el.getAttribute(a))}`);
    }
  }
  return hits;
}

const ID = 'k-001-\u202eevil\x1bid\u200b';
const TYPE = 'ty\u202epe';
const STATE = 'st\x1bate\u200b';
const ROLE = 'r\u202e-dev\x1b\u200b';
const PID = 'p_a';

// Display values reach the page as the server serialised them (`neutralise`: a backslash doubled, each
// unsafe character a visible escape); the page shows them as served. A raw element key (ID, TYPE, …)
// is escaped once by the page. The served literals are written out and checked against `neutralise`.
const DISPLAY_RAW = 'kind‮\x1b​\\suffix';
const DISPLAY = 'kind\\u202e\\x1b\\u200b\\\\suffix';
const PATTERN_RAW = 'US-‮01\x1b\\';
const PATTERN = 'US-\\u202e01\\x1b\\\\';
it('the served literals are the server escape of the raw display values', () => {
  expect(neutralise(DISPLAY_RAW)).toBe(DISPLAY);
  expect(neutralise(PATTERN_RAW)).toBe(PATTERN);
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

const base = (extra: FakeApi): FakeApi => ({
  '/api/server': serverInfo(),
  '/api/projects': {
    status: 200,
    body: { projects: [{ id: PID, name: 'demo', path: '/x', remote: null, availability: 'available' }] },
  },
  ...extra,
});

const NO_FIGURES = { state: 'unavailable', reason: { code: 'no-reference-categories' } } as const;
const READ_ONLY = { state: 'read-only', reason: { code: 'not-in-release' } } as const;
const PROGRESS: Progress = {
  ui: { source: 'none' },
  mode: 'sequence',
  scope: {
    type: DISPLAY,
    current: { id: ID, shortId: ID, title: 'Current', type: TYPE, status: STATE, tone: 'active' },
    basis: null,
  },
  figures: {
    completion: NO_FIGURES,
    phase: READ_ONLY,
    phaseCompletion: READ_ONLY,
    iterated: { state: 'unavailable', reason: { code: 'no-iterates-type' } },
    openDefects: { state: 'unavailable', reason: { code: 'no-defects-type' } },
    pendingGates: { state: 'shown', count: 0, ids: [] },
  },
  unreadable: [ID, 'k-009-plain'],
  capped: [ID],
} as unknown as Progress;

/** No current element: the scope line names the served type. */
const PROGRESS_NO_CURRENT = {
  ...PROGRESS,
  scope: { type: DISPLAY, current: null, basis: null },
  figures: { ...PROGRESS.figures, completion: { state: 'unavailable', reason: { code: 'no-linked-elements' } } },
} as unknown as Progress;

const row = (id: string, type: string, status: string, actor: unknown, action?: 'approve') => ({
  element: { id, type, title: `Row title ${id.slice(0, 5)}`, status, localChanges: false },
  descriptor: { id, type, status, kind: 'gate', tone: 'human', verbs: [], actor },
  ...(action === undefined ? {} : { action }),
});

const TODAY: Today = {
  view: 'approver',
  requiresYou: [row(ID, TYPE, STATE, { kind: 'none' }, 'approve')],
  waitingOnOthers: [row('k-002-plain', 'task', 'draft', { kind: 'role', role: ROLE, members: [] })],
  summary: [
    { role: 'approver', count: 1 },
    { role: ROLE, count: 2 },
  ],
} as unknown as Today;

const EVENTS: MemoryEventsPage = {
  events: [
    {
      sha: 'a'.repeat(40),
      timestamp: new Date().toISOString(),
      author: 'Jordan <j@x.test>',
      operation: 'submit',
      type: TYPE,
      id: ID,
      from: 'draft',
      to: 'pending',
      approver: null,
      reason: null,
    },
  ],
  more: false,
};

function todayApi(progress: Progress = PROGRESS): FakeApi {
  return base({
    [`/api/p/${PID}`]: {
      status: 200,
      body: header({
        identity: { kind: 'member', email: 'm@x.test', name: 'Morgan', roles: ['approver', ROLE] },
        roleViews: ['approver', ROLE],
        roleView: 'approver',
      }),
    },
    [`/api/p/${PID}/today?view=approver`]: { status: 200, body: TODAY },
    [`/api/p/${PID}/events/memory?limit=5`]: { status: 200, body: EVENTS },
    [`/api/p/${PID}/events/memory?limit=10`]: { status: 200, body: EVENTS },
    [`/api/p/${PID}/progress`]: { status: 200, body: progress },
  });
}

it('Today progress card: unreadable and capped notices show each raw element id escaped once', async () => {
  stubApi(todayApi());
  const { container } = renderApp(`/p/${PID}/today`);
  await screen.findByText('Row title k-001');
  const notes = [...container.querySelectorAll('.today-progress-note')].map((n) => n.textContent ?? '');
  expect(notes).toHaveLength(2);
  expect(notes[0]).toContain(`${SHOWN(ID)}, k-009-plain`);
  expect(notes[1]).toContain(`— ${SHOWN(ID)}`);
  expect(notes.every((n) => !hasRaw(n))).toBe(true);
  expect(rawHits(container.querySelector('main') ?? container)).toEqual([]);
});

it('Today progress card: the served scope type is shown as served, never escaped a second time', async () => {
  stubApi(todayApi(PROGRESS_NO_CURRENT));
  const { container } = renderApp(`/p/${PID}/today`);
  await screen.findByText('Row title k-001');
  const card = container.querySelector('.today-progress') ?? container;
  expect(card.textContent).toContain(`No current ${DISPLAY}`);
  expect(card.textContent).not.toContain('\\\\\\\\\\\\');
  expect(rawHits(card)).toEqual([]);
});

it('Today: rows, role summary, waiting role, progress card and recent activity show escaped keys; the raw id addresses', async () => {
  stubApi(todayApi());
  const { container } = renderApp(`/p/${PID}/today`);
  await screen.findByText('Row title k-001');
  await screen.findByText('Recent activity');
  await screen.findByText(SHOWN(ID), { selector: '.today-activity-id' });
  const main = container.querySelector('main') ?? container;
  expect(rawHits(main)).toEqual([]);
  expect(main.querySelector('li.today-row')?.getAttribute('data-eid')).toBe(ID);
  expect(main.textContent).toContain(SHOWN(TYPE));
  expect(main.textContent).toContain(SHOWN(STATE));
  expect(main.textContent).toContain(SHOWN(ROLE));
  // The plain key is unchanged.
  expect(main.textContent).toContain('k-002-plain');
});

it('Today: the type and state filter menus list the escaped key', async () => {
  stubApi(todayApi());
  const user = userEvent.setup();
  const { container } = renderApp(`/p/${PID}/today`);
  await screen.findByText('Row title k-001');
  for (const button of container.querySelectorAll<HTMLElement>('.today-filter-button')) await user.click(button);
  expect(rawHits(document.body)).toEqual([]);
  expect(within(document.body).getAllByText(new RegExp(SHOWN(TYPE).replace(/\\/g, '\\\\'))).length).toBeGreaterThan(0);
});

it('Notification bell and the header role view show the escaped keys', async () => {
  stubApi(todayApi());
  const user = userEvent.setup();
  renderApp(`/p/${PID}/team`);
  const bell = await screen.findByRole('button', { name: /^Notifications/ });
  await user.click(bell);
  await screen.findByText(SHOWN(ID), { selector: '.bell-update-id' });
  expect(rawHits(document.body)).toEqual([]);
  expect(document.body.textContent).toContain(SHOWN(TYPE));
  expect(document.querySelector('li.bell-item')?.getAttribute('data-eid')).toBe(ID);
  await user.keyboard('{Escape}');
  await user.click(await screen.findByRole('button', { name: /Role view/ }));
  expect(rawHits(document.body)).toEqual([]);
  expect(document.body.textContent).toContain(SHOWN(ROLE));
});

const DETAIL: ElementDetail = {
  element: {
    path: 'docs/el.md',
    id: ID,
    shortId: 'k-001',
    title: 'Element title',
    type: TYPE,
    status: STATE,
    tags: [],
    localChanges: false,
  },
  frontmatter: { id: ID, type: TYPE, title: 'Element title', status: STATE },
  body: 'Body text.\n',
  states: { sequence: ['plain-s', STATE, 'next\x1bs'], gates: {} },
};

const AMBIGUOUS: ElementRefusalBody = {
  error: {
    code: 'ambiguous-id',
    message: 'Ambiguous id',
    detail: {
      candidates: [{ id: ID, shortId: 'k-001', title: 'Candidate title', type: TYPE, status: STATE }],
      more: 0,
    },
  },
};

function elementApi(over: FakeApi = {}): FakeApi {
  const A = `/api/p/${PID}/elements`;
  return base({
    [`/api/p/${PID}`]: { status: 200, body: header({ identity: { kind: 'no-identity' } as never, roleViews: [] }) },
    [`${A}/${encodeURIComponent(ID)}`]: { status: 200, body: DETAIL },
    [`${A}/${encodeURIComponent(ID)}/history`]: { status: 200, body: { id: ID, path: 'docs/el.md', entries: [] } },
    [`${A}/amb`]: { status: 409, body: AMBIGUOUS },
    [`/api/p/${PID}/directives`]: { status: 200, body: { entries: [], warnings: [] } },
    ...over,
  });
}

it('Element page: topline, state machine chips and their accessible names show the escaped keys', async () => {
  stubApi(elementApi());
  const { container } = renderApp(`/p/${PID}/e/${encodeURIComponent(ID)}`);
  await screen.findByText('Element title');
  const main = container.querySelector('main') ?? container;
  expect(rawHits(main)).toEqual([]);
  const chips = main.querySelector('.state-machine')?.textContent ?? '';
  expect(chips).toContain(SHOWN(STATE));
  expect(chips).toContain('plain-s');
  expect(main.querySelector('.element-id')?.textContent).toBe(SHOWN(ID));
  expect(main.querySelector('.type-tag')?.textContent).toBe(SHOWN(TYPE));
});

it('Element page: the candidates of an ambiguous short id show the escaped keys', async () => {
  stubApi(elementApi());
  const { container } = renderApp(`/p/${PID}/e/amb`);
  await screen.findByText('Candidate title');
  const main = container.querySelector('main') ?? container;
  expect(rawHits(main)).toEqual([]);
  expect(main.textContent).toContain(SHOWN(ID));
  expect(main.textContent).toContain(SHOWN(STATE));
  expect(main.textContent).toContain(SHOWN(TYPE));
});

/** A shown completion: an element reference (raw id) and a pattern reference (id served escaped). */
const COMPLETION = {
  state: 'shown',
  value: 0.5,
  percent: 50,
  references: [
    { id: ID, element: true, done: 1, total: 2, percent: 50 },
    { id: PATTERN, element: false, done: 0, total: 1, percent: 0 },
  ],
  referencesCount: 2,
  ids: [ID],
} as const;

const TRACE = {
  ui: { source: 'file' },
  patterns: true,
  scope: {
    type: DISPLAY,
    current: { id: ID, shortId: ID, title: 'Current', type: TYPE, status: STATE, tone: 'active' },
    applied: 'current',
  },
  figures: {
    completion: COMPLETION,
    phaseCompletion: READ_ONLY,
    coverage: { state: 'shown', carrying: 1, total: 2, percent: 50 },
    referencesWithoutElements: 0,
  },
  references: [
    {
      id: ID,
      category: 'requirement',
      element: true,
      linked: [ID],
      done: 1,
      total: 2,
      percent: 50,
      status: 'in-progress',
    },
    {
      id: PATTERN,
      category: 'feature',
      element: false,
      linked: [ID],
      done: 0,
      total: 1,
      percent: 0,
      status: 'not-started',
    },
  ],
  missing: [{ id: ID, categories: ['requirement'] }],
  elements: [
    {
      path: 'docs/x.md',
      id: ID,
      shortId: 'k-001\u202e',
      title: 'Traced element',
      type: TYPE,
      status: STATE,
      tags: [],
      localChanges: false,
      descriptor: {
        id: ID,
        type: TYPE,
        status: STATE,
        kind: 'work',
        tone: 'human',
        verbs: [],
        actor: { kind: 'none' },
      },
      done: false,
      inScope: true,
    },
  ],
  unreadable: [ID],
  capped: [ID, 'k-009-plain'],
} as unknown as Traceability;

it('Traceability: table, chips, tooltip ids and the missing section show escaped keys', async () => {
  const T = `/api/p/${PID}/traceability`;
  stubApi(
    base({
      [`/api/p/${PID}`]: { status: 200, body: header() },
      [`${T}?scope=current`]: { status: 200, body: TRACE },
      [`${T}?scope=project`]: { status: 200, body: TRACE },
    }),
  );
  const { container } = renderApp(`/p/${PID}/traceability`);
  await screen.findAllByText('Traced element');
  const main = container.querySelector('main') ?? container;
  expect(rawHits(main)).toEqual([]);
  expect(main.textContent).toContain(SHOWN(STATE));
  expect(main.textContent).toContain(SHOWN(TYPE));
});

function traceApi(): FakeApi {
  const T = `/api/p/${PID}/traceability`;
  return base({
    [`/api/p/${PID}`]: { status: 200, body: header() },
    [`${T}?scope=current`]: { status: 200, body: TRACE },
    [`${T}?scope=project`]: { status: 200, body: TRACE },
  });
}

it('Traceability: the current-scope toggle shows the raw element id escaped once and the served type as served', async () => {
  stubApi(traceApi());
  const { container } = renderApp(`/p/${PID}/traceability`);
  await screen.findAllByText('Traced element');
  const toggle = container.querySelector('.trace-scope');
  expect(toggle?.textContent).toContain(`${SHOWN(ID)} (current ${DISPLAY})`);
  expect(rawHits(toggle!)).toEqual([]);
});

it('Traceability: the unreadable and capped notices show each raw element id escaped once', async () => {
  stubApi(traceApi());
  const { container } = renderApp(`/p/${PID}/traceability`);
  await screen.findAllByText('Traced element');
  const notes = [...container.querySelectorAll('.trace-notice')].map((n) => n.textContent ?? '');
  expect(notes).toHaveLength(2);
  expect(notes[0]).toMatch(new RegExp(`counted \u2014 ${SHOWN(ID).replaceAll('\\', '\\\\')}$`));
  expect(notes[1]).toContain(`${SHOWN(ID)}, k-009-plain`);
  expect(notes.some(hasRaw)).toBe(false);
});

it('Traceability: a pattern reference is shown as served (row, toggle name, detail), an element reference escaped once', async () => {
  stubApi(traceApi());
  const user = userEvent.setup();
  const { container } = renderApp(`/p/${PID}/traceability`);
  await screen.findAllByText('Traced element');
  const patternRow = [...container.querySelectorAll('tr')].find((r) => r.querySelector('.trace-ref-id:not(a)'));
  expect(patternRow?.querySelector('.trace-ref-id')?.textContent).toBe(PATTERN);
  const toggle = within(patternRow as HTMLElement).getByRole('button', { name: `Details of ${PATTERN}` });
  // The element reference shows its element's short id (raw key `k-001` + U+202E), escaped once.
  expect(container.querySelector('a.trace-ref-id')?.textContent).toBe(SHOWN('k-001‮'));
  await user.click(toggle);
  expect(container.querySelector('.trace-detail-heading')?.textContent).toBe(PATTERN);
  expect(rawHits(container)).toEqual([]);
  await user.click(
    within(container.querySelector('tbody') as HTMLElement).getByRole('button', { name: `Details of ${SHOWN(ID)}` }),
  );
  expect([...container.querySelectorAll('.trace-detail-heading')].map((h) => h.textContent)).toContain(SHOWN(ID));
});

it('Completion explanation: element references escaped once, pattern references as served', () => {
  render(
    <AppIntlProvider>
      <CompletionExplanation figure={COMPLETION as never} />
    </AppIntlProvider>,
  );
  const items = [...document.querySelectorAll('.progress-reference')].map((n) => n.textContent);
  expect(items).toEqual([`${SHOWN(ID)} 50 %`, `${PATTERN} 0 %`]);
});

/** A `/config` answer as the server serialised it (`uiConfigBody`): display strings already escaped. */
const SERVED_UI = {
  ...UI_DECLARED,
  taxonomy: {
    categories: [{ type: DISPLAY, category: 'work', origin: 'declared' as const }],
    patterns: { value: [{ match: '^(P\\d|Journey)', category: 'feature' as const }], origin: 'declared' as const },
    requires: { value: [{ type: DISPLAY, categories: ['requirement' as const] }], origin: 'declared' as const },
  },
  progress: {
    ...UI_DECLARED.progress,
    scope: {
      value: { type: DISPLAY },
      origin: 'declared' as const,
      current: { id: ID, shortId: ID, title: 'Cur', type: TYPE, status: STATE, tone: 'active' as const },
    },
    phases: { value: [DISPLAY], origin: 'declared' as const },
    iterates: { value: DISPLAY, origin: 'declared' as const },
    defects: { value: null, origin: 'declared' as const },
  },
  holds: {
    value: [{ type: DISPLAY, state: DISPLAY, approve: 'never' as const }],
    origin: 'declared' as const,
  },
  artifacts: { value: [{ path: DISPLAY, phase: DISPLAY }], origin: 'declared' as const },
};

it('Configuration: served display values are shown as served, the current element\u2019s raw keys escaped once', async () => {
  stubApi(uiApi(SERVED_UI as never));
  for (const tab of ['progress', 'taxonomy']) {
    const { container } = renderApp(`/p/p_fx/configuration/${tab}`);
    await screen.findByRole('heading', { level: 1 });
    await screen.findByText(/./, { selector: 'code' });
    const main = container.querySelector('main') ?? container;
    expect(rawHits(main), tab).toEqual([]);
    const text = main.textContent ?? '';
    expect(text, tab).toContain(DISPLAY);
    // The served escape is not escaped again: it would double each of its backslashes.
    expect(text, tab).not.toContain('kind\\\\u202e');
    expect(text, tab).not.toContain('\\\\\\\\suffix');
    if (tab === 'progress') {
      expect(main.querySelector('.element-id')?.textContent).toBe(SHOWN(ID));
      expect(text).toContain(SHOWN(STATE));
    }
    cleanup();
  }
});

it('DNA: agents’ executes_as and path categories show escaped keys; serialised display fields are escaped once', async () => {
  const raw = {
    ...DNA,
    modules: [{ name: 'mod-a', path: 'src\u202e/\x1b\u200b\\x' }],
    stacks: { technologies: [], methodologies: [{ name: 'Method One', phase: 'ph\x1base\u200b\\' }] },
    team: {
      members: [{ name: 'Ann Lee', email: 'ann@x.test', roles: [ROLE] }],
      roles: [{ name: ROLE }],
      agents: [{ name: 'Bot', executes_as: [ROLE, 'r-plain'], approval_authority: false }],
    },
    paths: { ['sources\u202e\x1b\u200b']: ['plain/', 'v\u202e\\'], docs: [] },
  };
  const served = dnaBody(raw as never);
  stubApi(projectApi({ [`${BASE}/config`]: { status: 200, body: config({ data: served }) } }));
  const { container } = renderApp('/p/p_fx/dna');
  await screen.findByText('Method One');
  const main = container.querySelector('main') ?? container;
  expect(rawHits(main)).toEqual([]);
  const text = main.textContent ?? '';
  // Keys: one escape by the web.
  expect(text).toContain(`executes as ${SHOWN(ROLE)}, r-plain`.replace('executes as ', ''));
  expect(text).toContain(SHOWN('sources\u202e\x1b\u200b'));
  // Display fields: escaped once, by the server (a backslash is doubled once, never twice).
  expect(text).toContain('src\\u202e/\\x1b\\u200b\\\\x');
  expect(text).toContain('ph\\x1base\\u200b\\\\');
  expect(text).not.toContain('\\\\\\\\');
  expect(text).toContain('v\\u202e\\\\');
  expect(text).toContain('plain/');
});
