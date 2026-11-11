// @vitest-environment jsdom
// task-072 AC-4 (D72-6; bug-035, spec-004 §3) — a documentation path is an address and the text the
// page shows is its `label`: the index shows the label (its folder and its file name) and links to the
// raw path; the document page's toolbar, its article and its page title show the content's label.
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { resetSession } from '../../../web/src/session/session.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';

const PID = 'p_fx';
const API = `/api/p/${PID}`;
const RLO = String.fromCodePoint(0x202e);
const ESC = String.fromCodePoint(0x1b);
/** The raw path (the address) and its label (as `neutralise` writes it). */
const PATH = `docs/g${RLO}uide/doc ${RLO}x${ESC}y.md`;
const LABEL = 'docs/g\\u202euide/doc \\u202ex\\x1by.md';

function api(over: FakeApi = {}): FakeApi {
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'custom', path: '/x', remote: '', availability: 'ok' }] },
    },
    [`${API}/docs`]: { status: 200, body: { roots: ['docs'], documents: [{ path: PATH, label: LABEL }] } },
    [`${API}/files/content?path=${encodeURIComponent(PATH)}`]: {
      status: 200,
      body: { path: PATH, label: LABEL, size: 9, content: '# Heading' },
    },
    [`${API}/elements`]: { status: 200, body: { elements: [], warnings: [] } },
    ...over,
  };
}

beforeEach(() => {
  resetSession();
  stubApi(api());
});
afterEach(() => {
  cleanup();
  stopEventStream();
  vi.unstubAllGlobals();
});

const raw = (text: string): boolean => text.includes(RLO) || text.includes(ESC);

it('the index shows the label and links to the raw path', async () => {
  renderApp(`/p/${PID}/docs`);
  const section = await screen.findByRole('region', { name: 'docs/g\\u202euide' });
  const link = within(section).getByRole('link');
  expect(link.textContent).toBe(`1.1doc \\u202ex\\x1by.md${LABEL}`);
  expect(decodeURIComponent(link.getAttribute('href') ?? '')).toContain(PATH);
  expect(raw(document.body.textContent ?? '')).toBe(false);
});

it('the document page shows the content label in its toolbar, its article and its page title', async () => {
  renderApp(`/p/${PID}/docs/${PATH.split('/').map(encodeURIComponent).join('/')}`);
  expect(await screen.findByRole('article', { name: LABEL })).toBeTruthy();
  expect(screen.getByText(LABEL)).toBeTruthy();
  await waitFor(() => expect(document.title).toBe(`custom · ${LABEL} — WingFoil UI`));
  expect(raw(document.body.textContent ?? '')).toBe(false);
  expect(raw(document.title)).toBe(false);
});
