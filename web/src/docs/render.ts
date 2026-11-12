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

const COMMENT_OPEN = '<!--';
const COMMENT_CLOSE = '-->';

/**
 * A comment block (task-078, D78-3): a line that starts with `<!--` (up to three spaces in), through
 * the line holding `-->` (CommonMark's HTML block type 2), or to the end when it is never closed (as
 * the v0.1 summary did). Nothing is emitted: the input is only dropped, never turned into markup.
 */
function commentBlock(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  if (state.sCount[startLine]! - state.blkIndent >= 4) return false;
  const start = state.bMarks[startLine]! + state.tShift[startLine]!;
  if (!state.src.startsWith(COMMENT_OPEN, start)) return false;
  if (silent) return true;
  let line = startLine;
  for (; line < endLine; line++) {
    const from = line === startLine ? start + 2 : state.bMarks[line]!;
    const text = state.src.slice(from, state.eMarks[line]);
    if (text.includes(COMMENT_CLOSE)) break;
  }
  state.line = Math.min(line + 1, endLine);
  return true;
}

/** An inline comment `<!--` … `-->` in a run of text (code spans are consumed before, D78-3). */
function commentInline(state: StateInline, _silent: boolean): boolean {
  if (!state.src.startsWith(COMMENT_OPEN, state.pos)) return false;
  const close = state.src.indexOf(COMMENT_CLOSE, state.pos + 2);
  const end = close < 0 || close + COMMENT_CLOSE.length > state.posMax ? state.posMax : close + COMMENT_CLOSE.length;
  state.pos = end;
  return true;
}

/** markdown-it as {@link markdown}, with the HTML comments left out (an element's document). */
export const commentFreeMarkdown = new MarkdownIt('default', OPTIONS);
commentFreeMarkdown.block.ruler.before('paragraph', 'comment_drop', commentBlock, {
  alt: ['paragraph', 'reference', 'blockquote'],
});
commentFreeMarkdown.inline.ruler.before('text', 'comment_drop', commentInline);

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
