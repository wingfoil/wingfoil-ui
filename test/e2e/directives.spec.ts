// task-019 — the Directives view on the real bin (US-R-06: R-06.1…R-06.4), on copies of the built
// custom fixture with the scenario's user set by `git config user.email` (Jordan: developer; Riley:
// not in the team). The expected lists come from the pinned CLI on the same copy, one entry per
// directive id: the one in force (task-047, bug-025 — a custom directive overriding a built-in one).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from '@playwright/test';
import type { DirectiveEntry } from '@wingfoil-ui/contracts';
import type { Fixture } from '../harness/fixtures/index.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS, expectFirstLoad } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { cli, commitFile } from './support/events.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { expectFocusVisible } from './support/keyboard.js';

test.use({ prebuild: ['custom'] });

/** `directives list` of the fixture, optionally for one role, as the CLI answers it. */
async function listedByCli(fx: Fixture, role?: string): Promise<{ entries: DirectiveEntry[]; warnings: string[] }> {
  const args = ['--format', 'json', 'directives', 'list', ...(role ? ['--role', role] : [])];
  return JSON.parse(await cli(fx, args)) as { entries: DirectiveEntry[]; warnings: string[] };
}

/**
 * The directives in force of `directives list`, in its order (W-23): for an id several files
 * declare, the file the warning names (`… defined in <a>, <b>; using <path>`); without a warning
 * (cut), WingFoil's precedence on its path-sorted list — the first file under `directives/custom/`,
 * else the first listed.
 */
async function directives(fx: Fixture, role?: string): Promise<DirectiveEntry[]> {
  const { entries, warnings } = await listedByCli(fx, role);
  const using = new Map<string, string>();
  for (const w of warnings) {
    const m = /^directive '(.*)' defined in .*; using (.+)$/.exec(w);
    if (m?.[1] !== undefined && m[2] !== undefined) using.set(m[1], m[2]);
  }
  const winner = new Map<string, DirectiveEntry>();
  for (const e of entries) {
    const id = e.frontmatter.id;
    const same = entries.filter((d) => d.frontmatter.id === id);
    winner.set(
      id,
      same.find((d) => d.path === using.get(id)) ??
        same.find((d) => d.path.startsWith('directives/custom/')) ??
        same[0]!,
    );
  }
  return entries.filter((e) => winner.get(e.frontmatter.id) === e);
}

/** The override of the built-in `testing` directive committed on `fx` (bug-025). */
const OVERRIDE_TITLE = 'Testing (project override)';
async function overrideTesting(fx: Fixture): Promise<void> {
  const builtIn = await readFile(path.join(fx.dir, '.wingfoil/directives/built-in/testing.md'), 'utf8');
  await commitFile(
    fx,
    '.wingfoil/directives/custom/testing.md',
    builtIn
      .replace('kind: built-in', 'kind: custom')
      .replace('title: "Testing"', `title: "${OVERRIDE_TITLE}"`)
      .replace(
        '# Directive — Testing',
        '# Directive — Testing, as this project runs it\n\nIt replaces [the built-in testing directive](../built-in/testing.md).',
      ),
    'chore(wingfoil): override the built-in testing directive',
  );
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
  /** R-06.1 on the open list of `custom` (Jordan, developer): "only mine" and the bound roles. */
  async function checkOnlyMine(page: Page, custom: Fixture): Promise<void> {
    const mine = await directives(custom, 'developer');
    const all = await directives(custom);
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
  }

  /** R-06.2 on the open list of `custom` (Jordan): "all" by keyboard, every directive in force. */
  async function checkAll(page: Page, c: RunningConsole, custom: Fixture): Promise<void> {
    const all = await directives(custom);
    // "all" by keyboard: from "Only mine", the arrow key moves the selection.
    await page.getByRole('radio', { name: 'Only mine' }).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('radio', { name: 'All', exact: true })).toBeChecked();
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/directives?show=all`);
    // Every directive in force under `.wingfoil/directives/`: one per id.
    await expect.poll(() => listed(page)).toEqual(all.map((e) => e.frontmatter.id));
    expect(all.every((e) => e.path.startsWith('directives/'))).toBe(true);
  }

  test('R-06.1 — Filter the directives bound to my role', async ({ page, fixtures, consoles }) => {
    const custom = await fixtures.copy('custom');
    await actAs(custom, 'Jordan');
    const c = await consoles.start({ projects: [custom] });
    await openList(page, c);
    await expect(page).toHaveTitle('custom · Directives — WingFoil UI');
    await checkOnlyMine(page, custom);
    const onlyMine = page.getByRole('radio', { name: 'Only mine' });
    await onlyMine.focus();
    await expectFocusVisible(onlyMine);
    expect(await scanThemes(page)).toEqual([]);
  });

  test('R-06.2 — Show every directive with "all"', async ({ page, fixtures, consoles }) => {
    const custom = await fixtures.copy('custom');
    await actAs(custom, 'Jordan');
    const c = await consoles.start({ projects: [custom] });
    await openList(page, c);
    await checkAll(page, c, custom);
    expect(await scanThemes(page)).toEqual([]);
  });

  test('bug-025 — One row per directive in force, with a custom directive overriding a built-in one', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const custom = await fixtures.copy('custom');
    await actAs(custom, 'Jordan');
    await overrideTesting(custom);
    // The CLI lists both files of `testing` and names the one in force.
    const byCli = await listedByCli(custom);
    expect(byCli.entries.filter((e) => e.frontmatter.id === 'testing').map((e) => e.path)).toEqual([
      'directives/built-in/testing.md',
      'directives/custom/testing.md',
    ]);
    const c = await consoles.start({ projects: [custom] });
    await openList(page, c);
    // R-06.1 and R-06.2 hold on the override: one `testing` row, the custom file's.
    await checkOnlyMine(page, custom);
    const testing = rows(page).and(page.locator('[data-directive="testing"]'));
    await expect(testing).toHaveCount(1);
    await expect(testing.getByRole('link')).toHaveText(OVERRIDE_TITLE);
    await checkAll(page, c, custom);
    await expect(testing).toHaveCount(1);
    await expect(testing.getByRole('link')).toHaveText(OVERRIDE_TITLE);
    // The shadowing warning, as WingFoil writes it.
    await expect(
      page.getByText(
        "directive 'testing' defined in directives/built-in/testing.md, directives/custom/testing.md; using directives/custom/testing.md",
        { exact: true },
      ),
    ).toBeVisible();
    expect(await scanThemes(page)).toEqual([]);
    // Its page is the custom file's (R-06.3).
    await testing.getByRole('link').click();
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/directives/testing`);
    const article = page.getByRole('article', { name: OVERRIDE_TITLE });
    await expectFirstLoad(article);
    await expect(article.getByRole('heading', { level: 1 })).toHaveText('Directive — Testing, as this project runs it');
    // A link to the shadowed built-in file is not shown in the UI (D47-4): no link, the mark.
    const shadowed = article.locator('p').filter({ hasText: 'the built-in testing directive' });
    await expect(shadowed.locator('.doc-link-mark')).toHaveText('not shown in the UI', { timeout: COLD_READ_MS });
    await expect(shadowed.getByRole('link')).toHaveCount(0);
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
