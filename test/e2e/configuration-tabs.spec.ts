// task-064 — Configuration › Taxonomy and Progress on the real bin (US-C-01, `c/ui-yaml.feature`
// C-01.1 … C-01.3; C-04.2 of US-C-04; AC-1 … AC-3; decisions D64-1 … D64-8, D64-16, D64-18). The
// tabs render `/config`'s `ui` section as served, each value with its origin. *Use preset* and the
// scenarios that commit (C-02.x, C-03.x) are task-079's. Each test has its own console.
import type { Locator, Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import { usePresetUiConfig } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
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
  // Review round 1 F-10: Taxonomy with the preset — the Requires column and the patterns table filled.
  await page
    .getByRole('navigation', { name: 'Configuration sections' })
    .getByRole('link', { name: 'Taxonomy' })
    .click();
  await expectFirstLoad(typesTable(page));
  await expect(row(typesTable(page), 'task').getByRole('cell').nth(1)).toHaveText('requirement');
  const patterns = page.getByRole('table', { name: 'Reference patterns' });
  await expect(patterns.locator('tbody tr')).toHaveCount(3);
  await expect(patterns.locator('tbody code.config-pattern').first()).toHaveText('^(REQ|US)-');
  expect(await scanThemes(page)).toEqual([]);
  // AC-2: the current element is a link to its element page.
  await page
    .getByRole('navigation', { name: 'Configuration sections' })
    .getByRole('link', { name: 'Progress' })
    .click();
  await expectFirstLoad(progressTable(page));
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
  const note = page.locator('.ui-yaml-warning');
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
  await expect(page.locator('.ui-yaml-warning')).toHaveText(/^ui\.yaml ignored: .*line \d+/);
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

/** A type name and a pattern with no break opportunity but the hyphens / none at all (D64-16). */
const LONG_TYPE = 'a-memory-type-whose-name-is-long-enough-to-wrap-in-a-narrow-window';
const LONG_PATTERN = `^${'X'.repeat(180)}`;

test('review round 1 F-3 — at 400 px a long type name and a long pattern wrap: the tabs scroll nothing sideways', async ({
  page,
  fixtures,
  consoles,
}) => {
  const kanban = await fixtures.copy('kanban');
  const memoryYaml = path.join(kanban.dir, '.wingfoil', 'memory.yaml');
  const memory = parse(await readFile(memoryYaml, 'utf8')) as { types: Record<string, unknown> };
  memory.types[LONG_TYPE] = {
    ...(memory.types['adr'] as object),
    path: 'docs/memory/long/{id}.md',
    id_pattern: 'long-{n}-{slug}',
  };
  await writeFile(memoryYaml, stringify(memory));
  await git(kanban.dir, ['add', '--', '.wingfoil/memory.yaml'], kanban.env);
  await git(kanban.dir, ['commit', '--quiet', '-m', 'chore: a long type name'], kanban.env);
  await commitFile(
    kanban,
    '.wingfoil/ui.yaml',
    `version: 1\ntaxonomy:\n  categories:\n    ${LONG_TYPE}: work\n  patterns:\n    - { match: '${LONG_PATTERN}', category: requirement }\n`,
    'chore: a ui.yaml with a long pattern',
  );
  const c = await consoles.start({ projects: [kanban] });
  await page.setViewportSize({ width: 400, height: 800 });
  await openTab(page, c, 'taxonomy');
  await expect(row(typesTable(page), LONG_TYPE).getByRole('cell').first()).toHaveText(/^work\s*declared$/);
  await expect(page.locator('code.config-pattern')).toHaveText(LONG_PATTERN);
  // The tab's own parts: none scrolls sideways or ends past the viewport. The page as a whole still
  // scrolls by about 40 px at this width because of the project header's user block — bug-044,
  // triaged for v0.4 — so the document's scrollWidth is not this test's measure.
  const overflow = () =>
    page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const parts = [...document.querySelectorAll<HTMLElement>('.config-tab, .config-table-wrap, .settings-tabs')];
      return parts.map((el) => ({
        part: el.className,
        inner: el.scrollWidth - el.clientWidth,
        past: Math.ceil(el.getBoundingClientRect().right - width),
      }));
    });
  for (const part of await overflow()) expect(part, part.part).toMatchObject({ inner: 0 });
  for (const part of await overflow()) expect(part.past, part.part).toBeLessThanOrEqual(0);
  await page
    .getByRole('navigation', { name: 'Configuration sections' })
    .getByRole('link', { name: 'Progress' })
    .click();
  await expectFirstLoad(progressTable(page));
  for (const part of await overflow()) expect(part, part.part).toMatchObject({ inner: 0 });
  for (const part of await overflow()) expect(part.past, part.part).toBeLessThanOrEqual(0);
});
