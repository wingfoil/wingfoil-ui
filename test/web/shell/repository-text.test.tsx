// @vitest-environment jsdom
// task-072 AC-4 (bug-035; spec-004 §5, D72-12) — the screens show the repository display texts the
// API escaped as they come: the project's name in the switcher and the page title, the identity's
// name in the header, a directive's title in its list row, its page heading and its page title, and
// a history entry's states — each `\u202e` written once, never escaped again and never the raw
// character (characterization: the web escapes nothing, React renders text).
import type { DirectiveDetail, DirectiveList, ElementDetail, Identity, MemoryHistory } from '@wingfoil-ui/contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { resetSession } from '../../../web/src/session/session.js';
import { BASE, header, PID } from '../dna/data.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from './render.js';

/** The texts as the server writes them (`neutralise`): a backslash, `u202e`; a backslash, `x1b`. */
const PROJECT = 'Project \\u202ex\\x1by';
const MEMBER = 'Alex \\u202ex\\x1by';
const TITLE = 'Directive title \\u202ex\\x1by';
const STATE = 'state \\u202ex\\x1by';

const IDENTITY: Identity = { kind: 'member', email: 'alex\\u202e\\x1b@example.test', name: MEMBER, roles: ['r-dev'] };

const ENTRY: DirectiveList['entries'][number] = {
  path: 'directives/custom/hostile-directive.md',
  frontmatter: {
    id: 'hostile-directive',
    name: 'Directive \\u202ex\\x1by',
    type: 'directive',
    kind: 'custom',
    title: TITLE,
  },
  roles: [],
  global: true,
  assignment: 'global (all roles)',
  mine: true,
};
const DIRECTIVE: DirectiveDetail = { entry: ENTRY, frontmatter: ENTRY.frontmatter, body: 'No heading of its own.\n' };

const EID = 'task-006-hand-state';
const DETAIL: ElementDetail = {
  element: {
    path: `docs/memory/task/${EID}.md`,
    id: EID,
    title: 'Hand state',
    type: 'task',
    status: 'draft',
    tags: [],
    localChanges: false,
  },
  frontmatter: { id: EID, type: 'task', title: 'Hand state', status: 'draft' },
  body: '',
  required: [],
  states: { sequence: ['draft', 'pending', 'done'], gates: {} },
};
const HISTORY: MemoryHistory = {
  id: EID,
  path: DETAIL.element.path,
  entries: [
    {
      sha: '1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      author: 'Jordan <jordan@example.test>',
      timestamp: '2026-09-29T15:20:04+00:00',
      operation: null,
      from: 'draft',
      to: STATE,
      approver: null,
      reason: null,
      subject: 'edit: a state written by hand',
    },
    {
      sha: '2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      author: 'Jordan <jordan@example.test>',
      timestamp: '2026-09-29T15:20:05+00:00',
      operation: null,
      from: STATE,
      to: 'draft',
      approver: null,
      reason: null,
      subject: 'edit: the state set back',
    },
  ],
};

function api(over: FakeApi = {}): FakeApi {
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: {
        projects: [
          {
            id: PID,
            name: PROJECT,
            path: '/x',
            remote: 'https://example.test/r\\u202eo\\x1b.git',
            availability: 'available',
          },
        ],
      },
    },
    [BASE]: { status: 200, body: { ...header(IDENTITY, 'r-dev'), name: PROJECT } },
    [`${BASE}/directives`]: { status: 200, body: { entries: [ENTRY], warnings: [] } },
    [`${BASE}/directives/hostile-directive`]: { status: 200, body: DIRECTIVE },
    [`${BASE}/elements/${EID}`]: { status: 200, body: DETAIL },
    [`${BASE}/elements/${EID}/history`]: { status: 200, body: HISTORY },
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

/** A raw U+202E or ESC, or an escape written twice (`\\u202e`). */
const unsafe = (text: string): boolean =>
  text.includes(String.fromCodePoint(0x202e)) ||
  text.includes(String.fromCodePoint(0x1b)) ||
  /\\\\(?:u202e|x1b)/.test(text);

it('the directives list and page, the switcher, the header and the page title show the texts as written', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/directives`);
  expect(await screen.findByText(TITLE)).toBeTruthy();
  cleanup();
  renderApp(`/p/${PID}/directives/hostile-directive`);
  expect(await screen.findByRole('heading', { level: 1, name: TITLE })).toBeTruthy();
  expect(screen.getByRole('article', { name: TITLE })).toBeTruthy();
  await waitFor(() => expect(document.title).toBe(`${PROJECT} · hostile-directive — WingFoil UI`));
  expect(await screen.findByText(MEMBER, { exact: false })).toBeTruthy();
  expect(screen.getAllByText(PROJECT, { exact: false }).length).toBeGreaterThan(0);
  expect(unsafe(document.body.textContent ?? '')).toBe(false);
});

it("a history entry's states show as written", async () => {
  stubApi(api());
  renderApp(`/p/${PID}/e/${EID}`);
  const dialog = await screen.findByRole('dialog', { name: 'Hand state' });
  const d = within(dialog);
  expect(await d.findByText(`draft → ${STATE}`)).toBeTruthy();
  expect(d.getByText(`${STATE} → draft`)).toBeTruthy();
  expect(unsafe(dialog.textContent ?? '')).toBe(false);
});
