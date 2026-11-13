/**
 * A rendered Markdown article (the output of `docs/render.ts`, DOMPurify last), shared by the
 * Documentation view, the Directives view (task-019) and the element's summary and document
 * (task-078): its content is set outside React so that a new link classification keeps the focus,
 * the heading of the URL fragment takes the focus, and the clicks on its in-UI links are routed
 * without a reload.
 *
 * A new classification keeps the anchors (bug-043, task-078 D78-1): when only the link groups
 * changed, each changed group is replaced by its copy from the new sanitised output and every other
 * node — a link being clicked included — stays the same element; any other change sets the whole
 * content again.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type MouseEvent, type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { HEADING_PREFIX, headingId, type FinishOptions } from './render.js';

/** The catalogue texts {@link finishDocument} writes into an article. */
export type RenderTexts = Pick<FinishOptions, 'marks' | 'newTab' | 'imageNotShown' | 'tableLabel'>;

/** The catalogue texts of a rendered article. */
export function useRenderTexts(): RenderTexts {
  const intl = useIntl();
  return useMemo(
    () => ({
      marks: {
        broken: intl.formatMessage({ id: 'docs.link.broken' }),
        outside: intl.formatMessage({ id: 'docs.link.outside' }),
        hidden: intl.formatMessage({ id: 'docs.link.hidden' }),
        unsupported: intl.formatMessage({ id: 'docs.link.unsupported' }),
      },
      newTab: intl.formatMessage({ id: 'docs.link.newTab' }),
      imageNotShown: (alt) => intl.formatMessage({ id: 'docs.image.notShown' }, { alt }),
      tableLabel: (number) => intl.formatMessage({ id: 'docs.table.label' }, { number }),
    }),
    [intl],
  );
}

/** Move the focus to the element `id` of `article` (a heading: made focusable) and show it. */
function focusById(article: HTMLElement | null, id: string, scroll = true): boolean {
  const target = article?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
  if (!target) return false;
  target.setAttribute('tabindex', '-1');
  target.focus();
  if (scroll) target.scrollIntoView?.({ block: 'start' });
  return true;
}

/** The heading the URL fragment names: its slug (`#key-decisions`) or a prefixed id as rendered. */
function focusFragment(article: HTMLElement | null, fragment: string, prefix = HEADING_PREFIX): boolean {
  return focusById(article, headingId(fragment, prefix)) || (fragment.startsWith(prefix) && focusById(article, fragment));
}

/** A selector finding the focused element of `article` again after its content is rebuilt. */
function focusKey(article: HTMLElement): string | undefined {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !article.contains(active)) return undefined;
  if (active === article) return '';
  if (active.dataset.docLink !== undefined) return `[data-doc-link="${CSS.escape(active.dataset.docLink)}"]`;
  if (active.dataset.docTable !== undefined) return `[data-doc-table="${CSS.escape(active.dataset.docTable)}"]`;
  return active.id ? `#${CSS.escape(active.id)}` : undefined;
}

/**
 * Put `html` into `article`, keeping the focus where it was: the links are classified as their
 * answers arrive (index, elements, server checks), and each new classification rebuilds the
 * content. A link that became refused is no longer focusable: the article takes the focus.
 */
function replaceContent(article: HTMLElement, html: string): void {
  const key = focusKey(article);
  article.innerHTML = html;
  restoreFocus(article, key);
}

/** Give the focus back to the element of `key` (see {@link focusKey}), else to the article. */
function restoreFocus(article: HTMLElement, key: string | undefined): void {
  if (key === undefined) return;
  const again = key === '' ? null : article.querySelector<HTMLElement>(key);
  if (again === document.activeElement) return;
  if (again && (again.tabIndex >= 0 || again.id)) {
    if (again.id && again.tabIndex < 0) again.setAttribute('tabindex', '-1');
    again.focus({ preventScroll: true });
  } else article.focus({ preventScroll: true });
}

/** An inert copy of the finished `html` (already sanitised: nothing loads, nothing runs). */
function inert(html: string): DocumentFragment {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

/**
 * The nodes of link group `key` in `root`: the link (or its refused or waiting text) and, for a
 * refused link, the space and the mark after it (`data-doc-mark`, D78-1).
 */
function groupNodes(root: ParentNode, key: string): Node[] {
  const link = root.querySelector(`[data-doc-link="${CSS.escape(key)}"]`);
  if (!link) return [];
  const nodes: Node[] = [link];
  const mark = root.querySelector(`[data-doc-mark="${CSS.escape(key)}"]`);
  if (mark) {
    const space = mark.previousSibling;
    if (space?.nodeType === Node.TEXT_NODE && space.previousSibling === link) nodes.push(space);
    nodes.push(mark);
  }
  return nodes;
}

/** The keys of the link groups of `root`, in document order. */
function groupKeys(root: ParentNode): string[] {
  return [...root.querySelectorAll<HTMLElement>('[data-doc-link]')].map((el) => el.dataset.docLink ?? '');
}

/** The HTML of `nodes`. */
function serialise(nodes: readonly Node[]): string {
  return nodes.map((n) => (n instanceof Element ? n.outerHTML : (n.textContent ?? ''))).join('');
}

/** `root`'s HTML with every link group replaced by an empty placeholder of its key. */
function frame(root: DocumentFragment): string {
  const copy = root.cloneNode(true) as DocumentFragment;
  for (const key of groupKeys(copy)) {
    const nodes = groupNodes(copy, key);
    const placeholder = document.createElement('span');
    placeholder.dataset.docLink = key;
    (nodes[0] as Element).replaceWith(placeholder);
    for (const n of nodes.slice(1)) n.parentNode?.removeChild(n);
  }
  const container = document.createElement('div');
  container.append(copy);
  return container.innerHTML;
}

/**
 * Update `article` from `previous` to `next` in place when only link groups differ (D78-1): each
 * changed group is replaced by its nodes from `next`'s sanitised output. False (nothing changed)
 * when anything else differs or a group is not found in the article: the caller sets the content.
 */
function patchLinks(article: HTMLElement, previous: string, next: string): boolean {
  const before = inert(previous);
  const after = inert(next);
  if (frame(before) !== frame(after)) return false;
  const changes: { live: Node[]; nodes: Node[] }[] = [];
  for (const key of groupKeys(after)) {
    const nodes = groupNodes(after, key);
    if (serialise(nodes) === serialise(groupNodes(before, key))) continue;
    const live = groupNodes(article, key);
    if (live.length === 0) return false;
    changes.push({ live, nodes });
  }
  if (changes.length === 0) return true;
  const focus = focusKey(article);
  for (const { live, nodes } of changes) {
    (live[0] as Element).replaceWith(...nodes.map((n) => document.importNode(n, true)));
    for (const n of live.slice(1)) n.parentNode?.removeChild(n);
  }
  restoreFocus(article, focus);
  return true;
}

/** `text` percent-decoded when it can be. */
function decoded(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** Props of {@link RenderedArticle}. */
export interface RenderedArticleProps {
  /** The finished, sanitised HTML; nothing is rendered while it is `''`. */
  html: string;
  /** The article's accessible name (none for a `div`). */
  label?: string;
  /** The element: an `article` (default), or a `div` for a fragment such as a summary (task-078). */
  as?: 'article' | 'div';
  /** Extra classes of the element. */
  className?: string;
  /** Whether the article takes a focus lost to the page when it is shown (default true). */
  focusOnShow?: boolean;
  /** The prefix of the heading ids of {@link FinishOptions.headingPrefix} (default `doc-`). */
  headingPrefix?: string;
  /**
   * An in-page anchor (`#fragment`) selected: the article routes no navigation and calls this
   * instead (task-078, D78-5); `'focus'` moves the focus to the heading inside this article.
   */
  onAnchor?: 'focus' | ((fragment: string) => void);
  /** What is shown (a path or an id): a new one moves the focus as a new page does. */
  pageKey: string;
  /** The URL fragment (a heading), without `#`. */
  hash: string;
  /** The in-UI URL of this article with `fragment`. */
  hrefOf(fragment: string): string;
  /** Open an in-UI URL without reloading the page. */
  onNavigate(href: string): void;
}

/** The article. */
export function RenderedArticle({
  html,
  label,
  as = 'article',
  className,
  focusOnShow = true,
  headingPrefix = HEADING_PREFIX,
  onAnchor,
  pageKey,
  hash,
  hrefOf,
  onNavigate,
}: RenderedArticleProps): ReactNode {
  const article = useRef<HTMLElement>(null);
  /** The element and the HTML last set in it (D78-1 compares with it, not with the live DOM). */
  const last = useRef<{ element: HTMLElement; html: string } | undefined>(undefined);
  const shown = html !== '';

  // The content is set here, not by React, so that a new classification keeps the focus and the
  // anchors (patchLinks, else replaceContent). DOMPurify ran last in finishDocument (adr-002, W3-29).
  useLayoutEffect(() => {
    const element = article.current;
    if (!element) {
      last.current = undefined;
      return;
    }
    const previous = last.current?.element === element ? last.current.html : undefined;
    if (previous !== html && (previous === undefined || !patchLinks(element, previous, html))) {
      replaceContent(element, html);
    }
    last.current = { element, html };
  }, [html]);

  // The heading named by the URL fragment, else the article when the focus was lost (e.g. after
  // following a link of the previous page).
  useEffect(() => {
    if (!shown) return;
    if (hash !== '' && focusFragment(article.current, decoded(hash), headingPrefix)) return;
    if (!focusOnShow) return;
    const active = document.activeElement;
    if (active === null || active === document.body) article.current?.focus();
  }, [shown, pageKey, hash, headingPrefix, focusOnShow]);

  const onClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const a = event.target instanceof Element ? event.target.closest('a') : null;
      if (!a || a.dataset.docNav === undefined) return;
      event.preventDefault();
      const href = a.getAttribute('href') ?? '';
      // An in-page anchor of an embedded article (task-078): no navigation.
      if (onAnchor !== undefined && href.startsWith('#')) {
        const fragment = decoded(href.slice(1));
        if (onAnchor === 'focus') focusFragment(article.current, fragment, headingPrefix);
        else onAnchor(fragment);
        return;
      }
      // The URL already shown (the same in-page anchor again): no navigation happens, so the
      // heading is focused here.
      const target = new URL(href, window.location.origin);
      const here = new URL(hrefOf(decoded(hash)), window.location.origin);
      if (hash !== '' && target.pathname === here.pathname && target.hash === here.hash) {
        focusFragment(article.current, decoded(hash), headingPrefix);
        return;
      }
      onNavigate(href);
    },
    [onNavigate, hrefOf, hash, onAnchor, headingPrefix],
  );

  if (!shown) return null;
  // The links inside are native anchors; the handler only routes their clicks (keyboard Enter
  // fires a click too).
  const classes = className ? `doc-article ${className}` : 'doc-article';
  if (as === 'div') {
    return <div ref={(el) => void (article.current = el)} className={classes} tabIndex={-1} onClick={onClick} />;
  }
  return <article ref={article} className={classes} aria-label={label} tabIndex={-1} onClick={onClick} />;
}
