// task-079 — *Use preset* on Configuration › Taxonomy on the real bin (US-C-02, US-C-03; `c/ui-yaml.feature`
// C-02.1 … C-02.5, C-03.1, C-03.2; AC-1, AC-2; decisions D79-2 … D79-12): the control hidden, disabled with
// its reason or offered, the dialog, the write through task-060's route as one `chore(ui)` commit, and
// the refusal toasts. Every write is made on a fixture copy of its own (one console per test); commits
// are read with git on the copy. C-03.1's "test build" is the answer such a build gives, fulfilled by
// `page.route` (D79-12, Q3 (a) of W3-1); its server half is task-060's API test.
import type { Locator, Page } from '@playwright/test';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import type { Fixture } from '../harness/fixtures/index.js';
import { usePresetUiConfig } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS, expectFirstLoad } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { lastCommitSubject } from './support/events.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { behindCopy } from './support/screens.js';

test.use({ prebuild: ['kanban', 'custom'] });

const typesTable = (page: Page): Locator => page.getByRole('table', { name: 'Types → categories' });
const usePreset = (page: Page): Locator => page.getByRole('button', { name: 'Use preset', exact: true });
const dialog = (page: Page): Locator => page.getByRole('dialog', { name: 'Use a preset' });
/** The choice `name` of the dialog: its label, clicked as a user does (the radio input is visually hidden). */
const choice = (page: Page, name: string): Locator =>
  dialog(page).locator('label.preset-choice', { has: page.getByRole('radio', { name, exact: true }) });
const politeToasts = (page: Page): Locator => page.locator('.toasts [aria-live="polite"]');
const assertiveToasts = (page: Page): Locator => page.locator('.toasts [aria-live="assertive"]');

/** Open the first project's Taxonomy tab and wait for its first read. */
async function openTaxonomy(page: Page, c: RunningConsole): Promise<void> {
  await openConsole(page, c, { path: `/p/${c.pids[0]}/configuration/taxonomy` });
  await expectFirstLoad(typesTable(page));
}

/** A kanban copy as `name`, with its console, on Taxonomy. */
async function kanbanAs(
  page: Page,
  fixtures: { copy(kind: 'kanban'): Promise<Fixture> },
  consoles: { start(o: { projects: Fixture[] }): Promise<RunningConsole> },
  name: 'Morgan' | 'Riley',
): Promise<{ kanban: Fixture; c: RunningConsole }> {
  const kanban = await fixtures.copy('kanban');
  await actAs(kanban, name);
  const c = await consoles.start({ projects: [kanban] });
  await openTaxonomy(page, c);
  return { kanban, c };
}

/** Choose `name` in the dialog and confirm. */
async function applyPreset(page: Page, name: string): Promise<void> {
  await usePreset(page).click();
  await expect(dialog(page)).toBeVisible();
  await choice(page, name).click();
  await dialog(page).getByRole('button', { name: 'Confirm' }).click();
}

const head = async (f: Fixture): Promise<string> => (await git(f.dir, ['rev-parse', 'HEAD'], f.env)).stdout.trim();
const exists = (f: Fixture, file: string): Promise<boolean> =>
  access(path.join(f.dir, file)).then(
    () => true,
    () => false,
  );

test('C-02.1 — Apply the Kanban preset as one chore(ui) commit', async ({ page, fixtures, consoles }) => {
  const { kanban } = await kanbanAs(page, fixtures, consoles, 'Morgan');
  await applyPreset(page, 'Kanban');
  const toast = politeToasts(page).locator('.toast').filter({ hasText: 'Kanban preset applied' });
  await expect(toast).toBeVisible({ timeout: COLD_READ_MS });
  await toast.hover();
  await expect(toast).toContainText(/[0-9a-f]{7} chore\(ui\): apply the Kanban preset/);
  expect(await lastCommitSubject(kanban)).toBe('chore(ui): apply the Kanban preset');
  const files = await git(kanban.dir, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], kanban.env);
  expect(files.stdout.trim().split('\n')).toEqual(['.wingfoil/ui.yaml']);
  // Taxonomy then marks every value "declared" (categories, patterns, requires; task-060 deviation (3)).
  await expect(usePreset(page)).toHaveCount(0, { timeout: COLD_READ_MS });
  const origins = page.locator('.config-tab .config-origin');
  await expect(origins.first()).toHaveText('declared', { timeout: COLD_READ_MS });
  expect(new Set(await origins.allTextContents())).toEqual(new Set(['declared']));
});

test('C-02.2 — Leave other staged changes out of the commit', async ({ page, fixtures, consoles }) => {
  const kanban = await fixtures.copy('kanban');
  await actAs(kanban, 'Morgan');
  await writeFile(path.join(kanban.dir, 'README.md'), '# kanban\n\nA staged change.\n');
  await git(kanban.dir, ['add', '--', 'README.md'], kanban.env);
  const c = await consoles.start({ projects: [kanban] });
  await openTaxonomy(page, c);
  await applyPreset(page, 'Kanban');
  await expect(politeToasts(page)).toContainText('Kanban preset applied', { timeout: COLD_READ_MS });
  expect(await lastCommitSubject(kanban)).toBe('chore(ui): apply the Kanban preset');
  const files = await git(kanban.dir, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], kanban.env);
  expect(files.stdout.trim().split('\n')).toEqual(['.wingfoil/ui.yaml']);
  const status = await git(kanban.dir, ['status', '--porcelain', '--', 'README.md'], kanban.env);
  // Staged (added: the fixture has no README.md before) and not in the preset commit.
  expect(status.stdout).toBe('A  README.md\n');
});

test('C-02.3 — Offer no preset when ui.yaml exists', async ({ page, fixtures, consoles }) => {
  const custom = await fixtures.copy('custom');
  await usePresetUiConfig(custom);
  const c = await consoles.start({ projects: [custom] });
  await openTaxonomy(page, c);
  await expect(page.locator('.config-tab .config-origin').first()).toHaveText('declared');
  await expect(usePreset(page)).toHaveCount(0);
});

test('C-02.5 — Offer no preset to a user who is not in the team', async ({ page, fixtures, consoles }) => {
  await kanbanAs(page, fixtures, consoles, 'Riley');
  await expect(page.locator('.config-tab .config-origin').first()).toHaveText('inferred');
  await expect(usePreset(page)).toHaveCount(0);
});

test('C-02.4 — Block the preset while the copy is behind', async ({ page, fixtures, consoles }) => {
  const behind = await behindCopy(fixtures);
  const c = await consoles.start({ projects: [behind] });
  await openTaxonomy(page, c);
  await expect(usePreset(page)).toHaveAttribute('aria-disabled', 'true', { timeout: COLD_READ_MS });
  await expect(usePreset(page)).toHaveAccessibleDescription(
    'Blocked: your copy is 1 commit behind the remote — Update',
  );
  // `force`: Playwright waits for an `aria-disabled` control to be enabled; a press must open nothing.
  await usePreset(page).click({ force: true });
  await expect(dialog(page)).toHaveCount(0);
});

test('C-03.1 — Refuse a preset that fails the schema', async ({ page, fixtures, consoles }) => {
  const { kanban, c } = await kanbanAs(page, fixtures, consoles, 'Morgan');
  const before = await head(kanban);
  // The answer of a test build whose Kanban preset lacks `version` (task-060's 422 body), never forwarded.
  await page.route(`**/api/p/${c.pids[0]}/ui-config/preset`, (route) =>
    route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'ui-config-invalid',
          message: 'The preset is not a valid ui.yaml',
          detail: { failure: 'missing required key version' },
        },
      }),
    }),
  );
  await applyPreset(page, 'Kanban');
  await expect(assertiveToasts(page)).toContainText('ui.yaml not written: missing required key version', {
    timeout: COLD_READ_MS,
  });
  expect(await exists(kanban, '.wingfoil/ui.yaml')).toBe(false);
  expect(await head(kanban)).toBe(before);
});

test('C-03.2 — Refuse a preset that maps a type the project does not declare', async ({ page, fixtures, consoles }) => {
  const { kanban } = await kanbanAs(page, fixtures, consoles, 'Morgan');
  const before = await head(kanban);
  await applyPreset(page, 'WingFoil sw-life-cycle');
  await expect(assertiveToasts(page)).toContainText(
    'ui.yaml not written: type service is not declared in memory.yaml',
    { timeout: COLD_READ_MS },
  );
  expect(await exists(kanban, '.wingfoil/ui.yaml')).toBe(false);
  expect(await head(kanban)).toBe(before);
  // The control is still offered, and the focus is back on it (D79-7).
  await expect(usePreset(page)).toBeFocused();
});

test('AC-1 — the dialog from the keyboard', async ({ page, fixtures, consoles }) => {
  const { kanban } = await kanbanAs(page, fixtures, consoles, 'Morgan');
  const before = await head(kanban);
  await usePreset(page).focus();
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeVisible();
  // The dialog takes the focus; Tab reaches the radio group, the arrows choose inside it.
  await page.keyboard.press('Tab');
  await expect(dialog(page).getByRole('radio', { name: 'Kanban' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(dialog(page).getByRole('radio', { name: 'Scrum' })).toBeChecked();
  await expect(dialog(page)).toContainText('chore(ui): apply the Scrum preset');
  expect(await scanThemes(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  await expect(usePreset(page)).toBeFocused();
  expect(await head(kanban)).toBe(before);
});

test('D79-10 — at 400 px the section and the dialog scroll nothing sideways', async ({ page, fixtures, consoles }) => {
  await page.setViewportSize({ width: 400, height: 800 });
  await kanbanAs(page, fixtures, consoles, 'Morgan');
  // Their own parts only: the page as a whole scrolls by about 40 px at this width (bug-044, v0.4).
  const overflow = (selector: string) =>
    page.evaluate((sel) => {
      const width = document.documentElement.clientWidth;
      return [...document.querySelectorAll<HTMLElement>(sel)].map((el) => ({
        part: el.className,
        inner: el.scrollWidth - el.clientWidth,
        past: Math.ceil(el.getBoundingClientRect().right - width),
      }));
    }, selector);
  await expect(usePreset(page)).toBeVisible();
  const section = await overflow('.preset-section');
  expect(section).toHaveLength(1);
  for (const part of section) expect(part, part.part).toMatchObject({ inner: 0 });
  for (const part of section) expect(part.past, part.part).toBeLessThanOrEqual(0);
  await usePreset(page).click();
  await choice(page, 'WingFoil sw-life-cycle').click();
  const parts = await overflow('.preset-dialog');
  expect(parts).toHaveLength(1);
  for (const part of parts) expect(part, part.part).toMatchObject({ inner: 0 });
  for (const part of parts) expect(part.past, part.part).toBeLessThanOrEqual(0);
});
