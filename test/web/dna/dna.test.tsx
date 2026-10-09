// @vitest-environment jsdom
// task-019 — the DNA view (US-R-05, US-S-27; ux-reference §4.5; W3-45) at component level, on the
// whole application with a stubbed API: the route and its sidebar entry, every section from
// `GET /config` `dna`, empty sections, absent optional fields, a failed read confined to the view
// with the CLI's message, and the catalogue (every text a key).
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { keyCatalogue } from '../../../web/scripts/catalogue.mjs';
import { stopEventStream } from '../../../web/src/api/events.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { resetSession } from '../../../web/src/session/session.js';
import { renderApp, stubApi } from '../shell/render.js';
import { BASE, config, DNA, PID, projectApi } from './data.js';

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

/** The section labelled `name`. */
function section(name: string): ReturnType<typeof within> {
  return within(screen.getByRole('region', { name }));
}

it('shows every section of the DNA: project, modules, stack, methodologies, team, agents, paths', async () => {
  const fetch = stubApi(projectApi({ [`${BASE}/config`]: { status: 200, body: config() } }));
  renderApp(`/p/${PID}/dna`);
  expect(await screen.findByRole('heading', { level: 1, name: 'DNA' })).toBeTruthy();
  expect(await screen.findByText('A demo project')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'DNA' }).getAttribute('aria-current')).toBe('page');
  const modules = section('Modules');
  expect(modules.getByText('mod-a')).toBeTruthy();
  expect(modules.getByText('First module')).toBeTruthy();
  expect(modules.getByText('a/')).toBeTruthy();
  expect(modules.getByText('mod-b')).toBeTruthy();
  const stack = section('Stack');
  expect(stack.getByText('Lang')).toBeTruthy();
  expect(stack.getByText('language · 5.x')).toBeTruthy();
  expect(stack.getByText('pinned')).toBeTruthy();
  expect(stack.getByText('Tool')).toBeTruthy();
  expect(stack.getByText('Method One')).toBeTruthy();
  expect(stack.getByText('phase-1')).toBeTruthy();
  expect(stack.getByText('Method Two')).toBeTruthy();
  const team = section('Team and roles');
  const ann = within(team.getByRole('listitem', { name: 'Ann Lee' }));
  expect(ann.getByText('r-approve')).toBeTruthy();
  expect(ann.getByText('r-lead')).toBeTruthy();
  expect(team.getByText('Writes code')).toBeTruthy();
  expect(team.getByText('Bot')).toBeTruthy();
  expect(team.getByText('executes as r-dev, r-qa · never approves')).toBeTruthy();
  const paths = section('Paths');
  expect(paths.getByText('sources')).toBeTruthy();
  expect(paths.getByText('a/')).toBeTruthy();
  expect(paths.getByText('b/')).toBeTruthy();
  expect(paths.getByText('docs')).toBeTruthy();
  expect(paths.getByText('No path declared')).toBeTruthy();
  expect(document.title).toBe('demo · DNA — WingFoil UI');
  // One read: the configuration (shared with the Memory list).
  const reads = fetch.mock.calls.map((c) => String(c[0])).filter((p) => p.startsWith(BASE));
  expect(new Set(reads)).toEqual(new Set([`${BASE}/config`]));
});

it('shows an empty or absent section as empty and leaves absent optional fields out', async () => {
  const bare = {
    version: 1,
    modules: [],
    stacks: {},
    team: { members: [{ name: 'Solo', roles: [] }], roles: [] },
    paths: {},
  };
  stubApi(projectApi({ [`${BASE}/config`]: { status: 200, body: config({ data: bare }) } }));
  renderApp(`/p/${PID}/dna`);
  expect(await screen.findByText('No module declared')).toBeTruthy();
  expect(screen.getByText('No technology declared')).toBeTruthy();
  expect(screen.getByText('No methodology declared')).toBeTruthy();
  expect(screen.getByText('No role declared')).toBeTruthy();
  expect(screen.getByText('No agent declared')).toBeTruthy();
  expect(screen.getByText('No path declared')).toBeTruthy();
  expect(within(screen.getByRole('listitem', { name: 'Solo' })).getByText('No role')).toBeTruthy();
  // No project description: nothing printed in its place.
  expect(screen.queryByText('A demo project')).toBeNull();
});

it('confines a failed DNA read to the view, with the CLI message, the sidebar usable', async () => {
  const error = { code: 'cli-refused', message: 'dna.yaml: bad indentation at line 3' };
  stubApi(projectApi({ [`${BASE}/config`]: { status: 200, body: config({ error }) } }));
  renderApp(`/p/${PID}/dna`);
  const alert = await screen.findByRole('alert');
  expect(within(alert).getByText('The DNA could not be read.')).toBeTruthy();
  expect(within(alert).getByText('dna.yaml: bad indentation at line 3')).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Modules' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Memory' })).toBeTruthy();
});

it('shows a failed configuration request as an error of the view', async () => {
  stubApi(projectApi({ [`${BASE}/config`]: { status: 500, body: { error: { code: 'internal', message: 'x' } } } }));
  renderApp(`/p/${PID}/dna`);
  const alert = await screen.findByRole('alert');
  expect(within(alert).getByText('Something went wrong in the console: see its log in the terminal')).toBeTruthy();
});

it('renders every text from the catalogue (key build)', async () => {
  stubApi(projectApi({ [`${BASE}/config`]: { status: 200, body: config() } }));
  renderApp(`/p/${PID}/dna`, keyCatalogue(en));
  expect(await screen.findByText('dna.modules.title')).toBeTruthy();
  expect(screen.getByText('dna.title')).toBeTruthy();
  expect(screen.getByText('dna.agent.executes r-dev, r-qa')).toBeTruthy();
  expect(screen.queryByText('Modules')).toBeNull();
  expect(DNA.modules).toHaveLength(2);
});
