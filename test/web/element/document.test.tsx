// @vitest-environment jsdom
// task-078 — the rendered element document (US-G-03; N6; ux-reference §4.2 v0.3; D78-2 … D78-10):
// the summary rendered as Markdown on the element page and in the side panel, *Open document* with
// the modal dialog (Rendered by default, Source as written, "No content yet"), Escape and Close back
// to the button, raw HTML as text, links classified against the element file's folder, images never
// loaded, anchors inside the article, HTML comments left out of the rendered forms only (Q2 (b)), and
// no read beyond the element for a body with no repository link.
import type { ElementDetail, MemoryHistory } from '@wingfoil-ui/contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keyCatalogue } from '../../../web/scripts/catalogue.mjs';
import { stopEventStream } from '../../../web/src/api/events.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { resetSession } from '../../../web/src/session/session.js';
import { header } from '../dna/data.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';

const PID = 'p_fx';
const EID = 'dl-002-x';
const TITLE = 'Use Fastify';
const PATH = 'docs/04_memory/dls/dl-002-x.md';
const API = `/api/p/${PID}`;

const BODY = [
  '## Context',
  '',
  '<!-- The situation or question that prompted this decision. -->',
  '',
  'We pick **Fastify**: see [the first decision](dl-001-x.md), [the vision](../../01_vision/00_index.md),',
  '[the guide](https://example.test/guide), [a script](javascript:alert(1)) and [the decision](#decision).',
  '',
  '## Decision',
  '',
  '<img src=x onerror="window.__pwned=1"> <script>window.__pwned=2</script>',
  '',
  '![Architecture diagram](diagram.png) ![remote](https://example.test/a.png)',
  '',
  '[data](data:text/html,x) [host](//evil.test/x) [up](../../../../etc/hosts)',
  '',
].join('\n');

function detail(body: string): ElementDetail {
  return {
    element: {
      path: PATH,
      id: EID,
      title: TITLE,
      type: 'decision-log',
      status: 'in-discussion',
      tags: [],
      localChanges: false,
    },
    frontmatter: { id: EID, type: 'decision-log', title: TITLE, status: 'in-discussion' },
    body,
    states: { sequence: ['draft', 'in-discussion', 'ready'], gates: {} },
  };
}

const HISTORY: MemoryHistory = {
  id: EID,
  path: PATH,
  entries: [
    {
      sha: '1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      author: 'Casey <casey@example.test>',
      timestamp: '2026-09-29T15:20:02+00:00',
      operation: 'add',
      from: null,
      to: 'draft',
      approver: null,
      reason: null,
      subject: 'wf(decision-log): add',
    },
  ],
};

function api(body = BODY, over: FakeApi = {}): FakeApi {
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'custom', path: '/x', remote: null, availability: 'available' }] },
    },
    [`${API}`]: { status: 200, body: header({ kind: 'no-identity' }) },
    [`${API}/directives`]: { status: 200, body: { entries: [], warnings: [] } },
    [`${API}/elements/${EID}`]: { status: 200, body: detail(body) },
    [`${API}/elements/${EID}/history`]: { status: 200, body: HISTORY },
    [`${API}/docs`]: {
      status: 200,
      body: {
        roots: ['docs'],
        documents: [{ path: 'docs/01_vision/00_index.md', label: 'docs/01_vision/00_index.md' }],
      },
    },
    [`${API}/elements`]: {
      status: 200,
      body: {
        elements: [
          {
            path: 'docs/04_memory/dls/dl-001-x.md',
            id: 'dl-001-x',
            title: 'First',
            type: 'decision-log',
            status: 'ready',
            tags: [],
            localChanges: false,
          },
          {
            path: PATH,
            id: EID,
            title: TITLE,
            type: 'decision-log',
            status: 'in-discussion',
            tags: [],
            localChanges: false,
          },
        ],
        warnings: [],
      },
    },
    ...over,
  };
}

/** The paths the stub API was asked for. */
function asked(fetch: ReturnType<typeof vi.fn>): string[] {
  return fetch.mock.calls.map((c) => String(c[0]));
}

/** The element page's summary section, once its rendered paragraph is shown. */
async function summary(): Promise<HTMLElement> {
  const section = (await screen.findByRole('heading', { name: 'Summary' })).closest('section')!;
  await waitFor(() => expect(section.querySelector('.element-summary strong')?.textContent).toBe('Fastify'));
  return section;
}

/** Open the document dialog from the summary section. */
async function openDocument(section: HTMLElement): Promise<HTMLElement> {
  await userEvent.click(within(section).getByRole('button', { name: 'Open document' }));
  return screen.findByRole('dialog', { name: TITLE });
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

describe('the summary (D78-2)', () => {
  it('renders the first paragraph as Markdown, its links classified against the element file’s folder', async () => {
    stubApi(api());
    renderApp(`/p/${PID}/e/${EID}`);
    const section = await summary();
    const text = section.querySelector('.element-summary')!;
    expect(text.textContent).not.toContain('<!--');
    expect((await within(section).findByRole('link', { name: 'the first decision' })).getAttribute('href')).toBe(
      `/p/${PID}/e/dl-001-x`,
    );
    await waitFor(() =>
      expect(within(section).getByRole('link', { name: 'the vision' }).getAttribute('href')).toBe(
        `/p/${PID}/docs/docs/01_vision/00_index.md`,
      ),
    );
    const guide = within(section).getByRole('link', { name: 'the guide (opens in a new tab)' });
    expect(guide.getAttribute('target')).toBe('_blank');
    expect(guide.getAttribute('rel')).toBe('noopener noreferrer');
    // markdown-it's own link validation: a `javascript:` link is no link, its Markdown stays text.
    expect(within(section).queryByRole('link', { name: 'a script' })).toBeNull();
    expect(text.textContent).toContain('[a script](javascript:alert(1))');
  });

  it('says when there is none, and offers no document for an empty body (G-03.3)', async () => {
    stubApi(api('   \n'));
    renderApp(`/p/${PID}/e/${EID}`);
    const section = (await screen.findByRole('heading', { name: 'Summary' })).closest('section')!;
    expect(await within(section).findByText('No summary in the document.')).toBeTruthy();
    const dialog = await openDocument(section);
    expect(within(dialog).getByText('No content yet')).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Source' }));
    expect(within(dialog).getByText('No content yet')).toBeTruthy();
  });

  it('a link of the summary opens the element page of the linked element', async () => {
    stubApi(api());
    const { router } = renderApp(`/p/${PID}/e/${EID}`);
    const section = await summary();
    await userEvent.click(await within(section).findByRole('link', { name: 'the first decision' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/p/${PID}/e/dl-001-x`));
  });

  it('an anchor of the summary opens the document on its heading', async () => {
    stubApi(api());
    const { router } = renderApp(`/p/${PID}/e/${EID}`);
    const section = await summary();
    await userEvent.click(within(section).getByRole('link', { name: 'the decision' }));
    const dialog = await screen.findByRole('dialog', { name: TITLE });
    await waitFor(() =>
      expect(document.activeElement).toBe(within(dialog).getByRole('heading', { level: 2, name: 'Decision' })),
    );
    expect(router.state.location.pathname).toBe(`/p/${PID}/e/${EID}`);
  });

  it('a body with no repository link reads nothing beyond the element (D78-6)', async () => {
    const fetch = stubApi(api('A *plain* summary with [a guide](https://example.test/x).\n'));
    renderApp(`/p/${PID}/e/${EID}`);
    const section = (await screen.findByRole('heading', { name: 'Summary' })).closest('section')!;
    await waitFor(() => expect(section.querySelector('.element-summary em')?.textContent).toBe('plain'));
    await openDocument(section);
    const reads = asked(fetch);
    expect(reads).not.toContain(`${API}/docs`);
    expect(reads).not.toContain(`${API}/elements`);
    expect(reads.filter((p) => p.includes('/files/content'))).toEqual([]);
  });
});

describe('the document dialog (D78-4, D78-5)', () => {
  it('opens rendered by default, with the headings, raw HTML as text and images as marked text', async () => {
    stubApi(api());
    renderApp(`/p/${PID}/e/${EID}`);
    const dialog = await openDocument(await summary());
    expect(within(dialog).getByRole('radio', { name: 'Rendered' }).getAttribute('aria-checked')).toBe('true');
    const article = within(dialog).getByRole('article', { name: TITLE });
    expect(
      within(article)
        .getAllByRole('heading', { level: 2 })
        .map((h) => [h.textContent, h.id]),
    ).toEqual([
      ['Context', 'eldoc-context'],
      ['Decision', 'eldoc-decision'],
    ]);
    // HTML comments are left out of the rendered document (Q2 (b)); other raw HTML is text.
    expect(article.textContent).not.toContain('The situation or question');
    expect(article.textContent).toContain('<img src=x onerror="window.__pwned=1">');
    expect(article.textContent).toContain('<script>window.__pwned=2</script>');
    expect(dialog.querySelector('img, script')).toBeNull();
    expect(within(article).getByText('Image not shown: Architecture diagram')).toBeTruthy();
    expect(within(article).getByText('Image not shown: remote')).toBeTruthy();
    expect(within(article).queryByRole('link', { name: 'data' })).toBeNull();
    expect(article.textContent).toContain('[data](data:text/html,x)');
    const refusals: [string, string][] = [
      ['host', 'link not supported'],
      ['up', 'outside the repository'],
    ];
    for (const [text, mark] of refusals) {
      expect(within(article).queryByRole('link', { name: text })).toBeNull();
      expect(within(article).getByText(text).nextElementSibling?.textContent).toBe(mark);
    }
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it('shows the source as written, comments included, in a monospace block', async () => {
    stubApi(api());
    renderApp(`/p/${PID}/e/${EID}`);
    const dialog = await openDocument(await summary());
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Source' }));
    const source = within(dialog).getByRole('region', { name: 'Source' });
    expect(source.tagName).toBe('PRE');
    expect(source.textContent).toBe(BODY);
    expect(source.tabIndex).toBe(0);
    expect(within(dialog).queryByRole('article')).toBeNull();
  });

  it('closes with Escape and with Close, the focus back on Open document, the page kept (R2)', async () => {
    stubApi(api());
    const { router } = renderApp(`/p/${PID}/e/${EID}`);
    const section = await summary();
    const button = within(section).getByRole('button', { name: 'Open document' });
    await openDocument(section);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(button));
    expect(router.state.location.pathname).toBe(`/p/${PID}/e/${EID}`);
    const dialog = await openDocument(section);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(button));
    expect(router.state.location.pathname).toBe(`/p/${PID}/e/${EID}`);
  });

  it('a link to an element file closes the dialog and opens that element’s page', async () => {
    stubApi(api());
    const { router } = renderApp(`/p/${PID}/e/${EID}`);
    const dialog = await openDocument(await summary());
    await userEvent.click(await within(dialog).findByRole('link', { name: 'the first decision' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/p/${PID}/e/dl-001-x`));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: TITLE })).toBeNull());
  });

  it('an anchor focuses its heading inside the dialog, with no navigation', async () => {
    stubApi(api());
    const { router } = renderApp(`/p/${PID}/e/${EID}`);
    const dialog = await openDocument(await summary());
    await userEvent.click(within(dialog).getByRole('link', { name: 'the decision' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(within(dialog).getByRole('heading', { level: 2, name: 'Decision' })),
    );
    expect(router.state.location.pathname).toBe(`/p/${PID}/e/${EID}`);
    expect(router.state.location.hash).toBe('');
    expect(screen.getByRole('dialog', { name: TITLE })).toBe(dialog);
  });

  it('opens from the side panel too, and Escape closes the dialog only (R2)', async () => {
    stubApi(api());
    const { router } = renderApp(`/p/${PID}/directives?panel=${EID}`);
    const panel = await screen.findByRole('dialog', { name: TITLE });
    const section = within(panel).getByRole('heading', { name: 'Summary' }).closest('section')!;
    await waitFor(() => expect(section.querySelector('.element-summary strong')?.textContent).toBe('Fastify'));
    await userEvent.click(within(section).getByRole('button', { name: 'Open document' }));
    // The modal makes the rest of the page inert: only the document dialog is in the tree.
    const dialog = await screen.findByRole('dialog', { name: TITLE });
    expect(dialog.classList.contains('element-document')).toBe(true);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('.element-document')).toBeNull());
    expect(screen.getByRole('dialog', { name: TITLE })).toBe(panel);
    expect(router.state.location.search).toEqual({ panel: EID });
    await waitFor(() =>
      expect(document.activeElement).toBe(within(section).getByRole('button', { name: 'Open document' })),
    );
  });

  it('shows only catalogue keys with the key catalogue (spec-008 §6)', async () => {
    stubApi(api());
    renderApp(`/p/${PID}/e/${EID}`, keyCatalogue(en));
    const button = await screen.findByRole('button', { name: 'element.document.open' });
    await userEvent.click(button);
    const dialog = await screen.findByRole('dialog', { name: TITLE });
    expect(within(dialog).getByRole('radiogroup', { name: 'element.document.view' })).toBeTruthy();
    expect(within(dialog).getByRole('radio', { name: 'element.document.rendered' })).toBeTruthy();
    expect(within(dialog).getByRole('radio', { name: 'element.document.source' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'common.action.close' })).toBeTruthy();
  });
});

// task-078 security review round 1, F-5: a link selected in the dialog closes it, also when the
// page stays (a link to the element's own file: the same address).
it('a link to the element’s own file closes the dialog, the page kept (F-5)', async () => {
  stubApi(api(`${BODY}\n[this decision](dl-002-x.md)\n`));
  const { router } = renderApp(`/p/${PID}/e/${EID}`);
  const section = await summary();
  const dialog = await openDocument(section);
  await userEvent.click(await within(dialog).findByRole('link', { name: 'this decision' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: TITLE })).toBeNull());
  expect(router.state.location.pathname).toBe(`/p/${PID}/e/${EID}`);
  expect(screen.getByRole('region', { name: TITLE })).toBeTruthy();
});
