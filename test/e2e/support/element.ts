/**
 * The element page (task-062, spec-011 §2, ux-reference §4.2 v0.3): `/p/<pid>/e/<id>` shows the
 * element in the main region; the side panel (task-077) shows it over the current view. Both roots
 * carry `data-element-view`, so the specs find "the element" by structure, whatever presentation
 * opened it.
 */
import type { Locator, Page } from '@playwright/test';
import { expectFirstLoad, expectLoaded } from './cold-read.js';
import { openConsole, type RunningConsole } from './console.js';

/** The element shown — the element page in the main region, or the side panel. */
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

/**
 * The element's side panel (task-077): the non-modal drawer over the current view, opened from
 * Today or the bell by `?panel=<full id>`.
 */
export function sidePanel(page: Page): Locator {
  return page.locator('[role="dialog"][data-element-view]');
}

/**
 * The document dialog of the element shown (task-078, D78-4): the modal over the page or the side
 * panel, named by the element's title.
 */
export function documentDialog(page: Page): Locator {
  return page.locator('[role="dialog"].element-document');
}

/**
 * Run `action` and fail if the page requested any image meanwhile (task-078 AC-3, D78-11): a
 * request of resource type `image`, or of a URL that names an image file, from any frame.
 */
export async function expectNoImageRequest(page: Page, action: () => Promise<void>): Promise<void> {
  const images: string[] = [];
  const listener = (request: { resourceType(): string; url(): string }) => {
    if (request.resourceType() === 'image' || /\.(png|jpe?g|gif|svg|webp|avif|ico)(\?|#|$)/i.test(request.url())) {
      images.push(request.url());
    }
  };
  page.on('request', listener);
  try {
    await action();
  } finally {
    page.off('request', listener);
  }
  if (images.length > 0) throw new Error(`images requested: ${images.join(', ')}`);
}
