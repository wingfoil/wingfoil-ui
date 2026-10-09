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
 */
import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import type { LinkClass, RefusalMark } from './links.js';

const markdown = new MarkdownIt('default', { html: false, linkify: true, typographer: false });

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

/** Markdown → sanitised HTML (step 1). */
export function markdownToSafeHtml(source: string): string {
  return DOMPurify.sanitize(markdown.render(source), {
    ALLOWED_TAGS: MARKDOWN_TAGS,
    // `style` only for the cell alignment markdown-it writes; turned into a class in step 2.
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'start', 'style'],
    ALLOW_DATA_ATTR: false,
  });
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
}

/** The in-UI URL of a document of project `pid` (each path segment encoded). */
export function documentHref(pid: string, path: string, fragment = ''): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `/p/${encodeURIComponent(pid)}/docs/${encoded}${fragment ? `#${encodeURIComponent(fragment)}` : ''}`;
}

/** The id of the heading `fragment` points at. */
export function headingId(fragment: string): string {
  return `doc-${slug(fragment)}`;
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
function rewriteHeadings(root: DocumentFragment): void {
  const used = new Set<string>();
  for (const h of root.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    const base = slug(h.textContent ?? '');
    let id = base;
    for (let n = 1; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    h.id = `doc-${id}`;
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
      if (link.kind === 'refused') parts.push(document.createTextNode(' '), span('doc-link-mark', options.marks[link.mark]));
      a.replaceWith(...parts);
      return;
    }
  }
}

/** Rewrite and finally sanitise the output of {@link markdownToSafeHtml} (step 2). */
export function finishDocument(safeHtml: string, options: FinishOptions): string {
  const root = inert(safeHtml).content;
  rewriteHeadings(root);
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
      'data-doc-table',
    ],
    // Labels are text, not URLs: not checked against ALLOWED_URI_REGEXP.
    ADD_URI_SAFE_ATTR: ['aria-label'],
    ALLOW_DATA_ATTR: false,
    // DOMPurify checks every attribute value with it: no scheme but http(s) (W3-32).
    ALLOWED_URI_REGEXP: /^(?:https?:|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}
