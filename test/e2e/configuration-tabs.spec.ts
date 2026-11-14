// task-064 — Configuration › Taxonomy and Progress on the real bin (US-C-01, `c/ui-yaml.feature`
// C-01.1 … C-01.3; C-04.2 of US-C-04; AC-1 … AC-3; decisions D64-1 … D64-8, D64-16, D64-18). The
// tabs render `/config`'s `ui` section as served, each value with its origin. *Use preset* and the
// scenarios that commit (C-02.x, C-03.x) are task-079's. Each test has its own console.
import type { Locator, Page } from '@playwright/test';
import { usePresetUiConfig } from '../harness/fixtures/index.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS, expectFirstLoad } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { commitFile } from './support/events.js';
import { expect, test } from './support/fixtures.js';
import { tabUntil } from './support/keyboard.js';

test.use({ prebuild: ['kanban', 'custom', 'unknown'] });

/** The row of the table `table` whose header cell reads `name`. */
const row = (table: Locator, name: string): Locator =>
  table.getByRole('row').filter({ has: table.page().getByRole('rowheader', { name, exact: true }) });

const typesTable = (page: Page) => page.getByRole('table', { name: 'Types → categories' });
const progressTable = (page: Page) => page.getByRole('table', { name: 'Progress settings' });

/** Open `tab` of the first project's Configuration and wait for its first read. */
async function openTab(page: Page, c: RunningConsole, tab: 'taxonomy' | 'progress'): Promise<void> {
  await openConsole(page, c, { path: `/p/${c.pids[0]}/configuration/${tab}` });
  await expect(page.getByRole('heading', { level: 1, name: 'Configuration' })).toBeVisible({ timeout: COLD_READ_MS });
  await expectFirstLoad(tab === 'taxonomy' ? typesTable(page) : progressTable(page));
}

test('C-01.1 — Show inferred values on a project without ui.yaml', async ({ page, fixtures, consoles }) => {
  const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
  await openTab(page, c, 'taxonomy');
  const task = row(typesTable(page), 'task');
  await expect(task.getByRole('cell').first()).toHaveText(/^work\s*inferred$/);
  const bug = row(typesTable(page), 'bug');
  await expect(bug.getByRole('cell').first()).toHaveText(/^defect\s*inferred$/);
  const categories = page.getByRole('list', { name: 'The 8 UI categories' }).locator('li code');
  await expect(categories).toHaveText([
    'work',
    'defect',
    'decision',
    'spec',
    'requirement',
    'feature',
    'release',
    'external',
  ]);
  expect(await scanThemes(page)).toEqual([]);
});

test('C-01.2 — Show declared values from ui.yaml', async ({ page, fixtures, consoles }) => {
  const custom = await fixtures.copy('custom');
  await usePresetUiConfig(custom);
  const c = await consoles.start({ projects: [custom] });
  await openTab(page, c, 'progress');
  const scope = row(progressTable(page), 'scope');
  await expect(scope.locator('.config-value')).toHaveText(/^release\s*declared$/);
  const current = scope.locator('.config-current');
  await expect(current.getByRole('link')).toContainText('minor-v0.1');
  await expect(current.locator('.config-origin')).toHaveText('derived');
  const mode = row(progressTable(page), 'mode');
  await expect(mode.locator('.config-value')).toHaveText(/^sequence\s*declared$/);
  await expect(mode).toContainText('Allowed values: sequence | flow');
  expect(await scanThemes(page)).toEqual([]);
  // AC-2: the current element is a link to its element page.
  await current.getByRole('link').click();
  await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/e/minor-v0.1`, { timeout: COLD_READ_MS });
});

test('C-01.3 — Mark a type with no inferable category', async ({ page, fixtures, consoles }) => {
  const c = await consoles.start({ projects: [await fixtures.get('unknown')] });
  await openTab(page, c, 'taxonomy');
  await expect(row(typesTable(page), 'story')).toContainText('No category — not counted in progress figures');
});

test('C-04.2 — Treat unparsable ui.yaml the same way', async ({ page, fixtures, consoles }) => {
  const kanban = await fixtures.copy('kanban');
  await commitFile(kanban, '.wingfoil/ui.yaml', 'version: 1\nprogress: { mode: flow\n', 'chore: a broken ui.yaml');
  const c = await consoles.start({ projects: [kanban] });
  await openTab(page, c, 'taxonomy');
  const note = page.getByRole('note');
  await expect(note).toHaveText(/^ui\.yaml ignored: .*line \d+/);
  const origins = page.locator('.config-origin');
  await expect(origins.first()).toBeVisible();
  expect(new Set(await origins.allTextContents())).toEqual(new Set(['inferred']));
  expect(await scanThemes(page)).toEqual([]);
  // AC-3: the same warning on Progress, every value inferred there too.
  await page
    .getByRole('navigation', { name: 'Configuration sections' })
    .getByRole('link', { name: 'Progress' })
    .click();
  await expectFirstLoad(progressTable(page));
  await expect(page.getByRole('note')).toHaveText(/^ui\.yaml ignored: .*line \d+/);
  expect(new Set(await page.locator('.config-origin').allTextContents())).toEqual(new Set(['inferred']));
});

test('AC-2 — the Progress tab on the kanban fixture: inferred flow, whole project', async ({
  page,
  fixtures,
  consoles,
}) => {
  const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
  await openTab(page, c, 'progress');
  await expect(row(progressTable(page), 'mode').locator('.config-value')).toHaveText(/^flow\s*inferred$/);
  await expect(row(progressTable(page), 'scope').locator('.config-value')).toHaveText(/^Whole project\s*inferred$/);
  await expect(row(progressTable(page), 'holds')).toContainText('No held gates');
  expect(await scanThemes(page)).toEqual([]);
});

test('D64-1, D64-16 — the tabs are links reached from the keyboard, in their order', async ({
  page,
  fixtures,
  consoles,
}) => {
  const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
  await openTab(page, c, 'taxonomy');
  const tabs = page.getByRole('navigation', { name: 'Configuration sections' }).getByRole('link');
  await expect(tabs).toHaveText(['UI settings', 'Taxonomy', 'Progress']);
  await expect(tabs.nth(1)).toHaveAttribute('aria-current', 'page');
  await tabUntil(page, tabs.nth(2));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/configuration/progress`);
  await expectFirstLoad(progressTable(page));
});
