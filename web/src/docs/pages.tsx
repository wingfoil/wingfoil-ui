/**
 * The pages of the Documentation view (`routes/docs.tsx`), loaded on first use: the index and a
 * document with what its links are classified against (`docs/link-lookup.ts`, task-078 D78-6: the
 * docs index, `GET /elements` and the server's check of each other repository target, W3-30, at
 * most `MAX_LINK_CHECKS` distinct targets per document, W3-36).
 */
import { useQuery } from '@tanstack/react-query';
import { getRouteApi, useLocation, useRouter } from '@tanstack/react-router';
import { useCallback, type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { DOCS_LABELS, docsIndexQuery, documentContentQuery } from '../routes/docs.js';
import { useProjectTitle } from '../shell/page-title.js';
import { DocsIndex } from './DocsIndex.js';
import { DocumentView, useDocumentHtml } from './DocumentView.js';
import { useLinkLookup } from './link-lookup.js';

/** Distinct repository targets of one document checked with the server (W3-36). */
export { MAX_LINK_CHECKS } from './link-lookup.js';

const indexApi = getRouteApi('/p/$pid/docs/');
const documentApi = getRouteApi('/p/$pid/docs/$');

export function DocsIndexPage(): ReactNode {
  const { pid } = indexApi.useParams();
  const intl = useIntl();
  useProjectTitle(pid, intl.formatMessage(DOCS_LABELS.nav));
  return <DocsIndex pid={pid} index={useQuery(docsIndexQuery(pid))} />;
}

export function DocumentPage(): ReactNode {
  const { pid, _splat } = documentApi.useParams();
  const path = _splat ?? '';
  const hash = useLocation({ select: (l) => l.hash });
  const router = useRouter();
  const intl = useIntl();
  const content = useQuery(documentContentQuery(pid, path));
  // The document's label is the view (project data, W5-5): the path as the server escaped it
  // (task-072 D72-6) — the view's name until it is read, never the raw path.
  useProjectTitle(pid, content.data?.label ?? intl.formatMessage(DOCS_LABELS.nav));
  const safeHtml = useDocumentHtml(content.data?.content);
  const lookup = useLinkLookup(pid, path, safeHtml);
  const navigate = useCallback((href: string) => void router.navigate({ href }), [router]);
  return (
    <DocumentView
      pid={pid}
      path={path}
      hash={hash}
      content={content}
      safeHtml={safeHtml}
      lookup={lookup}
      onNavigate={navigate}
      indexHref={`/p/${encodeURIComponent(pid)}/docs`}
    />
  );
}

