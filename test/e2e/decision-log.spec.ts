// task-078 — read and decide a decision-log (US-G-03: G-03.1 … G-03.4, US-G-08: G-08.1 … G-08.3;
// `g/decision-log.feature`; ux-reference §4.2 v0.3): the summary rendered as Markdown, *Open
// document* with the rendered body and its source, a link of a document or of a summary opening the
// element page in the main region, and the v0.2 gate footer deciding a decision-log for a product
// owner holding `approver`. Each scenario runs on a custom copy of its own with scenario-local
// commits (a body, a DNA role, an empty decision-log) made before the console starts; the user is
// Casey. No image is ever requested (AC-3).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import type { Fixture } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS, expectFirstLoad } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { documentDialog, elementView, expectNoImageRequest, openElementPage, sidePanel } from './support/element.js';
import { cli, commitFile, lastCommitSubject } from './support/events.js';
import { expect, test, type FixtureBuilds } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { expectFocusVisible } from './support/keyboard.js';

test.use({ prebuild: ['custom'] });

const DL = 'dl-002-use-fastify';
const DL_FILE = `docs/04_memory/design/dls/${DL}.md`;
const FIRST_DL = 'dl-001-initialise-wingfoil-before-inception';
const INDEX = 'docs/01_vision/00_index.md';

/** The body of the scenarios: the sections of G-03.1, a summary linking to the first decision (G-03.4). */
const BODY = [
  '',
  '## Context',
  '',
  '<!-- The situation or question that prompted this decision. -->',
  '',
  'The API needs a *fast* server; see [the first decision](dl-001-initialise-wingfoil-before-inception.md).',
  '',
  '## Options',
  '',
  '- Fastify',
  '- Express',
  '',
  '## Decision',
  '',
  'Use **Fastify**.',
  '',
  '![Architecture diagram](diagram.png) ![remote](https://example.test/diagram.png)',
  '',
].join('\n');

/** Replace the body of the element file `file` of `fx` by `body` (the frontmatter kept) and commit it. */
async function setBody(fx: Fixture, file: string, body: string): Promise<void> {
  const text = await readFile(path.join(fx.dir, file), 'utf8');
  const end = text.indexOf('\n---', 4);
  if (!text.startsWith('---') || end < 0) throw new Error(`${file} has no frontmatter`);
  await commitFile(fx, file, `${text.slice(0, end + 4)}\n${body}`, `docs: body of ${path.basename(file, '.md')}`);
}

/** A custom copy where the user is Casey, with `prepare` run before the console starts. */
async function caseyCopy(fixtures: FixtureBuilds, prepare: (fx: Fixture) => Promise<void> = async () => {}) {
  const fx = await fixtures.copy('custom');
  await actAs(fx, 'Casey');
  await prepare(fx);
  return fx;
}

/** The summary section of the element shown. */
const summary = (page: Page): Locator => elementView(page).getByRole('region', { name: 'Summary' });

/** Open the document dialog from the summary of the element shown. */
async function openDocument(page: Page): Promise<Locator> {
  const button = elementView(page).getByRole('button', { name: 'Open document' });
  await expectFirstLoad(button);
  await button.click();
  const dialog = documentDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

/** The gate footer of the element shown. */
const gate = (page: Page): Locator => elementView(page).getByRole('region', { name: 'Decision' });

/** Decide `outcome` with `reason` and wait for the commit `subject` on `fx`. */
async function decide(page: Page, fx: Fixture, outcome: string, reason: string, subject: string): Promise<void> {
  const field = gate(page).getByRole('textbox', { name: 'Reason, recorded in the commit' });
  await field.fill(reason, { timeout: COLD_READ_MS });
  await gate(page).getByRole('button', { name: outcome, exact: true }).click();
  await expect.poll(() => lastCommitSubject(fx), { timeout: COLD_READ_MS }).toBe(subject);
}

/** Give Casey the roles `roles` in the copy's DNA (the pinned CLI, committed). */
const caseyRoles = (fx: Fixture, roles: string) =>
  cli(fx, ['dna', 'update', 'team.members', '--value', 'Casey', '--entry-roles', roles]);

test.describe('US-G-03 — read a decision-log as a document', () => {
  test('G-03.1 — Read a decision-log as a rendered document', async ({ page, fixtures, consoles }) => {
    const fx = await caseyCopy(fixtures, (f) => setBody(f, DL_FILE, BODY));
    const c = await consoles.start({ projects: [fx] });
    const view = await openElementPage(page, c, DL);
    const dialog = await openDocument(page);
    await expect(dialog.getByRole('radio', { name: 'Rendered' })).toHaveAttribute('aria-checked', 'true');
    const article = dialog.getByRole('article', { name: 'Use Fastify' });
    await expect(article.getByRole('heading', { level: 2 })).toHaveText(['Context', 'Options', 'Decision']);
    // HTML comments are left out of the rendered document (the approver's Q2 (b)), kept in Source.
    await expect(article).not.toContainText('The situation or question');
    await expect(article.locator('.doc-image')).toHaveText([
      'Image not shown: Architecture diagram',
      'Image not shown: remote',
    ]);
    await dialog.getByRole('radio', { name: 'Source' }).click();
    const source = dialog.getByRole('region', { name: 'Source' });
    await expect(source).toContainText('<!-- The situation or question that prompted this decision. -->');
    await expect(source).toContainText('## Options');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(view.getByRole('button', { name: 'Open document' })).toBeFocused();
    // The history lists the submit by Casey with its commit.
    const submit = view.locator('.history-entry').filter({ hasText: 'submitted by Casey' });
    await expect(submit).toHaveCount(1, { timeout: COLD_READ_MS });
    await expect(submit.locator('.history-sha')).toHaveText(/^[0-9a-f]{7}$/);
  });

  test('G-03.2 — Open the decision-log from Documentation links', async ({ page, fixtures, consoles }) => {
    const fx = await caseyCopy(fixtures, async (f) => {
      await setBody(f, DL_FILE, BODY);
      const index = await readFile(path.join(f.dir, INDEX), 'utf8');
      await commitFile(
        f,
        INDEX,
        `${index}\n- [Use Fastify](../04_memory/design/dls/${DL}.md)\n`,
        'docs: link to dl-002',
      );
    });
    const c = await consoles.start({ projects: [fx] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/docs/${INDEX}` });
    const link = page.getByRole('article', { name: INDEX }).getByRole('link', { name: 'Use Fastify', exact: true });
    await expectFirstLoad(link);
    await expect(link).toHaveAttribute('href', `/p/${c.pids[0]}/e/${DL}`, { timeout: COLD_READ_MS });
    await link.click();
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/e/${DL}`);
    // The element page in the main region, not the side panel.
    await expect(page.getByRole('main').locator('[data-element-view]')).toBeVisible({ timeout: COLD_READ_MS });
    await expect(sidePanel(page)).toHaveCount(0);
    await expect(summary(page).locator('.element-summary em')).toHaveText('fast', { timeout: COLD_READ_MS });
  });

  test('G-03.3 — Read a decision-log with an empty body', async ({ page, fixtures, consoles }) => {
    const fx = await caseyCopy(fixtures, async (f) => {
      await cli(f, ['memory', 'add', '--type', 'decision-log', '--title', 'Empty']);
      await setBody(f, 'docs/04_memory/design/dls/dl-003-empty.md', '');
    });
    const c = await consoles.start({ projects: [fx] });
    const view = await openElementPage(page, c, 'dl-003-empty');
    await expect(view.locator('.state-chip[aria-current="step"] [aria-hidden="true"]')).toHaveText('draft');
    await expect(summary(page)).toContainText('No summary in the document.');
    const dialog = await openDocument(page);
    await expect(dialog).toContainText('No content yet');
    await dialog.getByRole('radio', { name: 'Source' }).click();
    await expect(dialog).toContainText('No content yet');
  });

  test('G-03.4 — Open a linked element from a summary in the main region', async ({ page, fixtures, consoles }) => {
    const fx = await caseyCopy(fixtures, (f) => setBody(f, DL_FILE, BODY));
    const c = await consoles.start({ projects: [fx] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}` });
    const row = page.getByRole('region', { name: 'Waiting on others' }).locator(`li[data-eid="${DL}"]`);
    await expectFirstLoad(row);
    await row.locator('.today-title').click();
    const panel = sidePanel(page);
    await expect(panel).toBeVisible({ timeout: COLD_READ_MS });
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/today?panel=${DL}`);
    const link = panel.locator('.element-summary').getByRole('link', { name: 'the first decision', exact: true });
    await expect(link).toHaveAttribute('href', `/p/${c.pids[0]}/e/${FIRST_DL}`, { timeout: COLD_READ_MS });
    await link.click();
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/e/${FIRST_DL}`);
    await expect(sidePanel(page)).toHaveCount(0);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(
      'Initialise WingFoil before inception',
      { timeout: COLD_READ_MS },
    );
  });

  test('AC-3 — No image is requested when the document opens', async ({ page, fixtures, consoles }) => {
    const fx = await caseyCopy(fixtures, (f) => setBody(f, DL_FILE, BODY));
    const c = await consoles.start({ projects: [fx] });
    await openElementPage(page, c, DL);
    await expectNoImageRequest(page, async () => {
      const dialog = await openDocument(page);
      await expect(dialog.locator('.doc-image')).toHaveCount(2);
      await dialog.getByRole('radio', { name: 'Source' }).click();
      await dialog.getByRole('radio', { name: 'Rendered' }).click();
      await expect(dialog.locator('img')).toHaveCount(0);
    });
  });

  test('AC-4 — The document dialog is keyboard operable and accessible', async ({ page, fixtures, consoles }) => {
    const fx = await caseyCopy(fixtures, (f) => setBody(f, DL_FILE, BODY));
    const c = await consoles.start({ projects: [fx] });
    const view = await openElementPage(page, c, DL);
    const button = view.getByRole('button', { name: 'Open document' });
    await expectFirstLoad(button);
    await button.focus();
    await expectFocusVisible(button);
    await page.keyboard.press('Enter');
    const dialog = documentDialog(page);
    await expect(dialog).toBeVisible();
    // Tab stays inside the modal: Close, the switch, the article.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    const sourceRadio = dialog.getByRole('radio', { name: 'Source' });
    await sourceRadio.focus();
    await expectFocusVisible(sourceRadio);
    await page.keyboard.press('Space');
    const source = dialog.getByRole('region', { name: 'Source' });
    await source.focus();
    await expectFocusVisible(source);
    expect(await scanThemes(page)).toEqual([]);
    const close = dialog.getByRole('button', { name: 'Close' });
    await close.focus();
    await expectFocusVisible(close);
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(button).toBeFocused();
  });
});

test.describe('US-G-08 — decide a decision-log holding approver', () => {
  test('G-08.1 — Approve a decision-log as a product owner holding approver', async ({ page, fixtures, consoles }) => {
    const fx = await caseyCopy(fixtures, async (f) => void (await caseyRoles(f, 'product-owner, approver')));
    const c = await consoles.start({ projects: [fx] });
    await openElementPage(page, c, DL);
    await decide(
      page,
      fx,
      'Approve → ready',
      'Agreed in the planning meeting',
      `wf(decision-log): approve ${DL} [in-discussion → ready]`,
    );
    const { stdout } = await git(fx.dir, ['log', '-1', '--format=%ae%n%b'], fx.env);
    expect(stdout).toContain('casey@example.test');
    expect(stdout).toContain('Agreed in the planning meeting');
  });

  test('G-08.2 — Send a decision-log back to draft', async ({ page, fixtures, consoles }) => {
    const fx = await caseyCopy(fixtures, async (f) => void (await caseyRoles(f, 'product-owner, approver')));
    const c = await consoles.start({ projects: [fx] });
    await openElementPage(page, c, DL);
    await decide(
      page,
      fx,
      'Reject → draft',
      'Needs a cost estimate',
      `wf(decision-log): reject ${DL} [in-discussion → draft]`,
    );
    await page.goto(`${c.origin}/p/${c.pids[0]}/today`);
    const row = page.getByRole('region', { name: 'Requires you' }).locator(`li[data-eid="${DL}"]`);
    await expect(row).toContainText('Rejected by Casey: Needs a cost estimate', { timeout: COLD_READ_MS });
  });

  test('G-08.3 — Keep the decision informational for a product owner without approver', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const fx = await caseyCopy(fixtures);
    const c: RunningConsole = await consoles.start({ projects: [fx] });
    const view = await openElementPage(page, c, DL);
    await expect(view.locator('.element-footer')).toContainText('Reserved to approver — Morgan, Alex can act', {
      timeout: COLD_READ_MS,
    });
    await expect(gate(page)).toHaveCount(0);
  });
});
