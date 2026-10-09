// task-019 — the Directives view on the real bin (US-R-06: R-06.1…R-06.4), on copies of the built
// custom fixture with the scenario's user set by `git config user.email` (Jordan: developer; Riley:
// not in the team). The expected lists come from the pinned CLI on the same copy.
import type { Page } from '@playwright/test';
import type { DirectiveEntry } from '@wingfoil-ui/contracts';
import type { Fixture } from '../harness/fixtures/index.js';
import { scanThemes } from './support/axe.js';
import { expectFirstLoad } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { cli } from './support/events.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { expectFocusVisible } from './support/keyboard.js';

test.use({ prebuild: ['custom'] });

/** `directives list` of the fixture, optionally for one role. */
async function directives(fx: Fixture, role?: string): Promise<DirectiveEntry[]> {
  const args = ['--format', 'json', 'directives', 'list', ...(role ? ['--role', role] : [])];
  return (JSON.parse(await cli(fx, args)) as { entries: DirectiveEntry[] }).entries;
}

/** The rows of the list. */
const rows = (page: Page) => page.getByRole('list', { name: 'Directives', exact: true }).locator('.directive-row');

/** The ids of the listed directives, in order. */
async function listed(page: Page): Promise<string[]> {
  return rows(page).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset['directive'] ?? ''));
}

/** Open the list of the console's first project and wait for its first read. */
async function openList(page: Page, c: RunningConsole): Promise<void> {
  await openConsole(page, c, { path: `/p/${c.pids[0]}/directives` });
  await expectFirstLoad(rows(page).first());
}

test.describe('US-R-06 — Directives view', () => {
  test('R-06.1 — Filter the directives bound to my role', async ({ page, fixtures, consoles }) => {
    const custom = await fixtures.copy('custom');
    await actAs(custom, 'Jordan');
    const mine = await directives(custom, 'developer');
    const all = await directives(custom);
    const c = await consoles.start({ projects: [custom] });
    await openList(page, c);
    await expect(page).toHaveTitle('custom · Directives — WingFoil UI');
    const onlyMine = page.getByRole('radio', { name: 'Only mine' });
    await expect(onlyMine).toBeChecked();
    // Exactly the developer-bound directives and the global ones, in the list's order.
    const expected = all.filter((e) => e.global || e.roles.includes('developer')).map((e) => e.frontmatter.id);
    expect(new Set(expected)).toEqual(new Set(mine.map((e) => e.frontmatter.id)));
    expect(await listed(page)).toEqual(expected);
    // Each directive shows the roles it is bound to (the current view's role highlighted).
    for (const e of all.filter((d) => expected.includes(d.frontmatter.id))) {
      const row = rows(page).and(page.locator(`[data-directive="${e.frontmatter.id}"]`));
      const chips = row.locator('.role-chip');
      await expect(chips).toHaveText(e.global ? ['All roles'] : e.roles);
      if (!e.global) await expect(row.locator('.role-chip[data-current="true"]')).toHaveText('developer');
    }
    await onlyMine.focus();
    await expectFocusVisible(onlyMine);
    expect(await scanThemes(page)).toEqual([]);
  });

  test('R-06.2 — Show every directive with "all"', async ({ page, fixtures, consoles }) => {
    const custom = await fixtures.copy('custom');
    await actAs(custom, 'Jordan');
    const all = await directives(custom);
    const c = await consoles.start({ projects: [custom] });
    await openList(page, c);
    // "all" by keyboard: from "Only mine", the arrow key moves the selection.
    await page.getByRole('radio', { name: 'Only mine' }).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('radio', { name: 'All', exact: true })).toBeChecked();
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/directives?show=all`);
    // Every directive file under `.wingfoil/directives/`.
    await expect.poll(() => listed(page)).toEqual(all.map((e) => e.frontmatter.id));
    expect(all.every((e) => e.path.startsWith('directives/'))).toBe(true);
    expect(await scanThemes(page)).toEqual([]);
  });

  test('R-06.3 — Render a directive body', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('custom')] });
    await openList(page, c);
    await page.getByRole('link', { name: 'Using the pinned WingFoil CLI' }).click();
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/directives/wingfoil-cli`);
    const article = page.getByRole('article', { name: 'Using the pinned WingFoil CLI' });
    await expectFirstLoad(article);
    await expect(page).toHaveTitle('custom · wingfoil-cli — WingFoil UI');
    // Rendered as Markdown: headings, and the table of known behaviours as a table.
    await expect(article.getByRole('heading', { level: 1 })).toHaveText('Directive — Using the pinned WingFoil CLI');
    await expect(article.getByRole('heading', { level: 2, name: 'Known behaviours (0.2.2)' })).toBeVisible();
    const table = article.getByRole('table');
    await expect(table.getByRole('columnheader', { name: 'Behaviour', exact: true })).toBeVisible();
    await expect(table.getByRole('cell', { name: 'W-01', exact: true })).toBeVisible();
    await expect(article).not.toContainText('|---');
    // The table scrolls inside its focusable region (keyboard).
    const region = article.getByRole('region', { name: 'Table 1', exact: true });
    await article.focus();
    for (let i = 0; i < 30 && !(await region.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press('Tab');
    }
    await expectFocusVisible(region);
    expect(await scanThemes(page)).toEqual([]);
    await page.getByRole('link', { name: '← Directives' }).click();
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/directives`);
  });

  test('R-06.4 — Show "only mine" empty for a user who is not in the team', async ({ page, fixtures, consoles }) => {
    const custom = await fixtures.copy('custom');
    await actAs(custom, 'Riley');
    const all = await directives(custom);
    const c = await consoles.start({ projects: [custom] });
    await openList(page, c);
    const onlyMine = page.getByRole('radio', { name: 'Only mine' });
    await expect(onlyMine).toBeDisabled();
    await expect(page.getByText('You hold no role in this project', { exact: true })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Directives to show' })).toHaveAccessibleDescription(
      'You hold no role in this project',
    );
    await expect(page.getByRole('radio', { name: 'All', exact: true })).toBeChecked();
    await expect.poll(() => listed(page)).toEqual(all.map((e) => e.frontmatter.id));
    expect(await scanThemes(page)).toEqual([]);
  });
});
