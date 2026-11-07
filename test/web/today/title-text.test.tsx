// @vitest-environment jsdom
// task-056 AC-3, AC-4 (bug-027, K1; spec-004 §5) — Today shows the texts the API escaped as text: a
// row whose title and rejection held a bidi override and a zero-width space comes from the server
// with visible escapes, and the page shows them as written, never the raw characters
// (characterization: React renders text).
import type { ActionDescriptor, ProjectHeader, Today } from '@wingfoil-ui/contracts';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { resetSession } from '../../../web/src/session/session.js';
import { header } from '../project/header-data.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';

const PID = 'p_a';
const ID = 'task-005-hostile-title';
const TITLE = 'Hostile \\u202eeltit\\u200b title';

function jordan(): ProjectHeader {
  return header({
    identity: { kind: 'member', email: 'jordan@example.test', name: 'Jordan', roles: ['developer'] },
    roleViews: ['developer'],
    roleView: 'developer',
  });
}

const DESCRIPTOR: ActionDescriptor = {
  id: ID,
  type: 'task',
  status: 'draft',
  kind: 'first',
  tone: 'neutral',
  verbs: [],
  actor: { kind: 'member', member: { name: 'Jordan', email: 'jordan@example.test' }, basis: 'submitter' },
  rejection: { by: 'Morgan \\u202enagroM', reason: 'Rejected \\u202etxt.exe\\u200b', at: '2026-09-29T15:20:04+00:00' },
};

const TODAY: Today = {
  view: 'developer',
  requiresYou: [
    {
      element: { id: ID, type: 'task', title: TITLE, status: 'draft', localChanges: false },
      descriptor: DESCRIPTOR,
      action: 'rework',
    },
  ],
  waitingOnOthers: [],
};

function api(over: FakeApi = {}): FakeApi {
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'demo', path: '/x', remote: null, availability: 'available' }] },
    },
    [`/api/p/${PID}`]: { status: 200, body: jordan() },
    [`/api/p/${PID}/today?view=developer`]: { status: 200, body: TODAY },
    ...over,
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

it('shows an escaped title as written in a Requires you row (K1)', async () => {
  stubApi(api());
  renderApp(`/p/${PID}`);
  const region = await screen.findByRole('region', { name: 'Requires you' });
  await within(region).findByText(TITLE, { exact: false });
  expect(/[\u202e\u200b]/u.test(region.textContent ?? '')).toBe(false);
});
