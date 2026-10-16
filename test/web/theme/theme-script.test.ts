// @vitest-environment jsdom
// spec-009 §1 (X-08.1, X-08.2): the inline script of web/index.html sets `data-theme` from
// prefers-color-scheme before the first paint and follows a change without a reload.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { REPO_ROOT } from '../../harness/cli.js';

const html = readFileSync(path.join(REPO_ROOT, 'web', 'index.html'), 'utf8');
const script = /<script id="wfui-theme">([\s\S]*?)<\/script>/.exec(html)![1]!;

function fakeMedia(dark: boolean): { set(next: boolean): void } {
  const listeners: (() => void)[] = [];
  const query = {
    matches: dark,
    addEventListener: (_: string, l: () => void) => listeners.push(l),
  };
  vi.stubGlobal('matchMedia', (q: string) => {
    expect(q).toBe('(prefers-color-scheme: dark)');
    return query;
  });
  return {
    set(next) {
      query.matches = next;
      for (const l of listeners) l();
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

it('runs in <head>, before the application script', () => {
  expect(html.indexOf('id="wfui-theme"')).toBeLessThan(html.indexOf('</head>'));
  expect(html.indexOf('id="wfui-theme"')).toBeLessThan(html.indexOf('src="/src/main.tsx"'));
});

it.each([
  [true, 'dark'],
  [false, 'light'],
])('dark preference %s → data-theme %s, then follows the change', (dark, theme) => {
  const media = fakeMedia(dark);
  new Function(script)();
  expect(document.documentElement.dataset['theme']).toBe(theme);
  media.set(!dark);
  expect(document.documentElement.dataset['theme']).toBe(dark ? 'light' : 'dark');
});

// task-041 (X-08.3, spec-009 §1, D41-5): the UI setting Theme reaches the page as the attribute
// `data-theme-setting` on <html> (written by the application, `settings/ThemeSetting.tsx`); the
// script stays the only writer of `data-theme`: a forced `light` / `dark` wins over the system
// preference and over its changes, and without the attribute the system preference applies again.
describe('X-08.3 — the theme setting overrides the system preference', () => {
  const root = document.documentElement;
  const settle = () => new Promise((r) => setTimeout(r, 0));

  afterEach(() => {
    root.removeAttribute('data-theme-setting');
  });

  it.each([
    [true, 'light'],
    [false, 'dark'],
  ] as const)('dark preference %s, setting %s → data-theme %s', async (dark, forced) => {
    const media = fakeMedia(dark);
    new Function(script)();
    root.setAttribute('data-theme-setting', forced);
    await settle();
    expect(root.dataset['theme']).toBe(forced);
    media.set(!dark);
    expect(root.dataset['theme']).toBe(forced);
    media.set(dark);
    expect(root.dataset['theme']).toBe(forced);
  });

  it('a setting present before the script runs applies at once (first paint)', () => {
    fakeMedia(true);
    root.setAttribute('data-theme-setting', 'light');
    new Function(script)();
    expect(root.dataset['theme']).toBe('light');
  });

  it('back to System: the attribute removed → the system preference again, and its changes', async () => {
    const media = fakeMedia(true);
    new Function(script)();
    root.setAttribute('data-theme-setting', 'light');
    await settle();
    expect(root.dataset['theme']).toBe('light');
    root.removeAttribute('data-theme-setting');
    await settle();
    expect(root.dataset['theme']).toBe('dark');
    media.set(false);
    expect(root.dataset['theme']).toBe('light');
  });

  it('an unknown value is ignored: the system preference applies', async () => {
    fakeMedia(true);
    new Function(script)();
    root.setAttribute('data-theme-setting', 'blue');
    await settle();
    expect(root.dataset['theme']).toBe('dark');
  });
});
