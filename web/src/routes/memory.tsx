/**
 * The Memory list `/p/$pid/memory` (US-M-01, US-M-02, US-S-25, US-S-26; ux-reference §4.4), the
 * landing view of a project in v0.1: `/p/$pid` redirects here (W3-22; Today takes the index in
 * v0.2). The filters live in the URL (`?type=&state=` or `?bucket=`), so the back navigation from
 * the element panel restores them (W3-23) and a filtered list can be shared.
 *
 * Reads: `GET /config` (the types of `memory.yaml`) and `GET /elements` (non-archived) — the
 * audited Memory list (TT-PERF-05), nothing per row; `GET /elements?archived=true` only once a type
 * is selected (W3-24). Every key sits under `['p', pid]`: the `repo` event refreshes the list
 * (S-26.1, S-25.2).
 */
import { useQuery } from '@tanstack/react-query';
import { createRoute, redirect } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { elementsQuery, projectConfigQuery, projectsQuery } from '../api/queries.js';
import { MemoryList } from '../memory/MemoryList.js';
import { isListedType, typesOf, type ListFilters } from '../memory/model.js';
import { TITLES, usePageTitle } from '../shell/page-title.js';
import { NAV_ORDER } from './nav.js';
import { projectRoute } from './project.js';

const LABELS = defineMessages({ memory: { id: 'shell.nav.memory' } });

/** A search parameter kept when it is a non-empty text. */
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** The list's search parameters: a type and its state, or (all types) a bucket. */
export function memorySearch(search: Record<string, unknown>): ListFilters {
  const type = text(search['type']);
  const state = text(search['state']);
  const bucket = text(search['bucket']);
  if (type !== undefined) return { type, ...(state !== undefined ? { state } : {}) };
  return bucket !== undefined ? { bucket } : {};
}

function MemoryPage(): ReactNode {
  const { pid } = memoryRoute.useParams();
  const filters = memoryRoute.useSearch();
  const intl = useIntl();
  const project = useQuery(projectsQuery()).data?.projects.find((p) => p.id === pid);
  usePageTitle(TITLES.projectView, { project: project?.name ?? pid, view: intl.formatMessage(LABELS.memory) });
  const config = useQuery(projectConfigQuery(pid));
  const elements = useQuery(elementsQuery(pid, false));
  // The archived elements are read once a listed type is selected (W3-24), then kept for the
  // session; a type the project does not list reads nothing more (review F5).
  const settled = elements.data !== undefined && (config.data !== undefined || config.error !== null);
  const listed =
    settled && filters.type !== undefined && isListedType(typesOf(config.data), elements.data.elements, filters.type);
  const archived = useQuery({ ...elementsQuery(pid, true), enabled: listed });
  return (
    <MemoryList
      pid={pid}
      filters={filters}
      config={config}
      elements={elements}
      withArchived={listed ? archived : undefined}
    />
  );
}

/** `/p/$pid/memory`: the Memory list. */
export const memoryRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: 'memory',
  validateSearch: memorySearch,
  component: MemoryPage,
  staticData: { nav: { group: 'work', order: NAV_ORDER.memory, label: LABELS.memory } },
});

/** `/p/$pid`: the project's landing view — the Memory list in v0.1 (W3-22). */
export const projectIndexRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: '/',
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/p/$pid/memory', params, replace: true });
  },
});
