// @vitest-environment jsdom
// task-019 — the element panel's Directives section (US-G-02; ux-reference §4.2; W3-38): the
// directives of the current role view (the server's `mine`), each a link to its page in the
// Directives view; outside the team the global ones with the reason; one `GET /directives` per
// project, not per element; a failed read stays in the section.
import type { ElementDetail, MemoryHistory } from '@wingfoil-ui/contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { resetSession } from '../../../web/src/session/session.js';
import { BASE, BO, D_DEV, DIRECTIVES, DIRECTIVES_NONE, header, OUTSIDER, PID, projectApi } from '../dna/data.js';
import { renderApp, stubApi, type FakeApi } from '../shell/render.js';

function detail(id: string): ElementDetail {
  return {
    element: {
      path: `docs/${id}.md`,
      id,
      title: `Element ${id}`,
      type: 'kind-a',
      status: 's1',
      tags: [],
      localChanges: false,
    },
    frontmatter: { id, type: 'kind-a', title: `Element ${id}`, status: 's1' },
    body: 'Text.',
  };
}

function elementApi(id: string): FakeApi {
  const history: MemoryHistory = { id, path: `docs/${id}.md`, entries: [] };
  return {
    [`${BASE}/elements/${id}`]: { status: 200, body: detail(id) },
    [`${BASE}/elements/${id}/history`]: { status: 200, body: history },
  };
}

const API = projectApi({
  [BASE]: { status: 200, body: header(BO, 'r-dev') },
  [`${BASE}/directives`]: { status: 200, body: DIRECTIVES },
  [`${BASE}/directives/d-dev`]: { status: 200, body: D_DEV },
  ...elementApi('e-1'),
  ...elementApi('e-2'),
});

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

/** The Directives section of the open panel. */
async function section(): Promise<ReturnType<typeof within>> {
  const dialog = await screen.findByRole('dialog');
  return within(await within(dialog).findByRole('region', { name: 'Directives' }));
}

it("lists the role view's directives as links to the Directives view, between References and History", async () => {
  stubApi(API);
  renderApp(`/p/${PID}/e/e-1`);
  const s = await section();
  await waitFor(() =>
    expect(s.getAllByRole('link').map((a: HTMLElement) => a.textContent)).toEqual(['Title of d-dev', 'Title of d-all']),
  );
  expect(s.getByRole('link', { name: 'Title of d-dev' }).getAttribute('href')).toBe(`/p/${PID}/directives/d-dev`);
  expect(s.getByText('d-all')).toBeTruthy();
  const titles = [...document.querySelectorAll('.drawer-body h3')].map((h) => h.textContent);
  expect(titles).toEqual(['Summary', 'References', 'Directives', 'History']);
});

it('reads the directives once for every panel of the project', async () => {
  const fetch = stubApi(API);
  const { router } = renderApp(`/p/${PID}/e/e-1`);
  await (await section()).findByRole('link', { name: 'Title of d-dev' });
  await router.navigate({ to: '/p/$pid/e/$eid', params: { pid: PID, eid: 'e-2' } });
  await screen.findByRole('dialog', { name: 'Element e-2' });
  await (await section()).findByRole('link', { name: 'Title of d-dev' });
  const reads = fetch.mock.calls.map((c) => String(c[0])).filter((p) => p === `${BASE}/directives`);
  expect(reads).toHaveLength(1);
});

it('opens the directive in the Directives view, with its body', async () => {
  stubApi(API);
  const { router } = renderApp(`/p/${PID}/e/e-1`);
  const user = userEvent.setup();
  await user.click(await (await section()).findByRole('link', { name: 'Title of d-dev' }));
  expect(await screen.findByRole('article', { name: 'Title of d-dev' })).toBeTruthy();
  expect(router.state.location.pathname).toBe(`/p/${PID}/directives/d-dev`);
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('shows the global directives with the reason outside the team', async () => {
  stubApi({
    ...API,
    [BASE]: { status: 200, body: header(OUTSIDER) },
    [`${BASE}/directives`]: { status: 200, body: DIRECTIVES_NONE },
  });
  renderApp(`/p/${PID}/e/e-1`);
  const s = await section();
  await waitFor(() =>
    expect(s.getAllByRole('link').map((a: HTMLElement) => a.textContent)).toEqual(['Title of d-all']),
  );
  expect(s.getByText('You hold no role in this project: only the global directives are shown.')).toBeTruthy();
});

it('says when no directive applies', async () => {
  stubApi({ ...API, [`${BASE}/directives`]: { status: 200, body: { entries: [], warnings: [] } } });
  renderApp(`/p/${PID}/e/e-1`);
  expect(await (await section()).findByText('No directive applies.')).toBeTruthy();
});

it('keeps a failed read inside the section', async () => {
  stubApi({
    ...API,
    [`${BASE}/directives`]: { status: 502, body: { error: { code: 'cli-refused', message: 'roles broken' } } },
  });
  renderApp(`/p/${PID}/e/e-1`);
  const s = await section();
  expect(within(await s.findByRole('alert')).getByText('roles broken')).toBeTruthy();
  expect(screen.getByRole('dialog', { name: 'Element e-1' })).toBeTruthy();
});
