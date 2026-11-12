// @vitest-environment jsdom
// task-056 AC-3 (bug-027; spec-004 §5) — the element panel shows the texts the API escaped as text:
// a title, a rejection and history entries whose commit texts held a bidi override, a zero-width
// space and ESC come from the server as visible escapes (`\u202e`, `\u200b`, `\x1b`), and the page
// shows those escapes as written — never the raw characters (characterization: React renders text).
import type { ElementDetail, MemoryHistory } from '@wingfoil-ui/contracts';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { resetSession } from '../../../web/src/session/session.js';
import { header } from '../dna/data.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';

const PID = 'p_fx';
const EID = 'task-005-hostile-title';
const BASE = `/api/p/${PID}/elements/${EID}`;

/** The escapes as the server writes them (`neutralise`): a backslash, `u202e`. */
const TITLE = 'Hostile \\u202eeltit\\u200b title';
const REJECTER = 'Morgan \\u202enagroM';
const REASON = 'Rejected \\u202etxt.exe\\u200b at <project>/docs/x.md';
const SUBJECT = 'edit \\u202etxt.exe\\u200b \\x1b[31m at <project>/docs/x.md';

const DETAIL: ElementDetail = {
  element: {
    path: `docs/memory/task/${EID}.md`,
    id: EID,
    title: TITLE,
    type: 'task',
    status: 'draft',
    tags: [],
    localChanges: false,
  },
  frontmatter: { id: EID, type: 'task', title: TITLE, status: 'draft' },
  body: 'Body.\n',
  descriptor: {
    id: EID,
    type: 'task',
    status: 'draft',
    kind: 'first',
    tone: 'neutral',
    verbs: [],
    actor: { kind: 'member', member: { name: 'Jordan', email: 'jordan@example.test' } },
    rejection: { by: REJECTER, reason: REASON, at: '2026-09-29T15:20:04+00:00' },
  },
  required: [],
  states: { sequence: ['draft', 'pending', 'done'], gates: { pending: { reject: 'draft' } } },
};

const HISTORY: MemoryHistory = {
  id: EID,
  path: DETAIL.element.path,
  // Oldest first, as `memory history` lists them; the panel shows the newest first.
  entries: [
    {
      sha: '3333333ccccccccccccccccccccccccccccccccc',
      author: `${REJECTER} <morgan@example.test>`,
      timestamp: '2026-09-29T15:20:04+00:00',
      operation: 'reject',
      from: 'pending',
      to: 'draft',
      approver: `${REJECTER} <morgan@example.test> (approver)`,
      reason: REASON,
      subject: `wf(task): reject ${EID} [pending → draft]`,
    },
    {
      sha: '4444444ddddddddddddddddddddddddddddddddd',
      author: 'Jordan \\u202enadroJ <jordan@example.test>',
      timestamp: '2026-09-29T15:20:05+00:00',
      operation: null,
      from: null,
      to: null,
      approver: null,
      reason: null,
      subject: SUBJECT,
    },
  ],
};

function api(over: FakeApi = {}): FakeApi {
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'kanban', path: '/x', remote: null, availability: 'available' }] },
    },
    [BASE]: { status: 200, body: DETAIL },
    [`${BASE}/history`]: { status: 200, body: HISTORY },
    [`/api/p/${PID}/directives`]: { status: 200, body: { entries: [], warnings: [] } },
    [`/api/p/${PID}`]: { status: 200, body: header({ kind: 'no-identity' }) },
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

/** The raw characters the escapes stand for. */
const raw = (text: string): boolean => [0x202e, 0x200b, 0x1b].some((c) => text.includes(String.fromCodePoint(c)));

it('shows the escaped title, rejection and history texts as written (bug-027, K1)', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/e/${EID}`);
  const dialog = await screen.findByRole('region', { name: TITLE });
  const d = within(dialog);
  expect(d.getByText(`Rejected by ${REJECTER}: ${REASON}`)).toBeTruthy();
  await d.findByText('edited outside a WingFoil verb by Jordan \\u202enadroJ');
  const lines = d
    .getAllByRole('listitem')
    .filter((li) => li.className === 'history-entry')
    .map((li) => li.textContent ?? '');
  expect(lines).toHaveLength(2);
  expect(lines[1]).toContain(`rejected by ${REJECTER}`);
  expect(lines[1]).toContain(`“${REASON}”`);
  expect(raw(dialog.textContent ?? '')).toBe(false);
});
