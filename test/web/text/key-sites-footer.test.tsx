// @vitest-environment jsdom
// task-085 AC-1 (D85-3; review F1) — the gate footer of the element panel: the outcome buttons name the
// target state, the "reserved" line names the gate role, the waiting line names the state. Each is a
// key; each is shown escaped (visible text and accessible name), a plain one unchanged (AC-2).
import type { ActionDescriptor, ElementDetail, Identity } from '@wingfoil-ui/contracts';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { resetSession } from '../../../web/src/session/session.js';
import { header } from '../dna/data.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';

const PID = 'p_fx';
const EID = 'el-002-reset';
const BASE = `/api/p/${PID}/elements/${EID}`;
const ROLE = 'r-approver';
const BAD_ROLE = 'r\u202e-gate\x1b\u200b';
const BAD_TO = 's\u202e3\x1b\u200b';
const BAD_STATE = 'st\x1bate\u200b';
const RAW_CHARS = ['\u202e', '\x1b', '\u200b'];
const hasRaw = (text: string | null | undefined): boolean => RAW_CHARS.some((c) => (text ?? '').includes(c));
const SHOWN = (s: string): string =>
  s.replaceAll('\u202e', '\\u202e').replaceAll('\x1b', '\\x1b').replaceAll('\u200b', '\\u200b');

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

function stub(descriptor: ActionDescriptor, identity: Identity): void {
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
  stubApi(api);
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

it('the outcome buttons name the escaped target state; a plain target is unchanged', async () => {
  const mo: Identity = { kind: 'member', email: 'mo@x.test', name: 'Mo', roles: [ROLE] };
  stub(
    {
      id: EID,
      type: 'kind-a',
      status: 's2',
      kind: 'gate',
      tone: 'human',
      verbs: [
        { verb: 'approve', to: BAD_TO, role: ROLE, enabled: true },
        { verb: 'reject', to: 's1', role: ROLE, enabled: true },
      ],
      actor: { kind: 'role', role: ROLE, members: ['Mo'] },
    },
    mo,
  );
  renderApp(`/p/${PID}/e/${EID}`);
  const footer = await screen.findByRole('region', { name: 'Decision' });
  const approve = within(footer).getByRole('button', { name: new RegExp(SHOWN(BAD_TO).replace(/\\/g, '\\\\')) });
  expect(hasRaw(approve.textContent)).toBe(false);
  expect(hasRaw(footer.textContent)).toBe(false);
  expect(within(footer).getByRole('button', { name: /→ s1/ })).toBeTruthy();
});

it('the reserved line names the escaped gate role', async () => {
  const sa: Identity = { kind: 'member', email: 'sa@x.test', name: 'Sa', roles: ['r-review'] };
  stub(
    {
      id: EID,
      type: 'kind-a',
      status: 's2',
      kind: 'gate',
      tone: 'human',
      verbs: [{ verb: 'approve', to: 's3', role: BAD_ROLE, enabled: true }],
      actor: { kind: 'role', role: BAD_ROLE, members: ['Mo'] },
    },
    sa,
  );
  renderApp(`/p/${PID}/e/${EID}`);
  const dialog = await screen.findByRole('region', { name: 'A gated element' });
  await within(dialog).findByText((_, el) => el?.tagName === 'P' && (el.textContent ?? '').includes(SHOWN(BAD_ROLE)));
  expect(hasRaw(dialog.textContent)).toBe(false);
});

it('the engine-waiting line names the escaped state', async () => {
  const sa: Identity = { kind: 'member', email: 'sa@x.test', name: 'Sa', roles: ['r-review'] };
  stub(
    {
      id: EID,
      type: 'kind-a',
      status: BAD_STATE,
      kind: 'gate',
      tone: 'neutral',
      verbs: [],
      actor: { kind: 'engine' },
    },
    sa,
  );
  renderApp(`/p/${PID}/e/${EID}`);
  const dialog = await screen.findByRole('region', { name: 'A gated element' });
  await within(dialog).findByText((_, el) => el?.tagName === 'P' && (el.textContent ?? '').includes(SHOWN(BAD_STATE)));
  expect(hasRaw(dialog.textContent)).toBe(false);
});
