/** Keyboard checks of the e2e suite (directive `accessibility`, REQ-ARC-10). */
import { expect, type Locator, type Page } from '@playwright/test';

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

/** The focus indicator of the focused element, as the user sees it (TT-ARC-10, W5-12). */
export interface FocusRing {
  /** What has the focus: tag, role, name or text (for the report). */
  element: string;
  /** Outline style and width in px. */
  style: string;
  width: number;
  /** Contrast ratio of the outline colour against the colour right next to it. */
  contrast: number;
}

/**
 * The focus ring of the focused element (W5-12, decided by the user 2026-10-10): its outline, and
 * the contrast ratio (WCAG 2.1 relative luminance) of the outline colour against the backdrop it
 * is drawn on — the element's own background for an inset ring (negative `outline-offset`), else
 * the background around the element; translucent backgrounds are composited up the ancestors.
 * `undefined` when nothing (or the body) has the focus.
 */
export async function focusRing(page: Page): Promise<FocusRing | undefined> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement) || el === document.body) return undefined;
    type Rgba = [number, number, number, number];
    const parse = (c: string): Rgba => {
      const m = /rgba?\(([^)]+)\)/.exec(c);
      if (!m) return [0, 0, 0, 0];
      const p = m[1]!
        .split(/[\s,/]+/)
        .filter(Boolean)
        .map(Number);
      return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
    };
    const over = (top: Rgba, bottom: Rgba): Rgba => {
      const a = top[3] + bottom[3] * (1 - top[3]);
      if (a === 0) return [0, 0, 0, 0];
      const mix = (i: number) => (top[i]! * top[3] + bottom[i]! * bottom[3] * (1 - top[3])) / a;
      return [mix(0), mix(1), mix(2), a];
    };
    const backdrop = (from: Element | null): Rgba => {
      const layers: Rgba[] = [];
      for (let n = from; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c[3] > 0) layers.push(c);
        if (c[3] >= 1) break;
      }
      let colour: Rgba = [255, 255, 255, 1];
      for (const layer of layers.reverse()) colour = over(layer, colour);
      return colour;
    };
    const luminance = ([r, g, b]: Rgba) => {
      const lin = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const style = getComputedStyle(el);
    const inset = parseFloat(style.outlineOffset) < 0;
    const back = backdrop(inset ? el : el.parentElement);
    const ring = over(parse(style.outlineColor), back);
    const [l1, l2] = [luminance(ring), luminance(back)].sort((a, b) => b - a);
    const name = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 40) ?? '';
    return {
      element: `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''} "${name}"`,
      style: style.outlineStyle,
      width: parseFloat(style.outlineWidth),
      contrast: (l1! + 0.05) / (l2! + 0.05),
    };
  });
}

/**
 * Press Tab (or Shift+Tab when `target` comes before the focus in the document) until `target`
 * has the focus, at most `max` presses; each element focused on the way is given to `seen` (the
 * walk of X-06.1 checks every focus ring).
 */
export async function tabUntil(
  page: Page,
  target: Locator,
  seen: (ring: FocusRing) => void = () => {},
  max = 60,
): Promise<void> {
  await target.waitFor();
  const handle = await target.elementHandle();
  for (let i = 0; i < max; i++) {
    const state = await page.evaluate((t) => {
      const active = document.activeElement;
      if (t === active) return 'here';
      if (!active || active === document.body) return 'forward';
      return active.compareDocumentPosition(t!) & Node.DOCUMENT_POSITION_PRECEDING ? 'back' : 'forward';
    }, handle);
    if (state === 'here') return;
    await page.keyboard.press(state === 'back' ? 'Shift+Tab' : 'Tab');
    const ring = await focusRing(page);
    if (ring) seen(ring);
  }
  throw new Error(`the focus never reached ${String(target)} in ${max} presses`);
}
