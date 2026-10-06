/** Reads the theme tokens of `web/src/theme/tokens.css` (spec-009 §1) for the theme tests. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../../harness/cli.js';

export const TOKENS_FILE = path.join(REPO_ROOT, 'web', 'src', 'theme', 'tokens.css');

/** The custom properties declared in the rule `:root[data-theme="<theme>"]`. */
export function themeTokens(theme: 'light' | 'dark', css = readFileSync(TOKENS_FILE, 'utf8')): Record<string, string> {
  const block = new RegExp(`:root\\[data-theme=["']${theme}["']\\]\\s*\\{([^}]*)\\}`).exec(css);
  if (!block) throw new Error(`no :root[data-theme="${theme}"] rule`);
  const tokens: Record<string, string> = {};
  for (const m of block[1]!.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) tokens[m[1]!] = m[2]!.trim();
  return tokens;
}

/** WCAG 2.1 relative luminance of a `#RRGGBB` colour. */
export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`not a #RRGGBB colour: ${hex}`);
  const [r, g, b] = [m[1]!, m[2]!, m[3]!].map((c) => {
    const s = parseInt(c, 16) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG 2.1 contrast ratio of two `#RRGGBB` colours. */
export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}
