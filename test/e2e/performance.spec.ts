// task-021 — TT-PERF-04 (REQ-PERF-04 "Other views": p95 ≤ 1.0 s with a warm cache; scenarios M-01.1,
// G-01.1, R-05.1, R-06.1, R-07.1, R-08.1, whose functional assertions close in tasks 017–020). On the
// large fixture of the SARD reference environment (custom + 500 elements + 2 000 commits, W5-7),
// Morgan's view; each view reached by in-app navigation in a fresh page (W5-6). Tag `@perf`: the
// budget is asserted under `npm run test:timing` only (W3-47, W5-9).
import { cp, mkdtemp, realpath, rm } from 'node:fs/promises';
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
  TODAY_AFTER_COMMIT_REOPEN_MS,
  TODAY_BUDGET_MS,
  TODAY_FIRST_OPEN_BUDGET_MS,
} from './support/perf.js';
import { expectSettled } from './support/screens.js';

/** The large fixture, built once per worker (perf only, not a fixture kind). */
const test = base.extend<object, { large: LargeFixture }>({
  large: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring
    async ({}, use) => {
      const root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-e2e-large-')));
      // Removed even when the build or the worker fails (task-026); the global teardown removes the
      // run's temporary root after a killed worker.
      try {
        const fx = await buildLargeFixture({ root });
        await actAs(fx, 'Morgan');
        await use(fx);
      } finally {
        await rm(root, { recursive: true, force: true, maxRetries: 5 });
      }
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
  /**
   * The path of the view's own read (W5-6 guard): never sent by the view a run starts on, sent
   * after the key press — the target's data is not in the page's cache.
   */
  reads: (pid: string) => string;
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
    reads: (pid) => `/api/p/${pid}/elements`,
  },
  {
    scenario: 'G-01.1',
    name: 'element panel',
    from: (pid) => `/p/${pid}/memory?type=task`,
    target: (page) => page.locator('.memory-row[data-eid="task-250-generated-task-151"]'),
    ready: '.drawer .history-sha',
    reads: (pid) => `/api/p/${pid}/elements/task-250-generated-task-151/history`,
  },
  {
    scenario: 'R-05.1',
    name: 'DNA',
    from: (pid) => `/p/${pid}/docs`,
    target: (p) => nav(p, 'DNA'),
    ready: '.rules-name',
    reads: (pid) => `/api/p/${pid}/config`,
  },
  {
    scenario: 'R-06.1',
    name: 'Directives',
    from: (pid) => `/p/${pid}/docs`,
    target: (p) => nav(p, 'Directives'),
    ready: '.directive-row',
    reads: (pid) => `/api/p/${pid}/directives`,
  },
  {
    scenario: 'R-07.1',
    name: 'Team',
    from: (pid) => `/p/${pid}/docs`,
    target: (p) => nav(p, 'Team'),
    ready: '.member-card',
    reads: (pid) => `/api/p/${pid}/config`,
  },
  {
    scenario: 'R-08.1',
    name: 'Documentation',
    from: (pid) => `/p/${pid}/dna`,
    target: (p) => nav(p, 'Documentation'),
    ready: '.docs-index .docs-path',
    reads: (pid) => `/api/p/${pid}/docs`,
  },
];

/**
 * One run in a fresh page: open `from`, wait until settled, then time the navigation. The view's
 * own read must not have been sent before the key press, and must be sent after it (W5-6) and
 * answered from the server — a finished request with a 2xx status, no cached or failed answer
 * (task-026, AC-2).
 */
async function run(page: Page, c: RunningConsole, view: View): Promise<number> {
  const pid = c.pids[0]!;
  const own = (url: string) => new URL(url).pathname === view.reads(pid);
  let reads = 0;
  let answered = 0;
  page.on('request', (r) => {
    if (own(r.url())) reads += 1;
  });
  page.on('requestfinished', (r) => {
    if (!own(r.url())) return;
    void r
      .response()
      .then((res) => {
        if (res?.ok()) answered += 1;
      })
      .catch(() => {
        // the page closed meanwhile: not an answer
      });
  });
  await openConsole(page, c, { path: view.from(pid) });
  await expect(view.target(page)).toBeVisible({ timeout: COLD_READ_MS });
  await expectSettled(page);
  expect(reads, `${view.reads(pid)} read before the key press`).toBe(0);
  const ms = await timeNavigation(page, view.target(page), view.ready);
  expect(reads, `${view.reads(pid)} not read after the key press`).toBeGreaterThan(0);
  await expect
    .poll(() => answered, { message: `${view.reads(pid)} not answered (2xx) after the key press` })
    .toBeGreaterThan(0);
  return ms;
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

// task-036 — TT-PERF-01 (REQ-PERF-01 "Today first render": p95 ≤ 2.0 s with a warm cache, ≤ 5.0 s for
// the first open after the server starts; scenarios T-01.1, T-02.1; D36-9): the same measurement as
// TT-PERF-04 — a fresh page on the Documentation index, Enter on the sidebar's *Today*, until a
// Requires you row shows with no loading status. The warm-up run is the first open after the start
// (one sample, its own budget); the RP-9 "after one commit" runs make an empty commit before each run
// (a new HEAD: the Memory events are parsed again in full, spec-002 §4) on a copy of the large
// fixture, printed with the load, not asserted (above ~1 s spec-002 §4 is reopened with the approver).
const TODAY: View = {
  scenario: 'T-01.1, T-02.1',
  name: 'Today',
  from: (pid) => `/p/${pid}/docs`,
  target: (p) => nav(p, 'Today'),
  ready: '.today-row',
  reads: (pid) => `/api/p/${pid}/today`,
};

test.describe(`TT-PERF-01 — Today ${PERF_TAG}`, () => {
  test('T-01.1, T-02.1 — Today renders within 2.0 s (p95, warm cache), the first open within 5.0 s', async ({
    browser,
    large,
    consoles,
  }) => {
    test.setTimeout(STRICT_PERF ? 600_000 : 240_000);
    const c = await consoles.start({ projects: [large] });
    const times: number[] = [];
    let firstOpen = 0;
    for (let i = 0; i <= PERF_RUNS; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        const ms = await run(page, c, TODAY);
        if (i === 0) firstOpen = ms;
        else times.push(ms);
      } finally {
        await context.close();
      }
    }
    reportRuns(TODAY.name, firstOpen, times, `TT-PERF-01 Today (${times.length} runs, warm cache)`);
    expect(times).toHaveLength(PERF_RUNS);
    if (STRICT_PERF) {
      expect(firstOpen).toBeLessThanOrEqual(TODAY_FIRST_OPEN_BUDGET_MS);
      expect(percentile(times, 95)).toBeLessThanOrEqual(TODAY_BUDGET_MS);
    }
  });

  test('RP-9 — Today after one commit (printed, not asserted)', async ({ browser, large, consoles }, testInfo) => {
    test.setTimeout(STRICT_PERF ? 900_000 : 300_000);
    // A copy: the commits must not change the worker's large fixture for the other tests.
    const dir = testInfo.outputPath('large-after-commit');
    await cp(large.dir, dir, { recursive: true });
    const copy = { ...large, dir };
    const c = await consoles.start({ projects: [copy] });
    const times: number[] = [];
    let firstOpen = 0;
    for (let i = 0; i <= PERF_RUNS; i++) {
      // Run 0 is the first open after the start; every later run follows a new commit.
      if (i > 0) await git(dir, ['commit', '--quiet', '--allow-empty', '-m', `perf: commit ${i}`], large.env);
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        const ms = await run(page, c, TODAY);
        if (i === 0) firstOpen = ms;
        else times.push(ms);
      } finally {
        await context.close();
      }
    }
    reportRuns(
      TODAY.name,
      firstOpen,
      times,
      `TT-PERF-01 Today after one commit (${times.length} runs; spec-002 §4 reopened above ${TODAY_AFTER_COMMIT_REOPEN_MS} ms)`,
    );
    expect(times).toHaveLength(PERF_RUNS);
  });
});
