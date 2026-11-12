// @vitest-environment jsdom
// task-078 AC-6 — bug-043: a link of a rendered document is the same element before and after a
// link check answers (`RenderedArticle` keeps its anchors and replaces only the link groups whose
// classification changed, D78-1), so a click on it while a lookup is in flight is never lost.
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { resetSession } from '../../../web/src/session/session.js';
import { renderApp, serverInfo, type FakeApi } from '../shell/render.js';

const PID = 'p_fx';
const API = `/api/p/${PID}`;
const content = (path: string) => `${API}/files/content?path=${encodeURIComponent(path)}`;
const doc = (path: string, text: string) => ({ status: 200, body: { path, label: path, size: text.length, content: text } });
const DOC = 'docs/01_vision/links.md';
const MISSING = content('docs/01_vision/missing-file.md');

const LINKS = [
  '# Links',
  '',
  '[vision](02_product-vision.md)',
  '[nowhere](missing-file.md)',
  '[guide](https://example.test/guide)',
  '',
].join('\n');

function answers(body = LINKS): FakeApi {
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'custom', path: '/x', remote: null, availability: 'available' }] },
    },
    [`${API}/docs`]: {
      status: 200,
      body: {
        roots: ['docs'],
        documents: [
          { path: DOC, label: DOC },
          { path: 'docs/01_vision/02_product-vision.md', label: 'docs/01_vision/02_product-vision.md' },
        ],
      },
    },
    [content(DOC)]: doc(DOC, body),
    [content('docs/01_vision/02_product-vision.md')]: doc('docs/01_vision/02_product-vision.md', '# Product vision'),
    [`${API}/elements`]: { status: 200, body: { elements: [], warnings: [] } },
    [MISSING]: { status: 404, body: { error: { code: 'not-found', message: 'Not found', detail: { kind: 'missing' } } } },
  };
}

/** Stub `fetch` with `api`, the check of the missing file held until `release()`. */
function holdMissing(api: FakeApi): () => void {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === MISSING) await gate;
      const a = api[url] ?? { status: 404, body: { error: { code: 'not-found', message: 'Not found' } } };
      return new Response(JSON.stringify(a.body), { status: a.status, headers: { 'content-type': 'application/json' } });
    }),
  );
  return () => release();
}

beforeEach(() => {
  resetSession();
});
afterEach(() => {
  cleanup();
  stopEventStream();
  vi.unstubAllGlobals();
});

it('bug-043 — a link keeps its element while a lookup answers, and a click on it opens', async () => {
  const release = holdMissing(answers());
  const { router } = renderApp(`/p/${PID}/docs/${DOC}`);
  const article = await screen.findByRole('article', { name: DOC });
  const vision = await within(article).findByRole('link', { name: 'vision' });
  const guide = within(article).getByRole('link', { name: 'guide (opens in a new tab)' });
  // The check of the missing file is in flight: its link waits.
  expect(within(article).getByText('nowhere').className).toBe('doc-link-unresolved');
  release();
  await waitFor(() => expect(within(article).getByText('nowhere').className).toBe('doc-link-refused'));
  expect(within(article).getByText('nowhere').nextElementSibling?.textContent).toBe('broken link');
  // The links that did not change are the same elements: a click taken before the answer lands.
  expect(vision.isConnected).toBe(true);
  expect(guide.isConnected).toBe(true);
  expect(within(article).getByRole('link', { name: 'vision' })).toBe(vision);
  expect(within(article).getByRole('link', { name: 'guide (opens in a new tab)' })).toBe(guide);
  await userEvent.click(vision);
  await waitFor(() =>
    expect(decodeURI(router.state.location.pathname)).toBe(`/p/${PID}/docs/docs/01_vision/02_product-vision.md`),
  );
});

it('a refetched document replaces the content (another frame)', async () => {
  const api = answers();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const a = api[url] ?? { status: 404, body: { error: { code: 'not-found', message: 'Not found' } } };
      return new Response(JSON.stringify(a.body), { status: a.status, headers: { 'content-type': 'application/json' } });
    }),
  );
  const { queryClient } = renderApp(`/p/${PID}/docs/${DOC}`);
  const article = await screen.findByRole('article', { name: DOC });
  await waitFor(() => expect(within(article).getByText('nowhere').className).toBe('doc-link-refused'));
  api[content(DOC)] = doc(DOC, `${LINKS}\nA new paragraph.\n`);
  await queryClient.invalidateQueries();
  expect(await within(article).findByText('A new paragraph.')).toBeTruthy();
  expect(within(article).getByRole('link', { name: 'vision' })).toBeTruthy();
});
