// @vitest-environment jsdom
// task-085 AC-1 (D85-3, D85-4) — a key holding a bidi, a control and a format character is shown
// escaped where the page renders it, while the raw value still addresses the element (bug-041).
import type { ElementList, ProjectConfig } from '@wingfoil-ui/contracts';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { resetSession } from '../../../web/src/session/session.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';

const PID = 'p_fx';
const BAD_ID = 'k-001-\u202eevil\x1bid\u200b';
const BAD_TYPE = 'ty\u202epe';
const BAD_STATE = 'st\x1bate\u200b';
const SHOWN = (s: string): string =>
  s.replace('\u202e', '\\u202e').replace('\x1b', '\\x1b').replace('\u200b', '\\u200b');
const RAW = /[\u202e\x1b\u200b]/;

const LIST: ElementList = {
  elements: [
    {
      path: `docs/${BAD_TYPE}/${BAD_ID}.md`,
      id: BAD_ID,
      title: 'Plain title',
      type: BAD_TYPE,
      status: BAD_STATE,
      tags: [],
      localChanges: false,
      descriptor: {
        id: BAD_ID,
        type: BAD_TYPE,
        status: BAD_STATE,
        kind: 'work',
        tone: 'neutral',
        bucket: 'in-progress',
        verbs: [],
        actor: { kind: 'none' },
      },
    },
  ],
  warnings: [],
};

const CONFIG: ProjectConfig = {
  dna: { error: { code: 'internal', message: 'x' } },
  paths: { error: { code: 'internal', message: 'x' } },
  workflows: { error: { code: 'internal', message: 'x' } },
  types: {
    data: { version: 1, types: { [BAD_TYPE]: { path: 'a/{id}.md', states: { sequence: [BAD_STATE] } } } },
  },
};

function api(): FakeApi {
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'demo', path: '/x', remote: null, availability: 'available' }] },
    },
    [`/api/p/${PID}/config`]: { status: 200, body: CONFIG },
    [`/api/p/${PID}/elements`]: { status: 200, body: LIST },
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

it('Memory list: the row and the filters show the escaped id, type and state; the raw id still addresses', async () => {
  stubApi(api());
  renderApp(`/p/${PID}/memory`);
  await screen.findByText('Plain title');
  const rows = within(screen.getByRole('list', { name: 'Elements' }));
  const link = rows.getByRole('link');
  expect(link.dataset['eid']).toBe(BAD_ID);
  expect(link.textContent).toContain(SHOWN(BAD_ID));
  expect(link.textContent).toContain(SHOWN(BAD_TYPE));
  expect(link.textContent).toContain(SHOWN(BAD_STATE));
  expect(RAW.test(link.textContent ?? '')).toBe(false);
  for (const name of ['Element types', 'States']) {
    const list = screen.getByRole('list', { name });
    expect(RAW.test(list.textContent ?? ''), name).toBe(false);
  }
  expect(screen.getByRole('list', { name: 'Element types' }).textContent).toContain(SHOWN(BAD_TYPE));
});

it('Memory list: no raw control, bidi or format character reaches any text node of the page', async () => {
  stubApi(api());
  const { container } = renderApp(`/p/${PID}/memory`);
  await screen.findByText('Plain title');
  const main = container.querySelector('main') ?? container;
  expect(RAW.test(main.textContent ?? '')).toBe(false);
});
