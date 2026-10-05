// TT-INT-08 (REQ-INT-08, staged): v0.1 runs the e2e suite on Chromium only.
import { expect, it } from 'vitest';
import config from '../../playwright.config.js';

it('declares exactly one Playwright project, chromium', () => {
  expect((config.projects ?? []).map((p) => p.name)).toEqual(['chromium']);
  expect(config.testDir).toMatch(/test[\\/]e2e$/);
});
