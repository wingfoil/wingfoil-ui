// task-048 (bug-026) — the element history and the Memory events of WingFoil 0.3.x's operations on
// the real bin, pinned CLI: a copy of the custom fixture with a phase plan closed by hand
// (directive `wingfoil-cli` W-04: `finalize`), a parked task, an amended decision-log, a grouped
// `start` and a chained `sync` (`addOperations`). The panel is read-only: the fixture's own
// identity (Alex) is used.
import type { Locator, Page } from '@playwright/test';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS, expectFirstLoad, expectLoaded } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { expect, test } from './support/fixtures.js';
import { addOperations, AMEND_REASON, PARK_REASON } from '../harness/fixtures/index.js';

test.use({ prebuild: ['custom'] });

/** Open the element panel of `eid` by its URL, after its cold reads (bug-004). */
async function openPanel(page: Page, c: RunningConsole, eid: string): Promise<Locator> {
  await openConsole(page, c, { path: `/p/${c.pids[0]}/e/${eid}` });
  const panel = page.getByRole('dialog');
  await expectFirstLoad(panel.locator('.type-tag'));
  await expectLoaded(panel);
  return panel;
}

/** The history line of the panel that says `what`. */
function line(panel: Locator, what: string): Locator {
  return panel.locator('li.history-entry').filter({ has: panel.page().locator('.history-what', { hasText: what }) });
}

test.describe('task-048 — WingFoil 0.3 operations in the history and the events', () => {
  test('S-48.1 — the history of a phase plan closed by hand', async ({ page, fixtures, consoles }) => {
    const fx = await fixtures.copy('custom');
    const ids = await addOperations(fx);
    const c = await consoles.start({ projects: [fx] });
    const panel = await openPanel(page, c, ids.plan);
    await expect(panel.getByRole('alert')).toHaveCount(0);
    const closed = line(panel, 'closed by Alex');
    await expect(closed).toBeVisible({ timeout: COLD_READ_MS });
    await expect(closed.locator('.history-transition')).toHaveText('active → done');
    await expect(panel.locator('li.history-entry .history-what')).toHaveText([
      'closed by Alex',
      'submitted by Alex',
      'created by Alex',
    ]);
    expect(await scanThemes(page)).toEqual([]);
  });

  test('S-48.2 — a parked and an amended element, with their reasons', async ({ page, fixtures, consoles }) => {
    const fx = await fixtures.copy('custom');
    const ids = await addOperations(fx);
    const c = await consoles.start({ projects: [fx] });
    let panel = await openPanel(page, c, ids.parked);
    const parked = line(panel, 'parked by Jordan');
    await expect(parked).toBeVisible({ timeout: COLD_READ_MS });
    await expect(parked.locator('.history-transition')).toHaveText('in-progress → backlog');
    await expect(parked.locator('.history-reason')).toContainText(PARK_REASON);
    await expect(line(panel, 'started by Jordan').locator('.history-transition')).toHaveText('backlog → in-progress');

    panel = await openPanel(page, c, ids.amended);
    const amended = line(panel, 'amended by Morgan');
    await expect(amended).toBeVisible({ timeout: COLD_READ_MS });
    await expect(amended.locator('.history-reason')).toContainText(AMEND_REASON);
  });

  test('S-48.3 — the bell lists the amend, the sync and the grouped start', async ({ page, fixtures, consoles }) => {
    const fx = await fixtures.copy('custom');
    const ids = await addOperations(fx);
    const c = await consoles.start({ projects: [fx] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}` });
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/today`, { timeout: COLD_READ_MS });
    await page
      .getByRole('banner')
      .getByRole('button', { name: /^Notifications/ })
      .click({ timeout: COLD_READ_MS });
    const updates = page.getByRole('dialog', { name: 'Notifications' }).getByRole('region', { name: 'Updates' });
    const item = (id: string, what: string) =>
      updates
        .locator('li[data-sha]')
        .filter({ has: page.locator('.bell-update-id', { hasText: new RegExp(`^${id}$`) }) })
        .filter({ has: page.locator('.bell-update-what', { hasText: what }) });
    await expect(item(ids.amended, 'amended by Morgan')).toHaveCount(1, { timeout: COLD_READ_MS });
    await expect(item(ids.grouped[1], 'moved with a linked element by Jordan')).toHaveCount(1);
    await expect(item(ids.grouped[0], 'started by Jordan')).toHaveCount(1);
    await expect(item(ids.grouped[1], 'started by Jordan')).toHaveCount(1);
  });
});
