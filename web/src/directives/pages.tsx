/**
 * One directive (US-R-06 R-06.3, US-G-02 G-02.2; W3-41, W3-42), loaded on first use: "←
 * Directives", the title, id, path and bound roles, and the body rendered by `docs/render.ts`
 * (markdown-it with `html: false`, DOMPurify last). Links: `http(s)` in a new tab, in-page anchors,
 * another directive on its page; any other repository path "not shown in the UI", no request.
 */
import { useQuery } from '@tanstack/react-query';
import { getRouteApi, Link, useLocation, useRouter } from '@tanstack/react-router';
import { useCallback, useMemo, type ReactNode } from 'react';
import { FormattedMessage } from 'react-intl';
import { directivesQuery, projectHeaderQuery } from '../api/queries.js';
import { RulesError } from '../dna/DnaView.js';
import { RenderedArticle, useRenderTexts } from '../docs/RenderedArticle.js';
import { finishDocument, markdownToSafeHtml, type FinishOptions } from '../docs/render.js';
import { useProjectName } from '../routes/dna.js';
import { directiveQuery } from '../routes/directives.js';
import { TITLES, usePageTitle } from '../shell/page-title.js';
import { DirectiveRoles } from './DirectiveList.js';
import { classifyDirectiveLink, directiveHref, directiveRepoPath } from './model.js';
import '../docs/docs.css';
import '../dna/rules.css';

const pageApi = getRouteApi('/p/$pid/directives/$did');

export function DirectivePage(): ReactNode {
  const { pid, did } = pageApi.useParams();
  const hash = useLocation({ select: (l) => l.hash });
  const router = useRouter();
  usePageTitle(TITLES.projectView, { project: useProjectName(pid), view: did });
  const detail = useQuery(directiveQuery(pid, did));
  const list = useQuery(directivesQuery(pid));
  const header = useQuery(projectHeaderQuery(pid));
  const texts = useRenderTexts();
  const entry = detail.data?.entry;
  const path = entry ? directiveRepoPath(entry) : '';
  // Other directives by repository path (the list, once read): their links open in the UI. Until
  // the list answers, the repository links wait (review F3); a failed list leaves none to open.
  const byPath = useMemo(
    () =>
      list.data === undefined && list.error === null
        ? undefined
        : new Map((list.data?.entries ?? []).map((e) => [directiveRepoPath(e), e.frontmatter.id])),
    [list.data, list.error],
  );
  const safeHtml = useMemo(() => (detail.data ? markdownToSafeHtml(detail.data.body) : ''), [detail.data]);
  const options = useMemo<FinishOptions>(
    () => ({
      pid,
      documentPath: path,
      classify: (href) => classifyDirectiveLink(href, path, byPath),
      hrefOf: (target, fragment) => directiveHref(pid, target === path ? did : (byPath?.get(target) ?? did), fragment),
      ...texts,
    }),
    [pid, did, path, byPath, texts],
  );
  const html = useMemo(() => (safeHtml === '' ? '' : finishDocument(safeHtml, options)), [safeHtml, options]);
  const hrefOf = useCallback((fragment: string) => directiveHref(pid, did, fragment), [pid, did]);
  const navigate = useCallback((href: string) => void router.navigate({ href }), [router]);
  const current = header.data?.roleView ?? header.data?.roleViews[0] ?? null;
  return (
    <div className="page rules directive-page">
      <div className="docs-toolbar">
        <Link className="button" to="/p/$pid/directives" params={{ pid }}>
          <FormattedMessage id="directives.page.back" />
        </Link>
        {entry && <span className="docs-path">{path}</span>}
      </div>
      {detail.error ? (
        <RulesError error={detail.error} />
      ) : entry && detail.data ? (
        <>
          <div className="rules-head">
            {/* A body that starts with its own title keeps the page's only level-1 heading. */}
            {!/^<h1[\s>]/.test(safeHtml.trim()) && <h1 className="page-title">{detail.data.frontmatter.title}</h1>}
            <span className="rules-path">{entry.frontmatter.id}</span>
            <DirectiveRoles entry={{ ...entry, mine: false }} current={current} />
          </div>
          <RenderedArticle
            html={html}
            label={detail.data.frontmatter.title}
            pageKey={did}
            hash={hash}
            hrefOf={hrefOf}
            onNavigate={navigate}
          />
        </>
      ) : (
        <p className="muted" role="status">
          <FormattedMessage id="directives.page.loading" />
        </p>
      )}
    </div>
  );
}
