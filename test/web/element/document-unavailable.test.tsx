// @vitest-environment jsdom
// task-078 security review round 1, F-2: when the element's document module cannot be loaded (a tab
// left open across an upgrade, the old chunk gone), the summary's place says so and offers a
// reload; the rest of the element — its heading, references, history, footer — and the shell stay.
import type { ElementDetail, MemoryHistory } from '@wingfoil-ui/contracts';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { keyCatalogue } from '../../../web/scripts/catalogue.mjs';
import { stopEventStream } from '../../../web/src/api/events.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { resetSession } from '../../../web/src/session/session.js';
import { header } from '../dna/data.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';

vi.mock('../../../web/src/element/document.js', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

const PID = 'p_fx';
const EID = 'el-002-reset';
const API = `/api/p/${PID}`;

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
  frontmatter: { id: EID, type: 'kind-a', title: 'Password reset', status: 's1', owner: 'Jordan' },
  body: 'Users forget passwords.\n',
  states: { sequence: ['s1', 's2'], gates: {} },
};

const HISTORY: MemoryHistory = { id: EID, path: 'docs/el.md', entries: [] };

function api(): FakeApi {
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'kanban', path: '/x', remote: null, availability: 'available' }] },
    },
    [`${API}`]: { status: 200, body: header({ kind: 'no-identity' }) },
    [`${API}/directives`]: { status: 200, body: { entries: [], warnings: [] } },
    [`${API}/elements/${EID}`]: { status: 200, body: DETAIL },
    [`${API}/elements/${EID}/history`]: { status: 200, body: HISTORY },
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

it('F-2 — says the summary and the document are unavailable and keeps the rest of the element', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/e/${EID}`);
  const page = await screen.findByRole('region', { name: 'Password reset' });
  const section = within(page).getByRole('heading', { name: 'Summary' }).closest('section')!;
  expect(
    await within(section).findByText('The summary and the document could not be loaded. Reload the page to try again.'),
  ).toBeTruthy();
  expect(within(section).getByRole('button', { name: 'Reload the page' })).toBeTruthy();
  // The rest of the element and the shell stay.
  expect(within(page).getByRole('heading', { level: 1, name: 'Password reset' })).toBeTruthy();
  expect(within(page).getByText('owner')).toBeTruthy();
  expect(within(page).getByRole('heading', { name: 'History' })).toBeTruthy();
  expect(screen.getByRole('navigation', { name: 'Project views' })).toBeTruthy();
  expect(screen.queryByText('Something went wrong!')).toBeNull();
});

it('F-2 — the side panel over Directives keeps the view and the panel', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/directives?panel=${EID}`);
  const panel = await screen.findByRole('dialog', { name: 'Password reset' });
  expect(
    await within(panel).findByText('The summary and the document could not be loaded. Reload the page to try again.'),
  ).toBeTruthy();
  expect(screen.getByRole('main')).toBeTruthy();
  expect(screen.queryByText('Something went wrong!')).toBeNull();
});

it('F-2 — its texts come from the catalogue (key build)', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/e/${EID}`, keyCatalogue(en));
  expect(await screen.findByText('element.document.unavailable')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'element.document.reload' })).toBeTruthy();
});
