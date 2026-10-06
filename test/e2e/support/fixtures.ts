/**
 * Playwright `test` of the e2e suites: worker-scoped fixture builds (each kind built once per
 * worker, lazily) and test-scoped consoles stopped after the test.
 *
 * ```ts
 * import { expect, test } from '../support/fixtures.js';
 * test('M-01.1 …', async ({ page, fixtures, consoles }) => {
 *   const kanban = await fixtures.copy('kanban');            // a copy the test may mutate
 *   const c = await consoles.start({ projects: [kanban] });
 *   await openConsole(page, c, { path: `/p/${c.pids[0]}/memory` });
 * });
 * ```
 */
import { test as base } from '@playwright/test';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildFixture, copyFixture, type Fixture, type FixtureKind } from '../../harness/fixtures/index.js';
import { startConsole, type ConsoleOptions, type RunningConsole } from './console.js';

export { expect } from '@playwright/test';

/** Fixture builds of one worker. */
export interface FixtureBuilds {
  /** The `kind` fixture, built once per worker: never mutate it. */
  get(kind: FixtureKind): Promise<Fixture>;
  /** A fresh copy of the `kind` fixture that the test may mutate. */
  copy(kind: FixtureKind): Promise<Fixture>;
}

/** Consoles of one test. */
export interface Consoles {
  start(options?: ConsoleOptions): Promise<RunningConsole>;
}

export const test = base.extend<{ consoles: Consoles }, { fixtures: FixtureBuilds }>({
  fixtures: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring
    async ({}, use) => {
      const root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-e2e-fx-')));
      const builds = new Map<FixtureKind, Promise<Fixture>>();
      let copies = 0;
      const get = (kind: FixtureKind): Promise<Fixture> => {
        let b = builds.get(kind);
        if (!b) {
          b = buildFixture(kind, { root: path.join(root, 'built') });
          builds.set(kind, b);
        }
        return b;
      };
      await use({ get, copy: async (kind) => copyFixture(await get(kind), path.join(root, `copy-${++copies}`)) });
      await rm(root, { recursive: true, force: true });
    },
    { scope: 'worker', timeout: 300_000 },
  ],
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring
  consoles: async ({}, use) => {
    const started: RunningConsole[] = [];
    await use({
      start: async (options) => {
        const c = await startConsole(options);
        started.push(c);
        return c;
      },
    });
    await Promise.all(started.map((c) => c.stop()));
  },
});
