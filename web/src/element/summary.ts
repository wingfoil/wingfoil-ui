/**
 * The summary of an element (task-078, D78-2; RP3-7 N6; ux-reference §4.2 v0.3): the body's first
 * top-level paragraph rendered as Markdown — emphasis, code, links —, HTML comments left out (the
 * template's placeholders, as the v0.1 summary did) and with the reference definitions of the whole
 * body, so `[text][ref]` resolves. The result is step 1 of `docs/render.ts` (markdown-it with raw
 * HTML shown as text, then DOMPurify): `finishDocument` classifies its links and runs DOMPurify last.
 */
import type { Token } from 'markdown-it';
import { commentFreeMarkdown, sanitiseMarkdownHtml } from '../docs/render.js';

/** The sanitised HTML of the summary of `body`, or `undefined` when it has no paragraph of text. */
export function summaryHtml(body: string): string | undefined {
  const env = {};
  const tokens = commentFreeMarkdown.parse(body, env);
  for (let i = 0; i < tokens.length; i++) {
    const open = tokens[i]!;
    if (open.type !== 'paragraph_open' || open.level !== 0) continue;
    const close = tokens.findIndex((t, j) => j > i && t.type === 'paragraph_close' && t.level === 0);
    if (close < 0) return undefined;
    const paragraph: Token[] = tokens.slice(i, close + 1);
    const text = paragraph.map((t) => t.content).join('');
    if (text.trim() === '') {
      i = close;
      continue;
    }
    return sanitiseMarkdownHtml(
      commentFreeMarkdown.renderer.render(paragraph, commentFreeMarkdown.options, env).trim(),
    );
  }
  return undefined;
}
