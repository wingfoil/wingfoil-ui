// task-021 — e2e-smoke `accessibility` (REQ-ARC-09, REQ-ARC-10, REQ-ARC-11): the closing pass over
// every v0.1 screen. US-X-06 (keyboard with a visible focus ring of contrast ≥ 3:1, Escape, the axe
// scan of every screen), US-X-08 (themes), US-X-09 (every string from the catalogue, on the
// key-rendering build), US-X-10 (the tab title). Decisions W5-1…W5-12 (2026-10-10). The screens are
// listed once in `support/screens.ts`, shared by X-06.4 and X-09.1 — one test per screen on one
// console per worker (bug-011).
import type { Page } from '@playwright/test';
import type { ElementDetail } from '@wingfoil-ui/contracts';
import { scanThemes, type BlockingViolation, type Theme } from './support/axe.js';
import { COLD_READ_MS, expectFirstLoad } from './support/cold-read.js';
import { openConsole, startConsole, type RunningConsole } from './support/console.js';
import { expect, test as base } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { expectFocusVisible, focusRing, tabUntil, type FocusRing } from './support/keyboard.js';
import { expectSettled, SCREENS, startScreensConsole } from './support/screens.js';
import { recordApiData, screenTextsOutsideCatalogue } from './support/strings.js';

/**
 * The console of `SCREENS` (`startScreensConsole`), one per worker (bug-011): X-06.4 and X-09.1 run
 * one test per screen, so a scenario's duration does not grow with the screens of the release, and
 * the three fixture copies and their cold reads are paid once per worker, not once per screen. The
 * screens only read (`no-commit.spec.ts` proves it), so the tests can share it. It is stopped when
 * the worker ends, and the worker's reaper kills it if the stop fails (bug-004).
 */
const test = base.extend<object, { screensConsole: RunningConsole }>({
  screensConsole: [
    async ({ fixtures }, use) => {
      const started: RunningConsole[] = [];
      const c = await startScreensConsole(fixtures, {
        start: async (options) => {
          const running = await startConsole(options);
          started.push(running);
          return running;
        },
      });
      try {
        await use(c);
      } finally {
        await Promise.allSettled(started.map((s) => s.stop()));
      }
    },
    { scope: 'worker', timeout: 300_000 },
  ],
});

test.use({ prebuild: ['kanban', 'custom'] });

/** The sidebar entry `name` of the open project. */
const navLink = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Project views' }).getByRole('link', { name, exact: true });

/** Wait until the element panel (the dialog) holds the focus, itself or one of its controls. */
async function expectFocusInPanel(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelector('[role="dialog"]')?.contains(document.activeElement) === true,
  );
}

/** The Memory list row of `eid`. */
const row = (page: Page, eid: string) => page.locator(`.memory-row[data-eid="${eid}"]`);

test.describe('US-X-06 — keyboard', () => {
  test('X-06.1 — Reach every v0.1 screen with the keyboard', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    await actAs(kanban, 'Morgan');
    const c = await consoles.start({ projects: [kanban] });
    const pid = c.pids[0]!;
    const rings: (FocusRing & { theme: Theme })[] = [];
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme });
      const seen = (r: FocusRing) => rings.push({ ...r, theme });
      await openConsole(page, c, { path: `/p/${pid}/memory` });
      await expectFirstLoad(row(page, 'task-001-login-form'));
      await expectSettled(page);
      // The page has the focus, no mouse: Tab, Shift+Tab, the arrow keys and Enter only.
      // Memory list.
      await tabUntil(page, navLink(page, 'Memory'), seen);
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { level: 1, name: 'Memory' })).toBeVisible({ timeout: COLD_READ_MS });
      // An element panel, from its row; Escape gives the focus back to the row (X-06.3).
      await tabUntil(page, row(page, 'task-001-login-form'), seen);
      await page.keyboard.press('Enter');
      const panel = page.getByRole('dialog', { name: 'Login form' });
      await expectFirstLoad(panel.locator('.type-tag'));
      await expectFocusInPanel(page);
      // The dialog itself takes the focus on open (programmatic, not a control): the rings are
      // checked on the controls reached from there.
      await tabUntil(page, panel.getByRole('button').first(), seen);
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
      await expect(row(page, 'task-001-login-form')).toBeFocused({ timeout: COLD_READ_MS });
      // DNA.
      await tabUntil(page, navLink(page, 'DNA'), seen);
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(`${c.origin}/p/${pid}/dna`);
      await expect(page.getByRole('heading', { level: 1, name: 'DNA' })).toBeVisible({ timeout: COLD_READ_MS });
      await expectSettled(page);
      // Directives, and one directive.
      await tabUntil(page, navLink(page, 'Directives'), seen);
      await page.keyboard.press('Enter');
      const directive = page.locator('.directive-row a').first();
      await expectFirstLoad(directive);
      await tabUntil(page, directive, seen);
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(new RegExp(`/p/${pid}/directives/[^/]+$`));
      await expectFirstLoad(page.locator('article h1'));
      // Team.
      await tabUntil(page, navLink(page, 'Team'), seen);
      await page.keyboard.press('Enter');
      await expectFirstLoad(page.locator('.member-card').first());
      await expectSettled(page);
      // Documentation.
      await tabUntil(page, navLink(page, 'Documentation'), seen);
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(`${c.origin}/p/${pid}/docs`);
      await expect(page.getByRole('heading', { level: 1, name: 'Documentation' })).toBeVisible({
        timeout: COLD_READ_MS,
      });
      await expectSettled(page);
      // The project switcher: Enter opens it, the arrow keys move between its rows, Escape closes.
      const trigger = page.getByRole('banner').getByRole('button', { name: 'Projects: kanban' });
      await tabUntil(page, trigger, seen);
      await page.keyboard.press('Enter');
      const grid = page.getByRole('dialog', { name: 'Projects' }).getByRole('grid');
      await expect(grid.getByRole('row').first()).toBeVisible({ timeout: COLD_READ_MS });
      await tabUntil(page, grid.getByRole('row').first(), seen);
      await page.keyboard.press('ArrowDown');
      const moved = await focusRing(page);
      if (moved) seen(moved);
      await page.keyboard.press('Escape');
      await expect(grid).toBeHidden();
      await expect(trigger).toBeFocused();
    }
    // Every focused control showed its ring: solid, 2 px at least, contrast ≥ 3:1 (TT-ARC-10).
    expect(rings.length).toBeGreaterThan(20);
    const poor = rings.filter((r) => r.style !== 'solid' || r.width < 2 || r.contrast < 3);
    expect(poor.map((r) => `${r.theme} ${r.element}: ${r.style} ${r.width}px ${r.contrast.toFixed(2)}:1`)).toEqual([]);
  });

  test('X-06.3 — Close the element panel with Escape', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    await actAs(kanban, 'Morgan');
    const c = await consoles.start({ projects: [kanban] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/memory` });
    const login = row(page, 'task-001-login-form');
    await expectFirstLoad(login);
    await login.focus();
    await page.keyboard.press('Enter');
    const panel = page.getByRole('dialog', { name: 'Login form' });
    await expectFirstLoad(panel.locator('.type-tag'));
    // The panel has the focus.
    await expectFocusInPanel(page);
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/memory`);
    await expect(row(page, 'task-001-login-form')).toBeFocused({ timeout: COLD_READ_MS });
    await expectFocusVisible(row(page, 'task-001-login-form'));
  });

  // One test per screen (bug-011), on the worker's screens console.
  for (const screen of SCREENS) {
    test(`X-06.4 — Pass the axe scan: ${screen.name}`, async ({ page, screensConsole: c }) => {
      await openConsole(page, c);
      await screen.open(page, c);
      const found: (BlockingViolation & { screen: string })[] = (await scanThemes(page)).map((v) => ({
        ...v,
        screen: screen.name,
      }));
      expect(found).toEqual([]);
    });
  }
});

test.describe('US-X-08 — themes', () => {
  test("X-08.1 — Follow the system's dark preference", async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    await page.emulateMedia({ colorScheme: 'dark' });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/memory` });
    await expectFirstLoad(row(page, 'task-001-login-form'));
    await expectSettled(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    // axe's color-contrast rule: every text ≥ 4.5:1 (3:1 for large text) in the dark theme.
    expect(await scanThemes(page, { themes: ['dark'] })).toEqual([]);
  });

  test('X-08.2 — Follow a change of the system preference', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    await page.emulateMedia({ colorScheme: 'light' });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/memory` });
    await expectFirstLoad(row(page, 'task-001-login-form'));
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const light = await background();
    await page.evaluate(() => {
      (window as unknown as { samePage: boolean }).samePage = true;
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await background()).not.toBe(light);
    // Without a reload: the marker set on this page is still there.
    expect(await page.evaluate(() => (window as unknown as { samePage?: boolean }).samePage)).toBe(true);
  });
});

test.describe('US-X-09 — externalised strings', () => {
  // One test per screen (bug-011), on the worker's screens console.
  for (const screen of SCREENS) {
    test(`X-09.1 — Render every string from the message catalogue: ${screen.name}`, async ({
      page,
      screensConsole: c,
    }) => {
      const data = recordApiData(page);
      await openConsole(page, c, { build: 'keys' });
      // The screen reloads the page: only what it read itself counts as its project data — what the
      // page being left reads until the navigation counts for nothing (R4-2).
      data.reset({ untilNavigation: true });
      await screen.open(page, c);
      // Every answer the page asked for, a late one included; a text flagged with no new data is
      // reported at once, with the recorder's causes (bug-015).
      const outside = (await screenTextsOutsideCatalogue(page, data)).map((text) => `${screen.name} — ${text}`);
      expect(outside).toEqual([]);
    });
  }

  test('X-09.2 — Keep project data untranslated', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    const read = page.waitForResponse(
      (r) => new URL(r.url()).pathname === `/api/p/${c.pids[0]}/elements/task-001-login-form`,
      { timeout: COLD_READ_MS },
    );
    await openConsole(page, c, { path: `/p/${c.pids[0]}/e/task-001-login-form`, build: 'keys' });
    const detail = (await (await read).json()) as ElementDetail;
    const panel = page.getByRole('dialog');
    await expectFirstLoad(panel.locator('.type-tag'));
    await expectSettled(page);
    // The element's title, id and state names as written in the project, in a key-only page.
    await expect(panel.locator('.drawer-title')).toHaveText(detail.element.title);
    await expect(panel.getByText(detail.element.id, { exact: true }).first()).toBeVisible();
    await expect(panel.locator('.type-tag')).toHaveText(detail.element.type);
    const chips = panel.locator('.state-chip > span[aria-hidden="true"]');
    await expect(chips).toHaveText(detail.states!.sequence);
    expect(detail.element.title).toBe('Login form');
    expect(detail.states!.sequence).toEqual(expect.arrayContaining(['draft', 'pending', 'approved']));
  });
});

test.describe('US-X-10 — page title', () => {
  test('X-10.1 — Name the project and the view in the tab title', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/memory` });
    await expectFirstLoad(row(page, 'task-001-login-form'));
    await expect(page).toHaveTitle('kanban · Memory — WingFoil UI', { timeout: COLD_READ_MS });
  });

  test('X-10.2 — Name the open element in the tab title', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/memory` });
    await expectFirstLoad(row(page, 'task-001-login-form'));
    await row(page, 'task-001-login-form').click();
    await expectFirstLoad(page.getByRole('dialog', { name: 'Login form' }).locator('.type-tag'));
    await expect(page).toHaveTitle('kanban · task-001-login-form — WingFoil UI', { timeout: COLD_READ_MS });
  });

  test('X-10.3 — Title the project list when no project is open', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/memory` });
    await expectFirstLoad(row(page, 'task-001-login-form'));
    await expect(page).toHaveTitle('kanban · Memory — WingFoil UI', { timeout: COLD_READ_MS });
    // Back to the project list: the logo's link to the start page.
    await page.getByRole('banner').getByRole('link').first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible({ timeout: COLD_READ_MS });
    await expect(page).toHaveTitle('Projects — WingFoil UI', { timeout: COLD_READ_MS });
  });
});
