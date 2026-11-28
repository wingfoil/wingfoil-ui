// @vitest-environment jsdom
// task-085 AC-1 (review round 4, R4-F1) — the browser tab title is a rendering site of the keys too:
// the element page and the directive page escape the raw id they interpolate, once, while the project
// name (served as the display value it is) and the composed title are not escaped again.
import type { ElementDetail } from '@wingfoil-ui/contracts';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { resetSession } from '../../../web/src/session/session.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';
import { BASE, BO, DIRECTIVES, header, projectApi } from '../dna/data.js';

const PID = 'p_fx';
const BAD_ID = 'k-001-\u202eevil\x1bid\u200b';
const PLAIN_ID = 'k-002-plain';
// A project name holding a literal backslash: shown as served, never escaped a second time.
const NAME = 'de\\mo';
const SHOWN = (s: string): string =>
  s.replaceAll('\u202e', '\\u202e').replaceAll('\x1b', '\\x1b').replaceAll('\u200b', '\\u200b');
const RAW_CHARS = ['\u202e', '\x1b', '\u200b'];
const hasRaw = (text: string): boolean => RAW_CHARS.some((c) => text.includes(c));

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

const detail = (id: string): ElementDetail => ({
  element: {
    path: 'docs/el.md',
    id,
    shortId: 'k-001',
    title: 'Element title',
    type: 'task',
    status: 'draft',
    tags: [],
    localChanges: false,
  },
  frontmatter: { id, type: 'task', title: 'Element title', status: 'draft' },
  body: 'Body text.\n',
  states: { sequence: ['draft'], gates: {} },
});

function elementApi(id: string): FakeApi {
  const A = `/api/p/${PID}/elements/${encodeURIComponent(id)}`;
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: NAME, path: '/x', remote: null, availability: 'available' }] },
    },
    [`/api/p/${PID}`]: { status: 200, body: header(BO, 'r-dev') },
    [A]: { status: 200, body: detail(id) },
    [`${A}/history`]: { status: 200, body: { id, path: 'docs/el.md', entries: [] } },
    [`/api/p/${PID}/directives`]: { status: 200, body: { entries: [], warnings: [] } },
  };
}

it.each([
  ['hostile', BAD_ID],
  ['plain', PLAIN_ID],
])('element page: the tab title shows the %s id escaped once and the project name as served', async (_n, id) => {
  stubApi(elementApi(id));
  renderApp(`/p/${PID}/e/${encodeURIComponent(id)}`);
  await screen.findByText('Element title');
  const expected = `${NAME} · ${SHOWN(id)} — WingFoil UI`;
  await waitFor(() => expect(document.title).toBe(expected));
  expect(hasRaw(document.title)).toBe(false);
});

it.each([
  ['hostile', BAD_ID],
  ['plain', PLAIN_ID],
])('directive page: the tab title shows the %s id escaped once and the project name as served', async (_n, did) => {
  const base = DIRECTIVES.entries[0]!;
  const entry = { ...base, mine: true };
  stubApi(
    projectApi({
      [BASE]: { status: 200, body: header(BO, 'r-dev') },
      '/api/projects': {
        status: 200,
        body: { projects: [{ id: PID, name: NAME, path: '/x', remote: null, availability: 'available' }] },
      },
      [`${BASE}/directives`]: { status: 200, body: { entries: [entry], warnings: [] } },
      [`${BASE}/directives/${encodeURIComponent(did)}`]: {
        status: 200,
        body: { entry, frontmatter: entry.frontmatter, body: '# Title\n\ntext\n' },
      },
    }),
  );
  renderApp(`/p/${PID}/directives/${encodeURIComponent(did)}`);
  await screen.findByText(/^\.wingfoil\/directives\//);
  const expected = `${NAME} · ${SHOWN(did)} — WingFoil UI`;
  await waitFor(() => expect(document.title).toBe(expected));
  expect(hasRaw(document.title)).toBe(false);
});
