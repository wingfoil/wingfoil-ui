/**
 * "No loading status left" — one rule for the screens of X-06.4/X-09.1 (`expectSettled`) and the
 * TT-PERF-04 timing (`timeNavigation`): no `role="status"` element shows a loading message of the
 * catalogue (every `*.loading` message is rendered in a status), in either build (the English text
 * or the key).
 */
import type { Page } from '@playwright/test';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };

/** The loading messages of the catalogue: their English text and their key. */
export const LOADING_TEXTS: readonly string[] = Object.entries(en)
  .filter(([id]) => /\.loading$/.test(id))
  .flatMap(([id, text]) => [id, text]);

/** The page-side check, installed as `window.wfuiNoLoading()` by {@link installLoadingCheck}. */
export interface LoadingCheckWindow {
  wfuiNoLoading(): boolean;
}

/** Install `window.wfuiNoLoading()` in `page` (the one definition of the rule). */
export async function installLoadingCheck(page: Page): Promise<void> {
  await page.evaluate((loading) => {
    (window as unknown as LoadingCheckWindow).wfuiNoLoading = () => {
      for (const s of document.querySelectorAll('[role="status"]')) {
        if (loading.some((t) => s.textContent?.includes(t))) return false;
      }
      return true;
    };
  }, LOADING_TEXTS);
}
