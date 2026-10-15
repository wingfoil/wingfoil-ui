/**
 * The v0.1 screens (task-021; W5-11, decided by the user 2026-10-10): every screen of the release
 * with how to reach it and when it is ready, shared by the axe scan of X-06.4 (normal build) and
 * the catalogue check of X-09.1 (key-rendering build). A screen is reached by its URL and by
 * structure (roles, classes), never by an English text, so the same list runs on the key build.
 * The console holds the kanban fixture and the custom fixture, the user is Morgan in both
 * (`startScreensConsole`), and a second kanban copy where the user is Riley, not in the team
 * (`pids[2]`, the *How to join* panel — task-035, D35-5; Today not in the team — task-036); state variants (refusals, notices of other identities, the unreachable
 * banner, a lost session) are scanned in the specs of their tasks (closure table of task-021).
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { COLD_READ_MS } from './cold-read.js';
import type { RunningConsole } from './console.js';
import type { Consoles, FixtureBuilds } from './fixtures.js';
import { actAs } from './identity.js';
import { installLoadingCheck, type LoadingCheckWindow } from './loading.js';

/**
 * The console of the screens: kanban (`pids[0]`) and custom (`pids[1]`), Morgan in both; a kanban
 * copy where the user is Riley (`pids[2]`, task-035).
 */
export async function startScreensConsole(fixtures: FixtureBuilds, consoles: Consoles): Promise<RunningConsole> {
  const kanban = await fixtures.copy('kanban');
  const custom = await fixtures.copy('custom');
  const outsider = await fixtures.copy('kanban');
  await actAs(kanban, 'Morgan');
  await actAs(custom, 'Morgan');
  await actAs(outsider, 'Riley');
  return consoles.start({ projects: [kanban, custom, outsider] });
}

/** Wait until no loading status is shown (every first read answered), whatever the build. */
export async function expectSettled(page: Page): Promise<void> {
  await installLoadingCheck(page);
  await page.waitForFunction(() => (window as unknown as LoadingCheckWindow).wfuiNoLoading(), undefined, {
    timeout: COLD_READ_MS,
  });
}

/** One screen of the release. */
export interface Screen {
  /** Its name in the reports. */
  name: string;
  /** Reach it from anywhere and wait until it is ready. */
  open(page: Page, c: RunningConsole): Promise<void>;
}

/** Go to `path` of the console (the session cookie set by the first opening) and wait for the shell. */
async function go(page: Page, c: RunningConsole, path: string): Promise<void> {
  await page.goto(`${c.origin}${path}`, { timeout: COLD_READ_MS });
  await page.getByRole('banner').waitFor({ timeout: COLD_READ_MS });
}

/** Open a project page and wait for its header and its content `ready`. */
async function project(page: Page, c: RunningConsole, path: string, ready: (page: Page) => Locator): Promise<void> {
  await go(page, c, path);
  await expect(page.locator('.project-header .project-version')).toBeVisible({ timeout: COLD_READ_MS });
  await expect(ready(page).first()).toBeVisible({ timeout: COLD_READ_MS });
  await expectSettled(page);
}

const trigger = (page: Page) => page.locator('.switcher-trigger');
const addDialog = (page: Page) => page.locator('.modal .dialog');

/** Open the switcher popover and wait for its rows. */
async function openSwitcherPopover(page: Page): Promise<void> {
  await trigger(page).click();
  await expect(page.locator('.switcher-row').first()).toBeVisible({ timeout: COLD_READ_MS });
  await expectSettled(page);
}

/** Every v0.1 screen (ux-reference 1.0 §3–§4, v0.1 parts). */
export const SCREENS: readonly Screen[] = [
  {
    name: 'start page (no project open)',
    open: async (page, c) => {
      await go(page, c, '/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: COLD_READ_MS });
      await expect(trigger(page)).toBeVisible();
    },
  },
  {
    name: 'project switcher',
    open: async (page, c) => {
      await go(page, c, '/');
      await openSwitcherPopover(page);
    },
  },
  {
    name: 'remove project confirmation',
    open: async (page, c) => {
      await go(page, c, '/');
      await openSwitcherPopover(page);
      await page.locator('.switcher-remove').first().click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
    },
  },
  {
    name: 'add project dialog — local folder',
    open: async (page, c) => {
      await go(page, c, '/');
      await page.getByRole('main').getByRole('button').first().click();
      await expect(addDialog(page)).toBeVisible();
    },
  },
  {
    name: 'add project dialog — remote repository',
    open: async (page, c) => {
      await go(page, c, '/');
      await page.getByRole('main').getByRole('button').first().click();
      await addDialog(page).locator('.segmented-option').nth(1).click();
      await expect(addDialog(page).getByRole('textbox')).toHaveCount(2);
    },
  },
  {
    name: 'memory list',
    open: (page, c) => project(page, c, `/p/${c.pids[0]}/memory`, (p) => p.locator('.memory-row')),
  },
  {
    name: 'memory list filtered by type',
    open: (page, c) => project(page, c, `/p/${c.pids[0]}/memory?type=task`, (p) => p.locator('.memory-row')),
  },
  {
    name: 'element panel',
    open: (page, c) => project(page, c, `/p/${c.pids[0]}/e/task-001-login-form`, (p) => p.locator('.drawer .type-tag')),
  },
  {
    name: 'role view selector open',
    open: async (page, c) => {
      await project(page, c, `/p/${c.pids[0]}/team`, (p) => p.locator('.member-card'));
      await page.locator('.role-view-button').click();
      await expect(page.getByRole('listbox')).toBeVisible();
    },
  },
  {
    name: 'DNA',
    open: (page, c) => project(page, c, `/p/${c.pids[1]}/dna`, (p) => p.locator('.rules-name')),
  },
  {
    name: 'directives',
    open: (page, c) => project(page, c, `/p/${c.pids[1]}/directives`, (p) => p.locator('.directive-row')),
  },
  {
    name: 'directive page',
    open: (page, c) => project(page, c, `/p/${c.pids[1]}/directives/wingfoil-cli`, (p) => p.locator('article h1')),
  },
  {
    name: 'team',
    open: (page, c) => project(page, c, `/p/${c.pids[0]}/team`, (p) => p.locator('.member-card')),
  },
  {
    name: 'documentation index',
    open: (page, c) => project(page, c, `/p/${c.pids[1]}/docs`, (p) => p.locator('.docs-index .docs-path')),
  },
  {
    name: 'document',
    open: (page, c) =>
      project(page, c, `/p/${c.pids[1]}/docs/docs/01_vision/02_product-vision.md`, (p) => p.locator('article h1')),
  },
  {
    name: 'how to join panel',
    open: async (page, c) => {
      await project(page, c, `/p/${c.pids[2]}/team`, (p) => p.locator('.member-card'));
      await page.locator('button.current-user-badge').click();
      const dialog = page.locator('.modal .dialog.how-to-join');
      await expect(dialog.locator('.how-to-join-leads li').first()).toBeVisible({ timeout: COLD_READ_MS });
      await expect(dialog.locator('code.cli-command')).toBeVisible();
      await expectSettled(page);
    },
  },
  {
    name: 'page not found',
    open: async (page, c) => {
      await go(page, c, '/no/such/page');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: COLD_READ_MS });
    },
  },
  {
    // task-036: Today as Morgan (Requires you, Waiting on others), the landing view of a project.
    name: 'today',
    open: (page, c) => project(page, c, `/p/${c.pids[0]}/today`, (p) => p.locator('.today-row')),
  },
  {
    // task-036: Today as Riley, not in the team (the identity sentence with How to join, D36-8).
    name: 'today — not in team',
    open: (page, c) => project(page, c, `/p/${c.pids[2]}/today`, (p) => p.locator('.today-identity button')),
  },
  {
    // task-037 (D37-12): the gate footer with its reason cleared — outcomes disabled, the hint shown.
    name: 'element panel — gate footer, reason empty',
    open: async (page, c) => {
      await project(page, c, `/p/${c.pids[0]}/e/task-001-login-form`, (p) => p.locator('.drawer .gate-reason-field'));
      await page.locator('.drawer .gate-reason-field').fill('');
      await expect(page.locator('.drawer .gate-hint')).toBeVisible();
    },
  },
  {
    // task-037: Riley, not in the team — the read-only line with How to join (S-13.2).
    name: 'element panel — read-only, not in team',
    open: (page, c) =>
      project(page, c, `/p/${c.pids[2]}/e/task-001-login-form`, (p) => p.locator('.drawer .element-footer button')),
  },
];
