// Self-test of the X-06.4 helper on static pages: the screens it scans arrive with task-013/021.
import { expect, test } from '@playwright/test';
import { scanThemes } from '../support/axe.js';

const THEMED = `<!doctype html><html lang="en"><head><title>Fixture</title>
<style>
  :root { color-scheme: light; --bg: #ffffff; --fg: #1a1f2b; }
  @media (prefers-color-scheme: dark) { :root { color-scheme: dark; --bg: #11151c; --fg: #e8ecf3; } }
  body { background: var(--bg); color: var(--fg); }
</style></head>
<body><main><h1>Fixture</h1><p>Readable in both themes.</p><button type="button">Add project…</button></main></body></html>`;

/** Light-on-light text in the dark theme only: a serious color-contrast violation. */
const DARK_ONLY_CONTRAST = THEMED.replace('--fg: #e8ecf3', '--fg: #1a1f2b');

/** A button with no accessible name: a critical violation in every theme. */
const NAMELESS_BUTTON = THEMED.replace(
  '<button type="button">Add project…</button>',
  '<button type="button"></button>',
);

test('reports nothing for an accessible page in both themes', async ({ page }) => {
  await page.setContent(THEMED);
  expect(await scanThemes(page)).toEqual([]);
});

test('reports a critical violation in each theme', async ({ page }) => {
  await page.setContent(NAMELESS_BUTTON);
  const found = await scanThemes(page);
  expect(found.map((v) => `${v.theme}:${v.id}:${v.impact}`)).toEqual([
    'light:button-name:critical',
    'dark:button-name:critical',
  ]);
});

test('scans the dark theme with the dark colours', async ({ page }) => {
  await page.setContent(DARK_ONLY_CONTRAST);
  const found = await scanThemes(page);
  expect(found.map((v) => `${v.theme}:${v.id}`)).toEqual(['dark:color-contrast']);
});
