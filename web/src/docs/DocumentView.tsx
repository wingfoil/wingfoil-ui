/**
 * A document rendered inside the UI (US-R-08 R-08.2/R-08.3, US-R-09; ux-reference §4.9): "← Index",
 * the document's path and the article rendered by `docs/render.ts` (sanitised by DOMPurify last).
 * Links classified by `docs/links.ts`: a document or a Memory file opens in the UI through the
 * router (no reload), an external link in a new tab, a refused link is marked and opens nothing.
 * "Open on GitHub" is deferred (W3-34).
 */
import type { UseQueryResult } from '@tanstack/react-query';
import type { FileContent } from '@wingfoil-ui/contracts';
import { useCallback, useMemo, type ReactNode } from 'react';
import { Link } from 'react-aria-components';
import { FormattedMessage } from 'react-intl';
import { classifyLink, resolveLink, type LinkLookup } from './links.js';
import { QueryError, refusedKind } from './QueryError.js';
import { documentHref, documentLinks, finishDocument, markdownToSafeHtml, type FinishOptions } from './render.js';
import { RenderedArticle, useRenderTexts } from './RenderedArticle.js';
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
  const texts = useRenderTexts();
  const options = useMemo<FinishOptions>(() => {
    const current = lookup ?? WAITING;
    return {
      pid,
      documentPath: path,
      classify: (href) => classifyLink(resolveLink(href, path), current),
      ...texts,
    };
  }, [texts, lookup, path, pid]);
  const html = useMemo(() => (safeHtml === '' ? '' : finishDocument(safeHtml, options)), [safeHtml, options]);
  const hrefOf = useCallback((fragment: string) => documentHref(pid, path, fragment), [pid, path]);

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
      <RenderedArticle html={html} label={path} pageKey={path} hash={hash} hrefOf={hrefOf} onNavigate={onNavigate} />
    </div>
  );
}
