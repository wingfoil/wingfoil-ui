// spec-009 §2–§3, §5 (REQ-ARC-10, REQ-ARC-11): the token table of both themes and every contrast
// pair recomputed from `tokens.css`, failing below the bar.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast, themeTokens, TOKENS_FILE } from './tokens.js';

/** spec-009 §2: token → [light, dark]. */
const TABLE: Record<string, [string, string]> = {
  '--color-bg': ['#FFFFFF', '#0B1424'],
  '--color-surface': ['#F5F7FA', '#111C30'],
  '--color-surface-2': ['#EEF1F5', '#18253D'],
  '--color-divider': ['#E3E8EF', '#24324A'],
  '--color-control-border': ['#6B7890', '#6A7C9C'],
  '--color-text': ['#081532', '#E6ECF5'],
  '--color-text-2': ['#3B4A63', '#B8C3D4'],
  '--color-text-muted': ['#5C6880', '#94A2B8'],
  '--color-primary': ['#0C469F', '#7DB2F7'],
  '--color-on-primary': ['#FFFFFF', '#0B1424'],
  '--color-focus': ['#1686C8', '#4DB3EA'],
  '--color-danger': ['#B42318', '#FF8A80'],
  '--color-on-danger': ['#FFFFFF', '#0B1424'],
  '--tone-human-bg': ['#FFF3DC', '#3A2A0A'],
  '--tone-human-fg': ['#8A5A00', '#F5C76B'],
  '--tone-active-bg': ['#E3F0FB', '#12305A'],
  '--tone-active-fg': ['#0C469F', '#A9CCFF'],
  '--tone-done-bg': ['#E2F6F1', '#0E3A33'],
  '--tone-done-fg': ['#0B6B5C', '#6FDCC8'],
  '--tone-neutral-bg': ['#EEF1F5', '#1E2A3F'],
  '--tone-neutral-fg': ['#4A5568', '#C3CDDC'],
  '--tone-attention-bg': ['#FDECEC', '#3D1416'],
  '--tone-attention-fg': ['#B42318', '#FFA39C'],
  '--tone-muted-bg': ['#F5F7FA', '#111C30'],
  '--tone-muted-fg': ['#5C6880', '#94A2B8'],
};
const TONES = ['human', 'active', 'done', 'neutral', 'attention', 'muted'];
const BACKGROUNDS = ['--color-bg', '--color-surface', '--color-surface-2'];

describe.each(['light', 'dark'] as const)('the %s theme', (theme) => {
  const t = themeTokens(theme);
  const col = theme === 'light' ? 0 : 1;

  it('declares every colour token of the spec-009 §2 table with its value', () => {
    for (const [token, values] of Object.entries(TABLE)) expect(t[token]?.toUpperCase(), token).toBe(values[col]);
  });

  it('declares the brand gradient and the font and focus tokens', () => {
    expect(t['--brand-gradient']).toMatch(/#22CEC6.*#1686C8.*#0C469F/i);
    expect(t['--font-sans']).toMatch(/^"Geist", system-ui, sans-serif$/);
    expect(t['--font-mono']).toMatch(/^"Geist Mono", ui-monospace, monospace$/);
    expect(t['--focus-ring']).toBe('2px solid var(--color-focus)');
  });

  const minOver = (fg: string): number => Math.min(...BACKGROUNDS.map((bg) => contrast(t[fg]!, t[bg]!)));

  it.each([
    ['--color-text', 4.5],
    ['--color-text-2', 4.5],
    ['--color-text-muted', 4.5],
    ['--color-primary', 4.5],
    ['--color-danger', 4.5],
    ['--color-focus', 3.0],
    ['--color-control-border', 3.0],
  ])('%s reaches %s:1 over bg, surface and surface-2', (fg, bar) => {
    expect(minOver(fg)).toBeGreaterThanOrEqual(bar);
  });

  it('keeps text on primary and danger buttons at 4.5:1', () => {
    expect(contrast(t['--color-on-primary']!, t['--color-primary']!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t['--color-on-danger']!, t['--color-danger']!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(TONES)('keeps the %s tone foreground at 4.5:1 on its background', (tone) => {
    expect(contrast(t[`--tone-${tone}-fg`]!, t[`--tone-${tone}-bg`]!)).toBeGreaterThanOrEqual(4.5);
  });
});

it('sets the colour scheme of each theme', () => {
  const css = readFileSync(TOKENS_FILE, 'utf8');
  expect(css).toMatch(/:root\[data-theme="light"\]\s*\{[^}]*color-scheme:\s*light;/);
  expect(css).toMatch(/:root\[data-theme="dark"\]\s*\{[^}]*color-scheme:\s*dark;/);
});

it('fails a pair below its bar (the check is not vacuous)', () => {
  const css = `:root[data-theme="light"] { --color-text: #777777; --color-bg: #FFFFFF; }`;
  const t = themeTokens('light', css);
  expect(contrast(t['--color-text']!, t['--color-bg']!)).toBeLessThan(4.5);
});
