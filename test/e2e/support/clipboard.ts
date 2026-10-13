/**
 * The text a *Copy* button wrote, on each engine of the suite (task-027 AC-1b, D27-3) — read from
 * the browser's clipboard, not from a spy on the page's calls.
 *
 * The engines of the pinned Playwright differ (probed 2026-10-13, Playwright 1.63): Chromium
 * refuses `navigator.clipboard.writeText` and `readText` unless the context is granted
 * `clipboard-read` and `clipboard-write`; Firefox writes and reads with no grant and throws
 * "Unknown permission" on either; WebKit writes with no grant, reads only with `clipboard-read`,
 * and throws on `clipboard-write`. {@link allowClipboard} grants what each engine needs.
 *
 * ```ts
 * test.beforeEach(({ context, browserName }) => allowClipboard(context, browserName));
 * expect(await copiedBy(page, () => copy.click())).toBe('npx wingfoil-ui');
 * ```
 *
 * The contexts of one browser share its clipboard; the tests of a worker run one at a time and
 * every worker has its own browser, so parallel tests do not see each other's text.
 */
import { expect, type BrowserContext, type Page } from '@playwright/test';

/** The clipboard permissions each engine needs (and accepts). */
const GRANTS: Record<string, string[]> = {
  chromium: ['clipboard-read', 'clipboard-write'],
  firefox: [],
  webkit: ['clipboard-read'],
};

/** Grant `context` the clipboard permissions of its engine (`browserName` of the test). */
export async function allowClipboard(context: BrowserContext, browserName: string): Promise<void> {
  const grants = GRANTS[browserName];
  if (grants === undefined) throw new Error(`no clipboard grants known for the engine "${browserName}"`);
  if (grants.length > 0) await context.grantPermissions(grants);
}

/** Options of {@link copiedBy}. */
export interface CopiedByOptions {
  /** How long to wait for the clipboard to change after the action (default: Playwright's 5 s). */
  timeout?: number;
}

let sentinels = 0;

/**
 * Put a unique sentinel on the clipboard, run `action` (the click on *Copy*), and return the text
 * the clipboard holds once it is no longer the sentinel — so a value left by an earlier copy never
 * passes. Fails when the clipboard still holds the sentinel after the timeout (nothing copied).
 * The page must be on a secure origin (the console's loopback URL is one).
 */
export async function copiedBy(
  page: Page,
  action: () => Promise<void>,
  options: CopiedByOptions = {},
): Promise<string> {
  const sentinel = `wfui-clipboard-sentinel-${process.pid}-${++sentinels}-${Date.now()}`;
  await page.evaluate((text) => navigator.clipboard.writeText(text), sentinel);
  expect(await readClipboard(page)).toBe(sentinel);
  await action();
  let copied = sentinel;
  await expect
    .poll(
      async () => {
        copied = await readClipboard(page);
        return copied;
      },
      {
        message: 'the clipboard still holds the sentinel: nothing was copied',
        ...(options.timeout === undefined ? {} : { timeout: options.timeout }),
      },
    )
    .not.toBe(sentinel);
  return copied;
}

/** The clipboard's text, read in the page. */
function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}
