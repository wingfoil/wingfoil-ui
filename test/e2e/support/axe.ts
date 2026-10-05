/**
 * Accessibility scan of the e2e suite (X-06.4, REQ-ARC-10): axe-core in the light and the dark
 * theme, failing on violations of impact "serious" or "critical". v0.1 themes follow
 * `prefers-color-scheme` (spec-009), so a theme is selected by emulating the media feature.
 */
import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/** The two themes of the UI. */
export type Theme = 'light' | 'dark';

/** WCAG 2.1 A/AA rule tags scanned. */
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;

/** A serious or critical violation found in one theme. */
export interface BlockingViolation {
  theme: Theme;
  id: string;
  impact: string;
  help: string;
  targets: string[];
}

/** Options of {@link scanThemes}. */
export interface ScanOptions {
  /** Themes to scan (default: light and dark). */
  themes?: readonly Theme[];
  /** Waits until the screen is ready after the theme switch. */
  ready?: (page: Page) => Promise<void>;
}

/** Scan the current page in each theme and return its serious and critical violations. */
export async function scanThemes(page: Page, options: ScanOptions = {}): Promise<BlockingViolation[]> {
  const found: BlockingViolation[] = [];
  for (const theme of options.themes ?? (['light', 'dark'] as const)) {
    await page.emulateMedia({ colorScheme: theme });
    if (options.ready) await options.ready(page);
    const results = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze();
    for (const v of results.violations) {
      if (v.impact !== 'serious' && v.impact !== 'critical') continue;
      found.push({ theme, id: v.id, impact: v.impact, help: v.help, targets: v.nodes.map((n) => n.target.join(' ')) });
    }
  }
  return found;
}
