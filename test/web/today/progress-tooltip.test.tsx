// @vitest-environment jsdom
// task-065 review round 1, F-1 (D65-7; US-T-14) — the completion tooltip's hover is React Aria's
// alone: it opens only after the trigger's delay, and a figure that comes back after an unavailable
// read starts closed. A file of its own: React Aria keeps module-wide state across tooltips (a
// tooltip closed — or unmounted open — less than its cooldown ago opens the next one at once), which
// the other card tests' tooltips would leave behind.
import type { ProjectHeader, Progress, Today } from '@wingfoil-ui/contracts';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { progressQuery } from '../../../web/src/api/queries.js';
import { resetSession } from '../../../web/src/session/session.js';
import { header } from '../project/header-data.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';

const PID = 'p_a';
const HEADER = `/api/p/${PID}`;
const TODAY = `/api/p/${PID}/today?view=approver`;
const PROGRESS = `/api/p/${PID}/progress`;

function morgan(over: Partial<ProjectHeader> = {}): ProjectHeader {
  return header({
    identity: { kind: 'member', email: 'morgan@example.test', name: 'Morgan', roles: ['approver', 'tech-lead'] },
    roleViews: ['approver', 'tech-lead'],
    roleView: 'approver',
    ...over,
  });
}

const TODAY_BODY: Today = {
  view: 'approver',
  requiresYou: [],
  waitingOnOthers: [],
  summary: [
    { role: 'approver', count: 0 },
    { role: 'tech-lead', count: 0 },
  ],
};

const NEEDS = { state: 'read-only', reason: { code: 'needs-version', minVersion: '0.3.0' } } as const;

function progress(over: Partial<Progress> = {}, figures: Partial<Progress['figures']> = {}): Progress {
  return {
    ui: { source: 'file' },
    mode: 'sequence',
    scope: {
      type: 'kind-r',
      current: { id: 'minor-v0.1', title: 'Minor v0.1', type: 'kind-r', status: 'planning', tone: 'active' },
      basis: 'derived',
    },
    figures: {
      completion: {
        state: 'shown',
        value: 0.25,
        percent: 25,
        references: [
          { id: 'US-M-01', element: false, done: 1, total: 2, percent: 50 },
          { id: 'US-S-01', element: false, done: 0, total: 1, percent: 0 },
        ],
        referencesCount: 2,
        ids: ['k-001-a', 'k-002-b'],
      },
      phase: NEEDS,
      phaseCompletion: NEEDS,
      iterated: { state: 'shown', type: 'kind-a', done: 1, total: 4, ids: ['k-001-a'], doneIds: [] },
      openDefects: { state: 'shown', type: 'kind-d', count: 1, ids: ['d-001-x'] },
      pendingGates: { state: 'shown', count: 3, ids: ['g-001-x'] },
      ...figures,
    },
    unreadable: [],
    capped: [],
    ...over,
  };
}

function api(body: Progress | null = progress(), over: FakeApi = {}): FakeApi {
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'demo', path: '/x', remote: null, availability: 'available' }] },
    },
    [HEADER]: { status: 200, body: morgan() },
    [TODAY]: { status: 200, body: TODAY_BODY },
    ...(body === null ? {} : { [PROGRESS]: { status: 200, body } }),
    ...over,
  };
}

const card = () => screen.getByRole('region', { name: 'Progress' });
const figures = () => within(card()).getByRole('list', { name: 'Figures' });

/**
 * Hover `el` as a pointer user does: the pointer moves on the page first, so React Aria's
 * interaction modality is `pointer` when the hover starts (its tooltip counts no other hover).
 */
async function hoverAsPointerUser(user: ReturnType<typeof userEvent.setup>, el: HTMLElement): Promise<void> {
  await user.pointer({ target: document.body });
  await user.hover(el);
}

/** Open Today and wait for the progress card's figures. */
async function openCard(): Promise<ReturnType<typeof renderApp>> {
  const app = renderApp(`/p/${PID}/today`);
  await waitFor(() => expect(within(card()).queryByRole('list', { name: 'Figures' })).not.toBeNull());
  return app;
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

describe('US-T-14 — the completion tooltip’s hover (review round 1, F-1)', () => {
  it('opens on hover only after React Aria’s delay — one source of hover (review round 1, F-1)', async () => {
    stubApi(api());
    const user = userEvent.setup();
    await openCard();
    await hoverAsPointerUser(user, within(figures()).getByRole('link', { name: 'Project completion 25 %' }));
    // Not at once: the trigger's delay is React Aria's, no hand-wired hover opens it earlier.
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(await screen.findByRole('tooltip')).toBeTruthy();
  });

  it('does not reopen its tooltip when the figure comes back after an unavailable read (review round 1, F-1)', async () => {
    stubApi(api());
    const user = userEvent.setup();
    const { queryClient } = await openCard();
    await hoverAsPointerUser(user, within(figures()).getByRole('link', { name: 'Project completion 25 %' }));
    await screen.findByRole('tooltip');
    act(() => {
      queryClient.setQueryData(
        progressQuery(PID).queryKey,
        progress({}, { completion: { state: 'unavailable', reason: { code: 'no-linked-elements' } } }),
      );
    });
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    act(() => {
      queryClient.setQueryData(progressQuery(PID).queryKey, progress());
    });
    await within(figures()).findByRole('link', { name: 'Project completion 25 %' });
    await new Promise((r) => setTimeout(r, 500));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
