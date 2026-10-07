/**
 * The pages of the Documentation view (`routes/docs.tsx`), loaded on first use: the index and a
 * document with what its links are classified against — the docs index, `GET /elements` and the
 * server's check of each other repository target (W3-30), at most {@link MAX_LINK_CHECKS} distinct
 * targets per document (W3-36; the others are "not shown in the UI").
 */
import { useQueries, useQuery } from '@tanstack/react-query';
import { getRouteApi, useLocation, useRouter } from '@tanstack/react-router';
import { useCallback, useMemo, type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { elementsQuery, projectsQuery } from '../api/queries.js';
import { DOCS_LABELS, docsIndexQuery, documentContentQuery } from '../routes/docs.js';
import { TITLES, usePageTitle } from '../shell/page-title.js';
import { DocsIndex } from './DocsIndex.js';
import { DocumentView, useDocumentHtml, useResolvedLinks } from './DocumentView.js';
import type { LinkLookup, ProbeAnswer } from './links.js';
import { refusedKind } from './QueryError.js';

/** Distinct repository targets of one document checked with the server (W3-36). */
export const MAX_LINK_CHECKS = 100;

const indexApi = getRouteApi('/p/$pid/docs/');
const documentApi = getRouteApi('/p/$pid/docs/$');

/** The server's answer for a probed path, from its content query. */
function probeAnswer(result: { data?: unknown; error: unknown }): ProbeAnswer | undefined {
  if (result.data !== undefined) return 'served';
  if (!result.error) return undefined;
  const kind = refusedKind(result.error);
  return kind === 'missing' || kind === 'outside' ? kind : 'hidden';
}

/** The project's name for the page title (the pid until the list is loaded). */
function useProjectName(pid: string): string {
  return useQuery(projectsQuery()).data?.projects.find((p) => p.id === pid)?.name ?? pid;
}

export function DocsIndexPage(): ReactNode {
  const { pid } = indexApi.useParams();
  const intl = useIntl();
  usePageTitle(TITLES.projectView, { project: useProjectName(pid), view: intl.formatMessage(DOCS_LABELS.nav) });
  return <DocsIndex pid={pid} index={useQuery(docsIndexQuery(pid))} />;
}

/** What the links of the document at `path` are classified against (`undefined`: index loading). */
function useLinkLookup(pid: string, path: string, safeHtml: string): LinkLookup | undefined {
  const index = useQuery(docsIndexQuery(pid));
  const resolved = useResolvedLinks(safeHtml, path);
  const indexReady = index.data !== undefined || index.error !== null;
  const documents = useMemo(
    () => new Set((index.data?.documents ?? []).map((d) => d.path.normalize('NFC'))),
    [index.data],
  );
  const outsideIndex = useMemo(() => {
    const paths = new Set<string>();
    for (const target of resolved) {
      if (target.kind !== 'path') continue;
      const p = target.path.normalize('NFC');
      if (p !== '' && !documents.has(p)) paths.add(p);
    }
    return [...paths];
  }, [resolved, documents]);
  const elementsAnswer = useQuery({
    ...elementsQuery(pid, false),
    enabled: indexReady && outsideIndex.length > 0,
  });
  const elements = useMemo(() => {
    if (elementsAnswer.data) return new Map(elementsAnswer.data.elements.map((e) => [e.path.normalize('NFC'), e.id]));
    // Without the elements, the Memory links are checked by the server like any path.
    return elementsAnswer.error ? new Map<string, string>() : undefined;
  }, [elementsAnswer.data, elementsAnswer.error]);
  const unknown = elements ? outsideIndex.filter((p) => !elements.has(p)) : [];
  const toProbe = unknown.slice(0, MAX_LINK_CHECKS);
  const overCap = unknown.slice(MAX_LINK_CHECKS);
  const probes = useQueries({
    queries: toProbe.map((p) => documentContentQuery(pid, p)),
    combine: (results) => {
      const answers = new Map<string, ProbeAnswer>(overCap.map((p) => [p, 'hidden']));
      results.forEach((r, i) => {
        const answer = probeAnswer(r);
        if (answer) answers.set(toProbe[i]!, answer);
      });
      return answers;
    },
  });
  const probeKey = [...probes].join('|');
  return useMemo(
    () =>
      !indexReady
        ? undefined
        : outsideIndex.length === 0
          ? { documents, elements: new Map(), probes: new Map() }
          : { documents, elements, probes },
    // `probes` is a new Map on every render: its content (probeKey) decides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [indexReady, documents, elements, outsideIndex.length, probeKey],
  );
}

export function DocumentPage(): ReactNode {
  const { pid, _splat } = documentApi.useParams();
  const path = _splat ?? '';
  const hash = useLocation({ select: (l) => l.hash });
  const router = useRouter();
  usePageTitle(TITLES.projectView, { project: useProjectName(pid), view: path });
  const content = useQuery(documentContentQuery(pid, path));
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

