/**
 * A rendered Markdown article (the output of `docs/render.ts`, DOMPurify last), shared by the
 * Documentation view and the Directives view (task-019): its content is set outside React so that
 * a new link classification keeps the focus, the heading of the URL fragment takes the focus, and
 * the clicks on its in-UI links are routed without a reload.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type MouseEvent, type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { headingId, type FinishOptions } from './render.js';

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

/** The heading the URL fragment names: its slug (`#key-decisions`) or a `doc-` id as rendered. */
function focusFragment(article: HTMLElement | null, fragment: string): boolean {
  return focusById(article, headingId(fragment)) || (fragment.startsWith('doc-') && focusById(article, fragment));
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
  if (key === undefined) return;
  const again = key === '' ? null : article.querySelector<HTMLElement>(key);
  if (again && (again.tabIndex >= 0 || again.id)) {
    if (again.id && again.tabIndex < 0) again.setAttribute('tabindex', '-1');
    again.focus({ preventScroll: true });
  } else article.focus({ preventScroll: true });
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
  /** The article's accessible name. */
  label: string;
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
export function RenderedArticle({ html, label, pageKey, hash, hrefOf, onNavigate }: RenderedArticleProps): ReactNode {
  const article = useRef<HTMLElement>(null);
  const shown = html !== '';

  // The content is set here, not by React, so that a new classification keeps the focus
  // (replaceContent). DOMPurify ran last in finishDocument (adr-002, W3-29).
  useLayoutEffect(() => {
    if (article.current) replaceContent(article.current, html);
  }, [html]);

  // The heading named by the URL fragment, else the article when the focus was lost (e.g. after
  // following a link of the previous page).
  useEffect(() => {
    if (!shown) return;
    if (hash !== '' && focusFragment(article.current, decoded(hash))) return;
    const active = document.activeElement;
    if (active === null || active === document.body) article.current?.focus();
  }, [shown, pageKey, hash]);

  const onClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const a = event.target instanceof Element ? event.target.closest('a') : null;
      if (!a || a.dataset.docNav === undefined) return;
      event.preventDefault();
      const href = a.getAttribute('href') ?? '';
      // The URL already shown (the same in-page anchor again): no navigation happens, so the
      // heading is focused here.
      const target = new URL(href, window.location.origin);
      const here = new URL(hrefOf(decoded(hash)), window.location.origin);
      if (hash !== '' && target.pathname === here.pathname && target.hash === here.hash) {
        focusFragment(article.current, decoded(hash));
        return;
      }
      onNavigate(href);
    },
    [onNavigate, hrefOf, hash],
  );

  if (!shown) return null;
  // The links inside are native anchors; the handler only routes their clicks (keyboard Enter
  // fires a click too).
  return <article ref={article} className="doc-article" aria-label={label} tabIndex={-1} onClick={onClick} />;
}
