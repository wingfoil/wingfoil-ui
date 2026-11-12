/**
 * The CommonMark oracle of an element's document with its HTML comments left out (task-078, security
 * review round 4, R4-2; after the reviewer's probe): markdown-it 15.0.2 — the web's own build — with
 * `html: true`, then each raw HTML block replaced by what a browser shows of it with its comments
 * removed (the HTML tokenizer's rules: `<!-->` and `<!--->` are empty comments, an unclosed one hides
 * the rest of its block) kept as a paragraph, and each inline comment removed; other raw HTML inline
 * is text, as `html: false` renders it. Sources that open another kind of HTML block at a line start
 * (`<script>`, `<div>`, …) are outside its reach: they are not used with it. A dropped block leaves
 * a line break on both sides (its raw text did), so neighbours never glue in a tight list.
 *
 * {@link agrees} compares `commentFreeMarkdown` with it on the visible text and on the structure of
 * the HTML (paragraph tags aside: markdown-it hides them in tight lists only for its own tokens).
 */
import type { Token } from 'markdown-it';
import { commentFreeMarkdown, plainMarkdown } from '../../../web/src/docs/render.js';

type MarkdownIt = typeof plainMarkdown;
const MarkdownItClass = plainMarkdown.constructor as new (preset: 'default', options: object) => MarkdownIt;
const reference = new MarkdownItClass('default', { html: true, linkify: true, typographer: false });
const TokenClass = (reference.parse('x', {})[0] as Token).constructor as new (
  type: string,
  tag: string,
  nesting: -1 | 0 | 1,
) => Token;

/** `html` without its comments, as the HTML tokenizer reads them. */
export function stripHtmlComments(html: string): string {
  let out = '';
  let i = 0;
  while (i < html.length) {
    const open = html.indexOf('<!--', i);
    if (open < 0) return out + html.slice(i);
    out += html.slice(i, open);
    const j = open + 4;
    if (html.startsWith('>', j)) {
      i = j + 1;
      continue;
    }
    if (html.startsWith('->', j)) {
      i = j + 2;
      continue;
    }
    const close = html.indexOf('-->', j);
    const bang = html.indexOf('--!>', j);
    if (close < 0 && bang < 0) return out;
    i = close >= 0 && (bang < 0 || close < bang) ? close + 3 : bang + 4;
  }
  return out;
}

/** A line break between blocks (an inline token holding a soft break). */
function separator(level: number): Token {
  const token = new TokenClass('inline', '', 0);
  token.level = level;
  token.content = '';
  token.children = [Object.assign(new TokenClass('softbreak', 'br', 0), { level: 0 })];
  return token;
}

/**
 * Inline tokens with each comment removed and any other raw HTML as text — the document is rendered
 * with `html: false`: only comments are compared with CommonMark, raw HTML is text by adr-002.
 */
function asText(children: Token[]): Token[] {
  return children
    .filter((c) => !(c.type === 'html_inline' && /^<!--/.test(c.content)))
    .map((c) => (c.type === 'html_inline' ? Object.assign(new TokenClass('text', '', 0), { content: c.content }) : c));
}

/** The oracle's tokens of `source`. */
function oracleTokens(source: string): Token[] {
  const out: Token[] = [];
  for (const token of reference.parse(source, {})) {
    if (token.type === 'html_block') {
      out.push(separator(token.level));
      const visible = stripHtmlComments(token.content).trim();
      if (visible !== '') {
        const open = new TokenClass('paragraph_open', 'p', 1);
        open.level = token.level;
        const inline = new TokenClass('inline', '', 0);
        inline.level = token.level + 1;
        inline.content = visible;
        inline.children = asText(reference.parseInline(visible, {})[0]?.children ?? []);
        const close = new TokenClass('paragraph_close', 'p', -1);
        close.level = token.level;
        out.push(open, inline, close, separator(token.level));
      }
      continue;
    }
    if (token.children) token.children = asText(token.children);
    out.push(token);
  }
  return out;
}

/** The oracle's HTML of `source`. */
export function oracleHtml(source: string): string {
  return reference.renderer.render(oracleTokens(source), reference.options, {});
}

const ENTITIES: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#39;': "'" };

/** The visible text of `html`, blanks collapsed. */
export function visibleText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(lt|gt|amp|quot|#39);/g, (m) => ENTITIES[m]!)
    .replace(/\s+/g, ' ')
    .trim();
}

/** The structure of `html`: blanks between tags and paragraph tags left out. */
export function structure(html: string): string {
  return html
    .replace(/<\/?p>/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .replace(/>\s+/g, '>')
    .replace(/\s+</g, '<')
    .trim();
}

/** `commentFreeMarkdown` and the oracle on `source`: the same text and the same structure. */
export function agrees(source: string): { text: [string, string]; structure: [string, string] } {
  const got = commentFreeMarkdown.render(source);
  const want = oracleHtml(source);
  return { text: [visibleText(got), visibleText(want)], structure: [structure(got), structure(want)] };
}
