// @vitest-environment jsdom
// task-038 — the single-action footer of the element panel (US-G-10, G-11.2; ux-reference §4.2;
// D38-6, D38-7) on the whole application with a stubbed API: *Submit → <to>* for every member,
// disabled with the descriptor's reason as its description, the write and its toast.
import type { ActionDescriptor, ElementDetail, Identity } from '@wingfoil-ui/contracts';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { resetSession } from '../../../web/src/session/session.js';
import { resetToasts } from '../../../web/src/shell/toasts.js';
import { header } from '../dna/data.js';
import { renderApp, serverInfo, type FakeApi } from '../shell/render.js';

const PID = 'p_fx';
const EID = 'el-004-draft';
const BASE = `/api/p/${PID}/elements/${EID}`;
const ROLE = 'r-dev';
const JO: Identity = { kind: 'member', email: 'jo@x.test', name: 'Jo', roles: [ROLE] };
const LOCAL_CHANGES = 'Blocked: this element has local changes — commit or discard them first';

const DRAFT: ActionDescriptor = {
  id: EID,
  type: 'kind-a',
  status: 's1',
  kind: 'first',
  tone: 'neutral',
  verbs: [{ verb: 'submit', to: 's2', role: null, enabled: true }],
  actor: { kind: 'member', member: { name: 'Jo', email: 'jo@x.test' }, basis: 'creator' },
};

const GATE: ActionDescriptor = {
  ...DRAFT,
  status: 's2',
  kind: 'gate',
  tone: 'human',
  verbs: [
    { verb: 'approve', to: 's3', role: 'r-approver', enabled: true },
    { verb: 'reject', to: 's1', role: 'r-approver', enabled: true },
  ],
  actor: { kind: 'role', role: 'r-approver', members: ['Mo'] },
};

function detail(descriptor: ActionDescriptor): ElementDetail {
  return {
    element: {
      path: 'docs/el.md',
      id: EID,
      title: 'A draft element',
      type: 'kind-a',
      status: descriptor.status,
      tags: [],
      localChanges: false,
    },
    frontmatter: { id: EID, type: 'kind-a', title: 'A draft element', status: descriptor.status },
    body: 'Summary.\n',
    descriptor,
    required: [],
    states: { sequence: ['s1', 's2', 's3'], gates: { s2: { reject: 's1' } } },
  };
}

function stub(descriptor: ActionDescriptor, identity: Identity = JO, posts: FakeApi = {}): ReturnType<typeof vi.fn> {
  const api: FakeApi = {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'kanban', path: '/x', remote: null, availability: 'available' }] },
    },
    [BASE]: { status: 200, body: detail(descriptor) },
    [`${BASE}/history`]: { status: 200, body: { id: EID, path: 'docs/el.md', entries: [] } },
    [`/api/p/${PID}/directives`]: { status: 200, body: { entries: [], warnings: [] } },
    [`/api/p/${PID}`]: { status: 200, body: header(identity, identity.kind === 'member' ? ROLE : null) },
    [`/api/p/${PID}/today?view=${ROLE}`]: { status: 200, body: { view: ROLE, requiresYou: [], waitingOnOthers: [] } },
  };
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const a = (init?.method === 'POST' ? posts[url] : api[url]) ?? {
      status: 404,
      body: { error: { code: 'not-found', message: 'Not found' } },
    };
    return new Response(a.body === undefined ? null : JSON.stringify(a.body), {
      status: a.status,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function posts(fetch: ReturnType<typeof vi.fn>): { url: string; body: unknown }[] {
  return fetch.mock.calls
    .filter((c) => (c[1] as RequestInit | undefined)?.method === 'POST')
    .map((c) => ({ url: String(c[0]), body: JSON.parse(String((c[1] as RequestInit).body)) as unknown }));
}

const dialog = () => screen.findByRole('dialog', { name: 'A draft element' });
const submit = async () => within(await dialog()).findByRole('button', { name: 'Submit → s2' });
const politeToasts = () => document.querySelector('.toasts [aria-live="polite"]') as HTMLElement;
const assertiveToasts = () => document.querySelector('.toasts [aria-live="assertive"]') as HTMLElement;

const OK = {
  result: { id: EID, path: 'docs/el.md', from: 's1', to: 's2' },
  commits: [{ sha: 'abcdef0123456789abcdef0123456789abcdef01', subject: `wf(kind-a): submit ${EID}` }],
  push: { status: 'off' },
};

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

it('G-10.1 — the single-action footer: Submit → <to> (primary), then Cancel', async () => {
  stub(DRAFT);
  renderApp(`/p/${PID}/e/${EID}`);
  const button = await submit();
  expect(button.className).toContain('button-primary');
  const footer = button.closest('.element-footer') as HTMLElement;
  expect(
    within(footer)
      .getAllByRole('button')
      .map((b) => b.textContent),
  ).toEqual(['Submit → s2', 'Cancel']);
  expect(button.getAttribute('aria-disabled')).toBeNull();
});

it('G-10.1 — Submit posts {expectedStatus}; "Submitting…" while it runs; a toast with the commit; focus to the heading', async () => {
  let answer: (r: Response) => void = () => {};
  const fetch = stub(DRAFT);
  const base = fetch.getMockImplementation() as (url: string, init?: RequestInit) => Promise<Response>;
  fetch.mockImplementation((url: string, init?: RequestInit) =>
    init?.method === 'POST' ? new Promise<Response>((resolve) => (answer = resolve)) : base(url, init),
  );
  renderApp(`/p/${PID}/e/${EID}`);
  await userEvent.click(await submit());
  const d = await dialog();
  await waitFor(() => expect(within(d).getByRole('status').textContent).toBe('Submitting…'));
  expect((await submit()).getAttribute('aria-disabled')).toBe('true');
  answer(new Response(JSON.stringify(OK), { status: 200, headers: { 'content-type': 'application/json' } }));
  expect(await within(politeToasts()).findByText(`Submitted ${EID}`)).toBeTruthy();
  expect(politeToasts().textContent).toContain(`abcdef0 wf(kind-a): submit ${EID}`);
  expect(posts(fetch)).toEqual([{ url: `${BASE}/submit`, body: { expectedStatus: 's1' } }]);
  await waitFor(() => expect(within(d).getByRole('status').textContent).toBe(''));
  expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'A draft element' }));
});

it('G-10.1 — keyboard: Enter on Submit sends it', async () => {
  const fetch = stub(DRAFT, JO, { [`${BASE}/submit`]: { status: 200, body: OK } });
  renderApp(`/p/${PID}/e/${EID}`);
  (await submit()).focus();
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(posts(fetch)).toHaveLength(1));
});

it('G-10.3 — no Submit on an element waiting on a gate', async () => {
  stub(GATE);
  renderApp(`/p/${PID}/e/${EID}`);
  const d = await dialog();
  await within(d).findByText(/Reserved to r-approver/);
  expect(within(d).queryByRole('button', { name: /^Submit/ })).toBeNull();
});

it('G-11.2, X-07.3 — disabled with the reason, which is its description; a press sends nothing', async () => {
  const fetch = stub({ ...DRAFT, verbs: [{ ...DRAFT.verbs[0]!, enabled: false, reason: { code: 'local-changes' } }] });
  renderApp(`/p/${PID}/e/${EID}`);
  const button = await submit();
  expect(button.getAttribute('aria-disabled')).toBe('true');
  const described = document.getElementById(button.getAttribute('aria-describedby') ?? '');
  expect(described?.textContent).toBe(LOCAL_CHANGES);
  fireEvent.click(button);
  button.focus();
  await userEvent.keyboard('{Enter}');
  expect(posts(fetch)).toEqual([]);
  // Disabled, it keeps the focus (D37-3).
  expect(document.activeElement).toBe(button);
});

it('the version reason, as for the gate (S-09.1)', async () => {
  stub({
    ...DRAFT,
    verbs: [{ ...DRAFT.verbs[0]!, enabled: false, reason: { code: 'version-unsupported', range: '0.2.2 to 0.2.x' } }],
  });
  renderApp(`/p/${PID}/e/${EID}`);
  const button = await submit();
  expect(document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
    'Read-only: supported 0.2.2 to 0.2.x',
  );
});

it("G-14.1 — a refusal is a red toast with the CLI's text; the footer stays", async () => {
  stub(DRAFT, JO, {
    [`${BASE}/submit`]: {
      status: 422,
      body: { error: { code: 'cli-refused', message: 'Error: required field "sard_ref" is empty' } },
    },
  });
  renderApp(`/p/${PID}/e/${EID}`);
  await userEvent.click(await submit());
  await waitFor(() => expect(assertiveToasts().textContent).toContain(`Submit of ${EID} not done`));
  expect(assertiveToasts().textContent).toContain('Error: required field "sard_ref" is empty');
  expect((await submit()).getAttribute('aria-disabled')).toBeNull();
});

it('Cancel closes the panel and sends nothing', async () => {
  const fetch = stub(DRAFT);
  renderApp(`/p/${PID}/e/${EID}`);
  await submit();
  await userEvent.click(within(await dialog()).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'A draft element' })).toBeNull());
  expect(posts(fetch)).toEqual([]);
});

it('S-13.2 — a user who is not in the team gets the read-only line, no Submit', async () => {
  stub(
    { ...DRAFT, verbs: [{ ...DRAFT.verbs[0]!, enabled: false, reason: { code: 'not-in-team' } }] },
    { kind: 'not-in-team', email: 'ri@x.test' },
  );
  renderApp(`/p/${PID}/e/${EID}`);
  const d = await dialog();
  await within(d).findByText(/is not in the team/);
  expect(within(d).queryByRole('button', { name: /^Submit/ })).toBeNull();
});
