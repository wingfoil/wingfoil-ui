/**
 * The element page (task-062, spec-011 §2, ux-reference §4.2 v0.3): `/p/<pid>/e/<id>` shows the
 * element in the main region. Its root carries `data-element-view` — the side panel's will too
 * (task-077) — so the specs find "the element" by structure, whatever presentation opened it.
 */
import type { Locator, Page } from '@playwright/test';
import { expectFirstLoad, expectLoaded } from './cold-read.js';
import { openConsole, type RunningConsole } from './console.js';

/** The element shown — the element page in the main region. */
export function elementView(page: Page): Locator {
  return page.locator('[data-element-view]');
}

/** Open the element page of `eid` by its address and wait for its first reads. */
export async function openElementPage(
  page: Page,
  c: RunningConsole,
  eid: string,
  pid: string = c.pids[0]!,
): Promise<Locator> {
  await openConsole(page, c, { path: `/p/${pid}/e/${eid}` });
  const view = elementView(page);
  // The cold reads of the element and of its history (bug-004).
  await expectFirstLoad(view.locator('.type-tag'));
  await expectLoaded(view);
  return view;
}
