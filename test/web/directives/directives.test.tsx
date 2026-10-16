// @vitest-environment jsdom
// task-019 — the Directives view (US-R-06; ux-reference §4.6; W3-41…W3-43) at component level, on
// the whole application with a stubbed API: the list with "only mine / all" in the URL, the bound
// roles with the view's role highlighted, "only mine" disabled outside the team, a directive's page
// with its rendered body and links, and the catalogue (every text a key).
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { keyCatalogue } from '../../../web/scripts/catalogue.mjs';
import { stopEventStream } from '../../../web/src/api/events.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { resetSession } from '../../../web/src/session/session.js';
import { renderApp, stubApi } from '../shell/render.js';
import { BASE, BO, D_DEV, DIRECTIVES, DIRECTIVES_NONE, header, OUTSIDER, PID, projectApi } from '../dna/data.js';

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

const MEMBER = projectApi({
  [BASE]: { status: 200, body: header(BO, 'r-dev') },
  [`${BASE}/directives`]: { status: 200, body: DIRECTIVES },
  [`${BASE}/directives/d-dev`]: { status: 200, body: D_DEV },
});

/** The ids of the listed directives, in order. */
function listed(): string[] {
  return within(screen.getByRole('list', { name: 'Directives' }))
    .getAllByRole('listitem')
    .filter((li) => li.classList.contains('directive-row'))
    .map((li) => li.dataset['directive'] ?? '');
}

it('lists only mine by default for a member, each with its bound roles, the view role highlighted', async () => {
  const fetch = stubApi(MEMBER);
  renderApp(`/p/${PID}/directives`);
  expect(await screen.findByRole('heading', { level: 1, name: 'Directives' })).toBeTruthy();
  const group = await screen.findByRole('radiogroup', { name: 'Directives to show' });
  await waitFor(() => expect(listed()).toEqual(['d-dev', 'd-all']));
  expect(within(group).getByRole('radio', { name: 'Only mine' }).getAttribute('aria-checked')).toBe('true');
  const dev = within(screen.getByRole('listitem', { name: 'Title of d-dev' }));
  expect(dev.getByText('d-dev')).toBeTruthy();
  const roles = dev.getAllByRole('listitem').map((r) => [r.textContent, r.dataset['current'] ?? '']);
  expect(roles).toEqual([
    ['r-dev', 'true'],
    ['r-qa', ''],
  ]);
  expect(within(screen.getByRole('listitem', { name: 'Title of d-all' })).getByText('All roles')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Directives' }).getAttribute('aria-current')).toBe('page');
  expect(document.title).toBe('demo · Directives — WingFoil UI');
  const reads = new Set(fetch.mock.calls.map((c) => String(c[0])).filter((p) => p.startsWith(BASE)));
  // Plus the notification bell's Today read of the role view (task-042, D42-1).
  expect(reads).toEqual(new Set([BASE, `${BASE}/directives`, `${BASE}/today?view=r-dev`]));
});

it('shows every directive with "all", kept in the URL, and back to only mine', async () => {
  stubApi(MEMBER);
  const { router } = renderApp(`/p/${PID}/directives`);
  const user = userEvent.setup();
  const all = await screen.findByRole('radio', { name: 'All' });
  await waitFor(() => expect(listed()).toEqual(['d-dev', 'd-all']));
  await user.click(all);
  await waitFor(() => expect(listed()).toEqual(['d-dev', 'd-qa', 'd-all']));
  expect(router.state.location.search).toEqual({ show: 'all' });
  await user.click(screen.getByRole('radio', { name: 'Only mine' }));
  await waitFor(() => expect(listed()).toEqual(['d-dev', 'd-all']));
  expect(router.state.location.search).toEqual({});
});

it('opens with "all" from the URL', async () => {
  stubApi(MEMBER);
  renderApp(`/p/${PID}/directives?show=all`);
  await waitFor(() => expect(listed()).toEqual(['d-dev', 'd-qa', 'd-all']));
  expect(screen.getByRole('radio', { name: 'All' }).getAttribute('aria-checked')).toBe('true');
});

it('disables "only mine" outside the team with the reason, and selects "all"', async () => {
  stubApi(
    projectApi({
      [BASE]: { status: 200, body: header(OUTSIDER) },
      [`${BASE}/directives`]: { status: 200, body: DIRECTIVES_NONE },
    }),
  );
  renderApp(`/p/${PID}/directives`);
  await waitFor(() => expect(listed()).toEqual(['d-dev', 'd-qa', 'd-all']));
  const mine = screen.getByRole('radio', { name: 'Only mine' });
  expect(mine.hasAttribute('disabled') || mine.getAttribute('aria-disabled') === 'true').toBe(true);
  expect(screen.getByRole('radio', { name: 'All' }).getAttribute('aria-checked')).toBe('true');
  const reason = screen.getByText('You hold no role in this project');
  expect(screen.getByRole('radiogroup').getAttribute('aria-describedby')).toContain(reason.id);
});

it('shows a failed list as an error of the view', async () => {
  stubApi(
    projectApi({
      [BASE]: { status: 200, body: header(BO, 'r-dev') },
      [`${BASE}/directives`]: {
        status: 502,
        body: { error: { code: 'cli-refused', message: 'roles.yaml is broken' } },
      },
    }),
  );
  renderApp(`/p/${PID}/directives`);
  const alert = await screen.findByRole('alert');
  expect(within(alert).getByText('roles.yaml is broken')).toBeTruthy();
});

it('opens a directive from the list on its page with the body rendered, and back', async () => {
  stubApi(MEMBER);
  const { router } = renderApp(`/p/${PID}/directives`);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('link', { name: 'Title of d-dev' }));
  const article = await screen.findByRole('article', { name: 'Title of d-dev' });
  expect(router.state.location.pathname).toBe(`/p/${PID}/directives/d-dev`);
  expect(within(article).getByRole('heading', { level: 2, name: 'Known behaviours' })).toBeTruthy();
  const table = within(article).getByRole('table');
  expect(within(table).getByRole('columnheader', { name: 'Behaviour' })).toBeTruthy();
  expect(within(table).getByRole('cell', { name: 'does one' })).toBeTruthy();
  // The page names the directive, its path and its roles.
  expect(screen.getByRole('heading', { level: 1, name: 'Title of d-dev' })).toBeTruthy();
  expect(screen.getByText('.wingfoil/directives/custom/d-dev.md')).toBeTruthy();
  expect(document.title).toBe('demo · d-dev — WingFoil UI');
  // Links (W3-42): another directive opens in the UI, the DNA file is not shown, an anchor stays.
  const qa = within(article).getByRole('link', { name: 'the QA directive' });
  expect(qa.getAttribute('href')).toBe(`/p/${PID}/directives/d-qa`);
  expect(within(article).queryByRole('link', { name: 'the DNA' })).toBeNull();
  expect(within(article).getByText('not shown in the UI')).toBeTruthy();
  expect(within(article).getByRole('link', { name: 'below' }).getAttribute('href')).toBe(
    `/p/${PID}/directives/d-dev#known-behaviours`,
  );
  const external = within(article).getByRole('link', { name: 'the site (opens in a new tab)' });
  expect(external.getAttribute('target')).toBe('_blank');
  await user.click(screen.getByRole('link', { name: '← Directives' }));
  await waitFor(() => expect(router.state.location.pathname).toBe(`/p/${PID}/directives`));
});

it('follows a link to another directive inside the UI', async () => {
  stubApi({
    ...MEMBER,
    [`${BASE}/directives/d-qa`]: {
      status: 200,
      body: { entry: DIRECTIVES.entries[1], frontmatter: DIRECTIVES.entries[1]!.frontmatter, body: 'QA rules.' },
    },
  });
  const { router } = renderApp(`/p/${PID}/directives/d-dev`);
  const user = userEvent.setup();
  const article = await screen.findByRole('article', { name: 'Title of d-dev' });
  await user.click(within(article).getByRole('link', { name: 'the QA directive' }));
  expect(await screen.findByText('QA rules.')).toBeTruthy();
  expect(router.state.location.pathname).toBe(`/p/${PID}/directives/d-qa`);
});

it('waits for the directive list before classifying a repository link, with no mark meanwhile (review F3)', async () => {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  const fetch = stubApi(MEMBER);
  const answer = fetch.getMockImplementation() as (url: string) => Promise<Response>;
  fetch.mockImplementation(async (url: string) => {
    if (url === `${BASE}/directives`) await held;
    return answer(url);
  });
  renderApp(`/p/${PID}/directives/d-dev`);
  const article = await screen.findByRole('article', { name: 'Title of d-dev' });
  const a = within(article);
  expect(a.getByText('the QA directive')).toBeTruthy();
  expect(a.queryByRole('link', { name: 'the QA directive' })).toBeNull();
  expect(a.queryByText('not shown in the UI')).toBeNull();
  release();
  expect(await a.findByRole('link', { name: 'the QA directive' })).toBeTruthy();
  expect(a.getByText('not shown in the UI')).toBeTruthy();
});

it('renders a malicious directive body inert (review F6)', async () => {
  const body = [
    '<script>window.__pwned = 1</script>',
    '',
    '[click me](javascript:window.__pwned=2) and [data](data:text/html,<script>window.__pwned=3</script>)',
    '',
    '<img src="x" onerror="window.__pwned=4"> and ![pic](javascript:window.__pwned=5) ![tracker](https://example.test/t.png)',
    '',
    '<b onclick="window.__pwned=6">bold</b> <iframe src="https://example.test"></iframe>',
    '',
    '[vb](vbscript:msgbox(1)) [file](file:///etc/passwd) [up](../../../../etc/hosts)',
  ].join('\n');
  stubApi({
    ...MEMBER,
    [`${BASE}/directives/d-dev`]: { status: 200, body: { ...D_DEV, body: body } },
  });
  renderApp(`/p/${PID}/directives/d-dev`);
  const article = await screen.findByRole('article', { name: 'Title of d-dev' });
  await within(article)
    .findByText('not shown in the UI', { exact: false })
    .catch(() => undefined);
  // Raw HTML is shown as written text, never parsed.
  expect(article.textContent).toContain('<script>window.__pwned = 1</script>');
  expect(article.textContent).toContain('<b onclick="window.__pwned=6">bold</b>');
  for (const tag of ['script', 'img', 'iframe', 'b']) expect(article.querySelector(tag)).toBeNull();
  for (const el of article.querySelectorAll('*')) {
    for (const attr of el.getAttributeNames()) expect(attr.startsWith('on')).toBe(false);
  }
  // No link leaves http(s) or the UI; the scripted ones are not links at all.
  for (const a of article.querySelectorAll('a')) {
    expect(a.getAttribute('href') ?? '').toMatch(/^(https?:|\/p\/)/);
  }
  expect(within(article).queryByRole('link', { name: 'click me' })).toBeNull();
  expect(within(article).queryByRole('link', { name: 'data' })).toBeNull();
  await userEvent.setup().click(within(article).getByText(/click me/));
  expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  // An image is never loaded: its alternative text, marked.
  expect(within(article).getByText('Image not shown: tracker')).toBeTruthy();
});

it('shows an unknown directive as not found', async () => {
  stubApi(MEMBER);
  renderApp(`/p/${PID}/directives/nope`);
  const alert = await screen.findByRole('alert');
  expect(within(alert).getByText('Not found')).toBeTruthy();
});

it('renders every text from the catalogue (key build)', async () => {
  stubApi(MEMBER);
  renderApp(`/p/${PID}/directives`, keyCatalogue(en));
  expect(await screen.findByText('directives.title')).toBeTruthy();
  expect(await screen.findByText('directives.filter.mine')).toBeTruthy();
  expect(screen.getByText('directives.filter.all')).toBeTruthy();
  expect(await screen.findByText('directives.global')).toBeTruthy();
});
