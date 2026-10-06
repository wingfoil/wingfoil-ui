// task-013 — the web shell on the real bin (US-S-01: S-01.1, S-01.3; S-01.2 has no screen and stays
// the launcher test `test/launcher/launcher.test.ts`). Also the shell mechanisms later tasks build
// on: session bootstrap, shell warnings, theme, key-rendering build, Add project dialog frame.
// `npx wingfoil-ui` runs the package bin with node: the tests run that same bin (as task-002's).
import type { Page } from '@playwright/test';
import { keyCatalogue } from '../../web/scripts/catalogue.mjs';
import en from '../../web/src/i18n/en.json' with { type: 'json' };
import { scanThemes } from './support/axe.js';
import { openConsole } from './support/console.js';
import { expect, test } from './support/fixtures.js';
import { expectFocusVisible } from './support/keyboard.js';

/** Heading of the lost-session page (W3-7). */
const LOST = 'This page is no longer recognised by the console';

/** Press Tab until `name`d button has the focus (at most `max` presses). */
async function tabTo(page: Page, role: 'button' | 'link', name: string, max = 10): Promise<void> {
  const target = page.getByRole(role, { name, exact: true });
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
  }
  throw new Error(`${name} not reached with Tab`);
}

test.describe('US-S-01 — start the console', () => {
  test('S-01.1 — Start the console with npx', async ({ page, consoles }) => {
    const c = await consoles.start({ opener: 'recording' });
    expect(c.launcher.runningLine).toMatch(/^WingFoil UI is running at http:\/\/127\.0\.0\.1:\d+\/#token=[\w-]{43}$/);
    await expect.poll(() => c.opened(), { timeout: 10_000 }).toEqual([c.url]);
    // The default browser opens the URL it was given.
    await page.goto((await c.opened())![0]!);
    const switcher = page.getByRole('button', { name: 'Projects', exact: true });
    await expect(switcher).toBeVisible();
    await expect(page).toHaveURL(`${c.origin}/`);
    await tabTo(page, 'button', 'Projects');
    await expectFocusVisible(switcher);
    await page.keyboard.press('Enter');
    const add = page.getByRole('menuitem', { name: 'Add project…' });
    await expect(add).toBeVisible();
    await expect(add).toBeFocused();
    expect(await scanThemes(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(add).toBeHidden();
    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
    await expect(page).toHaveTitle('Projects — WingFoil UI');
    expect(await scanThemes(page)).toEqual([]);
  });

  test('S-01.3 — Start without opening a browser when none is available', async ({ page, consoles }) => {
    const c = await consoles.start({ opener: 'none' });
    await expect
      .poll(() => c.launcher.stdoutLines(), { timeout: 10_000 })
      .toContain(`Open this URL in your browser: ${c.url}`);
    // The server keeps running: the URL printed opens the console.
    await page.goto(c.url);
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Add project…' })).toBeVisible();
  });
});

test.describe('shell mechanisms', () => {
  test('session: the fragment token opens the session, a reload keeps it, a wrong token loses it', async ({
    page,
    browser,
    consoles,
  }) => {
    const c = await consoles.start();
    await openConsole(page, c);
    await expect(page).toHaveURL(`${c.origin}/`);
    expect(await page.evaluate(async () => (await fetch('/api/projects')).status)).toBe(200);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
    expect(await page.evaluate(async () => (await fetch('/api/server')).status)).toBe(200);

    const context = await browser.newContext();
    try {
      const other = await context.newPage();
      await other.goto(`${c.origin}/#token=${'x'.repeat(43)}`);
      await expect(other.getByRole('heading', { level: 1, name: LOST })).toBeVisible();
      await expect(other).toHaveTitle('Session ended — WingFoil UI');
      expect(await scanThemes(other)).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('a session the console no longer knows (e.g. after a restart) shows the lost-session page', async ({
    page,
    consoles,
  }) => {
    const c = await consoles.start();
    await openConsole(page, c);
    await page.context().clearCookies();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: LOST })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Projects', exact: true })).toHaveCount(0);
  });

  test('shell warning of a corrupt state file, dismissed', async ({ page, consoles }) => {
    const c = await consoles.start({ stateFile: '{ not json' });
    await openConsole(page, c);
    const region = page.getByRole('region', { name: 'Console warnings' });
    await expect(
      region.getByText(/The project list could not be read: it was kept as \S*state\.json\.corrupt-\d{8}T\d{6}Z and/),
    ).toBeVisible();
    expect(await scanThemes(page)).toEqual([]);
    await region.getByRole('button', { name: 'Dismiss this warning' }).click();
    await expect(region).toBeHidden();
  });

  test('the theme follows prefers-color-scheme and its change without a reload (spec-009 §1)', async ({
    page,
    consoles,
  }) => {
    const c = await consoles.start();
    await page.emulateMedia({ colorScheme: 'dark' });
    await openConsole(page, c);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');
    const bg = (): Promise<string> => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await bg()).toBe('rgb(17, 28, 48)');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(html).toHaveAttribute('data-theme', 'light');
    expect(await bg()).toBe('rgb(245, 247, 250)');
  });

  test('the Add project dialog frame: keyboard, focus trapped and given back, axe', async ({ page, consoles }) => {
    const c = await consoles.start();
    await openConsole(page, c);
    await tabTo(page, 'button', 'Add project…');
    const add = page.getByRole('button', { name: 'Add project…' });
    await expectFocusVisible(add);
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Add project' });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    expect(await scanThemes(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(add).toBeFocused();
  });

  test('the key-rendering build shows catalogue keys only (spec-008 §6; X-09.1 closes in task-021)', async ({
    page,
    consoles,
  }) => {
    const c = await consoles.start();
    await openConsole(page, c, { build: 'keys' });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('projects.start.title');
    const texts = await page.evaluate(() => {
      const out: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = n.textContent?.trim();
        if (t && n.parentElement?.closest('[aria-hidden="true"]') === null) out.push(t);
      }
      return out;
    });
    // Each text must be one key-catalogue text exactly, its argument placeholders filled by data.
    const patterns = Object.values(keyCatalogue(en)).map(
      (text) =>
        new RegExp(
          `^${text
            .split(/\{[^}]+\}/)
            .map((part) => part.replace(/[.*+?^$()|[\]\\]/g, '\\$&'))
            .join('.+')}$`,
        ),
    );
    expect(texts.filter((t) => !patterns.some((p) => p.test(t)))).toEqual([]);
    await expect(page).toHaveTitle('title.projects');
  });

  test('a React Aria link navigates inside the application, without a reload (review F1)', async ({
    page,
    consoles,
  }) => {
    const c = await consoles.start();
    await openConsole(page, c, { path: '/no/such/page' });
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    await page.evaluate(() => {
      (window as unknown as { sameDocument: boolean }).sameDocument = true;
    });
    await page.getByRole('link', { name: 'Back to the projects' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { sameDocument?: boolean }).sameDocument)).toBe(true);
  });

  test('a stopped console: the unreachable banner after the threshold, axe in both themes (W3-12)', async ({
    page,
    consoles,
  }) => {
    const c = await consoles.start();
    // The page's timers run on Playwright's clock: the 10 s threshold is crossed without waiting.
    await page.clock.install();
    await openConsole(page, c);
    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
    const banner = page.getByRole('region', { name: 'Connection to the console' });
    await expect(banner).toHaveCount(0);
    await c.launcher.kill();
    await expect
      .poll(
        async () => {
          await page.clock.runFor(1_000);
          return banner.count();
        },
        { timeout: 30_000 },
      )
      .toBe(1);
    await expect(banner.getByRole('alert')).toContainText('Cannot reach the console.');
    // The rest of the page stays usable.
    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
    expect(await scanThemes(page)).toEqual([]);
  });
});
