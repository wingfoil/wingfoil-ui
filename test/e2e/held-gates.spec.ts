// task-069 — held gates on the real bin (US-S-24 `@v0.3`: S-24.5, S-24.6; spec-003 §3, §5;
// spec-005 §4a; ux-reference §4.1 and §4.2 v0.3): a copy of the custom fixture on the pinned CLI
// with the sw-life-cycle preset (`.wingfoil/ui.yaml`, `holds` on `release` `releasing` — `never` —
// and `release-line` `active` — `when-references-done`) and the Given steps made by WingFoil's
// verbs (RP3-16 P4, W-34). Asserted as the user sees it: the Waiting on others text, the footer's
// line, no Approve; the keyboard path and axe-core in both themes on the changed row and footer.
// S-24.7 (a move into a state at its limit) is task-073's (W2-5).
import type { Locator, Page } from '@playwright/test';
import {
  addReleaseLine,
  HELD_RELEASE,
  RELEASE_LINE,
  submitToReleasing,
  usePresetUiConfig,
  type Fixture,
  type MemberName,
} from '../harness/fixtures/index.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { expectFocusVisible, tabUntil } from './support/keyboard.js';

test.use({ prebuild: ['custom'] });

const HELD_BY_CONFIG = 'Approved outside the console (ui.yaml)';
const HELD_ONE = 'Waits for 1 referencing element to be done';

const drawer = (page: Page): Locator => page.locator('.drawer');
const footer = (page: Page): Locator => drawer(page).locator('.element-footer');
const requiresYou = (page: Page): Locator => page.getByRole('region', { name: 'Requires you' });
const waiting = (page: Page): Locator => page.getByRole('region', { name: 'Waiting on others' });
const waitingRow = (page: Page, eid: string): Locator => waiting(page).locator(`li[data-eid="${eid}"]`);

/** A copy of the custom fixture with the preset and `prepare`'s steps, as `name`. */
async function heldCopy(
  fixtures: { copy(kind: 'custom'): Promise<Fixture> },
  name: MemberName,
  prepare: (fx: Fixture) => Promise<void>,
): Promise<Fixture> {
  const fx = await fixtures.copy('custom');
  await usePresetUiConfig(fx);
  await prepare(fx);
  await actAs(fx, name);
  return fx;
}

/** Open Today and wait for its cards (the reference index is built on the first read). */
async function openToday(page: Page, c: RunningConsole): Promise<void> {
  await openConsole(page, c, { path: `/p/${c.pids[0]}` });
  await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/today`, { timeout: COLD_READ_MS });
  await expect(waiting(page)).toBeVisible({ timeout: COLD_READ_MS });
}

/** Open the element panel of `eid` from its Waiting on others row, by keyboard. */
async function openFromRow(page: Page, eid: string): Promise<void> {
  const link = waitingRow(page, eid).getByRole('link');
  await tabUntil(page, link);
  await expectFocusVisible(link);
  await page.keyboard.press('Enter');
  await expect(drawer(page).locator('.type-tag')).toBeVisible({ timeout: COLD_READ_MS });
  await expect(footer(page)).toBeVisible({ timeout: COLD_READ_MS });
}

test.describe('US-S-24 — held gates (v0.3)', () => {
  test('S-24.5 — Hold a gate whose approval is made outside the console', async ({ page, fixtures, consoles }) => {
    const fx = await heldCopy(fixtures, 'Morgan', submitToReleasing);
    const c = await consoles.start({ projects: [fx] });
    await openToday(page, c);
    // Morgan's first role, `approver`, is the role view.
    await expect(page.locator('.today').getByText('Role view: approver', { exact: true })).toBeVisible();
    await expect(requiresYou(page).locator(`li[data-eid="${HELD_RELEASE}"]`)).toHaveCount(0);
    await expect(waitingRow(page, HELD_RELEASE).locator('.today-who')).toHaveText(HELD_BY_CONFIG, {
      timeout: COLD_READ_MS,
    });
    expect(await scanThemes(page)).toEqual([]);

    await openFromRow(page, HELD_RELEASE);
    const gate = drawer(page).getByRole('region', { name: 'Decision' });
    await expect(gate.getByText(HELD_BY_CONFIG, { exact: true })).toBeVisible();
    await expect(gate.locator('.gate-outcome')).toHaveText(['Reject → in-development']);
    await expect(drawer(page).getByRole('button', { name: /^Approve/ })).toHaveCount(0);
    // The reason starts empty (no approval default): the reject waits for one (G-07.1).
    const reason = gate.getByRole('textbox', { name: 'Reason, recorded in the commit' });
    await expect(reason).toHaveValue('');
    await tabUntil(page, reason);
    await expectFocusVisible(reason);
    await page.keyboard.type('Not yet');
    const reject = gate.getByRole('button', { name: 'Reject → in-development', exact: true });
    await tabUntil(page, reject);
    await expectFocusVisible(reject);
    await expect(reject).not.toHaveAttribute('aria-disabled', 'true');
    expect(await scanThemes(page)).toEqual([]);
  });

  test('S-24.6 — Hold a gate until the elements that reference it are done', async ({ page, fixtures, consoles }) => {
    const fx = await heldCopy(fixtures, 'Casey', addReleaseLine);
    const c = await consoles.start({ projects: [fx] });
    await openToday(page, c);
    await expect(waitingRow(page, RELEASE_LINE).locator('.today-who')).toHaveText(HELD_ONE, { timeout: COLD_READ_MS });
    expect(await scanThemes(page)).toEqual([]);

    await openFromRow(page, RELEASE_LINE);
    await expect(footer(page)).toHaveText(HELD_ONE);
    await expect(drawer(page).locator('.gate-outcome')).toHaveCount(0);
    await expect(drawer(page).getByRole('button', { name: /→/ })).toHaveCount(0);
    await expect(drawer(page).getByText(/Reserved to/)).toHaveCount(0);
    expect(await scanThemes(page)).toEqual([]);
  });
});
