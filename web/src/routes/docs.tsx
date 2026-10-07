/**
 * The Documentation view (US-R-08, US-R-09; ux-reference §2 *Rules and context*, §4.9):
 * `/p/$pid/docs` (the index) and `/p/$pid/docs/<repository path>` (a document, the splat). Reads:
 * `GET /docs`, `GET /files/content?path=` of the document; only when the document links to
 * repository paths outside the index, `GET /elements` (Memory files open their element panel) and
 * `GET /files/content` once per remaining distinct target (W3-30: the server says served, missing,
 * outside or not shown). Every key sits under `['p', pid]`: a `repo` event refreshes the open page.
 */
import type { DocumentationIndex, FileContent } from '@wingfoil-ui/contracts';
import { queryOptions, useQueries, useQuery } from '@tanstack/react-query';
import { createRoute, Outlet, useLocation, useRouter } from '@tanstack/react-router';
import { useCallback, useMemo, type ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { apiGet } from '../api/client.js';
import { elementsQuery, projectsQuery } from '../api/queries.js';
import { queryKeys } from '../api/query-keys.js';
import { DocsIndex } from '../docs/DocsIndex.js';
import { DocumentView, useDocumentHtml, useResolvedLinks } from '../docs/DocumentView.js';
import type { LinkLookup, ProbeAnswer } from '../docs/links.js';
import { refusedKind } from '../docs/QueryError.js';
import { TITLES, usePageTitle } from '../shell/page-title.js';
import { NAV_ORDER } from './nav.js';
import { projectRoute } from './project.js';

const LABELS = defineMessages({ nav: { id: 'shell.nav.documentation' } });

/** Query keys of the Documentation view (on `queryKeys.project`, refreshed by `repo`). */
export const docsKeys = {
  index: (pid: string) => queryKeys.project(pid, 'docs'),
  content: (pid: string, path: string) => queryKeys.project(pid, 'docs', 'content', path),
};

/** `GET /api/p/:pid/docs`. */
export function docsIndexQuery(pid: string) {
  return queryOptions({
    queryKey: docsKeys.index(pid),
    queryFn: ({ signal }) => apiGet<DocumentationIndex>(`/api/p/${encodeURIComponent(pid)}/docs`, signal),
  });
}

/** `GET /api/p/:pid/files/content?path=`: a document, or why the path is refused. */
export function documentContentQuery(pid: string, path: string) {
  return queryOptions({
    queryKey: docsKeys.content(pid, path),
    queryFn: ({ signal }) =>
      apiGet<FileContent>(`/api/p/${encodeURIComponent(pid)}/files/content?path=${encodeURIComponent(path)}`, signal),
  });
}

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

function DocsIndexPage(): ReactNode {
  const { pid } = docsRoute.useParams();
  const intl = useIntl();
  usePageTitle(TITLES.projectView, { project: useProjectName(pid), view: intl.formatMessage(LABELS.nav) });
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
  const toProbe = elements ? outsideIndex.filter((p) => !elements.has(p)) : [];
  const probes = useQueries({
    queries: toProbe.map((p) => documentContentQuery(pid, p)),
    combine: (results) => {
      const answers = new Map<string, ProbeAnswer>();
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

function DocumentPage(): ReactNode {
  const { pid, _splat } = documentRoute.useParams();
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

/** `/p/$pid/docs`: the view's layout (its sidebar entry). */
const docsRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: 'docs',
  component: Outlet,
  staticData: { nav: { group: 'rules', order: NAV_ORDER.documentation, label: LABELS.nav } },
});

/** `/p/$pid/docs/`: the index. */
const docsIndexRoute = createRoute({ getParentRoute: () => docsRoute, path: '/', component: DocsIndexPage });

/** `/p/$pid/docs/<path>`: a document. */
const documentRoute = createRoute({ getParentRoute: () => docsRoute, path: '$', component: DocumentPage });

/** The Documentation routes, for `PROJECT_ROUTES`. */
export const documentationRoute = docsRoute.addChildren([docsIndexRoute, documentRoute]);
