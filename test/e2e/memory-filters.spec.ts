// task-066 — the Memory list's v0.3 filters on the real bin (US-M-02 `@v0.3` M-02.4, US-M-03,
// US-M-04; ux-reference §4.4 v0.3; spec-012 §5; D66-3 … D66-7): the states of a bucket on the
// unknown fixture, the filter "Missing required references" and the badge "missing refs" on copies
// of the custom fixture with the sw-life-cycle preset (`usePresetUiConfig`) and the Given steps of
// task-059's harness (`setFrontmatterValue`, committed outside the UI). Assertions are on what the
// user sees. The figure filter's e2e from Today is task-065's (T-13.1 … T-13.4); M-01.2 and M-02.2
// stay in `memory-list.spec.ts`, unchanged.
import type { Locator, Page } from '@playwright/test';
import { setFrontmatterValue, usePresetUiConfig, type Fixture } from '../harness/fixtures/index.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS, LIVE_REFRESH_TAG, refreshClock } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { mutateAndWait, recordServerEvents } from './support/events.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { expectFocusVisible } from './support/keyboard.js';

test.use({ prebuild: ['custom', 'unknown'] });

const MISSING = 'Missing required references';

/** Open the Memory list of the console's first project (optionally with a query string). */
async function openList(page: Page, c: RunningConsole, query = ''): Promise<void> {
  await openConsole(page, c, { path: `/p/${c.pids[0]}/memory${query}` });
  await expect(page.getByRole('heading', { level: 1, name: 'Memory' })).toBeVisible();
  await expect(rows(page).first()).toBeVisible({ timeout: COLD_READ_MS });
}

/** Wait until the list's state filters are there: `/elements` and `/config` answered. */
async function settledFilters(page: Page): Promise<void> {
  await expect(page.getByRole('list', { name: 'States' }).getByRole('link').first()).toBeVisible({
    timeout: COLD_READ_MS,
  });
  await expect(page.locator('.page-intro')).toBeVisible({ timeout: COLD_READ_MS });
}

function rows(page: Page): Locator {
  return page.getByRole('list', { name: 'Elements' }).getByRole('link');
}

function row(page: Page, eid: string): Locator {
  return page.locator(`.memory-row[data-eid="${eid}"]`);
}

function missingFilter(page: Page): Locator {
  return page.getByRole('list', { name: 'Reference filters' }).getByRole('link');
}

/** The listed element ids, sorted. */
async function listed(page: Page): Promise<string[]> {
  return (await rows(page).evaluateAll((links) => links.map((a) => (a as HTMLElement).dataset['eid'] ?? ''))).sort();
}

/** A copy of the custom fixture with the preset, `prepare`'s steps, as Morgan. */
async function presetCopy(
  fixtures: { copy(kind: 'custom'): Promise<Fixture> },
  prepare: (fx: Fixture) => Promise<void> = async () => undefined,
): Promise<Fixture> {
  const fx = await fixtures.copy('custom');
  await actAs(fx, 'Morgan');
  await usePresetUiConfig(fx);
  await prepare(fx);
  return fx;
}

test.describe('US-M-02 — a bucket narrowed to one of its states (v0.3)', () => {
  test('M-02.4 — Narrow a bucket to one of its states', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('unknown')] });
    await openList(page, c);
    await page
      .getByRole('list', { name: 'Element types' })
      .getByRole('link', { name: /^All types,/ })
      .click();
    await page
      .getByRole('list', { name: 'States' })
      .getByRole('link', { name: /^Waiting\/drafts\/closed,/ })
      .click();
    const sub = page.getByRole('list', { name: 'In Waiting/drafts/closed' });
    // The state reached and followed from the keyboard, with visible focus.
    const state = sub.getByRole('link', { name: /^open,/ });
    await state.focus();
    await expectFocusVisible(state);
    await page.keyboard.press('Enter');
    await expect(state).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => listed(page)).toEqual(['note-001-kickoff']);
    const active = page.getByRole('group', { name: 'Active filter' });
    await expect(active.locator('.memory-active-name')).toHaveText('Waiting/drafts/closed · open');
    await expect(page).toHaveURL(/\?bucket=waiting&state=open$/);
    expect(await scanThemes(page)).toEqual([]);
    // A reload restores the bucket and its state.
    await page.reload();
    await expect.poll(() => listed(page), { timeout: COLD_READ_MS }).toEqual(['note-001-kickoff']);
    await expect(active.locator('.memory-active-name')).toHaveText('Waiting/drafts/closed · open');
    // Clear filter: every element, the focus on the heading.
    await active.getByRole('link', { name: 'Clear filter' }).click();
    await expect
      .poll(() => listed(page))
      .toEqual(['note-001-kickoff', 'note-002-retro', 'story-001-onboarding', 'story-002-billing']);
    await expect(active).toBeHidden();
    await expect(page.getByRole('heading', { level: 1, name: 'Memory' })).toBeFocused();
  });
});

test.describe('US-M-03 — elements missing a required reference', () => {
  test('M-03.1 — Filter the elements missing a required reference', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await presetCopy(fixtures)] });
    await openList(page, c);
    const filter = missingFilter(page);
    await expect(filter).toHaveAccessibleName(`${MISSING}, 2 elements`, { timeout: COLD_READ_MS });
    await filter.focus();
    await expectFocusVisible(filter);
    await page.keyboard.press('Enter');
    await expect(filter).toHaveAttribute('aria-current', 'page');
    await expect(page).toHaveURL(/\?missing=refs$/);
    await expect.poll(() => listed(page)).toEqual(['adr-001-local-server', 'task-004-themes']);
    for (const eid of ['task-004-themes', 'adr-001-local-server']) {
      await expect(row(page, eid).locator('.memory-badge-missing')).toHaveText('missing refs');
      await expect(row(page, eid)).toHaveAccessibleDescription('Missing required references: requirement');
    }
    await expect(page.getByRole('group', { name: 'Active filter' }).locator('.memory-active-name')).toHaveText(MISSING);
    expect(await scanThemes(page)).toEqual([]);
  });

  test(
    'M-03.2 — Drop the badge when the reference is added',
    { tag: LIVE_REFRESH_TAG },
    async ({ page, fixtures, consoles }) => {
      const fx = await presetCopy(fixtures);
      const c = await consoles.start({ projects: [fx] });
      await recordServerEvents(page);
      await openList(page, c);
      const badge = row(page, 'task-004-themes').locator('.memory-badge-missing');
      await expect(badge).toHaveText('missing refs', { timeout: COLD_READ_MS });
      await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
      // From the start of the commit made outside the UI.
      const clock = refreshClock();
      await mutateAndWait(
        page,
        () => {
          clock.start();
          return setFrontmatterValue(fx, 'task-004-themes', 'ref', 'US-X-08');
        },
        { event: 'repo', pid: c.pids[0]! },
      );
      await expect(badge).toHaveCount(0, { timeout: clock.timeout() });
      clock.done('M-03.2 badge dropped');
      await expect(row(page, 'adr-001-local-server').locator('.memory-badge-missing')).toHaveText('missing refs');
      expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
    },
  );
});

test.describe('US-M-04 — the filter hidden when nothing is required', () => {
  test('M-04.1 — Hide the filter when no type requires references', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('unknown')] });
    await openList(page, c);
    await settledFilters(page);
    await expect(page.getByRole('list', { name: 'Reference filters' })).toHaveCount(0);
    await expect(page.getByText(MISSING)).toHaveCount(0);
  });

  test('M-04.2 — Hide the filter on the custom fixture without ui.yaml', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('custom')] });
    await openList(page, c);
    await settledFilters(page);
    await expect(page.getByRole('list', { name: 'Reference filters' })).toHaveCount(0);
    await expect(page.locator('.memory-badge-missing')).toHaveCount(0);
  });

  test('M-04.3 — Show the filter with 0 when every required reference is present', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const fx = await presetCopy(fixtures, async (copy) => {
      await setFrontmatterValue(copy, 'task-004-themes', 'ref', 'US-X-08');
      await setFrontmatterValue(copy, 'adr-001-local-server', 'sard_ref', 'REQ-ARC-01');
    });
    const c = await consoles.start({ projects: [fx] });
    await openList(page, c);
    await expect(missingFilter(page)).toHaveAccessibleName(`${MISSING}, 0 elements`, { timeout: COLD_READ_MS });
    await expect(page.locator('.memory-badge-missing')).toHaveCount(0);
  });
});
