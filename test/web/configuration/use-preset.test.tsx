// @vitest-environment jsdom
// task-079 — *Use preset* on Configuration › Taxonomy (AC-1; spec-005 §5; ux-reference §4.11, §5; D79-2 …
// D79-9) on the whole application with a stubbed API: the section after the tab's intro, hidden or
// disabled with the reason, the dialog (choices, effect line, Confirm, Cancel, Escape, no outside-click
// dismissal, the pending state), the POST, the success and refusal toasts, the focus after each, the
// dialog kept while a refetch hides the control (bug-046's lesson), and *Update* in the reason.
import type { ProjectHeader, UiConfig, WriteResponse } from '@wingfoil-ui/contracts';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { keyCatalogue } from '../../../web/scripts/catalogue.mjs';
import { stopEventStream } from '../../../web/src/api/events.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { resetSession } from '../../../web/src/session/session.js';
import { getToasts, resetToasts } from '../../../web/src/shell/toasts.js';
import { BASE, BO, header, OUTSIDER, PID } from '../dna/data.js';
import { renderApp, type FakeApi } from '../shell/render.js';
import { UI_DECLARED, UI_INFERRED, uiApi } from './data.js';

const PAGE = `/p/${PID}/configuration/taxonomy`;
const PRESET = `${BASE}/ui-config/preset`;
const UPDATE = `${BASE}/git/update`;
const SHA = 'abcdef0123456789abcdef0123456789abcdef01';
const OK: WriteResponse = {
  result: { file: '.wingfoil/ui.yaml', preset: 'kanban' },
  commits: [{ sha: SHA, subject: 'chore(ui): apply the Kanban preset' }],
  push: { status: 'off' },
} as unknown as WriteResponse;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Bo's header behind its remote by `behind` commits. */
function behindHeader(behind: number): ProjectHeader {
  const h = header(BO, 'r-dev');
  h.repository = { ...h.repository, copy: 'behind', behind };
  return h;
}

/** A mutable API: GETs from `api`, POSTs from `posts` (a function may hold the answer). */
function stub(
  api: FakeApi,
  posts: Record<string, (init: RequestInit) => Promise<Response> | Response> = {},
): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const answer = posts[url];
      if (answer) return answer(init);
      return json(404, { error: { code: 'not-found', message: 'Not found' } });
    }
    const a = api[url] ?? { status: 404, body: { error: { code: 'not-found', message: 'Not found' } } };
    return new Response(a.body === undefined ? null : JSON.stringify(a.body), {
      status: a.status,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function presetPosts(fetch: ReturnType<typeof vi.fn>): unknown[] {
  return fetch.mock.calls
    .filter((c) => String(c[0]) === PRESET && (c[1] as RequestInit | undefined)?.method === 'POST')
    .map((c) => JSON.parse(String((c[1] as RequestInit).body)) as unknown);
}

const politeToasts = () => document.querySelector('.toasts [aria-live="polite"]') as HTMLElement;
const assertiveToasts = () => document.querySelector('.toasts [aria-live="assertive"]') as HTMLElement;
const openButton = () => screen.findByRole('button', { name: 'Use preset' });
const dialog = () => screen.findByRole('dialog', { name: 'Use a preset' });

beforeEach(() => {
  resetSession();
  resetToasts();
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

/** Open the dialog and choose `name`. */
async function choose(name: string): Promise<HTMLElement> {
  await userEvent.click(await openButton());
  const d = await dialog();
  await userEvent.click(within(d).getByRole('radio', { name }));
  return d;
}

it('D79-3 — the section "Use a preset" follows the intro, before the categories', async () => {
  stub(uiApi(UI_INFERRED));
  renderApp(PAGE);
  const section = (await openButton()).closest('section') as HTMLElement;
  expect(within(section).getByRole('heading', { level: 3, name: 'Use a preset' })).toBeTruthy();
  expect(section.textContent).toContain(
    'Writes a shipped configuration as .wingfoil/ui.yaml, in one commit of its own',
  );
  const intro = document.querySelector('.config-tab .page-intro') as HTMLElement;
  const categories = screen.getByRole('heading', { level: 3, name: 'The 8 UI categories' });
  expect(intro.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(section.compareDocumentPosition(categories) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it.each<[string, UiConfig, ProjectHeader]>([
  ['ui.yaml exists (C-02.3)', UI_DECLARED, header(BO, 'r-dev')],
  ['the user is not in the team (C-02.5)', UI_INFERRED, header(OUTSIDER)],
])('AC-1 — no Use preset when %s', async (_name, ui, h) => {
  stub(uiApi(ui, { [BASE]: { status: 200, body: h } }));
  renderApp(PAGE);
  await screen.findByRole('table', { name: 'Types → categories' });
  expect(screen.queryByRole('button', { name: 'Use preset' })).toBeNull();
  expect(screen.queryByRole('heading', { level: 3, name: 'Use a preset' })).toBeNull();
});

it('C-02.4 — disabled while the copy is behind: the reason is its description, a press opens nothing', async () => {
  stub(uiApi(UI_INFERRED, { [BASE]: { status: 200, body: behindHeader(1) } }));
  renderApp(PAGE);
  const button = await openButton();
  await waitFor(() => expect(button.getAttribute('aria-disabled')).toBe('true'));
  const description = document.getElementById(button.getAttribute('aria-describedby') ?? '') as HTMLElement;
  expect(description.textContent).toBe('Blocked: your copy is 1 commit behind the remote — Update');
  expect(within(description).getByRole('button', { name: 'Update' })).toBeTruthy();
  await userEvent.click(button);
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('AC-1 — disabled while the version is out of range, with its reason', async () => {
  const h = header(BO, 'r-dev');
  h.readOnly = [{ code: 'version-unsupported', range: '0.2.2 – 0.3.x' }];
  stub(uiApi(UI_INFERRED, { [BASE]: { status: 200, body: h } }));
  renderApp(PAGE);
  const button = await openButton();
  await waitFor(() => expect(button.getAttribute('aria-disabled')).toBe('true'));
  expect(document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
    'Read-only: supported 0.2.2 – 0.3.x',
  );
});

it('AC-1 — the dialog: three choices with their notes, Confirm disabled until a choice, the effect line per choice', async () => {
  stub(uiApi(UI_INFERRED));
  renderApp(PAGE);
  await userEvent.click(await openButton());
  const d = await dialog();
  const radios = within(d).getAllByRole('radio');
  expect(radios.map((r) => r.getAttribute('aria-checked') ?? String((r as HTMLInputElement).checked))).toEqual([
    'false',
    'false',
    'false',
  ]);
  expect(within(d).getByRole('radio', { name: 'Kanban' })).toBeTruthy();
  expect(within(d).getByRole('radio', { name: 'Scrum' })).toBeTruthy();
  expect(within(d).getByRole('radio', { name: 'WingFoil sw-life-cycle' })).toBeTruthy();
  expect(d.textContent).toContain('For projects made with wingfoil init --template Kanban');
  expect(d.textContent).toContain('For projects made with wingfoil init --template Scrum');
  expect(d.textContent).toContain(
    'For projects that copy the WingFoil configuration (the packs base, software and methodology/scrum)',
  );
  const confirm = within(d).getByRole('button', { name: 'Confirm' });
  expect(confirm.getAttribute('aria-disabled') === 'true' || (confirm as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(within(d).getByRole('radio', { name: 'WingFoil sw-life-cycle' }));
  const effect =
    'Writes .wingfoil/ui.yaml and commits it alone as chore(ui): apply the WingFoil sw-life-cycle preset. Other staged changes stay staged.';
  expect(d.textContent).toContain(effect);
  expect(document.getElementById(confirm.getAttribute('aria-describedby') ?? '')?.textContent).toBe(effect);
  expect(confirm.getAttribute('aria-disabled') === 'true' || (confirm as HTMLButtonElement).disabled).toBe(false);
});

it('AC-1 — Cancel and Escape close the dialog and give the focus back to Use preset; an outside click does not', async () => {
  const fetch = stub(uiApi(UI_INFERRED));
  renderApp(PAGE);
  await choose('Kanban');
  await userEvent.click(within(await dialog()).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Use preset' })));
  await userEvent.click(await openButton());
  await dialog();
  // ux-reference §5 *Modal dismissal*: no outside-click dismissal.
  fireEvent.pointerDown(document.body);
  fireEvent.pointerUp(document.body);
  fireEvent.click(document.body);
  expect(screen.getByRole('dialog', { name: 'Use a preset' })).toBeTruthy();
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Use preset' })));
  expect(presetPosts(fetch)).toEqual([]);
});

it('AC-1, C-02.1 — Confirm posts {preset}; the toast names the commit; the focus goes to the main region', async () => {
  const fetch = stub(uiApi(UI_INFERRED), { [PRESET]: () => json(200, OK) });
  renderApp(PAGE);
  const d = await choose('Kanban');
  await userEvent.click(within(d).getByRole('button', { name: 'Confirm' }));
  expect(await within(politeToasts()).findByText('Kanban preset applied')).toBeTruthy();
  expect(politeToasts().textContent).toContain('abcdef0 chore(ui): apply the Kanban preset');
  expect(politeToasts().textContent).not.toContain('pushed');
  expect(presetPosts(fetch)).toEqual([{ preset: 'kanban' }]);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(document.getElementById('main')));
});

it('AC-1 — pushed, or "Not pushed — the commit stays local" with its reason (sticky)', async () => {
  let push: WriteResponse['push'] = { status: 'pushed' } as WriteResponse['push'];
  stub(uiApi(UI_INFERRED), { [PRESET]: () => json(200, { ...OK, push }) });
  renderApp(PAGE);
  await userEvent.click(within(await choose('Kanban')).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(politeToasts().textContent).toContain('pushed'));
  push = { status: 'failed', code: 'push-timeout' } as WriteResponse['push'];
  await userEvent.click(within(await choose('Scrum')).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(politeToasts().textContent).toContain('Not pushed — the commit stays local'));
  expect(politeToasts().textContent).toContain(en['error.pushTimeout']);
  // Review round 1 F-7: the failed push's toast is sticky (it replaced the pushed one: one key per project).
  expect(getToasts().filter((t) => t.key === `preset:${PID}`)).toEqual([
    expect.objectContaining({ tone: 'success', sticky: true }),
  ]);
});

/** One refusal per code of D64-13 / D79-8 and the text its toast shows. */
const REFUSALS: [string, number, unknown, string][] = [
  [
    'ui-config-invalid (C-03.1)',
    422,
    { code: 'ui-config-invalid', message: 'x', detail: { failure: 'missing required key version' } },
    'ui.yaml not written: missing required key version',
  ],
  [
    'ui-config-exists',
    409,
    { code: 'ui-config-exists', message: 'x' },
    'ui.yaml not written: .wingfoil/ui.yaml already exists (in the working tree, the index or the last commit)',
  ],
  ['stale-copy', 409, { code: 'stale-copy', message: 'x' }, en['error.staleCopy']],
  ['not-in-team', 403, { code: 'not-in-team', message: 'x' }, en['error.notInTeam']],
  ['unsupported-version', 409, { code: 'unsupported-version', message: 'x' }, en['error.unsupportedVersion']],
  ['git-refused (verbatim)', 422, { code: 'git-refused', message: 'fatal: index.lock held' }, 'fatal: index.lock held'],
  [
    'write-incomplete without commit',
    500,
    { code: 'write-incomplete', message: 'x', detail: { file: '.wingfoil/ui.yaml' } },
    'The preset was not applied completely: check .wingfoil/ui.yaml with git before trying again',
  ],
  [
    'write-incomplete with commit',
    500,
    { code: 'write-incomplete', message: 'x', detail: { file: '.wingfoil/ui.yaml', commit: SHA } },
    `— the commit ${SHA} was made`,
  ],
  ['internal', 500, { code: 'internal', message: 'x' }, en['error.internal']],
];

it.each(REFUSALS)(
  'AC-1 — refusal %s: a red toast with its text; the focus back on Use preset',
  async (_n, status, error, text) => {
    stub(uiApi(UI_INFERRED), { [PRESET]: () => json(status, { error }) });
    renderApp(PAGE);
    await userEvent.click(within(await choose('Kanban')).getByRole('button', { name: 'Confirm' }));
    expect(await within(assertiveToasts()).findByText('Kanban preset not applied')).toBeTruthy();
    expect(assertiveToasts().textContent).toContain(text);
    expect(assertiveToasts().textContent).not.toContain('WingFoil did not finish');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Use preset' })));
  },
);

it('AC-1 — no answer: the unreachable text', async () => {
  stub(uiApi(UI_INFERRED), {
    [PRESET]: () => {
      throw new TypeError('Failed to fetch');
    },
  });
  renderApp(PAGE);
  await userEvent.click(within(await choose('Kanban')).getByRole('button', { name: 'Confirm' }));
  expect(await within(assertiveToasts()).findByText('Kanban preset not applied')).toBeTruthy();
  expect(assertiveToasts().textContent).toContain(en['error.unreachable']);
});

it('D79-5 — while the write runs: buttons disabled, Escape ignored, the status; a refetch that hides the control keeps the dialog', async () => {
  let answer: (r: Response) => void = () => {};
  const api = uiApi(UI_INFERRED);
  stub(api, { [PRESET]: () => new Promise<Response>((resolve) => (answer = resolve)) });
  const { queryClient } = renderApp(PAGE);
  const d = await choose('Kanban');
  await userEvent.click(within(d).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(within(d).getByRole('status').textContent).toBe('Applying the preset…'));
  for (const name of ['Confirm', 'Cancel']) {
    const b = within(d).getByRole('button', { name });
    expect(b.getAttribute('aria-disabled') === 'true' || (b as HTMLButtonElement).disabled, name).toBe(true);
  }
  await userEvent.keyboard('{Escape}');
  expect(screen.getByRole('dialog', { name: 'Use a preset' })).toBeTruthy();
  // The server publishes `repo` before it answers (bug-046): `/config` now reads the file.
  api[`${BASE}/config`] = { status: 200, body: { ...(api[`${BASE}/config`]!.body as object), ui: UI_DECLARED } };
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ['p', PID] });
  });
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Use preset' })).toBeNull());
  expect(screen.getByRole('dialog', { name: 'Use a preset' })).toBeTruthy();
  answer(json(200, OK));
  expect(await within(politeToasts()).findByText('Kanban preset applied')).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(document.getElementById('main')));
});

it('D79-6 — Update in the reason updates the copy, then the focus goes to Use preset', async () => {
  const api = uiApi(UI_INFERRED, { [BASE]: { status: 200, body: behindHeader(1) } });
  const fetch = stub(api, {
    [UPDATE]: () => {
      api[BASE] = { status: 200, body: header(BO, 'r-dev') };
      return json(200, { repository: header(BO, 'r-dev').repository });
    },
  });
  const { queryClient } = renderApp(PAGE);
  const button = await openButton();
  await waitFor(() => expect(button.getAttribute('aria-disabled')).toBe('true'));
  const description = document.getElementById(button.getAttribute('aria-describedby') ?? '') as HTMLElement;
  await userEvent.click(within(description).getByRole('button', { name: 'Update' }));
  await waitFor(() =>
    expect(fetch.mock.calls.some((c) => String(c[0]) === UPDATE && (c[1] as RequestInit).method === 'POST')).toBe(true),
  );
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ['p', PID] });
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Use preset' }).getAttribute('aria-disabled')).toBeNull(),
  );
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Use preset' })));
});

it('review round 1 F-4 — a /config refetch that fails while the write runs keeps the tab and the dialog', async () => {
  let answer: (r: Response) => void = () => {};
  const api = uiApi(UI_INFERRED);
  stub(api, { [PRESET]: () => new Promise<Response>((resolve) => (answer = resolve)) });
  const { queryClient } = renderApp(PAGE);
  const d = await choose('Kanban');
  await userEvent.click(within(d).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(within(d).getByRole('status').textContent).toBe('Applying the preset…'));
  api[`${BASE}/config`] = { status: 500, body: { error: { code: 'internal', message: 'x' } } };
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ['p', PID] });
  });
  await waitFor(() => expect(queryClient.getQueryState(['p', PID, 'config'])?.status).toBe('error'));
  expect(screen.getByRole('dialog', { name: 'Use a preset' })).toBeTruthy();
  // The tab is still rendered (hidden from assistive technology while the modal is open).
  expect(screen.getByRole('table', { name: 'Types → categories', hidden: true })).toBeTruthy();
  expect(document.querySelector('.config-error')).toBeNull();
  answer(json(200, OK));
  expect(await within(politeToasts()).findByText('Kanban preset applied')).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(document.getElementById('main')));
});

it('review round 1 F-5 — an Update that leaves the copy blocking drops the focus request: a later enablement does not move the focus', async () => {
  const api = uiApi(UI_INFERRED, { [BASE]: { status: 200, body: behindHeader(1) } });
  const diverged = header(BO, 'r-dev');
  diverged.repository = { ...diverged.repository, copy: 'diverged' };
  const fetch = stub(api, {
    [UPDATE]: () => {
      api[BASE] = { status: 200, body: diverged };
      return json(200, { repository: diverged.repository });
    },
  });
  const { queryClient } = renderApp(PAGE);
  const button = await openButton();
  await waitFor(() => expect(button.getAttribute('aria-disabled')).toBe('true'));
  const description = document.getElementById(button.getAttribute('aria-describedby') ?? '') as HTMLElement;
  await userEvent.click(within(description).getByRole('button', { name: 'Update' }));
  await waitFor(() =>
    expect(fetch.mock.calls.some((c) => String(c[0]) === UPDATE && (c[1] as RequestInit).method === 'POST')).toBe(true),
  );
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ['p', PID] });
  });
  await waitFor(() =>
    expect(document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Blocked: your copy has diverged from the remote',
    ),
  );
  (document.activeElement as HTMLElement | null)?.blur();
  // Later the copy is in sync again (someone fixed it in a terminal): the focus stays where it was.
  api[BASE] = { status: 200, body: header(BO, 'r-dev') };
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ['p', PID] });
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Use preset' }).getAttribute('aria-disabled')).toBeNull(),
  );
  expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Use preset' }));
});

it('X-09.1 — every text of the section and the dialog comes from the catalogue (key build)', async () => {
  stub(uiApi(UI_INFERRED));
  renderApp(PAGE, keyCatalogue(en));
  const button = await screen.findByRole('button', { name: 'settings.preset.open' });
  await userEvent.click(button);
  const d = await screen.findByRole('dialog');
  await userEvent.click(within(d).getAllByRole('radio')[0]!);
  expect(d.textContent).toContain('settings.preset.effect');
  expect(d.textContent).not.toMatch(/Writes|Confirm|Kanban/);
});
