// TT-INT-08 (REQ-INT-08): v0.2 runs the e2e suite on Chromium, Firefox and WebKit (task-027, AC-1);
// timing and perf runs stay on Chromium only (AC-2, RP-44); the inner-loop script runs Chromium
// only (D27-4 C).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { PlaywrightTestConfig } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import config from '../../playwright.config.js';
import { REPO_ROOT } from './cli.js';

const STRICT = 'WFUI_STRICT_REFRESH';

/** A tag `grep` / `grepInvert` matches (Playwright matches it against the title and the tags). */
function matches(pattern: RegExp | RegExp[] | undefined, tag: string): boolean {
  if (pattern === undefined) return false;
  return (Array.isArray(pattern) ? pattern : [pattern]).some((p) => new RegExp(p.source, p.flags).test(tag));
}

describe('playwright.config.ts (npm run test:e2e)', () => {
  const projects = config.projects ?? [];

  it('declares the chromium, firefox and webkit projects, each on its own engine', () => {
    expect(projects.map((p) => [p.name, p.use?.defaultBrowserType])).toEqual([
      ['chromium', 'chromium'],
      ['firefox', 'firefox'],
      ['webkit', 'webkit'],
    ]);
    expect(config.testDir).toMatch(/test[\\/]e2e$/);
    expect(config.fullyParallel).toBe(true);
    expect(config.workers).toBeUndefined();
  });

  it('runs @perf on chromium only and @live-refresh on every engine', () => {
    for (const p of projects) {
      expect(matches(p.grepInvert, '@perf'), p.name).toBe(p.name !== 'chromium');
      expect(matches(p.grepInvert, '@live-refresh'), p.name).toBe(false);
    }
  });
});

describe('playwright.timing.config.ts (npm run test:timing)', () => {
  let timing: PlaywrightTestConfig;
  let strict: string | undefined;

  beforeAll(async () => {
    // The timing config sets the strict flag for its workers: keep it out of this test process.
    strict = process.env[STRICT];
    timing = (await import('../../playwright.timing.config.js')).default;
  });
  afterAll(() => {
    if (strict === undefined) delete process.env[STRICT];
    else process.env[STRICT] = strict;
  });

  it('runs on chromium only, one worker, the tagged tests only', () => {
    expect((timing.projects ?? []).map((p) => [p.name, p.use?.defaultBrowserType])).toEqual([['chromium', 'chromium']]);
    expect(timing.workers).toBe(1);
    expect(matches(timing.grep, '@perf')).toBe(true);
    expect(matches(timing.grep, '@live-refresh')).toBe(true);
  });
});

describe('package.json e2e scripts', () => {
  const scripts = (
    JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    }
  ).scripts;

  it('runs the three engines in test:e2e and Chromium only in test:e2e:chromium', () => {
    expect(scripts['test:e2e']).toBe('playwright test');
    expect(scripts['test:e2e:chromium']).toBe('playwright test --project=chromium');
  });
});
