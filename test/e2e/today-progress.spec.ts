// task-065 — Today's progress card on the real bin (US-T-12 … US-T-15 of `t/progress-card.feature`,
// US-X-10 X-10.4, US-C-04 C-04.1; ux-reference §4.1 v0.3; spec-012 §3; D65-3 … D65-11, D65-14): the
// scope and the figures of `GET /progress` on copies of the custom fixture with the sw-life-cycle
// preset and task-059's Given steps (`addSecondRelease`, `draftRelease`, the pre-packs states, the
// version-fake variant), the unknown fixture, and kanban copies (an ignored ui.yaml, the 40 % of
// `kanbanCompletion`). The figures open the Memory list's figure filter (task-066); the
// completion's explanation is a tooltip on hover and keyboard focus. Recent activity (US-T-08) is
// task-080's. Assertions are on what the user sees; T-12.3 approves with the CLI outside the UI
// (the strict-identity recipe of test/README.md, dl-011, on the runner).
import type { Locator, Page } from '@playwright/test';
import {
  addSecondRelease,
  draftRelease,
  installCliStub,
  kanbanCompletion,
  usePrePacksStates,
  usePresetUiConfig,
  type Fixture,
  type FixtureKind,
  type MemberName,
} from '../harness/fixtures/index.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS, LIVE_REFRESH_TAG, refreshClock } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { cli, commitFile, mutateAndWait, recordServerEvents } from './support/events.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { expectFocusVisible, tabUntil } from './support/keyboard.js';

test.use({ prebuild: ['custom', 'unknown', 'kanban'] });

const EXPLANATION =
  'Mean of reference completion over 2 references with at least 1 linked element: US-M-01 50 %, US-S-01 0 %';

/** The progress card. */
const card = (page: Page): Locator => page.getByRole('region', { name: 'Progress' });

/** The card's figures. */
const figures = (page: Page): Locator => card(page).getByRole('list', { name: 'Figures' });

/** The figure link named `name`. */
const figure = (page: Page, name: string): Locator => figures(page).getByRole('link', { name, exact: true });

/** The Memory list's rows. */
const rows = (page: Page): Locator => page.getByRole('list', { name: 'Elements' }).getByRole('link');

/** The listed element ids, sorted. */
async function listed(page: Page): Promise<string[]> {
  return (await rows(page).evaluateAll((links) => links.map((a) => (a as HTMLElement).dataset['eid'] ?? ''))).sort();
}

/** The non-archived element ids of `fx`, as the CLI lists them, sorted. */
async function everyElement(fx: Fixture): Promise<string[]> {
  const search = JSON.parse(await cli(fx, ['--format', 'json', 'memory', 'search'])) as { matches: { id: string }[] };
  return search.matches.map((m) => m.id).sort();
}

/** A copy of `kind` after `prepare` (moves by their own members), then the user `name`. */
async function copyAs(
  fixtures: { copy(kind: FixtureKind): Promise<Fixture> },
  kind: FixtureKind,
  name: MemberName,
  prepare: (fx: Fixture) => Promise<unknown> = async () => {},
): Promise<Fixture> {
  const fx = await fixtures.copy(kind);
  await prepare(fx);
  await actAs(fx, name);
  return fx;
}

/** A copy of the custom fixture with the sw-life-cycle preset, after `prepare`, as Casey. */
const presetCopy = (
  fixtures: { copy(kind: FixtureKind): Promise<Fixture> },
  prepare: (fx: Fixture) => Promise<unknown> = async () => {},
): Promise<Fixture> =>
  copyAs(fixtures, 'custom', 'Casey', async (fx) => {
    await usePresetUiConfig(fx);
    await prepare(fx);
  });

/** Open project `pid` on Today and wait for the card's figures. */
async function openToday(page: Page, c: RunningConsole, pid = c.pids[0]!): Promise<void> {
  await openConsole(page, c, { path: `/p/${pid}/today` });
  await expect(figures(page)).toBeVisible({ timeout: COLD_READ_MS });
}

/** The card's scope line. */
const scope = (page: Page): Locator => card(page).locator('.today-progress-scope');

test.describe('US-T-12 — the progress card', () => {
  test('T-12.1 — Show the figures of the current scope', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await presetCopy(fixtures)] });
    await openToday(page, c);
    await expect(scope(page)).toContainText('minor-v0.1');
    await expect(scope(page).locator('.state-pill')).toHaveText('planning');
    // Q2 (b): the type as written, the Memory list's labels.
    for (const name of ['Project completion 25 %', 'Iterated: task 1/4', 'Open: bug 1', 'Pending gates 3']) {
      await expect(figure(page, name)).toBeVisible();
    }
    expect(await scanThemes(page)).toEqual([]);
    // D65-5, review round 1 F-5: at 400 px the card's own parts wrap inside it (bug-044's page-level
    // scroll is not this task's).
    await page.setViewportSize({ width: 400, height: 800 });
    for (const part of ['.today-progress', '.today-progress-scope', '.today-progress-figures']) {
      const fits = await card(page)
        .locator('xpath=ancestor-or-self::section')
        .first()
        .evaluate((section, selector) => {
          const el = section.matches(selector) ? section : section.querySelector(selector);
          return el !== null && el.scrollWidth <= el.clientWidth;
        }, part);
      expect(fits, part).toBe(true);
    }
  });

  test('T-12.4 — Move the scope to the most advanced release', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await presetCopy(fixtures, addSecondRelease)] });
    await openToday(page, c);
    await expect(scope(page)).toContainText('minor-v0.2');
    await expect(scope(page).locator('.state-pill')).toHaveText('in-development');
  });

  test('T-12.5 — Say that no release is under way', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await presetCopy(fixtures, draftRelease)] });
    await openToday(page, c);
    await expect(scope(page)).toHaveText('No current release');
    // The figures of the whole project: the 4 tasks, every pending gate.
    await expect(figure(page, 'Iterated: task 1/4')).toBeVisible();
    await expect(figure(page, 'Pending gates 3')).toBeVisible();
  });

  test('T-12.6 — Say that no reference is linked in the current release', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await presetCopy(fixtures, addSecondRelease)] });
    await openToday(page, c);
    await expect(figures(page).getByRole('listitem').first()).toHaveText('No references linked in minor-v0.2');
    await expect(figures(page).getByRole('link', { name: /^Project completion/ })).toHaveCount(0);
  });

  test('T-12.2 — Show whole-project figures without ui.yaml', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'unknown', 'Casey')] });
    await openToday(page, c);
    await expect(scope(page)).toHaveText('Whole project');
    await expect(figure(page, 'Pending gates 1')).toBeVisible();
    const reason = figures(page).getByRole('listitem').first();
    await expect(reason).toHaveText('Completion needs references — see Configuration › Taxonomy');
    await expect(figures(page).getByRole('link', { name: /^Project completion/ })).toHaveCount(0);
    await reason.getByRole('link', { name: 'Configuration › Taxonomy' }).click();
    await expect(page).toHaveURL(new RegExp(`/p/${c.pids[0]}/configuration/taxonomy$`));
  });

  test(
    'T-12.3 — Update the figures after a decision',
    { tag: LIVE_REFRESH_TAG },
    async ({ page, fixtures, consoles }) => {
      const fx = await copyAs(fixtures, 'custom', 'Casey', async (f) => {
        await usePrePacksStates(f);
        await usePresetUiConfig(f);
      });
      const c = await consoles.start({ projects: [fx] });
      await recordServerEvents(page);
      await openToday(page, c);
      await expect(figure(page, 'Pending gates 3')).toBeVisible();
      await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
      const clock = refreshClock();
      await mutateAndWait(
        page,
        async () => {
          await actAs(fx, 'Morgan');
          clock.start();
          return cli(fx, ['memory', 'approve', 'bug-001-toast-overlap', '--reason', 'Confirmed']);
        },
        { event: 'repo', pid: c.pids[0]! },
      );
      await expect(figure(page, 'Pending gates 2')).toBeVisible({ timeout: clock.timeout() });
      clock.done('T-12.3 Pending gates 2');
      expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
    },
  );
});

test.describe('US-T-13 — the figures open the Memory list', () => {
  test('T-13.1 — Open the items behind "Pending gates"', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await presetCopy(fixtures)] });
    await openToday(page, c);
    const link = figure(page, 'Pending gates 3');
    // From the keyboard, with visible focus.
    await tabUntil(page, link);
    await expectFocusVisible(link);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Memory' })).toBeVisible();
    await expect
      .poll(() => listed(page), { timeout: COLD_READ_MS })
      .toEqual(['bug-001-toast-overlap', 'dl-002-use-fastify', 'task-001-cli-adapter']);
    await expect(page.getByRole('group', { name: 'Active filter' }).locator('.memory-active-name')).toHaveText(
      'Pending gates',
    );
  });

  test('T-13.2 — Open the items behind "Iterated: task 1/4"', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await presetCopy(fixtures)] });
    await openToday(page, c);
    await figure(page, 'Iterated: task 1/4').click();
    await expect
      .poll(() => listed(page), { timeout: COLD_READ_MS })
      .toEqual(['task-001-cli-adapter', 'task-002-memory-list', 'task-003-element-panel', 'task-004-themes']);
    await expect(page.locator('.memory-row[data-eid="task-002-memory-list"] .state-pill')).toHaveClass(/tone-done/);
  });

  test('T-13.3 — Clear a figure filter', async ({ page, fixtures, consoles }) => {
    const fx = await presetCopy(fixtures);
    const c = await consoles.start({ projects: [fx] });
    await openToday(page, c);
    await figure(page, 'Pending gates 3').click();
    const active = page.getByRole('group', { name: 'Active filter' });
    await expect(active.locator('.memory-active-name')).toHaveText('Pending gates', { timeout: COLD_READ_MS });
    await active.getByRole('link', { name: 'Clear filter' }).click();
    const every = await everyElement(fx);
    await expect.poll(() => listed(page), { timeout: COLD_READ_MS }).toEqual(every);
    await expect(active).toHaveCount(0);
  });

  test('T-13.4 — Ignore an unknown figure code', async ({ page, fixtures, consoles }) => {
    const fx = await presetCopy(fixtures);
    const c = await consoles.start({ projects: [fx] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/memory?figure=bogus` });
    const every = await everyElement(fx);
    await expect.poll(() => listed(page), { timeout: COLD_READ_MS }).toEqual(every);
    await expect(page.getByRole('group', { name: 'Active filter' })).toHaveCount(0);
  });
});

test.describe('US-T-14 — the completion explained', () => {
  test('T-14.1 — Explain the completion figure on hover', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await presetCopy(fixtures)] });
    await openToday(page, c);
    // A pointer user: the pointer moves on the page before it rests on the figure (React Aria counts
    // a hover only once the interaction modality is the pointer's, review round 1 F-1).
    await page.mouse.move(1, 1);
    await figure(page, 'Project completion 25 %').hover();
    await expect(page.getByRole('tooltip')).toHaveText(EXPLANATION);
  });

  test('T-14.2 — Reach the explanation with the keyboard', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await presetCopy(fixtures)] });
    await openToday(page, c);
    const link = figure(page, 'Project completion 25 %');
    await tabUntil(page, link);
    await expectFocusVisible(link);
    await expect(page.getByRole('tooltip')).toHaveText(EXPLANATION);
    await expect(link).toHaveAccessibleDescription(EXPLANATION);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  });
});

test.describe('US-T-15 — the phase figures read-only', () => {
  /** The custom fixture with the preset, its CLI answering 0.2.2 (the version-fake variant). */
  const on022 = (fixtures: { copy(kind: FixtureKind): Promise<Fixture> }) =>
    presetCopy(fixtures, (fx) => installCliStub(fx, { version: '0.2.2' }));

  test('T-15.1 — Show the phase figure read-only on WingFoil 0.2.2', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await on022(fixtures)] });
    await openToday(page, c);
    const phase = figures(page).getByText('Phase — needs WingFoil 0.3 (this project: 0.2.2)', { exact: true });
    await expect(phase).toBeVisible();
    await expect(phase.locator('xpath=ancestor-or-self::a')).toHaveCount(0);
    await expect(figure(page, 'Project completion 25 %')).toBeVisible();
  });

  test('T-15.2 — Show phase completion read-only too', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await on022(fixtures)] });
    await openToday(page, c);
    const phaseCompletion = figures(page).getByText('Phase completion — needs WingFoil 0.3', { exact: true });
    await expect(phaseCompletion).toBeVisible();
    await expect(phaseCompletion.locator('xpath=ancestor-or-self::a')).toHaveCount(0);
  });

  test('T-15.2 — the not-in-release text on WingFoil 0.3.1', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await presetCopy(fixtures)] });
    await openToday(page, c);
    await expect(
      figures(page).getByText('Phase — comes with a later WingFoil UI release', { exact: true }),
    ).toBeVisible();
    await expect(
      figures(page).getByText('Phase completion — comes with a later WingFoil UI release', { exact: true }),
    ).toBeVisible();
  });
});

test.describe('US-X-10 — the project completion in the tab title', () => {
  test('X-10.4 — Show the project completion in the tab title', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'kanban', 'Casey', kanbanCompletion)] });
    await openToday(page, c);
    await expect(figure(page, 'Project completion 40 %')).toBeVisible();
    await expect(page).toHaveTitle('kanban · 40 % · Today — WingFoil UI');
  });

  test('X-10.4 — no percentage when completion is not shown', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'kanban', 'Casey')] });
    await openToday(page, c);
    await expect(figures(page).getByRole('link', { name: /^Project completion/ })).toHaveCount(0);
    await expect(page).toHaveTitle('kanban · Today — WingFoil UI');
  });
});

test.describe('US-C-04 — an invalid ui.yaml on Today', () => {
  test('C-04.1 — Fall back to inferred values when ui.yaml is invalid', async ({ page, fixtures, consoles }) => {
    const fx = await copyAs(fixtures, 'kanban', 'Alex', (f) =>
      commitFile(f, '.wingfoil/ui.yaml', 'version: 1\nprogress:\n  mode: spiral\n', 'chore: a ui.yaml with a bad mode'),
    );
    const c = await consoles.start({ projects: [fx] });
    await openToday(page, c);
    // W3-2: the shared warning has no role="note".
    await expect(page.locator('.ui-yaml-warning')).toHaveText(
      'ui.yaml ignored: progress.mode must be sequence or flow (found spiral)',
    );
    await expect(scope(page)).toHaveText('Whole project');
  });
});
