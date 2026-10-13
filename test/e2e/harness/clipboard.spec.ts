// Self-test of the cross-engine clipboard helper (task-027 AC-1b, D27-3), on each engine of the
// suite: a static page served on a loopback origin (a secure context, as the console's) with Copy
// buttons; task-035 (C-08.2) uses the helper on the console's *How to join* panel.
import { expect, test, type Page } from '@playwright/test';
import { allowClipboard, copiedBy } from '../support/clipboard.js';

const ORIGIN = 'http://localhost:4173';

const PAGE = `<!doctype html><html lang="en"><head><title>Clipboard</title></head><body><main>
<button type="button" id="api" onclick="navigator.clipboard.writeText('npx wingfoil-ui --port 4000')">Copy</button>
<button type="button" id="legacy" onclick="
  const t = document.createElement('textarea'); t.value = 'git config user.email casey@example.com';
  document.body.append(t); t.select(); document.execCommand('copy'); t.remove();">Copy (legacy)</button>
<button type="button" id="none">Does not copy</button>
</main></body></html>`;

async function open(page: Page): Promise<void> {
  await page.route(`${ORIGIN}/**`, (route) => route.fulfill({ contentType: 'text/html', body: PAGE }));
  await page.goto(`${ORIGIN}/`);
}

test.beforeEach(async ({ context, browserName }) => {
  await allowClipboard(context, browserName);
});

test('returns the text a Copy button wrote with the Clipboard API', async ({ page }) => {
  await open(page);
  expect(await copiedBy(page, () => page.getByRole('button', { name: 'Copy', exact: true }).click())).toBe(
    'npx wingfoil-ui --port 4000',
  );
});

test('returns the text a Copy button wrote with the copy command', async ({ page }) => {
  await open(page);
  expect(await copiedBy(page, () => page.getByRole('button', { name: 'Copy (legacy)' }).click())).toBe(
    'git config user.email casey@example.com',
  );
});

test('returns the same text copied twice (no stale clipboard can pass)', async ({ page }) => {
  await open(page);
  const copy = () => page.getByRole('button', { name: 'Copy', exact: true }).click();
  expect(await copiedBy(page, copy)).toBe('npx wingfoil-ui --port 4000');
  expect(await copiedBy(page, copy)).toBe('npx wingfoil-ui --port 4000');
});

test('fails when the action copies nothing', async ({ page }) => {
  await open(page);
  // First something on the clipboard, so that a helper reading a stale value would pass.
  await copiedBy(page, () => page.getByRole('button', { name: 'Copy', exact: true }).click());
  await expect(
    copiedBy(page, () => page.getByRole('button', { name: 'Does not copy' }).click(), { timeout: 1_000 }),
  ).rejects.toThrow(/nothing was copied/);
});
