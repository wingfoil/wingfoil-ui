// @vitest-environment jsdom
// task-064 — Configuration › Taxonomy (US-C-01, C-01.1, C-01.3, AC-1, AC-3 / C-04.2; ux-reference
// §4.11; D64-1 … D64-4, D64-6, D64-7) on the whole application with a stubbed API: one row per type
// with its category (or "No category") and origin, the requires and patterns with their origins,
// the patterns as served, the 8 categories explained, the ui.yaml warning, the missing `ui` section,
// the tab links in their order, and the key build.
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { keyCatalogue } from '../../../web/scripts/catalogue.mjs';
import { stopEventStream } from '../../../web/src/api/events.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { resetSession } from '../../../web/src/session/session.js';
import { PID } from '../dna/data.js';
import { renderApp, stubApi } from '../shell/render.js';
import { UI_DECLARED, UI_IGNORED, UI_INFERRED, uiApi } from './data.js';

/** The ui.yaml warning (a static paragraph, D64-6). */
function warning(): HTMLElement {
  const el = document.querySelector<HTMLElement>('.ui-yaml-warning');
  if (!el) throw new Error('no ui.yaml warning');
  return el;
}

const PAGE = `/p/${PID}/configuration/taxonomy`;

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

/** The table row of `type` (its first cell). */
async function typeRow(type: string): Promise<HTMLElement> {
  const table = await screen.findByRole('table', { name: 'Types → categories' });
  const row = within(table)
    .getAllByRole('row')
    .find((r) => r.querySelector('th[scope="row"]')?.textContent === type);
  if (!row) throw new Error(`no row for ${type}`);
  return row;
}

it('C-01.1 — inferred categories marked "inferred", and the 8 categories explained', async () => {
  stubApi(uiApi(UI_INFERRED));
  renderApp(PAGE);
  expect(await screen.findByRole('heading', { level: 2, name: 'Taxonomy' })).toBeTruthy();
  const task = await typeRow('task');
  expect(within(task).getByText('work')).toBeTruthy();
  expect(within(task).getByText('inferred')).toBeTruthy();
  const bug = await typeRow('bug');
  expect(within(bug).getByText('defect')).toBeTruthy();
  expect(within(bug).getByText('inferred')).toBeTruthy();
  const list = screen.getByRole('list', { name: 'The 8 UI categories' });
  const names = within(list)
    .getAllByRole('listitem')
    .map((li) => li.querySelector('code')?.textContent);
  expect(names).toEqual(['work', 'defect', 'decision', 'spec', 'requirement', 'feature', 'release', 'external']);
  // Empty lists say so, with their origin.
  expect(screen.getByText('No patterns: only references to other Memory elements are recognised')).toBeTruthy();
  expect(document.title).toBe('demo · Configuration — WingFoil UI');
});

it('C-01.3 — a type with no category reads "No category — not counted in progress figures"', async () => {
  stubApi(uiApi(UI_INFERRED));
  renderApp(PAGE);
  const story = await typeRow('story');
  expect(within(story).getByText('No category — not counted in progress figures')).toBeTruthy();
  expect(within(story).getByText('inferred')).toBeTruthy();
});

it('AC-1 — declared values: categories, requires and patterns with their origins, patterns as served', async () => {
  stubApi(uiApi(UI_DECLARED));
  renderApp(PAGE);
  const task = await typeRow('task');
  expect(within(task).getByText('declared')).toBeTruthy();
  expect(within(task).getByText('requirement, feature')).toBeTruthy();
  const plan = await typeRow('plan');
  expect(within(plan).getByText('No category — not counted in progress figures')).toBeTruthy();
  expect(within(plan).getByText('declared')).toBeTruthy();
  expect(within(plan).getByText('—')).toBeTruthy();
  const requires = screen.getByText('requires', { selector: '.config-key-line code' }).closest('p');
  expect(requires && within(requires).getByText('declared')).toBeTruthy();
  const patterns = screen.getByRole('table', { name: 'Reference patterns' });
  const rows = within(patterns).getAllByRole('row').slice(1);
  expect(rows.map((r) => r.querySelector('code')?.textContent)).toEqual([
    '^(REQ|US)-',
    '^(P\\d|Journey)',
    // An escaped control stays a visible escape, never the character (spec-012 §9).
    '^x\\u202e',
  ]);
  expect(within(rows[0]!).getByText('requirement')).toBeTruthy();
  const line = screen.getByText('patterns', { selector: '.config-key-line code' }).closest('p');
  expect(line && within(line).getByText('declared')).toBeTruthy();
  expect(document.querySelector('.ui-yaml-warning')).toBeNull();
});

it('AC-3 / C-04.2 — an ignored ui.yaml: the warning at the top, every value inferred', async () => {
  stubApi(uiApi(UI_IGNORED));
  renderApp(PAGE);
  const note = await waitFor(() => warning());
  expect(note.textContent).toBe(
    'ui.yaml ignored: Nested mappings are not allowed in compact mappings (line 3, column 7)',
  );
  await typeRow('task');
  const badges = [...document.querySelectorAll('.config-origin')].map((b) => b.textContent);
  expect(badges.length).toBeGreaterThan(3);
  expect(new Set(badges)).toEqual(new Set(['inferred']));
});

it('D64-7 — no ui section (memory.yaml unreadable): the types error, no values', async () => {
  stubApi(uiApi(undefined));
  renderApp(PAGE);
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('Cannot read .wingfoil/memory.yaml');
  expect(screen.queryByRole('table')).toBeNull();
});

it('D64-1 — the tab links in order, Taxonomy current', async () => {
  stubApi(uiApi(UI_INFERRED));
  renderApp(PAGE);
  const nav = await screen.findByRole('navigation', { name: 'Configuration sections' });
  const links = within(nav).getAllByRole('link');
  expect(links.map((l) => l.textContent)).toEqual(['UI settings', 'Taxonomy', 'Progress']);
  expect(links[1]!.getAttribute('aria-current')).toBe('page');
  expect(links[1]!.getAttribute('href')).toBe(`/p/${PID}/configuration/taxonomy`);
  expect(links[2]!.getAttribute('href')).toBe(`/p/${PID}/configuration/progress`);
});

it('X-09.1 — every text from the catalogue (key build)', async () => {
  stubApi(uiApi(UI_IGNORED));
  renderApp(PAGE, keyCatalogue(en));
  expect(await screen.findByRole('heading', { level: 2, name: 'settings.taxonomy.title' })).toBeTruthy();
  expect((await waitFor(() => warning())).textContent).toContain('shell.uiYaml.ignored');
  expect(screen.getByRole('table', { name: 'settings.taxonomy.types.title' })).toBeTruthy();
});
