// @vitest-environment jsdom
// task-081 (D81-2) — a characterization of Today's *Waiting on others* "who must act", written
// before its extraction into the shared part `web/src/element/WhoMustAct.tsx`: the markup of each
// row's `.today-who` for every actor case is pinned as literal text, green before the extraction
// and after it, so Today's rendering is proved unchanged.
import type { ActionDescriptor, ProjectHeader, Today, TodayRow } from '@wingfoil-ui/contracts';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { resetSession } from '../../../web/src/session/session.js';
import { header } from '../project/header-data.js';
import { renderApp, serverInfo, stubApi } from '../shell/render.js';
import { progressAnswer } from './progress-data.js';

const PID = 'p_a';
const JORDAN = { name: 'Jordan', email: 'jordan@example.test' };

function morgan(): ProjectHeader {
  return header({
    identity: { kind: 'member', email: 'morgan@example.test', name: 'Morgan', roles: ['approver'] },
    roleViews: ['approver'],
    roleView: 'approver',
  });
}

function waiting(id: string, over: Partial<ActionDescriptor>): TodayRow {
  return {
    element: { id, type: 'task', title: `Title of ${id}`, status: 's', localChanges: false },
    descriptor: {
      id,
      type: 'task',
      status: 's',
      kind: 'work',
      tone: 'neutral',
      verbs: [],
      actor: { kind: 'none' },
      ...over,
    },
  };
}

/** One row per actor case (ten: within the card's row limit). */
const ROWS: TodayRow[] = [
  waiting('task-001-a', { actor: { kind: 'member', member: JORDAN, basis: 'submitter' } }),
  waiting('task-002-b', { actor: { kind: 'member', member: JORDAN, basis: 'creator' } }),
  waiting('task-003-c', { actor: { kind: 'member', member: JORDAN, basis: 'last-transition' } }),
  waiting('task-004-d', { actor: { kind: 'member', member: JORDAN } }),
  waiting('task-005-e', { actor: { kind: 'role', role: 'architect', members: ['Alex', 'Casey'] } }),
  waiting('task-006-f', { actor: { kind: 'role', role: 'qa', members: [] } }),
  waiting('task-007-g', { actor: { kind: 'engine' } }),
  waiting('task-008-h', {
    actor: { kind: 'role', role: 'approver', members: ['Morgan'] },
    approveHeld: { condition: 'never', reason: { code: 'held-by-config' } },
  }),
  waiting('task-009-i', {
    actor: { kind: 'role', role: 'approver', members: ['Morgan'] },
    approveHeld: { condition: 'when-references-done', reason: { code: 'held-until-references-done', count: 2 } },
  }),
  waiting('task-010-j', { actor: { kind: 'none' } }),
];

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

function stub(rows: TodayRow[]): void {
  const today: Today = { view: 'approver', requiresYou: [], waitingOnOthers: rows };
  stubApi({
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'demo', path: '/x', remote: null, availability: 'available' }] },
    },
    [`/api/p/${PID}`]: { status: 200, body: morgan() },
    [`/api/p/${PID}/today?view=approver`]: { status: 200, body: today },
    ...progressAnswer(PID),
    [`/api/p/${PID}/events/memory?limit=5`]: { status: 200, body: { events: [], more: false } },
  });
}

async function whoTexts(): Promise<(string | undefined)[]> {
  renderApp(`/p/${PID}/today`);
  const card = await screen.findByRole('region', { name: 'Waiting on others' });
  return within(card)
    .getAllByRole('listitem')
    .map((li) => li.querySelector('.today-who')?.outerHTML);
}

// Review round 1 (F-5): added after the extraction — the two actors that name no one.
it("Today's Waiting on others renders nothing for a member or role actor naming no one (task-081, D81-2)", async () => {
  stub([waiting('task-011-k', { actor: { kind: 'member' } }), waiting('task-012-l', { actor: { kind: 'role' } })]);
  expect(await whoTexts()).toMatchInlineSnapshot(`
    [
      "<span class="today-who"></span>",
      "<span class="today-who"></span>",
    ]
  `);
});

it("Today's Waiting on others renders the same who must act for every actor case (task-081, D81-2)", async () => {
  const today: Today = { view: 'approver', requiresYou: [], waitingOnOthers: ROWS };
  stubApi({
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'demo', path: '/x', remote: null, availability: 'available' }] },
    },
    [`/api/p/${PID}`]: { status: 200, body: morgan() },
    [`/api/p/${PID}/today?view=approver`]: { status: 200, body: today },
    ...progressAnswer(PID),
    [`/api/p/${PID}/events/memory?limit=5`]: { status: 200, body: { events: [], more: false } },
  });
  renderApp(`/p/${PID}/today`);
  const card = await screen.findByRole('region', { name: 'Waiting on others' });
  const who = within(card)
    .getAllByRole('listitem')
    .map((li) => li.querySelector('.today-who')?.outerHTML);
  expect(who).toMatchInlineSnapshot(`
    [
      "<span class="today-who">Jordan (submitter) must act</span>",
      "<span class="today-who">Jordan (creator) must act</span>",
      "<span class="today-who">Jordan (last transition) must act</span>",
      "<span class="today-who">Jordan must act</span>",
      "<span class="today-who">Reserved to architect — <span class="today-members">Alex, Casey</span></span>",
      "<span class="today-who">Reserved to qa</span>",
      "<span class="today-who">Waiting for the workflow engine</span>",
      "<span class="today-who">Approved outside the console (ui.yaml)</span>",
      "<span class="today-who">Waits for 2 referencing elements to be done</span>",
      "<span class="today-who"></span>",
    ]
  `);
});
