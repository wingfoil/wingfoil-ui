// @vitest-environment jsdom
// task-085 AC-1 (D85-3, D85-4) — a key holding a bidi, a control and a format character is shown
// escaped where the page renders it, while the raw value still addresses the element (bug-041).
import type { ElementList, ProjectConfig } from '@wingfoil-ui/contracts';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { dnaBody } from '../../../server/src/http/serialise.js';
import { resetSession } from '../../../web/src/session/session.js';
import { renderApp, serverInfo, stubApi, type FakeApi } from '../shell/render.js';
import { BASE, BO, config, DIRECTIVES, DNA, header, projectApi } from '../dna/data.js';

const PID = 'p_fx';
const BAD_ID = 'k-001-\u202eevil\x1bid\u200b';
const BAD_TYPE = 'ty\u202epe';
const BAD_STATE = 'st\x1bate\u200b';
const SHOWN = (s: string): string =>
  s.replaceAll('\u202e', '\\u202e').replaceAll('\x1b', '\\x1b').replaceAll('\u200b', '\\u200b');
const RAW_CHARS = ['\u202e', '\x1b', '\u200b'];
/** Whether `text` holds a raw hostile character (a list, not a regex: `no-control-regex`). */
const hasRaw = (text: string | null | undefined): boolean => RAW_CHARS.some((c) => (text ?? '').includes(c));

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
  expect(hasRaw(link.textContent)).toBe(false);
  for (const name of ['Element types', 'States']) {
    const list = screen.getByRole('list', { name });
    expect(hasRaw(list.textContent), name).toBe(false);
  }
  expect(screen.getByRole('list', { name: 'Element types' }).textContent).toContain(SHOWN(BAD_TYPE));
});

it('Memory list: no raw control, bidi or format character reaches any text node of the page', async () => {
  stubApi(api());
  const { container } = renderApp(`/p/${PID}/memory`);
  await screen.findByText('Plain title');
  const main = container.querySelector('main') ?? container;
  expect(hasRaw(main.textContent)).toBe(false);
});

const BAD_ROLE = 'r‮-dev\x1b​';
const BAD_PHASE = 'ph\x1base​';
const BAD_PATH = 'src‮/\x1b​';

it('DNA: module path, methodology phase, role names and member role chips show the escaped keys', async () => {
  const dna = {
    ...DNA,
    modules: [{ name: 'mod-a', path: BAD_PATH }],
    stacks: { technologies: [], methodologies: [{ name: 'Method One', phase: BAD_PHASE }] },
    team: {
      members: [{ name: 'Ann Lee', email: 'ann@x.test', roles: [BAD_ROLE] }],
      roles: [{ name: BAD_ROLE }],
      agents: [],
    },
  };
  // The body as `/config` serves it (spec-004 §5, D72-2): display fields escaped once by the server,
  // the role names raw (task-085 review F2).
  stubApi(projectApi({ [`${BASE}/config`]: { status: 200, body: config({ data: dnaBody(dna) }) } }));
  const { container } = renderApp(`/p/${PID}/dna`);
  await screen.findByText('Method One');
  const main = container.querySelector('main') ?? container;
  expect(hasRaw(main.textContent)).toBe(false);
  for (const shown of [SHOWN(BAD_PATH), SHOWN(BAD_PHASE), SHOWN(BAD_ROLE)]) {
    expect(main.textContent).toContain(shown);
  }
  expect(main.textContent).toContain('mod-a');
});

it('Team: the role chips and the role filter show the escaped role', async () => {
  const dna = {
    ...DNA,
    team: { members: [{ name: 'Ann Lee', email: 'ann@x.test', roles: [BAD_ROLE, 'r-plain'] }], roles: [], agents: [] },
  };
  stubApi(
    projectApi({
      [BASE]: { status: 200, body: header(BO, 'r-dev') },
      [`${BASE}/config`]: { status: 200, body: config({ data: dna }) },
      [`${BASE}/elements`]: { status: 200, body: { elements: [], warnings: [] } },
    }),
  );
  const { container } = renderApp(`/p/${PID}/team`);
  await screen.findByText('Ann Lee');
  const main = container.querySelector('main') ?? container;
  expect(hasRaw(main.textContent)).toBe(false);
  expect(main.textContent).toContain(SHOWN(BAD_ROLE));
  expect(main.textContent).toContain('r-plain');
});

it('Directives: the list shows the escaped bound roles; the page toolbar shows the escaped path', async () => {
  const base = DIRECTIVES.entries[0]!;
  const entry = {
    ...base,
    path: `directives/${BAD_PATH}d-dev.md`,
    roles: [BAD_ROLE],
    assignment: BAD_ROLE,
    mine: true,
  };
  stubApi(
    projectApi({
      [BASE]: { status: 200, body: header(BO, 'r-dev') },
      [`${BASE}/directives`]: { status: 200, body: { entries: [entry], warnings: [] } },
      [`${BASE}/directives/d-dev`]: {
        status: 200,
        body: { entry, frontmatter: entry.frontmatter, body: '# Title of d-dev\n\ntext\n' },
      },
    }),
  );
  renderApp(`/p/${PID}/directives`);
  await screen.findByText('d-dev');
  const rowList = screen.getByRole('list', { name: 'Directives' });
  expect(hasRaw(rowList.textContent)).toBe(false);
  expect(rowList.textContent).toContain(SHOWN(BAD_ROLE));
  cleanup();
  renderApp(`/p/${PID}/directives/d-dev`);
  const path = await screen.findByText(/^\.wingfoil\/directives\//);
  expect(hasRaw(path.textContent)).toBe(false);
  expect(path.textContent).toContain(SHOWN(BAD_PATH));
});
