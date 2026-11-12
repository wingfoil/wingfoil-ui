// task-073 — a move into a state at its limit on the real bin (US-S-24 `@v0.3`: S-24.7; spec-003 §6
// rule 5; RP3-14 D11, RP3-16 P3): a copy of the custom fixture on the pinned CLI, whose `sprint`
// declares `limits: { active: 1 }`, with the Given made by WingFoil's verbs (RP3-16 P4, W-34):
// `sprint-001` in `active`, `sprint-002` in `planned`. Asserted as the user sees it: *Submit →
// active* disabled with the reason shown and as its accessible description; the keyboard path
// sends nothing; axe-core in both themes on the footer.
import type { Locator, Page } from '@playwright/test';
import { fillSprints, PLANNED_SPRINT } from '../harness/fixtures/index.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS } from './support/cold-read.js';
import { openConsole } from './support/console.js';
import { elementView } from './support/element.js';
import { lastCommitSubject } from './support/events.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { expectFocusVisible, tabUntil } from './support/keyboard.js';

test.use({ prebuild: ['custom'] });

const LIMITED = 'Blocked: only 1 active at a time';

/** The element page (task-062: the address opens it in the main region, `support/element.ts`). */
const drawer = (page: Page): Locator => elementView(page);
const submitButton = (page: Page): Locator => drawer(page).getByRole('button', { name: 'Submit → active' });

test.describe('US-S-24 — a state at its limit (v0.3)', () => {
  test('S-24.7 — Disable a move into a state at its limit', async ({ page, fixtures, consoles }) => {
    const fx = await fixtures.copy('custom');
    await fillSprints(fx);
    await actAs(fx, 'Morgan');
    const before = await lastCommitSubject(fx);
    const c = await consoles.start({ projects: [fx] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/e/${PLANNED_SPRINT}` });
    await expect(drawer(page).locator('.type-tag')).toBeVisible({ timeout: COLD_READ_MS });

    const submit = submitButton(page);
    await expect(submit).toHaveAttribute('aria-disabled', 'true', { timeout: COLD_READ_MS });
    await expect(submit).toHaveAccessibleDescription(LIMITED);
    await expect(drawer(page).locator('.submit-footer').getByText(LIMITED, { exact: true })).toBeVisible();
    expect(await scanThemes(page)).toEqual([]);

    // Keyboard: the disabled button stays reachable (D37-3) and a press sends nothing.
    const writes: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST') writes.push(r.url());
    });
    await tabUntil(page, submit);
    await expectFocusVisible(submit);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await submit.click({ force: true });
    expect(writes).toEqual([]);
    expect(await lastCommitSubject(fx)).toBe(before);
    await expect(submit).toHaveAttribute('aria-disabled', 'true');
  });
});
