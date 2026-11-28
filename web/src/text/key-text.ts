/**
 * `keyText`: the one escape of a repository key where the page renders it (task-085 D85-2, bug-041).
 * A key — element id, type, state, role, tag, path key, workflow name — is shown, never used: the raw
 * value stays the address, the filter value, the React `key` and `data-*`. The rule is the server's
 * `neutralise` (`server/src/git/redact.ts`): CR LF folded to a newline, a backslash doubled, and every
 * control, format, lone-surrogate, line- or paragraph-separator character but newline and tab written
 * as a visible escape (`\x1b`, `‮`, `\u{e0001}`). The web cannot import `server/`; a parity test
 * (`test/web/text/key-text.test.ts`) keeps the two equal. Plain keys pass through unchanged.
 */

const UNSAFE = /(?![\n\t])[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u;
const ESCAPED = new RegExp(`\\\\|${UNSAFE.source}`, 'gu');

/** The visible escape of one unsafe character: `\x1b`, `‮`, `\u{e0001}`. */
function visibleEscape(ch: string): string {
  const code = ch.codePointAt(0)!;
  const hex = code.toString(16);
  if (code <= 0xff) return `\\x${hex.padStart(2, '0')}`;
  if (code <= 0xffff) return `\\u${hex.padStart(4, '0')}`;
  return `\\u{${hex}}`;
}

/** `raw` as the page shows a key: control, bidi and format characters written as visible escapes. */
export function keyText(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(ESCAPED, (ch) => (ch === '\\' ? '\\\\' : visibleEscape(ch)));
}

/**
 * A reference's id as the page shows it. Provenance is the response's `element` flag, never the
 * text: an element reference's id is a raw key (escaped here, once); a pattern reference's id is a
 * display value the server already escaped (`referenceKey`, spec-012 §9), shown as served.
 */
export function referenceText(reference: { id: string; element: boolean }): string {
  return reference.element ? keyText(reference.id) : reference.id;
}
