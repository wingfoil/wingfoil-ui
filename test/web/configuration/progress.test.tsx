// @vitest-environment jsdom
// task-064 — Configuration › Progress (US-C-01, C-01.2, AC-2, AC-3; ux-reference §4.11; D64-3,
// D64-5, D64-6) on the whole application with a stubbed API: one row per key with its value,
// origin, meaning and allowed values; the current element of scope as a link to its element page,
// "derived"; "Whole project", "No current …", the phases' note, the holds' rules, the warning.
import type { UiConfig } from '@wingfoil-ui/contracts';
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

const PAGE = `/p/${PID}/configuration/progress`;

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

/** The row of key `key`. */
async function keyRow(key: string): Promise<HTMLElement> {
  const table = await screen.findByRole('table', { name: 'Progress settings' });
  const row = within(table)
    .getAllByRole('row')
    .find((r) => r.querySelector('th[scope="row"]')?.textContent === key);
  if (!row) throw new Error(`no row for ${key}`);
  return row;
}

it('C-01.2 — scope declared with its current element derived, mode with its allowed values', async () => {
  stubApi(uiApi(UI_DECLARED));
  renderApp(PAGE);
  expect(await screen.findByRole('heading', { level: 2, name: 'Progress' })).toBeTruthy();
  const scope = await keyRow('scope');
  const typeLine = scope.querySelector('.config-value')!;
  expect(within(typeLine as HTMLElement).getByText('release')).toBeTruthy();
  expect(within(typeLine as HTMLElement).getByText('declared')).toBeTruthy();
  const link = within(scope).getByRole('link');
  expect(link.getAttribute('href')).toBe(`/p/${PID}/e/minor-v0.1`);
  expect(link.textContent).toContain('minor-v0.1');
  expect(link.textContent).toContain('First release');
  const current = link.closest('.config-current')!;
  expect(within(current as HTMLElement).getByText('derived')).toBeTruthy();
  expect(within(current as HTMLElement).getByText('in-progress').className).toContain('tone-active');
  const mode = await keyRow('mode');
  expect(within(mode).getByText('sequence')).toBeTruthy();
  expect(within(mode).getByText('declared')).toBeTruthy();
  expect(within(mode).getByText('Allowed values: sequence | flow')).toBeTruthy();
});

it('AC-2 — phases with the v0.4 note, iterates, defects, holds with their rules', async () => {
  stubApi(uiApi(UI_DECLARED));
  renderApp(PAGE);
  const phases = await keyRow('phases');
  expect(
    within(phases)
      .getAllByRole('listitem')
      .map((li) => li.textContent),
  ).toEqual(['plan', 'build', 'release']);
  expect(phases.textContent).toContain('matched to the workflow from v0.4');
  expect(within(await keyRow('iterates')).getByText('task')).toBeTruthy();
  expect(within(await keyRow('defects')).getByText('bug')).toBeTruthy();
  const holds = await keyRow('holds');
  const items = within(holds)
    .getAllByRole('listitem')
    .map((li) => li.textContent);
  expect(items[0]).toContain('release');
  expect(items[0]).toContain('releasing');
  expect(items[0]).toContain('Approved outside the console (ui.yaml)');
  expect(items[1]).toContain('release-line');
  expect(items[1]).toContain('Approve not offered while an element that references it is not done');
  expect(within(holds).getByText('declared')).toBeTruthy();
});

it('AC-2 — inferred flow: Whole project, no current element line, None for unset keys', async () => {
  stubApi(uiApi(UI_INFERRED));
  renderApp(PAGE);
  const scope = await keyRow('scope');
  expect(within(scope).getByText('Whole project')).toBeTruthy();
  expect(within(scope).getByText('inferred')).toBeTruthy();
  expect(within(scope).queryByRole('link')).toBeNull();
  expect(within(await keyRow('mode')).getByText('flow')).toBeTruthy();
  expect(within(await keyRow('phases')).getByText('None')).toBeTruthy();
  expect(within(await keyRow('defects')).getByText('None')).toBeTruthy();
  expect(within(await keyRow('holds')).getByText('No held gates')).toBeTruthy();
});

it('AC-2 — sequence mode with no element under way: "No current <type>"', async () => {
  const ui: UiConfig = {
    ...UI_DECLARED,
    progress: { ...UI_DECLARED.progress, scope: { value: { type: 'release' }, origin: 'declared', current: null } },
  };
  stubApi(uiApi(ui));
  renderApp(PAGE);
  const scope = await keyRow('scope');
  expect(within(scope).getByText('No current release')).toBeTruthy();
  expect(within(scope).getByText('derived')).toBeTruthy();
});

it('AC-3 — an ignored ui.yaml: the warning at the top, every value inferred', async () => {
  stubApi(uiApi(UI_IGNORED));
  renderApp(PAGE);
  expect((await waitFor(() => warning())).textContent).toContain('ui.yaml ignored: Nested mappings');
  await keyRow('mode');
  const badges = [...document.querySelectorAll('.config-origin')].map((b) => b.textContent);
  expect(badges.length).toBe(6);
  expect(new Set(badges)).toEqual(new Set(['inferred']));
});

it('X-09.1 — every text from the catalogue (key build)', async () => {
  stubApi(uiApi(UI_DECLARED));
  renderApp(PAGE, keyCatalogue(en));
  expect(await screen.findByRole('heading', { level: 2, name: 'settings.progress.title' })).toBeTruthy();
  expect(await screen.findByRole('table', { name: 'settings.progress.table' })).toBeTruthy();
});
