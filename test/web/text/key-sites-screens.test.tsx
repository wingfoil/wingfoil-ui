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
import { cleanup, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { resetSession } from '../../../web/src/session/session.js';
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
    type: TYPE,
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
  unreadable: [],
  capped: [],
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

function todayApi(): FakeApi {
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
    [`/api/p/${PID}/progress`]: { status: 200, body: PROGRESS },
  });
}

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

const TRACE = {
  ui: { source: 'file' },
  patterns: true,
  scope: { type: null, current: null, applied: 'project' },
  figures: {
    completion: {
      state: 'shown',
      value: 0.5,
      percent: 50,
      references: [{ id: ID, done: 1, total: 2, percent: 50 }],
      referencesCount: 1,
      ids: [ID],
    },
    phaseCompletion: READ_ONLY,
    coverage: { state: 'shown', carrying: 1, total: 2, percent: 50 },
    referencesWithoutElements: 0,
  },
  references: [
    {
      id: ID,
      category: 'cat\u202e\x1b',
      element: true,
      linked: [ID],
      done: 1,
      total: 2,
      percent: 50,
      status: 'in-progress',
    },
    {
      id: 'US-\u202e01',
      category: 'cat\u200b',
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
  unreadable: [],
  capped: [],
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

it('Configuration: Progress and Taxonomy show escaped types, states, ids and categories', async () => {
  const ui = {
    ...UI_DECLARED,
    taxonomy: {
      ...UI_DECLARED.taxonomy,
      categories: [{ type: TYPE, category: 'cat\u202e\x1b', origin: 'declared' as const }],
      requires: { value: [{ type: TYPE, categories: ['re\x1bq'] }], origin: 'declared' as const },
    },
    progress: {
      ...UI_DECLARED.progress,
      scope: {
        value: { type: TYPE },
        origin: 'declared' as const,
        current: { id: ID, shortId: ID, title: 'Cur', type: TYPE, status: STATE, tone: 'active' as const },
      },
    },
    holds: { value: [{ type: TYPE, state: STATE, approve: 'never' as const }], origin: 'declared' as const },
  };
  stubApi(uiApi(ui as never));
  for (const tab of ['progress', 'taxonomy']) {
    const { container } = renderApp(`/p/p_fx/configuration/${tab}`);
    await screen.findByRole('heading', { level: 1 });
    await screen.findByText(/./, { selector: 'code' });
    const main = container.querySelector('main') ?? container;
    expect(rawHits(main), tab).toEqual([]);
    expect(main.textContent, tab).toContain(SHOWN(TYPE));
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
