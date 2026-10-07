// task-019 — the Team view on the real bin (US-R-07: R-07.1…R-07.3), on the built kanban fixture
// (a copy when the scenario's user is set: "I am Morgan"). The pending gates are the kanban
// elements waiting at a gate (`bug-001-crash-on-save`, `task-001-login-form`: role approver).
import type { Page } from '@playwright/test';
import { scanThemes } from './support/axe.js';
import { expectFirstLoad } from './support/cold-read.js';
import { openConsole } from './support/console.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';

test.use({ prebuild: ['kanban'] });

/** The member cards. */
const cards = (page: Page) => page.getByRole('list', { name: 'Members' }).locator('.member-card');

/** The card of `name`. */
const card = (page: Page, name: string) => page.getByRole('listitem', { name, exact: true });

/** The names on the cards, in order. */
async function names(page: Page): Promise<string[]> {
  return cards(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
}

test.describe('US-R-07 — Team view', () => {
  test('R-07.1 — Show members with their roles and pending gates', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    await actAs(kanban, 'Morgan');
    const c = await consoles.start({ projects: [kanban] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/team` });
    const morgan = card(page, 'Morgan');
    await expectFirstLoad(morgan.getByText('2 pending gates', { exact: true }));
    await expect(page).toHaveTitle('kanban · Team — WingFoil UI');
    await expect(cards(page)).toHaveCount(5);
    expect(await names(page)).toEqual(['Morgan', 'Casey', 'Jordan', 'Sam', 'Alex']);
    await expect(morgan.locator('.role-chip')).toHaveText(['approver', 'tech-lead']);
    await expect(morgan.getByText('you', { exact: true })).toBeVisible();
    await expect(morgan.getByText('morgan@example.test', { exact: true })).toBeVisible();
    const jordan = card(page, 'Jordan');
    await expect(jordan.locator('.role-chip')).toHaveText(['developer']);
    await expect(jordan.getByText('No pending gate', { exact: true })).toBeVisible();
    await expect(jordan.getByText('you', { exact: true })).toHaveCount(0);
    expect(await scanThemes(page)).toEqual([]);
  });

  test('R-07.2 — Mark agents as never approving', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/team` });
    const agents = page.getByRole('region', { name: 'Agents', exact: true });
    await expectFirstLoad(agents);
    const agent = agents.getByRole('listitem').filter({ hasText: 'Build agent' });
    await expect(agent.locator('.rules-name')).toHaveText('Build agent');
    await expect(agent.locator('.rules-text')).toHaveText('executes as developer · never approves');
    // An agent is not a member card.
    await expect(cards(page).filter({ hasText: 'Build agent' })).toHaveCount(0);
  });

  test('R-07.3 — Filter members with pending gates', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/team` });
    await expectFirstLoad(card(page, 'Morgan').getByText('2 pending gates', { exact: true }));
    // The filter "with pending gates", by keyboard.
    const filter = page.getByRole('checkbox', { name: 'With pending gates' });
    await page.getByRole('searchbox', { name: 'Search by name or email' }).focus();
    await page.keyboard.press('Tab');
    await expect(filter).toBeFocused();
    // The input is hidden by React Aria: its label shows the focus ring.
    const label = page.locator('.team-gates');
    await expect(label).toHaveAttribute('data-focus-visible', 'true');
    expect(await label.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
    await page.keyboard.press('Space');
    await expect(filter).toBeChecked();
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/team?gates=1`);
    await expect.poll(() => names(page)).toEqual(['Morgan', 'Alex']);
    expect(await scanThemes(page)).toEqual([]);
  });
});
