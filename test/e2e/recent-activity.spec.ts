// task-080 — Recent activity on Today on the real bin (US-T-08, `t/recent-activity.feature`;
// ux-reference §4.1 item 6 and v0.3; spec-012 §6; D80-1 … D80-12): the last 5 Memory events of
// the kanban fixture, newest first, each row "<id> <from → to | created> · <name>" with its age and
// no link to the Timeline (RP3-14 D8); an approve made with the CLI outside the UI is the first row
// once the `repo` event reached the page (`@live-refresh`: COLD_READ_MS by default, 5 s under
// `test:timing`); a commit that is not a Memory event is not listed. The user is Casey (the
// Background); Morgan approves through `cliAs`, which leaves the copy's identity — the console's
// user — as it is. T-08.2 and T-08.3 commit outside the UI: the strict-identity recipe of
// `test/README.md` *Fixtures* › *Git identity* (dl-011) covers this spec.
import type { Locator, Page } from '@playwright/test';
import type { Fixture } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { COLD_READ_MS, LIVE_REFRESH_TAG, refreshClock } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { cliAs, commitFile, mutateAndWait, recordServerEvents } from './support/events.js';
import { sidePanel } from './support/element.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { expectFocusVisible } from './support/keyboard.js';

test.use({ prebuild: ['kanban'] });

/** The Recent activity card. */
const card = (page: Page): Locator => page.getByRole('region', { name: 'Recent activity' });

/** The rows of the card. */
const rows = (page: Page): Locator => card(page).locator('li.today-activity-row');

/** The rows' texts without their time: "<id> <what> · <name>", in order. */
async function linesOf(page: Page): Promise<string[]> {
  return rows(page)
    .locator('.today-activity-main')
    .evaluateAll((els) => els.map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()));
}

/** The 5 last Memory events of the kanban fixture as built (`builder.ts`), newest first (D80-12). */
const KANBAN_LINES = [
  'bug-001-crash-on-save draft → pending · Sam',
  'bug-001-crash-on-save created · Sam',
  'task-004-session-timeout created · Jordan',
  'task-003-logout pending → approved · Morgan',
  'task-003-logout draft → pending · Jordan',
];

/** A kanban copy where the user is Casey (the Background), after `prepare`. */
async function caseyCopy(
  fixtures: { copy(kind: 'kanban'): Promise<Fixture> },
  prepare: (fx: Fixture) => Promise<void> = async () => {},
): Promise<Fixture> {
  const fx = await fixtures.copy('kanban');
  await actAs(fx, 'Casey');
  await prepare(fx);
  return fx;
}

/** Open Today of the console's first project and wait for the card's rows. */
async function openToday(page: Page, c: RunningConsole): Promise<void> {
  await openConsole(page, c, { path: `/p/${c.pids[0]!}/today` });
  await expect(page.locator('.today').getByRole('heading', { level: 1 })).toBeVisible({ timeout: COLD_READ_MS });
  await expect(rows(page).first()).toBeVisible({ timeout: COLD_READ_MS });
}

test.describe('US-T-08 — Recent activity', () => {
  test('T-08.1 — Show the last 5 Memory events', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await caseyCopy(fixtures)], settings: { autoFetch: false } });
    await openToday(page, c);
    await expect(rows(page)).toHaveCount(5);
    expect(await linesOf(page)).toEqual(KANBAN_LINES);
    // Each row: its time "… ago", the full time as the description of its link (D80-4).
    for (const row of await rows(page).all()) {
      await expect(row.locator('time')).toHaveText(/ ago$/);
      await expect(row.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T/);
      await expect(row.getByRole('link')).toHaveAccessibleDescription(/\d{4}/);
    }
    // No link to the Timeline while R6 is in v0.4 (RP3-14 D8).
    await expect(card(page).getByRole('link', { name: /timeline/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Open the Timeline' })).toHaveCount(0);
    // The last card of Today (AC-2): after every other section.
    const last = await page.locator('.today section').last().getAttribute('class');
    expect(last).toContain('today-activity');
    // The id by the keyboard opens its side panel over Today (D80-4).
    const link = rows(page).first().getByRole('link', { name: 'bug-001-crash-on-save' });
    await link.focus();
    await expectFocusVisible(link);
    await page.keyboard.press('Enter');
    await expect(sidePanel(page).getByRole('heading', { level: 2, name: 'Crash on save' })).toBeVisible({
      timeout: COLD_READ_MS,
    });
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]!}/today?panel=bug-001-crash-on-save`);
    // Closed, the main region takes the focus (Q3 (a), D80-7).
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]!}/today`);
    await expect(page.locator('#main')).toBeFocused();
    // At 400 px the card wraps inside its own width (D80-4).
    await page.setViewportSize({ width: 400, height: 800 });
    await expect
      .poll(() => card(page).evaluate((el) => el.scrollWidth - el.clientWidth), { timeout: COLD_READ_MS })
      .toBeLessThanOrEqual(0);
  });

  test('T-08.2 — Add an event made outside the UI', { tag: LIVE_REFRESH_TAG }, async ({ page, fixtures, consoles }) => {
    const fx = await caseyCopy(fixtures);
    const c = await consoles.start({ projects: [fx], settings: { autoFetch: false } });
    await recordServerEvents(page);
    await openToday(page, c);
    expect(await linesOf(page)).toEqual(KANBAN_LINES);
    const clock = refreshClock();
    await mutateAndWait(
      page,
      () => {
        clock.start();
        return cliAs(fx, 'Morgan', ['memory', 'approve', 'task-001-login-form', '--reason', 'Looks good']);
      },
      { event: 'repo', pid: c.pids[0]! },
    );
    await expect
      .poll(async () => (await linesOf(page))[0], { timeout: clock.timeout() })
      .toBe('task-001-login-form pending → approved · Morgan');
    clock.done('T-08.2 Recent activity refreshed');
    await expect(rows(page)).toHaveCount(5);
    expect(await linesOf(page)).toEqual([
      'task-001-login-form pending → approved · Morgan',
      ...KANBAN_LINES.slice(0, 4),
    ]);
    // The copy's identity is still Casey's: the console's user did not change (D80-12).
    const { stdout } = await git(fx.dir, ['config', 'user.email'], fx.env);
    expect(stdout.trim()).toBe('casey@example.test');
  });

  test('T-08.3 — Leave out commits that are not Memory events', async ({ page, fixtures, consoles }) => {
    const fx = await caseyCopy(fixtures, (copy) =>
      commitFile(copy, 'README.md', '# kanban\n\nA fixed typo.\n', 'docs: fix a typo in README'),
    );
    const { stdout } = await git(fx.dir, ['log', '-1', '--format=%H %s'], fx.env);
    const [head, ...subject] = stdout.trim().split(' ');
    expect(subject.join(' ')).toBe('docs: fix a typo in README');
    const c = await consoles.start({ projects: [fx], settings: { autoFetch: false } });
    await openToday(page, c);
    await expect(rows(page)).toHaveCount(5);
    expect(await linesOf(page)).toEqual(KANBAN_LINES);
    await expect(card(page).getByText('docs: fix a typo in README')).toHaveCount(0);
    await expect(card(page).locator(`li[data-sha="${head!}"]`)).toHaveCount(0);
  });
});
