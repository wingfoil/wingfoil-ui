// @vitest-environment jsdom
// spec-009 §1 (X-08.1, X-08.2): the inline script of web/index.html sets `data-theme` from
// prefers-color-scheme before the first paint and follows a change without a reload.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
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
