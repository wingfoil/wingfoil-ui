// task-025 AC-4 (e2e-smoke `fixture-project`, ES-14): a project made with the pinned CLI's
// `Scrum` template — the only template besides Kanban — opened in the console: the Memory list
// renders its elements with their states, the element panel opens one, the DNA view shows the
// Scrum methodology, and axe reports no serious or critical violation in either theme.
import type { Locator, Page } from '@playwright/test';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS, expectFirstLoad, expectLoaded } from './support/cold-read.js';
import { openConsole } from './support/console.js';
import { expect, test } from './support/fixtures.js';

test.use({ prebuild: ['scrum'] });

/** The elements of the Scrum fixture that the landing list shows (archived ones aside), with their state. */
const ACTIVE: Record<string, string> = {
  'task-001-search-story': 'pending',
  'task-002-login-story': 'draft',
  'task-003-export-story': 'approved',
  'bug-001-burndown-off-by-one': 'draft',
  'dl-001-two-week-sprints': 'approved',
};

const rows = (page: Page): Locator => page.getByRole('list', { name: 'Elements' }).getByRole('link');
const row = (page: Page, eid: string): Locator => page.locator(`.memory-row[data-eid="${eid}"]`);
const typeList = (page: Page): Locator => page.getByRole('list', { name: 'Element types' });

/** The listed element ids, in order. */
async function listed(page: Page): Promise<string[]> {
  return rows(page).evaluateAll((links) => links.map((a) => (a as HTMLElement).dataset['eid'] ?? ''));
}

test.describe('task-025 AC-4 — Scrum fixture', () => {
  test('AC-4.1 — the Memory list renders the Scrum elements with their states', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const c = await consoles.start({ projects: [await fixtures.get('scrum')] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/memory` });
    await expect(page.getByRole('heading', { level: 1, name: 'Memory' })).toBeVisible();
    await expect(rows(page).first()).toBeVisible({ timeout: COLD_READ_MS });
    await expect(page).toHaveTitle('scrum · Memory — WingFoil UI');
    await expect.poll(() => listed(page).then((ids) => ids.sort())).toEqual(Object.keys(ACTIVE).sort());
    for (const [eid, state] of Object.entries(ACTIVE)) {
      await expect(row(page, eid).locator('.state-pill')).toHaveText(state);
    }
    await expect(row(page, 'task-001-search-story')).toContainText('Search story');
    // The task type lists its deprecated element too, once selected (W3-24).
    const task = typeList(page).getByRole('link', { name: 'task, 3 elements' });
    await task.click();
    await expect(task).toHaveAttribute('aria-current', 'page');
    await expect(row(page, 'task-004-obsolete-spike').locator('.state-pill')).toHaveText('deprecated', {
      timeout: COLD_READ_MS,
    });
    expect(await scanThemes(page)).toEqual([]);
  });

  test('AC-4.2 — the element panel opens a Scrum element', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('scrum')] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/memory` });
    await expect(rows(page).first()).toBeVisible({ timeout: COLD_READ_MS });
    await row(page, 'task-001-search-story').click();
    const panel = page.getByRole('dialog');
    await expectFirstLoad(panel.locator('.type-tag'));
    await expectLoaded(panel);
    await expect(panel).toHaveAccessibleName('Search story');
    await expect(panel.getByRole('heading', { level: 2, name: 'Search story' })).toBeVisible();
    await expect(panel.getByText('task-001-search-story', { exact: true })).toBeVisible();
    const current = panel.getByRole('list', { name: 'State machine' }).locator('[aria-current="step"]');
    await expect(current.locator('.visually-hidden')).toHaveText('pending, current state');
    await expect(panel.getByRole('listitem').filter({ hasText: 'submitted by Jordan' })).toBeVisible();
    expect(await scanThemes(page)).toEqual([]);
  });

  test('AC-4.3 — the DNA view shows the Scrum methodology', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('scrum')] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/dna` });
    const stack = page.getByRole('region', { name: 'Stack', exact: true });
    await expectFirstLoad(stack);
    await expect(stack.getByText('Scrum', { exact: true })).toBeVisible();
    expect(await scanThemes(page)).toEqual([]);
  });
});
