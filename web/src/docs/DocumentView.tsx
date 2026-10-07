/**
 * A document rendered inside the UI (US-R-08 R-08.2/R-08.3, US-R-09; ux-reference §4.9): "← Index",
 * the document's path and the article rendered by `docs/render.ts` (sanitised by DOMPurify last).
 * Links classified by `docs/links.ts`: a document or a Memory file opens in the UI through the
 * router (no reload), an external link in a new tab, a refused link is marked and opens nothing.
 * "Open on GitHub" is deferred (W3-34).
 */
import type { UseQueryResult } from '@tanstack/react-query';
import type { FileContent } from '@wingfoil-ui/contracts';
import { useCallback, useEffect, useMemo, useRef, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-aria-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { classifyLink, resolveLink, type LinkLookup } from './links.js';
import { QueryError, refusedKind } from './QueryError.js';
import { documentLinks, finishDocument, headingId, markdownToSafeHtml, type FinishOptions } from './render.js';
import './docs.css';

/** While the index is loading every repository link waits. */
const WAITING: LinkLookup = { documents: new Set(), elements: undefined, probes: new Map() };

/** Props of {@link DocumentView}. */
export interface DocumentViewProps {
  pid: string;
  /** The document's repository path. */
  path: string;
  /** The URL fragment (a heading of the document), without `#`. */
  hash: string;
  content: Pick<UseQueryResult<FileContent>, 'data' | 'error'>;
  /** The content as sanitised HTML ({@link useDocumentHtml}). */
  safeHtml: string;
  /** What the links are classified against; `undefined` while the index loads. */
  lookup: LinkLookup | undefined;
  /** Open an in-UI URL (a document or an element panel) without reloading the page. */
  onNavigate(href: string): void;
  /** The in-UI URL of the index. */
  indexHref: string;
}

/** The document `markdown` as sanitised HTML (step 1 of `docs/render.ts`), `''` while absent. */
export function useDocumentHtml(markdown: string | undefined): string {
  return useMemo(() => (markdown === undefined ? '' : markdownToSafeHtml(markdown)), [markdown]);
}

/** The links of `safeHtml` resolved against `path`. */
export function useResolvedLinks(safeHtml: string, path: string) {
  return useMemo(() => documentLinks(safeHtml).map((href) => resolveLink(href, path)), [safeHtml, path]);
}

/** Move the focus to the heading `id` of `article` and show it. */
function focusHeading(article: HTMLElement | null, id: string): boolean {
  const target = article?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
  if (!target) return false;
  target.setAttribute('tabindex', '-1');
  target.focus();
  target.scrollIntoView?.({ block: 'start' });
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

/** The document page's content. */
export function DocumentView({
  pid,
  path,
  hash,
  content,
  safeHtml,
  lookup,
  onNavigate,
  indexHref,
}: DocumentViewProps): ReactNode {
  const intl = useIntl();
  const article = useRef<HTMLElement>(null);
  const options = useMemo<FinishOptions>(() => {
    const current = lookup ?? WAITING;
    return {
      pid,
      classify: (href) => classifyLink(resolveLink(href, path), current),
      marks: {
        broken: intl.formatMessage({ id: 'docs.link.broken' }),
        outside: intl.formatMessage({ id: 'docs.link.outside' }),
        hidden: intl.formatMessage({ id: 'docs.link.hidden' }),
        unsupported: intl.formatMessage({ id: 'docs.link.unsupported' }),
      },
      newTab: intl.formatMessage({ id: 'docs.link.newTab' }),
      imageNotShown: (alt) => intl.formatMessage({ id: 'docs.image.notShown' }, { alt }),
      tableLabel: (number) => intl.formatMessage({ id: 'docs.table.label' }, { number }),
    };
  }, [intl, lookup, path, pid]);
  const html = useMemo(() => (safeHtml === '' ? '' : finishDocument(safeHtml, options)), [safeHtml, options]);
  const shown = html !== '';

  // A heading named by the URL fragment, else the article when the focus was lost (e.g. after
  // following a link of the previous document).
  useEffect(() => {
    if (!shown) return;
    if (hash !== '' && focusHeading(article.current, headingId(decoded(hash)))) return;
    const active = document.activeElement;
    if (active === null || active === document.body) article.current?.focus();
  }, [shown, path, hash]);

  const onClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const a = event.target instanceof Element ? event.target.closest('a') : null;
      if (!a) return;
      if (a.dataset.docAnchor !== undefined) {
        event.preventDefault();
        focusHeading(article.current, a.dataset.docAnchor);
      } else if (a.dataset.docNav !== undefined) {
        event.preventDefault();
        onNavigate(a.getAttribute('href') ?? '');
      }
    },
    [onNavigate],
  );

  const kind = refusedKind(content.error);
  return (
    <div className="page docs-document">
      <div className="docs-toolbar">
        <Link className="button" href={indexHref}>
          <FormattedMessage id="docs.document.back" />
        </Link>
        <span className="docs-path">{path}</span>
      </div>
      {kind !== undefined && (
        <p role="alert" className="docs-error">
          <FormattedMessage id="docs.document.refused" values={{ kind }} />
        </p>
      )}
      {content.error && kind === undefined && <QueryError error={content.error} />}
      {!content.data && !content.error && (
        <p role="status">
          <FormattedMessage id="docs.document.loading" />
        </p>
      )}
      {shown && (
        // The links inside are native anchors; the handler only routes their clicks (keyboard
        // Enter fires a click too).
        <article
          ref={article}
          className="doc-article"
          aria-label={path}
          tabIndex={-1}
          onClick={onClick}
          // Sanitised by DOMPurify as the last step of finishDocument (adr-002, W3-29).
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}
