// task-021 — TT-PERF-04 (REQ-PERF-04 "Other views": p95 ≤ 1.0 s with a warm cache; scenarios M-01.1,
// G-01.1, R-05.1, R-06.1, R-07.1, R-08.1, whose functional assertions close in tasks 017–020). On the
// large fixture of the SARD reference environment (custom + 500 elements + 2 000 commits, W5-7),
// Morgan's view; each view reached by in-app navigation in a fresh page (W5-6). Tag `@perf`: the
// budget is asserted under `npm run test:timing` only (W3-47, W5-9).
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { buildLargeFixture, LARGE_ELEMENTS, type LargeFixture } from '../harness/fixtures/large.js';
import { git } from '../harness/run.js';
import { COLD_READ_MS } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { expect, test as base } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import {
  PERF_BUDGET_MS,
  PERF_RUNS,
  PERF_TAG,
  percentile,
  reportRuns,
  STRICT_PERF,
  timeNavigation,
} from './support/perf.js';
import { expectSettled } from './support/screens.js';

/** The large fixture, built once per worker (perf only, not a fixture kind). */
const test = base.extend<object, { large: LargeFixture }>({
  large: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring
    async ({}, use) => {
      const root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-e2e-large-')));
      const fx = await buildLargeFixture({ root });
      await actAs(fx, 'Morgan');
      await use(fx);
      await rm(root, { recursive: true, force: true });
    },
    { scope: 'worker', timeout: 600_000 },
  ],
});

/** The views of REQ-PERF-04: where a run starts, what the user activates, when the view is shown. */
interface View {
  scenario: string;
  name: string;
  /**
   * The view a run starts on: another view of the project that reads none of the target's data
   * (the Documentation index, or the DNA for Documentation), so the target's reads all happen
   * after the key press; the project header and list are shared by every view.
   */
  from: (pid: string) => string;
  /** The element the keyboard activates (Enter). */
  target: (page: Page) => ReturnType<Page['locator']>;
  /** The view's content (CSS), visible once it is rendered. */
  ready: string;
}

const nav = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Project views' }).getByRole('link', { name, exact: true });

const VIEWS: View[] = [
  {
    scenario: 'M-01.1',
    name: 'Memory list',
    from: (pid) => `/p/${pid}/docs`,
    target: (page) => nav(page, 'Memory'),
    ready: '.memory-row',
  },
  {
    scenario: 'G-01.1',
    name: 'element panel',
    from: (pid) => `/p/${pid}/memory?type=task`,
    target: (page) => page.locator('.memory-row[data-eid="task-250-generated-task-151"]'),
    ready: '.drawer .history-sha',
  },
  {
    scenario: 'R-05.1',
    name: 'DNA',
    from: (pid) => `/p/${pid}/memory`,
    target: (p) => nav(p, 'DNA'),
    ready: '.rules-name',
  },
  {
    scenario: 'R-06.1',
    name: 'Directives',
    from: (pid) => `/p/${pid}/docs`,
    target: (p) => nav(p, 'Directives'),
    ready: '.directive-row',
  },
  {
    scenario: 'R-07.1',
    name: 'Team',
    from: (pid) => `/p/${pid}/docs`,
    target: (p) => nav(p, 'Team'),
    ready: '.member-card',
  },
  {
    scenario: 'R-08.1',
    name: 'Documentation',
    from: (pid) => `/p/${pid}/dna`,
    target: (p) => nav(p, 'Documentation'),
    ready: '.docs-index .docs-path',
  },
];

/** One run in a fresh page: open `from`, wait until settled, then time the navigation. */
async function run(page: Page, c: RunningConsole, view: View): Promise<number> {
  await openConsole(page, c, { path: view.from(c.pids[0]!) });
  await expect(view.target(page)).toBeVisible({ timeout: COLD_READ_MS });
  await expectSettled(page);
  return timeNavigation(page, view.target(page), view.ready);
}

test.describe(`TT-PERF-04 — other views ${PERF_TAG}`, () => {
  test('the large fixture holds 500 generated elements and 2 000 commits', async ({ large }) => {
    expect(large.elements).toHaveLength(LARGE_ELEMENTS);
    expect((await git(large.dir, ['rev-list', '--count', 'HEAD'], large.env)).stdout.trim()).toBe('2000');
    expect((await git(large.dir, ['status', '--porcelain'], large.env)).stdout).toBe('');
  });

  for (const view of VIEWS) {
    test(`${view.scenario} — the ${view.name} renders within 1.0 s (p95, warm cache)`, async ({
      browser,
      large,
      consoles,
    }) => {
      test.setTimeout(STRICT_PERF ? 600_000 : 240_000);
      const c = await consoles.start({ projects: [large] });
      const times: number[] = [];
      let warmUp = 0;
      for (let i = 0; i <= PERF_RUNS; i++) {
        // A fresh page each run: the page's query cache is cold, the server's is warm.
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
          const ms = await run(page, c, view);
          if (i === 0) warmUp = ms;
          else times.push(ms);
        } finally {
          await context.close();
        }
      }
      reportRuns(view.name, warmUp, times);
      expect(times).toHaveLength(PERF_RUNS);
      if (STRICT_PERF) expect(percentile(times, 95)).toBeLessThanOrEqual(PERF_BUDGET_MS);
    });
  }
});
