/**
 * The UI setting Theme on the page (X-08.3, spec-009 §1; task-041, D41-5, D41-6): once the settings
 * are read, `light` or `dark` is written on `<html>` as `data-theme-setting` (removed for `system`);
 * the inline script of `index.html` — the only writer of `data-theme` — applies it over the system
 * preference. Before the settings answer, and while they cannot be read, the system theme applies.
 * Mounted once by `App`; it follows every change of the cached settings (a save, another tab's
 * `settings` event).
 */
import type { UiTheme } from '@wingfoil-ui/contracts';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { settingsQuery } from '../api/queries.js';

/** The attribute the inline theme script reads. */
export const THEME_SETTING_ATTRIBUTE = 'data-theme-setting';

/** Write `theme` for the inline script: a forced theme, or none for `system` / not read. */
export function applyThemeSetting(theme: UiTheme | undefined): void {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute(THEME_SETTING_ATTRIBUTE, theme);
  else root.removeAttribute(THEME_SETTING_ATTRIBUTE);
}

/** Keeps the page's theme on the UI setting (renders nothing). */
export function ThemeSetting(): null {
  const theme = useQuery(settingsQuery()).data?.theme;
  useEffect(() => applyThemeSetting(theme), [theme]);
  return null;
}
