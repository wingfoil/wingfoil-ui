// task-067 — the Traceability page on the real bin (US-R-01 `@v0.3`; R-01.2 and the inline detail
// and refresh appended by task-081, D81-4 … D81-7; C-04.3 of US-C-04; ux-reference §4.8 v0.3; spec-012 §4; D67-1 … D67-17). Copies of the
// custom fixture with the sw-life-cycle preset (`usePresetUiConfig`) and the Given steps of
// task-059's harness (`setFrontmatterValue`, committed outside the UI); the unknown fixture; the
// kanban fixture with an ignored `ui.yaml`. Assertions are on what the user sees; the user is the
// scenario's (Casey, Alex). One console per test (bug-023).
import type { Locator, Page } from '@playwright/test';
import { setFrontmatterValue, usePrePacksStates, usePresetUiConfig, type Fixture } from '../harness/fixtures/index.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS, LIVE_REFRESH_TAG, refreshClock } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { commitFile, mutateAndWait, recordServerEvents } from './support/events.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { expectFocusVisible, tabUntil } from './support/keyboard.js';

test.use({ prebuild: ['custom', 'unknown', 'kanban'] });

const DL_001 = 'dl-001-initialise-wingfoil-before-inception';

/** A copy of the custom fixture as Casey, with the preset unless `preset` is false, then `prepare`. */
async function customCopy(
  fixtures: { copy(kind: 'custom'): Promise<Fixture> },
  prepare: (fx: Fixture) => Promise<void> = async () => undefined,
  preset = true,
): Promise<Fixture> {
  const fx = await fixtures.copy('custom');
  await actAs(fx, 'Casey');
  if (preset) await usePresetUiConfig(fx);
  await prepare(fx);
  return fx;
}

/** Open Traceability of the console's first project and wait for its first answer. */
async function openPage(page: Page, c: RunningConsole, query = ''): Promise<void> {
  await openConsole(page, c, { path: `/p/${c.pids[0]}/traceability${query}` });
  await expect(page.getByRole('heading', { level: 1, name: 'Traceability' })).toBeVisible();
  await expect(page.locator('.trace-figures, .trace-empty').first()).toBeVisible({ timeout: COLD_READ_MS });
}

function table(page: Page): Locator {
  return page.getByRole('table', { name: 'References' });
}

function row(page: Page, id: string): Locator {
  return table(page).locator(`tr[data-ref="${id}"]`);
}

function chips(r: Locator): Locator {
  return r.locator('td').nth(1).getByRole('link');
}

/** The reference ids of the rows shown, in order. */
async function rowIds(page: Page): Promise<string[]> {
  return table(page)
    .locator('tr[data-ref]')
    .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-ref') ?? ''));
}

test.describe('US-R-01 — traceability', () => {
  test('R-01.1 — List references with their completion', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await customCopy(fixtures)] });
    await openPage(page, c);
    const figures = page.getByRole('region', { name: 'Figures' });
    await expect(figures).toContainText('Project completion 25 %');
    await expect(figures).toContainText('Reference coverage 3/5');
    await expect(chips(row(page, 'US-M-01'))).toHaveCount(2);
    await expect(row(page, 'US-M-01').locator('td').nth(2)).toHaveText('50 % · 1/2');
    await expect(chips(row(page, 'US-S-01'))).toHaveCount(1);
    await expect(row(page, 'US-S-01').locator('td').nth(2)).toHaveText('0 % · 0/1');
    expect(await scanThemes(page)).toEqual([]);
  });

  test('R-01.3 — Filter references by status', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await customCopy(fixtures)] });
    await openPage(page, c);
    const before = await rowIds(page);
    await page
      .getByRole('group', { name: 'Status' })
      .getByRole('button', { name: /^Completed / })
      .click();
    await expect(page.getByText('No reference matches')).toBeVisible();
    await expect(page).toHaveURL(/status=completed/);
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect.poll(() => rowIds(page)).toEqual(before);
  });

  test('R-01.4 — Explain an empty traceability', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('unknown')] });
    await openPage(page, c);
    await expect(page.getByText('No references found — declare taxonomy patterns in ui.yaml')).toBeVisible();
  });

  test('R-01.5 — Show the rows outside the current release under the whole project', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const fx = await customCopy(fixtures, (f) => setFrontmatterValue(f, DL_001, 'ref', 'US-S-09'));
    const c = await consoles.start({ projects: [fx] });
    await openPage(page, c);
    const scope = page.getByRole('group', { name: 'Scope' });
    await expect(scope.getByRole('button', { name: 'minor-v0.1 (current release)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(row(page, 'US-M-01')).toBeVisible();
    expect(await rowIds(page)).not.toContain('US-S-09');
    await scope.getByRole('button', { name: 'Whole project' }).click();
    await expect(chips(row(page, 'US-S-09'))).toHaveText(['dl-001'], { timeout: COLD_READ_MS });
    await expect(page).toHaveURL(/scope=project/);
    // Review round 1 F-1: the whole project's completion is no link to the current scope's filter.
    const figures = page.getByRole('region', { name: 'Figures' });
    await expect(figures.locator('.progress-completion-trigger')).toBeVisible();
    await expect(figures.getByRole('link', { name: /^Project completion/ })).toHaveCount(0);
  });

  test('R-01.6 — Show a pattern reference by its id only', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await customCopy(fixtures)] });
    await openPage(page, c);
    const cell = row(page, 'US-M-01').locator('td').first();
    await expect(cell.locator('.type-tag')).toHaveText('requirement');
    await expect(cell).toHaveText(/^\s*requirement\s*US-M-01\s*$/);
    await expect(cell.getByRole('link')).toHaveCount(0);
    await expect(cell.locator('[title]')).toHaveCount(0);
    await cell.getByText('US-M-01').hover();
    await page.waitForTimeout(800);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  });

  test('R-01.7 — List references between Memory elements without ui.yaml', async ({ page, fixtures, consoles }) => {
    const fx = await customCopy(
      fixtures,
      (f) => setFrontmatterValue(f, 'task-001-cli-adapter', 'related', DL_001),
      false,
    );
    const c = await consoles.start({ projects: [fx] });
    await openPage(page, c);
    await expect(
      page.locator('p.trace-note', {
        hasText: /^No ui\.yaml — only references to other Memory elements are recognised/,
      }),
    ).toBeVisible();
    const r = row(page, DL_001);
    await expect(r.locator('td').first().locator('.type-tag')).toHaveText('decision');
    await expect(chips(r)).toHaveText(['task-001']);
  });

  test('R-01.8 — Open the elements missing required references in Memory', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await customCopy(fixtures)] });
    await openPage(page, c);
    const section = page.locator('section', {
      has: page.getByRole('heading', { name: 'Elements missing required references (2)' }),
    });
    await section.getByRole('link', { name: 'Show in Memory' }).click();
    await expect(page).toHaveURL(/\/memory\?missing=refs$/);
    const listed = page.getByRole('list', { name: 'Elements' }).getByRole('link');
    await expect
      .poll(async () => (await listed.evaluateAll((a) => a.map((x) => (x as HTMLElement).dataset['eid']))).sort(), {
        timeout: COLD_READ_MS,
      })
      .toEqual(['adr-001-local-server', 'task-004-themes']);
    await expect(page.getByRole('group', { name: 'Active filter' }).locator('.memory-active-name')).toHaveText(
      'Missing required references',
    );
  });

  test('R-01.9 — Filter references by category', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await customCopy(fixtures)] });
    await openPage(page, c);
    await page
      .getByRole('group', { name: 'Category' })
      .getByRole('button', { name: /^requirement / })
      .click();
    await expect.poll(() => rowIds(page)).toEqual(['US-M-01', 'US-S-01']);
    await expect(page).toHaveURL(/category=requirement/);
  });
});

test.describe('US-C-04 — the ui.yaml warning', () => {
  test('C-04.3 — Show the ui.yaml warning on Traceability', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    await actAs(kanban, 'Alex');
    await commitFile(kanban, '.wingfoil/ui.yaml', 'version: 1\nprogress: { mode: spiral }\n', 'chore: a ui.yaml');
    const c = await consoles.start({ projects: [kanban] });
    await openPage(page, c);
    await expect(page.locator('.ui-yaml-warning')).toHaveText(
      'ui.yaml ignored: progress.mode must be sequence or flow (found spiral)',
    );
    const note = page.locator('p.trace-note', {
      hasText: /^No ui\.yaml — only references to other Memory elements are recognised/,
    });
    await expect(note).toBeVisible();
    // A file exists, even ignored: no Use preset (Q3 (a)); the Taxonomy link.
    await expect(note.getByRole('link', { name: 'Use preset' })).toHaveCount(0);
    await note.getByRole('link', { name: 'Configuration › Taxonomy' }).click();
    await expect(page).toHaveURL(/\/configuration\/taxonomy$/);
  });
});

test.describe('task-067 acceptance criteria', () => {
  test('AC-1 — filters in the address, back restores them', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await customCopy(fixtures)] });
    await openPage(page, c, '?category=requirement&q=US-M');
    await expect.poll(() => rowIds(page)).toEqual(['US-M-01']);
    await expect(page.getByRole('searchbox', { name: 'Search references' })).toHaveValue('US-M');
    await page.getByRole('group', { name: 'Category' }).getByRole('button', { name: /^All / }).click();
    await expect(page).not.toHaveURL(/category=/);
    await page.goBack();
    await expect(page).toHaveURL(/category=requirement/);
    await expect.poll(() => rowIds(page)).toEqual(['US-M-01']);
  });

  test('AC-1 — the completion explanation on hover and on keyboard focus (as T-14.1, T-14.2)', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const explanation =
      'Mean of reference completion over 2 references with at least 1 linked element: US-M-01 50 %, US-S-01 0 %';
    const c = await consoles.start({ projects: [await customCopy(fixtures)] });
    await openPage(page, c);
    const link = page.getByRole('region', { name: 'Figures' }).getByRole('link', { name: 'Project completion 25 %' });
    // A pointer user: the pointer moves on the page first (React Aria's modality, task-065 F-1).
    await page.mouse.move(1, 1);
    await link.hover();
    await expect(page.getByRole('tooltip')).toHaveText(explanation);
    await page.mouse.move(1, 1);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await tabUntil(page, link);
    await expectFocusVisible(link);
    await expect(page.getByRole('tooltip')).toHaveText(explanation);
    await expect(link).toHaveAccessibleDescription(explanation);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  });

  test('AC-1 — chip tooltip on hover and on focus, closed with Escape', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await customCopy(fixtures)] });
    await openPage(page, c);
    const chip = chips(row(page, 'US-M-01')).first();
    await chip.hover();
    const tip = page.getByRole('tooltip');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('task-002-memory-list');
    await page.mouse.move(0, 0);
    await expect(tip).toHaveCount(0);
    await tabUntil(page, chip);
    await expectFocusVisible(chip);
    await expect(tip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tip).toHaveCount(0);
    await expect(chip).toBeFocused();
  });

  test('AC-3 — the filters by keyboard, toggle buttons with counts, the rows announced politely', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const c = await consoles.start({ projects: [await customCopy(fixtures)] });
    await openPage(page, c);
    const requirement = page.getByRole('group', { name: 'Category' }).getByRole('button', { name: /^requirement / });
    await expect(requirement).toHaveAccessibleName('requirement 2 references');
    await tabUntil(page, requirement);
    await expectFocusVisible(requirement);
    await page.keyboard.press('Enter');
    await expect(requirement).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('status', { name: 'Traceability updates' })).toHaveText('2 references');
    await expect(requirement).toBeFocused();
  });

  test('AC-1 — at 400 px only the table container scrolls sideways', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await customCopy(fixtures)] });
    await page.setViewportSize({ width: 400, height: 800 });
    await openPage(page, c);
    await expect(row(page, 'US-M-01')).toBeVisible();
    // The page's own parts; the project header's bug-044 is page-level and not this test's measure.
    const parts = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      return [
        ...document.querySelectorAll<HTMLElement>('.trace-figures, .trace-filters, .trace-table-wrap, .trace-missing'),
      ].map((el) => ({
        part: el.className,
        inner: el.classList.contains('trace-table-wrap') ? 0 : el.scrollWidth - el.clientWidth,
        past: Math.ceil(el.getBoundingClientRect().right - width),
      }));
    });
    expect(parts.length).toBe(4);
    for (const part of parts) expect(part, part.part).toMatchObject({ inner: 0 });
    for (const part of parts) expect(part.past, part.part).toBeLessThanOrEqual(0);
  });
});

/** The row toggle of the reference `id` (task-081, D81-4). */
function toggle(page: Page, id: string): Locator {
  return row(page, id).getByRole('button', { name: `Details of ${id}` });
}

/** The open detail row (one at a time, D81-5). */
function detail(page: Page): Locator {
  return table(page).locator('tr.trace-detail-row');
}

/** The texts of the detail's linked elements, in order. */
function detailItems(page: Page): Locator {
  return detail(page).getByRole('listitem');
}

test.describe('US-R-01 — traceability, the inline detail (task-081)', () => {
  test("R-01.2 — Show who must act on a reference's open elements", async ({ page, fixtures, consoles }) => {
    const fx = await customCopy(fixtures, usePrePacksStates);
    const c = await consoles.start({ projects: [fx] });
    await openPage(page, c);
    // "When I select the row": a click on the row itself (§4.8, the prototype).
    await row(page, 'US-M-01').locator('td').nth(2).click();
    await expect(toggle(page, 'US-M-01')).toHaveAttribute('aria-expanded', 'true');
    await expect(detail(page).getByRole('heading', { name: 'US-M-01' })).toBeVisible();
    await expect(detailItems(page)).toHaveText([
      'task-002 · Memory list · done',
      'task-003 · Element panel · backlog · Waiting for the workflow engine',
    ]);
    expect(await scanThemes(page)).toEqual([]);
    // Each item opens the element page in the main region (P2).
    await detailItems(page).nth(1).getByRole('link').click();
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/e/task-003-element-panel`);
  });
});

test.describe('task-081 acceptance criteria', () => {
  test('AC-2 — the row toggle by keyboard: aria-expanded, aria-controls, one detail at a time, the focus kept', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const c = await consoles.start({ projects: [await customCopy(fixtures)] });
    await openPage(page, c);
    const first = toggle(page, 'US-M-01');
    await expect(first).toHaveAttribute('aria-expanded', 'false');
    await tabUntil(page, first);
    await expectFocusVisible(first);
    await page.keyboard.press('Enter');
    await expect(first).toHaveAttribute('aria-expanded', 'true');
    const controls = await first.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    await expect(detail(page)).toHaveAttribute('id', controls!);
    await expect(first).toBeFocused();
    const second = toggle(page, 'US-S-01');
    await second.focus();
    await page.keyboard.press('Space');
    await expect(second).toHaveAttribute('aria-expanded', 'true');
    await expect(first).toHaveAttribute('aria-expanded', 'false');
    await expect(detail(page)).toHaveCount(1);
    await expect(detail(page).getByRole('heading', { name: 'US-S-01' })).toBeVisible();
    await expect(second).toBeFocused();
    await page.keyboard.press('Space');
    await expect(second).toHaveAttribute('aria-expanded', 'false');
    await expect(detail(page)).toHaveCount(0);
  });

  test(
    'AC-3 — a refresh keeps the open row and the focus and announces nothing',
    { tag: LIVE_REFRESH_TAG },
    async ({ page, fixtures, consoles }) => {
      const fx = await customCopy(fixtures);
      const c = await consoles.start({ projects: [fx] });
      await recordServerEvents(page);
      await openPage(page, c);
      const open = toggle(page, 'US-M-01');
      await open.focus();
      await page.keyboard.press('Enter');
      await expect(detailItems(page)).toHaveCount(2);
      const status = page.getByRole('status', { name: 'Traceability updates' });
      await expect(status).toHaveText('');
      await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
      // From the start of the commit made outside the UI.
      const clock = refreshClock();
      await mutateAndWait(
        page,
        () => {
          clock.start();
          return setFrontmatterValue(fx, 'task-004-themes', 'ref', 'US-M-01');
        },
        { event: 'repo', pid: c.pids[0]! },
      );
      await expect(detailItems(page)).toHaveCount(3, { timeout: clock.timeout() });
      clock.done('AC-3 (task-081) the open detail refreshed');
      await expect(detailItems(page).nth(2)).toContainText('task-004 · Themes');
      await expect(open).toHaveAttribute('aria-expanded', 'true');
      await expect(open).toBeFocused();
      // Past the 500 ms pause of the count announcement (F-7): one read, not a retried assertion.
      await page.waitForTimeout(700);
      expect((await status.textContent()) ?? '').toBe('');
      expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
    },
  );

  test('AC-2 — at 400 px an open detail scrolls only inside the table container', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const c = await consoles.start({ projects: [await customCopy(fixtures)] });
    await page.setViewportSize({ width: 400, height: 800 });
    await openPage(page, c);
    await toggle(page, 'US-M-01').click();
    await expect(detailItems(page)).toHaveCount(2);
    const parts = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      return [...document.querySelectorAll<HTMLElement>('.trace-filters, .trace-table-wrap')].map((el) => ({
        part: el.className,
        past: Math.ceil(el.getBoundingClientRect().right - width),
      }));
    });
    expect(parts.length).toBe(2);
    for (const part of parts) expect(part.past, part.part).toBeLessThanOrEqual(0);
    // The detail wraps: its cell holds its content, nothing overflows it.
    const overflow = await page.evaluate(() => {
      const cell = document.querySelector<HTMLElement>('.trace-detail-row td')!;
      return cell.scrollWidth - cell.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
