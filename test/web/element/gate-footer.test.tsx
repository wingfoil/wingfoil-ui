// @vitest-environment jsdom
// task-037 — the gate footer of the element panel (US-G-04 … G-07, G-09, S-24; ux-reference §4.2)
// on the whole application with a stubbed API: every outcome side by side, the reason with its
// default, disabled outcomes that keep the focus (D37-3), the write and its feedback (D37-9), and
// the read-only, reserved, waiting and final footers (D37-5 … D37-7).
import type { ActionDescriptor, ElementDetail, Identity } from '@wingfoil-ui/contracts';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { resetSession } from '../../../web/src/session/session.js';
import { header } from '../dna/data.js';
import { renderApp, serverInfo, type FakeApi } from '../shell/render.js';

const PID = 'p_fx';
const EID = 'el-007-gate';
const BASE = `/api/p/${PID}/elements/${EID}`;
const ROLE = 'r-approver';
const MO: Identity = { kind: 'member', email: 'mo@x.test', name: 'Mo', roles: [ROLE, 'r-lead'] };
const DEFAULT_REASON = 'Approved via WingFoil UI';

const GATE: ActionDescriptor = {
  id: EID,
  type: 'kind-a',
  status: 's2',
  kind: 'gate',
  tone: 'human',
  verbs: [
    { verb: 'approve', to: 's3', role: ROLE, enabled: true },
    { verb: 'reject', to: 's1', role: ROLE, enabled: true },
  ],
  actor: { kind: 'role', role: ROLE, members: ['Mo', 'Al'] },
};

function detail(descriptor: ActionDescriptor): ElementDetail {
  return {
    element: {
      path: 'docs/el.md',
      id: EID,
      title: 'A gated element',
      type: 'kind-a',
      status: descriptor.status,
      tags: [],
      localChanges: false,
    },
    frontmatter: { id: EID, type: 'kind-a', title: 'A gated element', status: descriptor.status },
    body: 'Summary.\n',
    descriptor,
    required: [],
    states: { sequence: ['s1', 's2', 's3'], gates: { s2: { reject: 's1' } } },
  };
}

/** The reads of the panel, plus `posts` answered by path for `POST`. */
function stub(
  descriptor: ActionDescriptor,
  identity: Identity = MO,
  posts: FakeApi = {},
  /** The descriptor the element is read with once a POST was sent (the refetch after a write). */
  after?: ActionDescriptor,
): ReturnType<typeof vi.fn> {
  let posted = false;
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
    if (init?.method === 'POST') posted = true;
    const reread = posted && after !== undefined && url === BASE && init?.method !== 'POST';
    const a = (reread ? { status: 200, body: detail(after) } : init?.method === 'POST' ? posts[url] : api[url]) ?? {
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

/** The `POST` requests the page sent. */
function posts(fetch: ReturnType<typeof vi.fn>): { url: string; body: unknown }[] {
  return fetch.mock.calls
    .filter((c) => (c[1] as RequestInit | undefined)?.method === 'POST')
    .map((c) => ({ url: String(c[0]), body: JSON.parse(String((c[1] as RequestInit).body)) as unknown }));
}

async function footer(): Promise<HTMLElement> {
  return screen.findByRole('region', { name: 'Decision' });
}

const reasonField = (f: HTMLElement) => within(f).getByRole('textbox', { name: 'Reason, recorded in the commit' });
const outcome = (f: HTMLElement, name: string) => within(f).getByRole('button', { name });

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

it('G-05.1 — shows every outcome side by side, approve first and primary, then Cancel', async () => {
  stub(GATE);
  renderApp(`/p/${PID}/e/${EID}`);
  const f = await footer();
  expect(
    within(f)
      .getAllByRole('button')
      .map((b) => b.textContent),
  ).toEqual(['Approve → s3', 'Reject → s1', 'Cancel']);
  expect(outcome(f, 'Approve → s3').className).toContain('button-primary');
  expect(outcome(f, 'Reject → s1').className).toContain('button-danger');
  const field = reasonField(f);
  expect((field as HTMLTextAreaElement).value).toBe(DEFAULT_REASON);
  expect(field.getAttribute('placeholder')).toBe('Reason (required)');
  // Opened by URL (not from Today): the reason does not take the focus.
  expect(document.activeElement).not.toBe(field);
});

it('G-04.3 / G-06.1 — opened from Today: the reason has the focus and its default is selected', async () => {
  stub(GATE);
  const { router } = renderApp(`/p/${PID}/e/other`);
  await act(() =>
    router.navigate({ to: '/p/$pid/e/$eid', params: { pid: PID, eid: EID }, state: { gateFocus: true } }),
  );
  const f = await footer();
  const field = reasonField(f) as HTMLTextAreaElement;
  await waitFor(() => expect(document.activeElement).toBe(field));
  expect([field.selectionStart, field.selectionEnd]).toEqual([0, DEFAULT_REASON.length]);
  // Typing replaces the default (G-06.2's first step).
  await userEvent.keyboard('Matches the mock-up');
  expect(field.value).toBe('Matches the mock-up');
});

it('G-06.3 / D37-4 — an untouched default is cleared on a reject and restored on Approve', async () => {
  stub(GATE);
  renderApp(`/p/${PID}/e/${EID}`);
  const f = await footer();
  const field = reasonField(f) as HTMLTextAreaElement;
  act(() => outcome(f, 'Reject → s1').focus());
  expect(field.value).toBe('');
  expect(document.activeElement).toBe(outcome(f, 'Reject → s1'));
  expect(outcome(f, 'Reject → s1').getAttribute('aria-disabled')).toBe('true');
  expect(within(f).getByText('A reason is required')).toBeTruthy();
  act(() => outcome(f, 'Approve → s3').focus());
  expect(field.value).toBe(DEFAULT_REASON);
  expect(outcome(f, 'Approve → s3').getAttribute('aria-disabled')).toBeNull();
});

it('G-06.4 — a reason I typed is kept when a reject is chosen', async () => {
  stub(GATE);
  renderApp(`/p/${PID}/e/${EID}`);
  const f = await footer();
  const field = reasonField(f) as HTMLTextAreaElement;
  await userEvent.clear(field);
  await userEvent.type(field, 'Looks wrong');
  act(() => outcome(f, 'Reject → s1').focus());
  expect(field.value).toBe('Looks wrong');
  // A typed reason is never replaced by the default.
  await userEvent.clear(field);
  act(() => outcome(f, 'Approve → s3').focus());
  expect(field.value).toBe('');
});

it('G-07.1 / G-07.2 — an empty or blank reason disables every outcome, which keep the focus and send nothing', async () => {
  const fetch = stub(GATE);
  renderApp(`/p/${PID}/e/${EID}`);
  const f = await footer();
  const field = reasonField(f);
  await userEvent.clear(field);
  for (const name of ['Approve → s3', 'Reject → s1']) {
    const b = outcome(f, name);
    expect(b.getAttribute('aria-disabled')).toBe('true');
    expect(b.hasAttribute('disabled')).toBe(false);
    expect(b.getAttribute('aria-describedby')).toBe(within(f).getByText('A reason is required').id);
  }
  await userEvent.type(field, '   ');
  expect(outcome(f, 'Approve → s3').getAttribute('aria-disabled')).toBe('true');
  await userEvent.click(outcome(f, 'Approve → s3'));
  await userEvent.click(outcome(f, 'Reject → s1'));
  expect(posts(fetch)).toEqual([]);
});

it('G-06.2 — an outcome posts the decision; the panel says the new state and keeps the focus inside', async () => {
  const fetch = stub(GATE, MO, {
    [`${BASE}/approve`]: {
      status: 200,
      body: {
        result: { id: EID, from: 's2', to: 's3' },
        commits: [{ sha: 'a'.repeat(40), subject: 'wf' }],
        push: { status: 'off' },
      },
    },
  });
  renderApp(`/p/${PID}/e/${EID}`);
  const f = await footer();
  const field = reasonField(f);
  await userEvent.clear(field);
  await userEvent.type(field, 'Matches the mock-up');
  const reads = fetch.mock.calls.filter((c) => String(c[0]) === BASE).length;
  await userEvent.click(outcome(f, 'Approve → s3'));
  expect(await screen.findByText(`${EID} is now s3`)).toBeTruthy();
  expect(screen.getByText(`${EID} is now s3`).closest('[role="status"]')).not.toBeNull();
  expect(posts(fetch)).toEqual([
    { url: `${BASE}/approve`, body: { expectedStatus: 's2', reason: 'Matches the mock-up' } },
  ]);
  // The project's queries are read again (the panel shows the new state).
  await waitFor(() => expect(fetch.mock.calls.filter((c) => String(c[0]) === BASE).length).toBeGreaterThan(reads));
  expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
});

it('G-05.2 — a reject posts to /reject with the reason', async () => {
  const fetch = stub(GATE, MO, {
    [`${BASE}/reject`]: { status: 200, body: { result: {}, commits: [], push: { status: 'off' } } },
  });
  renderApp(`/p/${PID}/e/${EID}`);
  const f = await footer();
  await userEvent.clear(reasonField(f));
  await userEvent.type(reasonField(f), 'Cannot reproduce');
  await userEvent.click(outcome(f, 'Reject → s1'));
  await screen.findByText(`${EID} is now s1`);
  expect(posts(fetch)).toEqual([{ url: `${BASE}/reject`, body: { expectedStatus: 's2', reason: 'Cannot reproduce' } }]);
});

it('D37-9 — a refusal is an alert from the catalogue (CLI text verbatim); the reason is kept', async () => {
  stub(GATE, MO, {
    [`${BASE}/approve`]: {
      status: 422,
      body: { error: { code: 'cli-refused', message: 'Error: role approver required' } },
    },
  });
  renderApp(`/p/${PID}/e/${EID}`);
  const f = await footer();
  await userEvent.click(outcome(f, 'Approve → s3'));
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('WingFoil refused the action:');
  expect(alert.textContent).toContain('Error: role approver required');
  expect((reasonField(f) as HTMLTextAreaElement).value).toBe(DEFAULT_REASON);
});

it('D37-11 — write-incomplete names the file, and the commit when there is one', async () => {
  stub(GATE, MO, {
    [`${BASE}/approve`]: {
      status: 500,
      body: { error: { code: 'write-incomplete', message: 'x', detail: { file: 'docs/el.md' } } },
    },
    [`${BASE}/reject`]: {
      status: 500,
      body: {
        error: { code: 'write-incomplete', message: 'x', detail: { file: 'docs/el.md', commit: 'b'.repeat(40) } },
      },
    },
  });
  renderApp(`/p/${PID}/e/${EID}`);
  const f = await footer();
  await userEvent.click(outcome(f, 'Approve → s3'));
  expect((await screen.findByRole('alert')).textContent).toBe(
    'WingFoil did not finish the action: check docs/el.md with git before trying again',
  );
  await userEvent.clear(reasonField(f));
  await userEvent.type(reasonField(f), 'No');
  await userEvent.click(outcome(f, 'Reject → s1'));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(`WingFoil made the commit ${'b'.repeat(40)}`),
  );
});

it('G-04.2 — Cancel closes the panel and sends nothing', async () => {
  const fetch = stub(GATE);
  renderApp(`/p/${PID}/e/${EID}`);
  const f = await footer();
  await userEvent.click(within(f).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'A gated element' })).toBeNull());
  expect(posts(fetch)).toEqual([]);
});

it('D37-8 — an outcome disabled by the descriptor shows the reason and describes the buttons with it', async () => {
  stub({
    ...GATE,
    verbs: GATE.verbs.map((v) => ({ ...v, enabled: false, reason: { code: 'copy-behind', commits: 2 } as const })),
  });
  renderApp(`/p/${PID}/e/${EID}`);
  const f = await footer();
  const text = within(f).getByText('Blocked: your copy is 2 commits behind the remote');
  for (const name of ['Approve → s3', 'Reject → s1']) {
    expect(outcome(f, name).getAttribute('aria-disabled')).toBe('true');
    expect(outcome(f, name).getAttribute('aria-describedby')).toBe(text.id);
  }
});

it.each([
  [{ code: 'local-changes' } as const, 'Blocked: this element has local changes — commit or discard them first'],
  [{ code: 'version-unsupported', range: '0.2.2 to 0.2.x' } as const, 'Read-only: supported 0.2.2 to 0.2.x'],
  [{ code: 'copy-diverged' } as const, 'Blocked: your copy has diverged from the remote'],
  // task-039 D39-11 (C6): the text of Y-01.3 and of error.detachedHead.
  [{ code: 'copy-detached' } as const, 'Blocked: no branch checked out'],
  [{ code: 'not-in-team' } as const, 'Read-only: not in the team'],
])('D37-8 — renders the reason %o', async (reason, text) => {
  stub({ ...GATE, verbs: GATE.verbs.map((v) => ({ ...v, enabled: false, reason })) });
  renderApp(`/p/${PID}/e/${EID}`);
  expect(within(await footer()).getByText(text)).toBeTruthy();
});

it('S-24.4 — a gate that is also a waiting state: only the reject, empty reason, the engine note', async () => {
  stub({ ...GATE, kind: 'gate-waiting', verbs: [GATE.verbs[1]!], actor: { kind: 'engine' } });
  renderApp(`/p/${PID}/e/${EID}`);
  const f = await footer();
  expect(
    within(f)
      .getAllByRole('button')
      .map((b) => b.textContent),
  ).toEqual(['Reject → s1', 'Cancel']);
  expect((reasonField(f) as HTMLTextAreaElement).value).toBe('');
  expect(within(f).getByText('Waiting for the workflow engine to advance')).toBeTruthy();
});

it('G-09.1 — a member without the gate role sees who can act and no outcome', async () => {
  stub(GATE, { kind: 'member', email: 'sa@x.test', name: 'Sa', roles: ['r-review'] });
  renderApp(`/p/${PID}/e/${EID}`);
  const dialog = await screen.findByRole('dialog', { name: 'A gated element' });
  const line = await within(dialog).findByText(
    (_, el) => el?.tagName === 'P' && el.textContent === `Reserved to ${ROLE} — Mo, Al can act`,
  );
  expect(line).toBeTruthy();
  expect(within(dialog).queryByRole('button', { name: /→/ })).toBeNull();
  expect(within(dialog).queryByRole('textbox')).toBeNull();
});

it('D37-6 — a gate-waiting state for a member without the role: reserved without names, and the engine note', async () => {
  stub(
    { ...GATE, kind: 'gate-waiting', verbs: [GATE.verbs[1]!], actor: { kind: 'engine' } },
    { kind: 'member', email: 'sa@x.test', name: 'Sa', roles: ['r-review'] },
  );
  renderApp(`/p/${PID}/e/${EID}`);
  const dialog = await screen.findByRole('dialog', { name: 'A gated element' });
  expect(await within(dialog).findByText(`Reserved to ${ROLE}`)).toBeTruthy();
  expect(within(dialog).getByText('Waiting for the workflow engine to advance')).toBeTruthy();
});

it('S-13.2 — not in the team: the read-only line with How to join, no outcome', async () => {
  stub(GATE, { kind: 'not-in-team', email: 'zed@x.test' });
  renderApp(`/p/${PID}/e/${EID}`);
  const dialog = await screen.findByRole('dialog', { name: 'A gated element' });
  const line = await within(dialog).findByText('Read-only: zed@x.test is not in the team —');
  const join = within(line.closest('.element-footer') as HTMLElement).getByRole('button', { name: 'How to join' });
  expect(within(dialog).queryByRole('button', { name: /→/ })).toBeNull();
  await userEvent.click(join);
  expect(await screen.findByRole('dialog', { name: 'How to join this project' })).toBeTruthy();
});

it('S-15.2 — an ambiguous identity: the read-only line pointing to the notice, no outcome', async () => {
  stub(GATE, { kind: 'ambiguous', email: 'j@x.test', members: ['Jo', 'Sa'] });
  renderApp(`/p/${PID}/e/${EID}`);
  const dialog = await screen.findByRole('dialog', { name: 'A gated element' });
  expect(await within(dialog).findByText('Read-only: see the notice above the view')).toBeTruthy();
  expect(within(dialog).queryByRole('button', { name: /→/ })).toBeNull();
  expect(within(dialog).queryByRole('button', { name: 'How to join' })).toBeNull();
});

it('S-24.2 — a waiting state: the engine note, no button', async () => {
  stub({ ...GATE, kind: 'waiting', tone: 'neutral', verbs: [], actor: { kind: 'engine' } });
  renderApp(`/p/${PID}/e/${EID}`);
  const dialog = await screen.findByRole('dialog', { name: 'A gated element' });
  expect(await within(dialog).findByText('Waiting for the workflow engine (state: s2)')).toBeTruthy();
  expect(
    within(dialog)
      .getAllByRole('button')
      .map((b) => b.textContent),
  ).toEqual(['Close']);
});

it('S-24.1 — a final state: the chip says final, the note says no action, no button', async () => {
  stub({ ...GATE, status: 's3', kind: 'last', tone: 'done', verbs: [], actor: { kind: 'none' } });
  renderApp(`/p/${PID}/e/${EID}`);
  const dialog = await screen.findByRole('dialog', { name: 'A gated element' });
  expect(await within(dialog).findByText('Final state: no action is possible')).toBeTruthy();
  const current = within(dialog).getByRole('list', { name: 'State machine' }).querySelector('[aria-current="step"]');
  expect(current?.querySelector('.visually-hidden')?.textContent).toBe('s3, final state');
  expect(
    within(dialog)
      .getAllByRole('button')
      .map((b) => b.textContent),
  ).toEqual(['Close']);
});

it('shows no footer for a submit-only element (task-038) nor without a descriptor', async () => {
  stub({
    ...GATE,
    kind: 'first',
    verbs: [{ verb: 'submit', to: 's2', role: null, enabled: true }],
    actor: { kind: 'none' },
  });
  renderApp(`/p/${PID}/e/${EID}`);
  const dialog = await screen.findByRole('dialog', { name: 'A gated element' });
  await within(dialog).findByText('Summary.');
  expect(within(dialog).queryByRole('region', { name: 'Decision' })).toBeNull();
  expect(within(dialog).queryByText(/Final state|Waiting for the workflow engine/)).toBeNull();
});

const OK = { result: { id: EID, from: 's2', to: 's3' }, commits: [], push: { status: 'off' } };

it('review F1 — a Reject click that gave no focus clears the untouched default and sends nothing', async () => {
  const fetch = stub(GATE, MO, { [`${BASE}/reject`]: { status: 200, body: OK } });
  renderApp(`/p/${PID}/e/${EID}`);
  const f = await footer();
  fireEvent.click(outcome(f, 'Reject → s1'));
  expect((reasonField(f) as HTMLTextAreaElement).value).toBe('');
  expect(outcome(f, 'Reject → s1').getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(outcome(f, 'Reject → s1'));
  expect(posts(fetch)).toEqual([]);
});

it('review F2 — a refusal stays shown when the refetched element has no gate footer any more', async () => {
  stub(
    GATE,
    MO,
    { [`${BASE}/approve`]: { status: 409, body: { error: { code: 'element-changed', message: 'x' } } } },
    { ...GATE, status: 's3', kind: 'last', tone: 'done', verbs: [], actor: { kind: 'none' } },
  );
  renderApp(`/p/${PID}/e/${EID}`);
  await userEvent.click(outcome(await footer(), 'Approve → s3'));
  const dialog = screen.getByRole('dialog', { name: 'A gated element' });
  expect(await within(dialog).findByText('Final state: no action is possible')).toBeTruthy();
  expect(within(dialog).getByRole('alert').textContent).toBe('This element changed since you opened it');
});

it("review F4, F5, F6 — after a success the outcomes stay disabled until the state changes; the heading has the focus; the state is the server's", async () => {
  // The refetch still answers the old state (the new one has not arrived yet).
  stub(GATE, MO, { [`${BASE}/approve`]: { status: 200, body: { ...OK, result: { id: EID, from: 's2', to: 's9' } } } });
  renderApp(`/p/${PID}/e/${EID}`);
  const f = await footer();
  await userEvent.click(outcome(f, 'Approve → s3'));
  expect(await screen.findByText(`${EID} is now s9`)).toBeTruthy();
  for (const name of ['Approve → s3', 'Reject → s1']) {
    expect(outcome(await footer(), name).getAttribute('aria-disabled')).toBe('true');
  }
  expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'A gated element' }));
});

it('review F9 — the blank reason field is described by the hint', async () => {
  stub(GATE);
  renderApp(`/p/${PID}/e/${EID}`);
  const f = await footer();
  expect(reasonField(f).getAttribute('aria-describedby')).toBeNull();
  await userEvent.clear(reasonField(f));
  expect(reasonField(f).getAttribute('aria-describedby')).toBe(within(f).getByText('A reason is required').id);
});

it('review F7 — the focus request is forgotten once used (a reload or Back does not move the focus)', async () => {
  stub(GATE);
  const { router } = renderApp(`/p/${PID}/e/other`);
  await act(() =>
    router.navigate({ to: '/p/$pid/e/$eid', params: { pid: PID, eid: EID }, state: { gateFocus: true } }),
  );
  const field = reasonField(await footer());
  await waitFor(() => expect(document.activeElement).toBe(field));
  await waitFor(() => expect(router.state.location.state.gateFocus).toBeUndefined());
  expect(router.state.location.pathname).toBe(`/p/${PID}/e/${EID}`);
});

it('review F12 — outcomes are enabled again when the element comes back to the state it was decided from', async () => {
  stub(
    GATE,
    MO,
    { [`${BASE}/approve`]: { status: 200, body: OK } },
    {
      ...GATE,
      status: 's3',
      kind: 'last',
      tone: 'done',
      verbs: [],
      actor: { kind: 'none' },
    },
  );
  const { queryClient } = renderApp(`/p/${PID}/e/${EID}`);
  await userEvent.click(outcome(await footer(), 'Approve → s3'));
  const dialog = screen.getByRole('dialog', { name: 'A gated element' });
  expect(await within(dialog).findByText('Final state: no action is possible')).toBeTruthy();
  // A later change (e.g. a hand edit, a live refresh) brings the element back to the gate.
  stub(GATE);
  await act(() => queryClient.invalidateQueries({ queryKey: ['p', PID] }));
  const f = await footer();
  for (const name of ['Approve → s3', 'Reject → s1']) {
    await waitFor(() => expect(outcome(f, name).getAttribute('aria-disabled')).toBeNull());
  }
});

it('review F13 — an Approve click without focus after the reject rule restores the default and sends nothing', async () => {
  const fetch = stub(GATE, MO, { [`${BASE}/approve`]: { status: 200, body: OK } });
  renderApp(`/p/${PID}/e/${EID}`);
  const f = await footer();
  fireEvent.click(outcome(f, 'Reject → s1'));
  expect((reasonField(f) as HTMLTextAreaElement).value).toBe('');
  fireEvent.click(outcome(f, 'Approve → s3'));
  expect((reasonField(f) as HTMLTextAreaElement).value).toBe(DEFAULT_REASON);
  expect(posts(fetch)).toEqual([]);
});

it('review F14 — the refusal has its own band, not a second footer', async () => {
  stub(GATE, MO, { [`${BASE}/approve`]: { status: 409, body: { error: { code: 'element-changed', message: 'x' } } } });
  renderApp(`/p/${PID}/e/${EID}`);
  await userEvent.click(outcome(await footer(), 'Approve → s3'));
  const alert = await screen.findByRole('alert');
  expect(alert.className).toBe('element-footer-alert');
  expect(document.querySelectorAll('.drawer .element-footer')).toHaveLength(1);
});
