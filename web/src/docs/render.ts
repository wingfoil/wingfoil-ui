/**
 * Rendering a document (adr-002: markdown-it + DOMPurify; decisions W3-29, W3-31, W3-32):
 *
 * 1. {@link markdownToSafeHtml}: markdown-it with `html: false` (raw HTML is shown as written text)
 *    and its own link validation (`javascript:`, `vbscript:`, `file:`, `data:` never become links),
 *    then DOMPurify with the allow-list of the tags markdown-it emits.
 * 2. {@link finishDocument}: on an inert `<template>` (nothing loads, nothing runs), only through
 *    the DOM API and `textContent`: heading ids (prefixed `doc-` against DOM clobbering), links
 *    rewritten from their classification (`docs/links.ts`), images replaced by their marked
 *    alternative text (never loaded), tables wrapped in a focusable labelled region, cell alignment
 *    as a class; then a final DOMPurify pass — nothing reaches the page that DOMPurify did not see
 *    last.
 *
 * An element's document (task-078, D78-3; the approver's Q2 (b)) leaves its HTML comments out of
 * step 1 (`comments: 'drop'`): the template's placeholders are not shown as text; code keeps them.
 */
import DOMPurify from 'dompurify';
import MarkdownIt, { type StateBlock, type StateInline } from 'markdown-it';
import type { LinkClass, RefusalMark } from './links.js';

const OPTIONS = { html: false, linkify: true, typographer: false } as const;
const markdown = new MarkdownIt('default', OPTIONS);

/** markdown-it as the Documentation view renders (comments shown as text): the tests' reference. */
export const plainMarkdown = markdown;

const COMMENT_OPEN = '<!--';
const COMMENT_CLOSE = '-->';

/**
 * The first `-->` of `src` at or after `from`, or -1 (task-078 review round 2, R2-1). The answer of
 * the last search of each parse state is kept: a later search from a position between that search's
 * start and its answer has the same answer, so the forward scans of a parse stay linear in the source
 * (the rules ask again for every line, every opener and every link label they are tried on).
 */
const closeScans = new WeakMap<object, { from: number; found: number }>();
function nextClose(owner: object, src: string, from: number): number {
  const last = closeScans.get(owner);
  if (last && from >= last.from && (last.found < 0 || from <= last.found)) return last.found;
  const found = src.indexOf(COMMENT_CLOSE, from);
  closeScans.set(owner, { from, found });
  return found;
}

/**
 * A comment block (task-078, D78-3; review rounds 1 and 2): a line that starts with `<!--` (up to
 * three spaces in), through the line holding the first `-->` (CommonMark's HTML block type 2), or to
 * the end of its container when it is never closed (as CommonMark and GitHub hide the rest).
 *
 * - A comment that closes on its own line is a block only where a block starts, and only when blanks
 *   alone follow its `-->`. Inside a paragraph (silent mode: the terminator check), or with text
 *   after it, the paragraph keeps the line and {@link commentInline} drops the comment alone, so the
 *   text stays and the lines around it stay one paragraph (F-1, R2-3, R2-4).
 * - A comment over several lines is a block wherever it starts, interrupting a paragraph as
 *   CommonMark's type 2 does: its lines are dropped, and text after its `-->` opens a paragraph
 *   (R2-2, R4-3) — nothing inside the comment is ever parsed. An unclosed one ends with its
 *   container (R3-1); a blank line inside it does not end it (R4-1).
 *
 * Only the text after the comment is emitted (by markdown-it's paragraph rule, parsed inline like
 * any text): the comment is never turned into markup. Each call scans forward once through {@link nextClose}.
 */
function commentBlock(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  if (state.sCount[startLine]! - state.blkIndent >= 4) return false;
  const start = state.bMarks[startLine]! + state.tShift[startLine]!;
  if (!state.src.startsWith(COMMENT_OPEN, start)) return false;
  const close = nextClose(state, state.src, start + 2);
  const firstEnd = state.eMarks[startLine]!;
  if (close >= 0 && close + COMMENT_CLOSE.length <= firstEnd) {
    // Closed on its own line: a block only where a block starts and with nothing after it.
    if (silent) return false;
    if (state.src.slice(close + COMMENT_CLOSE.length, firstEnd).trim() !== '') return false;
    state.line = startLine + 1;
    return true;
  }
  if (silent) return true;
  // Over several lines: find the closing line inside the container. The comment ends with its
  // container — at the first non-blank line indented less than the container's content (a list
  // item's next item or outdented text, a quote's lazy line: `sCount` -1), as markdown-it's own HTML
  // block does (review round 3, R3-1) — or at the end of the parse range.
  let line = startLine + 1;
  for (; line < endLine; line++) {
    if (state.sCount[line]! < state.blkIndent && !state.isEmpty(line)) break;
    if (close >= 0 && close + COMMENT_CLOSE.length <= state.eMarks[line]!) break;
  }
  const closed =
    line < endLine &&
    !(state.sCount[line]! < state.blkIndent && !state.isEmpty(line)) &&
    close >= state.bMarks[line]!;
  if (!closed) {
    state.line = line;
    return true;
  }
  const after = close + COMMENT_CLOSE.length;
  if (state.src.slice(after, state.eMarks[line]).trim() === '') {
    state.line = line + 1;
    return true;
  }
  // Text after `-->`: the closing line now starts after the comment and opens a paragraph, so the
  // text is that paragraph's first line and the lines that continue it stay with it (review round
  // 4, R4-3). Always a paragraph — the text is never read as a heading, a list or code.
  let text = after;
  while (state.src[text] === ' ' || state.src[text] === '\t') text++;
  state.bMarks[line] = after;
  state.tShift[line] = text - after;
  state.sCount[line] = state.blkIndent;
  return paragraphRule(state, line, endLine, false);
}

/**
 * An inline comment `<!--` … `-->` in a run of text (code spans are consumed before, D78-3): only
 * the comment is dropped. An opener with no `-->` in the run is text, as CommonMark reads it (F-1).
 * A comment that is a whole line of a paragraph takes its line break along, so its neighbours stay
 * one line apart (R2-4); one that opens a line takes the blanks after it. The search is bounded and
 * kept per run ({@link nextClose}); the line start is found by looking back over blanks only (R2-1).
 */
function commentInline(state: StateInline, _silent: boolean): boolean {
  if (!state.src.startsWith(COMMENT_OPEN, state.pos)) return false;
  const close = nextClose(state, state.src, state.pos + 2);
  // The `posMax` bound is defensive (review round 3, R3-2): markdown-it lowers `posMax` only to
  // tokenize a link's text, whose label `skipToken` has already scanned with this rule, so a comment
  // there never reaches past the label's end; no input found reaches it. It keeps the rule inside its
  // run whatever a later markdown-it does.
  if (close < 0 || close + COMMENT_CLOSE.length > state.posMax) return false;
  let end = close + COMMENT_CLOSE.length;
  let back = state.pos - 1;
  while (back >= 0 && (state.src[back] === ' ' || state.src[back] === '\t')) back--;
  if (back < 0 || state.src[back] === '\n') {
    while (end < state.posMax && (state.src[end] === ' ' || state.src[end] === '\t')) end++;
    // A whole line: its line break goes too (the previous line's break stays).
    if (back >= 0 && state.src[end] === '\n') end++;
  }
  state.pos = end;
  return true;
}

/** markdown-it as {@link markdown}, with the HTML comments left out (an element's document). */
export const commentFreeMarkdown = new MarkdownIt('default', OPTIONS);
// Before `lheading`: a comment line followed by `===` is no setext heading's text (R2-4).
commentFreeMarkdown.block.ruler.before('lheading', 'comment_drop', commentBlock, {
  alt: ['paragraph', 'reference', 'blockquote'],
});
commentFreeMarkdown.inline.ruler.before('text', 'comment_drop', commentInline);

/** markdown-it's own paragraph rule, which the comment block hands the text after `-->` to. */
const paragraphRule = commentFreeMarkdown.block.ruler.__rules__[commentFreeMarkdown.block.ruler.__find__('paragraph')]!
  .fn as typeof commentBlock;

/** Tags markdown-it emits (`default` preset, no raw HTML). */
const MARKDOWN_TAGS = [
  'a',
  'blockquote',
  'br',
  'code',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
];

/** The page's tags: markdown-it's minus `img`, plus the wrappers {@link finishDocument} adds. */
const PAGE_TAGS = [...MARKDOWN_TAGS.filter((t) => t !== 'img'), 'div', 'span'];

/** What {@link markdownToSafeHtml} does with HTML comments: shown as text (default) or left out. */
export interface MarkdownOptions {
  comments?: 'keep' | 'drop';
}

/** The output of markdown-it sanitised by DOMPurify with the allow-list of step 1. */
export function sanitiseMarkdownHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: MARKDOWN_TAGS,
    // `style` only for the cell alignment markdown-it writes; turned into a class in step 2.
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'start', 'style'],
    ALLOW_DATA_ATTR: false,
  });
}

/** Markdown → sanitised HTML (step 1). */
export function markdownToSafeHtml(source: string, options: MarkdownOptions = {}): string {
  const md = options.comments === 'drop' ? commentFreeMarkdown : markdown;
  return sanitiseMarkdownHtml(md.render(source));
}

/** An inert copy of `html` to work on. */
function inert(html: string): HTMLTemplateElement {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template;
}

/** The hrefs of the links of `safeHtml`, in document order (what the page must classify). */
export function documentLinks(safeHtml: string): string[] {
  return [...inert(safeHtml).content.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? '');
}

/** What {@link finishDocument} needs: the project, the classification and the catalogue texts. */
export interface FinishOptions {
  pid: string;
  /** The document's repository path (the target of its in-page links). */
  documentPath: string;
  /** The classification of a raw href of the document. */
  classify: (href: string) => LinkClass;
  /** The visible mark of each refusal. */
  marks: Record<RefusalMark, string>;
  /** Text for assistive technology after an external link. */
  newTab: string;
  imageNotShown: (alt: string) => string;
  tableLabel: (n: number) => string;
  /**
   * The in-UI URL of a repository path with a fragment (anchors and `document` links); default the
   * Documentation view's ({@link documentHref}). The Directives view gives its own (task-019).
   */
  hrefOf?: (path: string, fragment: string) => string;
  /**
   * The prefix of the heading ids (default `doc-`); an element's document uses `eldoc-`, so a dialog
   * over the Documentation view repeats no id (task-078, D78-5).
   */
  headingPrefix?: string;
}

/** The default prefix of the heading ids. */
export const HEADING_PREFIX = 'doc-';

/** The in-UI URL of a document of project `pid` (each path segment encoded). */
export function documentHref(pid: string, path: string, fragment = ''): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `/p/${encodeURIComponent(pid)}/docs/${encoded}${fragment ? `#${encodeURIComponent(fragment)}` : ''}`;
}

/** The id of the heading `fragment` points at. */
export function headingId(fragment: string, prefix = HEADING_PREFIX): string {
  return `${prefix}${slug(fragment)}`;
}

/** A GitHub-like slug: lower case, punctuation dropped, spaces as `-`. */
function slug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** A span with `className` and the text `text`. */
function span(className: string, text: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

/** Unique heading ids: a repeated slug takes the first free `-1`, `-2`, … suffix. */
function rewriteHeadings(root: DocumentFragment, prefix: string): void {
  const used = new Set<string>();
  for (const h of root.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    const base = slug(h.textContent ?? '');
    let id = base;
    for (let n = 1; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    h.id = `${prefix}${id}`;
  }
}

/** The URL builder of `options`. */
function hrefOf(options: FinishOptions): (path: string, fragment: string) => string {
  return options.hrefOf ?? ((path, fragment) => documentHref(options.pid, path, fragment));
}

function rewriteLink(a: HTMLAnchorElement, link: LinkClass, options: FinishOptions): void {
  switch (link.kind) {
    case 'external':
      a.setAttribute('href', link.href);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      a.className = 'doc-link-external';
      a.append(document.createTextNode(' '), span('visually-hidden', options.newTab));
      return;
    case 'anchor':
      // The same document with the fragment in the URL: a copied or reloaded URL lands on the
      // heading, and Back returns to the previous position.
      a.setAttribute('href', hrefOf(options)(options.documentPath, link.fragment));
      a.dataset.docNav = '';
      return;
    case 'document':
      a.setAttribute('href', hrefOf(options)(link.path, link.fragment));
      a.dataset.docNav = '';
      return;
    case 'element':
      a.setAttribute('href', `/p/${encodeURIComponent(options.pid)}/e/${encodeURIComponent(link.eid)}`);
      a.dataset.docNav = '';
      return;
    case 'refused':
    case 'unresolved': {
      const text = document.createElement('span');
      text.className = link.kind === 'refused' ? 'doc-link-refused' : 'doc-link-unresolved';
      text.dataset.docLink = a.dataset.docLink;
      text.append(...a.childNodes);
      const parts: Node[] = [text];
      if (link.kind === 'refused') {
        // The mark carries its link's key: the article finds the group by it (D78-1).
        const mark = span('doc-link-mark', options.marks[link.mark]);
        if (a.dataset.docLink !== undefined) mark.dataset.docMark = a.dataset.docLink;
        parts.push(document.createTextNode(' '), mark);
      }
      a.replaceWith(...parts);
      return;
    }
  }
}

/** Rewrite and finally sanitise the output of {@link markdownToSafeHtml} (step 2). */
export function finishDocument(safeHtml: string, options: FinishOptions): string {
  const root = inert(safeHtml).content;
  rewriteHeadings(root, options.headingPrefix ?? HEADING_PREFIX);
  [...root.querySelectorAll('a')].forEach((a, i) => {
    const href = a.getAttribute('href');
    a.removeAttribute('title');
    // A key that survives a new classification (the page keeps the focus on it).
    a.dataset.docLink = String(i);
    rewriteLink(a, options.classify(href ?? ''), options);
  });
  for (const img of root.querySelectorAll('img')) {
    img.replaceWith(span('doc-image', options.imageNotShown(img.getAttribute('alt') ?? '')));
  }
  for (const cell of root.querySelectorAll('[style]')) {
    const align = /text-align:\s*(left|center|right)/.exec(cell.getAttribute('style') ?? '')?.[1];
    cell.removeAttribute('style');
    if (align) cell.className = `align-${align}`;
  }
  [...root.querySelectorAll('table')].forEach((table, i) => {
    const region = document.createElement('div');
    region.className = 'doc-table';
    region.setAttribute('role', 'region');
    region.setAttribute('tabindex', '0');
    region.setAttribute('aria-label', options.tableLabel(i + 1));
    region.dataset.docTable = String(i);
    table.replaceWith(region);
    region.append(table);
  });
  const container = document.createElement('div');
  container.append(root);
  return DOMPurify.sanitize(container.innerHTML, {
    ALLOWED_TAGS: PAGE_TAGS,
    ALLOWED_ATTR: [
      'href',
      'target',
      'rel',
      'id',
      'class',
      'start',
      'role',
      'tabindex',
      'aria-label',
      'data-doc-nav',
      'data-doc-link',
      'data-doc-mark',
      'data-doc-table',
    ],
    // Labels are text, not URLs: not checked against ALLOWED_URI_REGEXP.
    ADD_URI_SAFE_ATTR: ['aria-label'],
    ALLOW_DATA_ATTR: false,
    // DOMPurify checks every attribute value with it: no scheme but http(s) (W3-32).
    ALLOWED_URI_REGEXP: /^(?:https?:|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}
