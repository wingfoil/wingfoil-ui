// task-020 — the Documentation view on the real bin (US-R-08: R-08.1…R-08.3, US-R-09: R-09.1…R-09.4),
// on the custom fixture (its `docs/01_vision/` documents and Memory under `docs/04_memory/`). The
// R-09 scenarios use a copy with a committed document holding the links of the scenarios. The
// identity "I am Riley" changes nothing a read-only page shows: the fixture's identity is used.
import type { Page } from '@playwright/test';
import { scanThemes } from './support/axe.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { commitFile } from './support/events.js';
import { expect, test, type Consoles, type FixtureBuilds } from './support/fixtures.js';
import { expectFocusVisible } from './support/keyboard.js';

const LINKS_DOC = 'docs/01_vision/links.md';
const LINKS = [
  '# Links of the scenarios',
  '',
  '- [Decision](../04_memory/design/dls/dl-001-initialise-wingfoil-before-inception.md)',
  '- [Missing](missing-file.md)',
  '- [Hosts](../../../etc/hosts)',
  '- [Guide](https://example.test/guide)',
  '',
].join('\n');

/** The in-UI path of the document `path` of the console's first project. */
const docPath = (c: RunningConsole, path: string) => `/p/${c.pids[0]}/docs/${path}`;

/** The rendered document of `path`. */
const article = (page: Page, path: string) => page.getByRole('article', { name: path });

/** A console on a custom copy with the document of the R-09 links committed. */
async function withLinks(fixtures: FixtureBuilds, consoles: Consoles): Promise<RunningConsole> {
  const custom = await fixtures.copy('custom');
  await commitFile(custom, LINKS_DOC, LINKS, 'docs: links of the scenarios');
  return consoles.start({ projects: [custom] });
}

test.describe('US-R-08 — documentation index and documents', () => {
  test('R-08.1 — Index the documents without Memory and plan files', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('custom')] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}` });
    // "When I open Documentation": the sidebar entry, by keyboard.
    const entry = page.getByRole('navigation', { name: 'Project views' }).getByRole('link', { name: 'Documentation' });
    await entry.focus();
    await expectFocusVisible(entry);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/docs`);
    await expect(page.getByRole('heading', { level: 1, name: 'Documentation' })).toBeVisible();
    await expect(page).toHaveTitle('custom · Documentation — WingFoil UI');
    const index = page.locator('.docs-index');
    await expect(
      index.getByRole('link', { name: '02_product-vision.md docs/01_vision/02_product-vision.md' }),
    ).toBeVisible();
    const listed = await index.locator('.docs-path').allTextContents();
    expect(listed).toContain('docs/01_vision/02_product-vision.md');
    expect(listed.filter((p) => p.startsWith('docs/04_memory/') || p.startsWith('docs/05_plans/'))).toEqual([]);
    expect(await scanThemes(page)).toEqual([]);
  });

  test('R-08.2 — Render a document inside the UI', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('custom')] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/docs` });
    await page
      .locator('.docs-index')
      .getByRole('link', { name: /^06_features\.md / })
      .click();
    const doc = article(page, 'docs/01_vision/06_features.md');
    await expect(doc).toBeVisible();
    // Headings, lists and tables rendered (not the Markdown source).
    await expect(doc.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(doc.getByRole('heading', { level: 2 }).first()).toBeVisible();
    await expect(doc.getByRole('region', { name: 'Table 1' }).getByRole('table')).toBeVisible();
    await expect(doc).not.toContainText('|---');
    expect(new URL(page.url()).origin).toBe(c.origin);
    await expect(page).toHaveURL(`${c.origin}${docPath(c, 'docs/01_vision/06_features.md')}`);
    // A wide table scrolls inside its focusable region (keyboard).
    const table = doc.getByRole('region', { name: 'Table 1' });
    await table.focus();
    await expectFocusVisible(table);
    expect(await scanThemes(page)).toEqual([]);
    // 06_features.md holds no list: the lists are proved on 02_product-vision.md (open point).
    await page.getByRole('link', { name: '← Index' }).click();
    await page
      .locator('.docs-index')
      .getByRole('link', { name: /^02_product-vision\.md / })
      .click();
    const vision = article(page, 'docs/01_vision/02_product-vision.md');
    await expect(vision.locator('ul > li, ol > li').first()).toBeVisible();
  });

  test('R-08.3 — Follow a link between indexed documents inside the UI', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('custom')] });
    await openConsole(page, c, { path: docPath(c, 'docs/01_vision/00_index.md') });
    const link = article(page, 'docs/01_vision/00_index.md').getByRole('link', { name: 'Product Vision' });
    await expect(link).toHaveAttribute('href', docPath(c, 'docs/01_vision/02_product-vision.md'));
    // A client-side navigation: a marker on `window` survives (no reload), the origin stays.
    await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
    await link.focus();
    await expectFocusVisible(link);
    await page.keyboard.press('Enter');
    await expect(article(page, 'docs/01_vision/02_product-vision.md')).toBeVisible();
    await expect(page).toHaveURL(`${c.origin}${docPath(c, 'docs/01_vision/02_product-vision.md')}`);
    expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
    await expect(page).toHaveTitle('custom · docs/01_vision/02_product-vision.md — WingFoil UI');
    // "← Index" goes back to the index.
    await page.getByRole('link', { name: '← Index' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Documentation' })).toBeVisible();
  });
});

test.describe('US-R-09 — safe links', () => {
  test('R-09.1 — Open a linked Memory file in the element panel', async ({ page, fixtures, consoles }) => {
    const c = await withLinks(fixtures, consoles);
    await openConsole(page, c, { path: docPath(c, LINKS_DOC) });
    const link = article(page, LINKS_DOC).getByRole('link', { name: 'Decision' });
    await expect(link).toHaveAttribute('href', `/p/${c.pids[0]}/e/dl-001-initialise-wingfoil-before-inception`);
    await link.click();
    const panel = page.getByRole('dialog');
    await expect(panel).toBeVisible();
    await expect(panel.getByText('dl-001-initialise-wingfoil-before-inception', { exact: true })).toBeVisible();
    await expect(panel).toHaveAccessibleName('Initialise WingFoil before inception');
    // Close goes back to the document.
    await page.keyboard.press('Escape');
    await expect(article(page, LINKS_DOC)).toBeVisible();
  });

  test('R-09.2 — Mark a link that points nowhere', async ({ page, fixtures, consoles }) => {
    const c = await withLinks(fixtures, consoles);
    await openConsole(page, c, { path: docPath(c, LINKS_DOC) });
    const doc = article(page, LINKS_DOC);
    const item = doc.getByRole('listitem').filter({ hasText: 'Missing' });
    await expect(item.locator('.doc-link-mark')).toHaveText('broken link');
    await expect(item.getByRole('link')).toHaveCount(0);
    await item.getByText('Missing', { exact: true }).click();
    await expect(page).toHaveURL(`${c.origin}${docPath(c, LINKS_DOC)}`);
    expect(await scanThemes(page)).toEqual([]);
  });

  test('R-09.3 — Mark a link that leaves the repository', async ({ page, fixtures, consoles }) => {
    const c = await withLinks(fixtures, consoles);
    const asked: string[] = [];
    page.on('request', (r) => asked.push(r.url()));
    await openConsole(page, c, { path: docPath(c, LINKS_DOC) });
    const item = article(page, LINKS_DOC).getByRole('listitem').filter({ hasText: 'Hosts' });
    await expect(item.locator('.doc-link-mark')).toHaveText('outside the repository');
    await expect(item.getByRole('link')).toHaveCount(0);
    const pages = page.context().pages().length;
    await item.getByText('Hosts', { exact: true }).click();
    await expect(page).toHaveURL(`${c.origin}${docPath(c, LINKS_DOC)}`);
    expect(page.context().pages()).toHaveLength(pages);
    // Never asked to the server: the escape is decided in the page.
    expect(asked.filter((u) => decodeURIComponent(u).includes('etc/hosts'))).toEqual([]);
  });

  test('R-09.4 — Open an external link in a new tab', async ({ page, fixtures, consoles, context }) => {
    const c = await withLinks(fixtures, consoles);
    await context.route('https://example.test/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Guide</title>' }),
    );
    await openConsole(page, c, { path: docPath(c, LINKS_DOC) });
    const link = article(page, LINKS_DOC).getByRole('link', { name: 'Guide (opens in a new tab)' });
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const [tab] = await Promise.all([context.waitForEvent('page'), link.click()]);
    await tab.waitForLoadState();
    expect(tab.url()).toBe('https://example.test/guide');
    expect(await tab.evaluate(() => window.opener)).toBeNull();
    // The console's page stays where it was.
    await expect(page).toHaveURL(`${c.origin}${docPath(c, LINKS_DOC)}`);
    await tab.close();
  });
});
