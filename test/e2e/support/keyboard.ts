/** Keyboard checks of the e2e suite (directive `accessibility`, REQ-ARC-10). */
import { expect, type Locator } from '@playwright/test';

/** `locator` has the focus and shows the focus ring of spec-009 (a 2 px solid outline). */
export async function expectFocusVisible(locator: Locator): Promise<void> {
  await expect(locator).toBeFocused();
  const outline = await locator.evaluate((el) => {
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
  });
  expect(outline.style).toBe('solid');
  expect(outline.width).toBeGreaterThanOrEqual(2);
}
