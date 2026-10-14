// task-035 — the *How to join* panel on the real bin (US-C-08, US-C-09; `how-to-join.feature`;
// decisions D35-1…D35-9): opened from the "not in team" badge of the project header, it names the
// tech leads of the DNA or says that there is none or no member at all, and gives the exact
// `wingfoil dna add team.members …` command for the user's email with *Copy command*. The user is
// Riley (`actAs`); the DNA variants are made with the pinned CLI on the fixture copy before the
// console starts. The copied text is read from the browser's clipboard with the task-027 helper
// (`support/clipboard.ts`), on every engine. The panel reads the header and the configuration,
// two queries: every first read is waited for with `COLD_READ_MS` (bug-009).
import type { Locator, Page } from '@playwright/test';
import type { Fixture } from '../harness/fixtures/index.js';
import { scanThemes } from './support/axe.js';
import { allowClipboard, copiedBy } from './support/clipboard.js';
import { COLD_READ_MS, expectFirstLoad } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { cli } from './support/events.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { expectFocusVisible, tabUntil } from './support/keyboard.js';

test.use({ prebuild: ['kanban'] });

const COMMAND =
  'wingfoil dna add team.members --value "<Your Name>" --entry-email riley@example.test --entry-roles <roles>';

/** The "not in team" badge, a button opening the panel. */
const badge = (page: Page): Locator =>
  page.getByRole('banner').getByRole('button', { name: 'Not in team — how to join' });

/** The open panel. */
const panel = (page: Page): Locator => page.getByRole('dialog', { name: 'How to join this project' });

/** The command shown in the panel. */
const command = (page: Page): Locator => panel(page).locator('code.cli-command');

/** A kanban copy where the user is Riley, after `prepare` (CLI changes to its DNA). */
async function rileyKanban(
  fixtures: { copy(kind: 'kanban'): Promise<Fixture> },
  prepare: (fx: Fixture) => Promise<void> = async () => {},
): Promise<Fixture> {
  const kanban = await fixtures.copy('kanban');
  await actAs(kanban, 'Riley');
  await prepare(kanban);
  return kanban;
}

/** Open the project's Memory list, wait for the header (a cold read), open the panel from the badge. */
async function openPanel(page: Page, c: RunningConsole): Promise<Locator> {
  await openConsole(page, c, { path: `/p/${c.pids[0]}/memory` });
  await expectFirstLoad(badge(page));
  await badge(page).click();
  await expect(panel(page)).toBeVisible();
  // The command needs the header only; the team part waits for the configuration's first read.
  await expect(command(page)).toHaveText(COMMAND, { timeout: COLD_READ_MS });
  return panel(page);
}

test.describe('How to join (US-C-08, US-C-09)', () => {
  test('C-08.1 — Name the tech leads and give the command', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await rileyKanban(fixtures)] });
    const p = await openPanel(page, c);
    await expect(p.getByText('riley@example.test is not in the team of this project.', { exact: false })).toBeVisible();
    await expect(p.getByText('Ask a tech lead to run it:')).toBeVisible({ timeout: COLD_READ_MS });
    await expect(p.getByRole('list', { name: 'Tech leads' }).getByRole('listitem')).toHaveText(
      ['Morgan <morgan@example.test>', 'Alex <alex@example.test>'],
      { timeout: COLD_READ_MS },
    );
    await expect(command(page)).toHaveText(COMMAND);
    await expect(p.locator('.how-to-join-roles .role-chip')).toHaveText([
      'developer',
      'reviewer',
      'qa',
      'architect',
      'product-owner',
      'tech-lead',
      'approver',
    ]);
    await expect(p.locator('.how-to-join-roles p')).toHaveText('Roles this project declares:');
    expect(await scanThemes(page)).toEqual([]);

    // The keyboard path: Escape closes and the focus is back on the badge; Tab reaches the badge,
    // Enter opens, Tab reaches Copy command and Close, all with a visible focus.
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    await expectFocusVisible(badge(page));
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await tabUntil(page, badge(page));
    await expectFocusVisible(badge(page));
    await page.keyboard.press('Enter');
    await expect(panel(page)).toBeVisible();
    const copy = panel(page).getByRole('button', { name: 'Copy command' });
    await tabUntil(page, copy);
    await expectFocusVisible(copy);
    const close = panel(page).getByRole('button', { name: 'Close' });
    await tabUntil(page, close);
    await expectFocusVisible(close);
    await page.keyboard.press('Enter');
    await expect(panel(page)).toHaveCount(0);
    await expect(badge(page)).toBeFocused();

    // The notice's *How to join* opens the same panel (D35-2).
    await page
      .getByRole('main')
      .getByRole('region', { name: 'Project header' })
      .getByRole('button', { name: 'How to join' })
      .click();
    await expect(panel(page)).toBeVisible();
    await expect(command(page)).toHaveText(COMMAND);
  });

  test.describe('with the clipboard', () => {
    test.beforeEach(({ context, browserName }) => allowClipboard(context, browserName));

    test('C-08.2 — Copy the command', async ({ page, fixtures, consoles }) => {
      const c = await consoles.start({ projects: [await rileyKanban(fixtures)] });
      const p = await openPanel(page, c);
      const shown = await command(page).textContent();
      const copied = await copiedBy(page, () => p.getByRole('button', { name: 'Copy command' }).click());
      expect(copied).toBe(shown);
      expect(copied).toContain('riley@example.test');
      expect(copied).toBe(COMMAND);
      await expect(p.getByRole('status').filter({ hasText: 'Command copied' })).toBeVisible();
    });
  });

  test('C-09.1 — Say that no tech lead is declared', async ({ page, fixtures, consoles }) => {
    const kanban = await rileyKanban(fixtures, async (fx) => {
      await cli(fx, ['dna', 'update', 'team.members', '--value', 'Morgan', '--entry-roles', 'approver']);
      await cli(fx, [
        'dna',
        'update',
        'team.members',
        '--value',
        'Alex',
        '--entry-roles',
        'architect,developer,reviewer,product-owner,approver,qa',
      ]);
    });
    const c = await consoles.start({ projects: [kanban] });
    const p = await openPanel(page, c);
    await expect(
      p.getByText('This project declares no tech lead — ask any member to run the command', { exact: true }),
    ).toBeVisible({ timeout: COLD_READ_MS });
    await expect(p.getByRole('list', { name: 'Tech leads' })).toHaveCount(0);
    await expect(command(page)).toContainText('riley@example.test');
    expect(await scanThemes(page)).toEqual([]);
  });

  test('C-09.2 — Explain an empty team', async ({ page, fixtures, consoles }) => {
    const kanban = await rileyKanban(fixtures, async (fx) => {
      for (const name of ['Morgan', 'Casey', 'Jordan', 'Sam', 'Alex']) {
        await cli(fx, ['dna', 'remove', 'team.members', '--value', name]);
      }
    });
    const c = await consoles.start({ projects: [kanban] });
    const p = await openPanel(page, c);
    await expect(
      p.getByText(
        'This project declares no team member — anyone with write access to the repository can run the command',
        { exact: true },
      ),
    ).toBeVisible({ timeout: COLD_READ_MS });
    await expect(p.getByText(/declares no tech lead/)).toHaveCount(0);
    await expect(command(page)).toHaveText(COMMAND);
    expect(await scanThemes(page)).toEqual([]);
  });
});
