/**
 * The Content-Security-Policy of the console's HTML responses (task-084, bug-039; spec-004 §5
 * *Process Notes*). Scripts come from the console's own origin, plus the inline theme script of
 * `index.html` allowed by its hash; styles allow `'unsafe-inline'` (React Aria and the app's
 * `style` props set styles at run time, and a nonce cannot cover style attributes).
 */
import { createHash } from 'node:crypto';

const THEME_SCRIPT = /<script id="wfui-theme">([\s\S]*?)<\/script>/;

/** The CSP source `'sha256-…'` of the theme script of `html`, or `undefined` when it has none. */
export function themeScriptSource(html: string): string | undefined {
  const match = THEME_SCRIPT.exec(html);
  if (!match) return undefined;
  return `'sha256-${createHash('sha256')
    .update(match[1] ?? '', 'utf8')
    .digest('base64')}'`;
}

/** The policy for the page whose `index.html` text is `html` (no hash when it has no theme script). */
export function contentSecurityPolicy(html: string | undefined): string {
  const hash = html === undefined ? undefined : themeScriptSource(html);
  const script = hash ? `'self' ${hash}` : "'self'";
  return [
    "default-src 'none'",
    `script-src ${script}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "connect-src 'self'",
    "img-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}
