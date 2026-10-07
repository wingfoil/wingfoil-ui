// @vitest-environment jsdom
// task-020 — the Documentation view (US-R-08, US-R-09; ux-reference §4.9) at component level, on
// the whole application with a stubbed API: the index (sections, numbering, empty, error), a
// document (rendered, links routed inside the UI, Memory file → element panel, refused links marked
// and inert, external links in a new tab), the server checks of W3-30, the page title and the
// catalogue (every text a key).
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keyCatalogue } from '../../../web/scripts/catalogue.mjs';
import { stopEventStream } from '../../../web/src/api/events.js';
import { indexSections } from '../../../web/src/docs/DocsIndex.js';
import { MAX_LINK_CHECKS } from '../../../web/src/docs/pages.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { resetSession } from '../../../web/src/session/session.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';

const PID = 'p_fx';
const API = `/api/p/${PID}`;
const content = (path: string) => `${API}/files/content?path=${encodeURIComponent(path)}`;
const doc = (path: string, text: string) => ({ status: 200, body: { path, size: text.length, content: text } });
const refused = (kind: string) => ({
  status: 404,
  body: { error: { code: 'not-found', message: 'Not found', detail: { kind } } },
});

const LINKS = [
  '# Links',
  '',
  '[vision](02_product-vision.md#pillars)',
  '[decision](../04_memory/dls/dl-001-x.md)',
  '[nowhere](missing-file.md)',
  '[hosts](../../../etc/hosts)',
  '[source](../../src/index.ts)',
  '[guide](https://example.test/guide)',
  '[spaced](my%20doc.md)',
  '[top](#links)',
  '',
  '| A | B |',
  '|---|---|',
  '| 1 | 2 |',
].join('\n');

function api(over: FakeApi = {}): FakeApi {
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
          { path: 'docs/01_vision/00_index.md' },
          { path: 'docs/01_vision/02_product-vision.md' },
          { path: 'docs/01_vision/links.md' },
          { path: 'docs/01_vision/my doc.md' },
          { path: 'docs/guide.md' },
        ],
      },
    },
    [content('docs/01_vision/links.md')]: doc('docs/01_vision/links.md', LINKS),
    [content('docs/01_vision/02_product-vision.md')]: doc(
      'docs/01_vision/02_product-vision.md',
      '# Product vision\n\n## Pillars\n\nText.',
    ),
    [content('docs/01_vision/my doc.md')]: doc('docs/01_vision/my doc.md', '# Spaced'),
    [`${API}/elements`]: {
      status: 200,
      body: {
        elements: [
          {
            path: 'docs/04_memory/dls/dl-001-x.md',
            id: 'dl-001-x',
            title: 'X',
            type: 'kind-a',
            status: 's1',
            tags: [],
            localChanges: false,
          },
        ],
        warnings: [],
      },
    },
    [content('docs/01_vision/missing-file.md')]: refused('missing'),
    [content('src/index.ts')]: refused('not-allowed'),
    ...over,
  };
}

let fetchStub: ReturnType<typeof vi.fn>;
beforeEach(() => {
  resetSession();
  fetchStub = stubApi(api());
});
afterEach(() => {
  cleanup();
  stopEventStream();
  vi.unstubAllGlobals();
});

describe('indexSections (W3-28)', () => {
  it('groups by folder, numbered as the prototype', () => {
    expect(indexSections(['README.md', 'docs/a.md', 'docs/b/c.md', 'docs/d.md'])).toEqual([
      { number: '1', folder: '.', entries: [{ number: '1.1', name: 'README.md', path: 'README.md' }] },
      {
        number: '2',
        folder: 'docs',
        entries: [
          { number: '2.1', name: 'a.md', path: 'docs/a.md' },
          { number: '2.2', name: 'd.md', path: 'docs/d.md' },
        ],
      },
      { number: '3', folder: 'docs/b', entries: [{ number: '3.1', name: 'c.md', path: 'docs/b/c.md' }] },
    ]);
  });
});

describe('the index', () => {
  it('lists the documents by folder; the sidebar entry is current; a document opens in the UI', async () => {
    const { router } = renderApp(`/p/${PID}/docs`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Documentation' })).toBeTruthy();
    const section = await screen.findByRole('region', { name: 'docs/01_vision' });
    expect(within(section).getAllByRole('link').map((l) => l.textContent)).toEqual([
      '1.100_index.mddocs/01_vision/00_index.md',
      '1.202_product-vision.mddocs/01_vision/02_product-vision.md',
      '1.3links.mddocs/01_vision/links.md',
      '1.4my doc.mddocs/01_vision/my doc.md',
    ]);
    expect(within(section).getByRole('link', { name: 'links.md docs/01_vision/links.md' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'docs' })).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Project views' });
    expect(within(nav).getByRole('link', { name: 'Documentation' }).getAttribute('aria-current')).toBe('page');
    await waitFor(() => expect(document.title).toBe('custom · Documentation — WingFoil UI'));

    await userEvent.click(within(section).getByRole('link', { name: /my doc\.md/ }));
    await waitFor(() => expect(decodeURI(router.state.location.pathname)).toBe(`/p/${PID}/docs/docs/01_vision/my doc.md`));
    expect(await screen.findByRole('heading', { name: 'Spaced' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'docs/01_vision/my doc.md' })).toBeTruthy();
  });

  it('says when there is no document, and shows an error', async () => {
    stubApi(api({ [`${API}/docs`]: { status: 200, body: { roots: ['docs'], documents: [] } } }));
    renderApp(`/p/${PID}/docs`);
    expect(await screen.findByText('No documents under paths.docs.')).toBeTruthy();
    cleanup();
    stubApi(api({ [`${API}/docs`]: { status: 500, body: { error: { code: 'internal', message: 'x' } } } }));
    renderApp(`/p/${PID}/docs`);
    expect((await screen.findByRole('alert')).textContent).toContain('Something went wrong in the console');
  });
});

describe('a document', () => {
  async function openLinks() {
    const app = renderApp(`/p/${PID}/docs/docs/01_vision/links.md`);
    const article = await screen.findByRole('article', { name: 'docs/01_vision/links.md' });
    await waitFor(() => expect(within(article).queryByText('source')?.className).toBe('doc-link-refused'));
    return { ...app, article };
  }

  it('renders the Markdown and classifies every link', async () => {
    const { article } = await openLinks();
    expect(within(article).getByRole('heading', { level: 1, name: 'Links' })).toBeTruthy();
    expect(within(article).getByRole('region', { name: 'Table 1' })).toBeTruthy();
    expect(within(article).getByRole('link', { name: 'vision' }).getAttribute('href')).toBe(
      `/p/${PID}/docs/docs/01_vision/02_product-vision.md#pillars`,
    );
    expect(within(article).getByRole('link', { name: 'decision' }).getAttribute('href')).toBe(`/p/${PID}/e/dl-001-x`);
    const external = within(article).getByRole('link', { name: 'guide (opens in a new tab)' });
    expect(external.getAttribute('target')).toBe('_blank');
    expect(external.getAttribute('rel')).toBe('noopener noreferrer');
    const marks: Record<string, string> = {
      nowhere: 'broken link',
      hosts: 'outside the repository',
      source: 'not shown in the UI',
    };
    for (const [text, mark] of Object.entries(marks)) {
      expect(within(article).queryByRole('link', { name: text })).toBeNull();
      expect(within(article).getByText(text).nextElementSibling?.textContent).toBe(mark);
    }
    await waitFor(() => expect(document.title).toBe('custom · docs/01_vision/links.md — WingFoil UI'));
    // The outside path is never asked to the server.
    expect(fetchStub.mock.calls.map(([url]) => url as string).filter((u) => u.includes('etc'))).toEqual([]);
  });

  it('a document link opens it in the UI at its heading; the focus follows', async () => {
    const { article, router } = await openLinks();
    await userEvent.click(within(article).getByRole('link', { name: 'vision' }));
    await waitFor(() =>
      expect(decodeURI(router.state.location.pathname)).toBe(`/p/${PID}/docs/docs/01_vision/02_product-vision.md`),
    );
    expect(router.state.location.hash).toBe('pillars');
    const heading = await screen.findByRole('heading', { name: 'Pillars' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it('a Memory file link opens its element panel', async () => {
    const { article, router } = await openLinks();
    await userEvent.click(within(article).getByRole('link', { name: 'decision' }));
    await waitFor(() => expect(decodeURI(router.state.location.pathname)).toBe(`/p/${PID}/e/dl-001-x`));
  });

  it('selecting a refused link opens nothing', async () => {
    const { article, router } = await openLinks();
    await userEvent.click(within(article).getByText('nowhere'));
    await userEvent.click(within(article).getByText('hosts'));
    expect(decodeURI(router.state.location.pathname)).toBe(`/p/${PID}/docs/docs/01_vision/links.md`);
  });

  it('a fragment link moves the focus to its heading; keyboard Enter follows a link', async () => {
    const { article, router } = await openLinks();
    await userEvent.click(within(article).getByRole('link', { name: 'top' }));
    // The fragment is in the URL (review F2): Back and a copied URL work.
    await waitFor(() => expect(router.state.location.hash).toBe('links'));
    await waitFor(() =>
      expect(document.activeElement).toBe(within(article).getByRole('heading', { name: 'Links' })),
    );
    within(article).getByRole('link', { name: 'spaced' }).focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(decodeURI(router.state.location.pathname)).toBe(`/p/${PID}/docs/docs/01_vision/my doc.md`));
  });

  it('a modified click is left to the browser', async () => {
    const { article, router } = await openLinks();
    const link = within(article).getByRole('link', { name: 'vision' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(decodeURI(router.state.location.pathname)).toBe(`/p/${PID}/docs/docs/01_vision/links.md`);
  });

  it('without the elements, a Memory link is checked by the server like any path', async () => {
    stubApi(
      api({
        [`${API}/elements`]: { status: 500, body: { error: { code: 'internal', message: 'x' } } },
        [content('docs/04_memory/dls/dl-001-x.md')]: refused('not-allowed'),
      }),
    );
    renderApp(`/p/${PID}/docs/docs/01_vision/links.md`);
    const article = await screen.findByRole('article');
    await waitFor(() => expect(within(article).getByText('decision').nextElementSibling?.textContent).toBe('not shown in the UI'));
  });

  it('a document the server serves outside the index opens in the UI', async () => {
    stubApi(api({ [content('src/index.ts')]: doc('src/index.ts', 'x') }));
    renderApp(`/p/${PID}/docs/docs/01_vision/links.md`);
    const article = await screen.findByRole('article');
    expect((await within(article).findByRole('link', { name: 'source' })).getAttribute('href')).toBe(
      `/p/${PID}/docs/src/index.ts`,
    );
  });

  it.each([
    ['missing', 'This document does not exist.'],
    ['outside', 'This path is outside the repository.'],
    ['not-allowed', 'This file is not shown in the UI.'],
  ])('a refused document (%s) says why', async (kind, text) => {
    stubApi(api({ [content('docs/x.md')]: refused(kind) }));
    renderApp(`/p/${PID}/docs/docs/x.md`);
    expect((await screen.findByRole('alert')).textContent).toBe(text);
  });

  it('another error of the document is rendered from the catalogue', async () => {
    stubApi(api({ [content('docs/x.md')]: { status: 500, body: { error: { code: 'internal', message: 'x' } } } }));
    renderApp(`/p/${PID}/docs/docs/x.md`);
    expect((await screen.findByRole('alert')).textContent).toContain('Something went wrong in the console');
  });

  it('"← Index" goes back to the index', async () => {
    const { router } = await openLinks();
    await userEvent.click(screen.getByRole('link', { name: '← Index' }));
    await waitFor(() => expect(decodeURI(router.state.location.pathname)).toBe(`/p/${PID}/docs`));
  });

  it('every text comes from the catalogue (key build)', async () => {
    const keys = keyCatalogue(en);
    renderApp(`/p/${PID}/docs/docs/01_vision/links.md`, keys);
    const article = await screen.findByRole('article');
    await waitFor(() => expect(within(article).getByText('source').nextElementSibling?.textContent).toBe('docs.link.hidden'));
    expect(within(article).getByText('hosts').nextElementSibling?.textContent).toBe('docs.link.outside');
    expect(within(article).getByRole('link', { name: 'guide docs.link.newTab' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'docs.document.back' })).toBeTruthy();
    expect(within(article).getByRole('region', { name: 'docs.table.label 1' })).toBeTruthy();
  });

  it('the server answering outside for a link check marks it "outside the repository" (review F8)', async () => {
    // e.g. a symlink inside the repository leading out of it.
    stubApi(api({ [content('src/index.ts')]: refused('outside') }));
    renderApp(`/p/${PID}/docs/docs/01_vision/links.md`);
    const article = await screen.findByRole('article');
    await waitFor(() =>
      expect(within(article).getByText('source').nextElementSibling?.textContent).toBe('outside the repository'),
    );
    expect(within(article).queryByRole('link', { name: 'source' })).toBeNull();
  });
});

describe('the focus while the links are classified (review F1)', () => {
  /** The API with `GET /elements` held back until `release()`. */
  function heldElements() {
    const answers = api();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === `${API}/elements`) await gate;
        const a = answers[url] ?? refused('missing');
        return new Response(JSON.stringify(a.body), {
          status: a.status,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    return () => release();
  }

  it('a focused link keeps the focus when the classification updates', async () => {
    const release = heldElements();
    renderApp(`/p/${PID}/docs/docs/01_vision/links.md`);
    const article = await screen.findByRole('article');
    const vision = await within(article).findByRole('link', { name: 'vision' });
    expect(within(article).getByText('decision').className).toBe('doc-link-unresolved');
    vision.focus();
    release();
    await waitFor(() => expect(within(article).getByRole('link', { name: 'decision' })).toBeTruthy());
    expect(document.activeElement).toBe(within(article).getByRole('link', { name: 'vision' }));
    expect(document.activeElement).not.toBe(vision);
  });

  it('the heading of the URL fragment keeps the focus when the classification updates', async () => {
    const release = heldElements();
    renderApp(`/p/${PID}/docs/docs/01_vision/links.md#links`);
    const article = await screen.findByRole('article');
    await waitFor(() =>
      expect(document.activeElement).toBe(within(article).getByRole('heading', { name: 'Links' })),
    );
    release();
    await waitFor(() => expect(within(article).getByRole('link', { name: 'decision' })).toBeTruthy());
    expect(document.activeElement).toBe(within(article).getByRole('heading', { name: 'Links' }));
  });

  it('a focus on a link that becomes refused goes to the article', async () => {
    const release = heldElements();
    renderApp(`/p/${PID}/docs/docs/01_vision/links.md`);
    const article = await screen.findByRole('article');
    await within(article).findByRole('link', { name: 'vision' });
    // An unresolved link is text: put the focus on its key element as a stand-in.
    const unresolved = within(article).getByText('nowhere');
    unresolved.setAttribute('tabindex', '0');
    unresolved.focus();
    release();
    await waitFor(() => expect(within(article).getByText('nowhere').className).toBe('doc-link-refused'));
    expect(document.activeElement).toBe(article);
  });
});

describe('the cap on link checks (W3-36)', () => {
  it(`checks at most ${MAX_LINK_CHECKS} distinct targets; the others are "not shown in the UI"`, async () => {
    const many = Array.from({ length: MAX_LINK_CHECKS + 1 }, (_, i) => `[t${i}](gone-${i}.md)`).join(' ');
    const answers = api({ [content('docs/01_vision/links.md')]: doc('docs/01_vision/links.md', `# Many\n\n${many}`) });
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        const a = answers[url] ?? refused('missing');
        return new Response(JSON.stringify(a.body), { status: a.status, headers: { 'content-type': 'application/json' } });
      }),
    );
    renderApp(`/p/${PID}/docs/docs/01_vision/links.md`);
    const article = await screen.findByRole('article');
    const last = `t${MAX_LINK_CHECKS}`;
    await waitFor(() => expect(within(article).getByText(last).nextElementSibling?.textContent).toBe('not shown in the UI'));
    await waitFor(() => expect(within(article).getByText(`t${MAX_LINK_CHECKS - 1}`).nextElementSibling?.textContent).toBe('broken link'));
    expect(within(article).getByText('t0').nextElementSibling?.textContent).toBe('broken link');
    expect(calls.filter((u) => u.includes('gone-'))).toHaveLength(MAX_LINK_CHECKS);
    expect(calls.some((u) => u.includes(`gone-${MAX_LINK_CHECKS}.md`))).toBe(false);
  });
});
