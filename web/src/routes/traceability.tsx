/**
 * Traceability `/p/$pid/traceability` (US-R-01; ux-reference §4.8 v0.3; task-067, D67-1 … D67-3):
 * the sidebar's *Work* entry after Memory. The filters live in the URL (`?scope=project&category=
 * &status=&q=`, D67-2), the open row (task-081) does not.
 *
 * Reads `GET /traceability?scope=current|project` (spec-012 §4) under `['p', pid]`, so the `repo`
 * event refreshes it, and the project header the shell already holds (the *Use preset* link, Q3).
 */
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import { createRoute } from '@tanstack/react-router';
import type { Traceability, TraceabilityScope } from '@wingfoil-ui/contracts';
import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { apiGet } from '../api/client.js';
import { projectHeaderQuery } from '../api/queries.js';
import { queryKeys } from '../api/query-keys.js';
import { useProjectTitle } from '../shell/page-title.js';
import { traceabilitySearch } from '../traceability/model.js';
import { TraceabilityView } from '../traceability/TraceabilityView.js';
import { NAV_ORDER } from './nav.js';
import { projectRoute } from './project.js';

const LABELS = defineMessages({ traceability: { id: 'shell.nav.traceability' } });

/** The query keys of the view (`api/query-keys.ts`: every project key under `['p', pid]`). */
export const traceabilityKeys = {
  answer: (pid: string, scope: TraceabilityScope) => queryKeys.project(pid, 'traceability', { scope }),
};

/** `GET /api/p/:pid/traceability?scope=` (spec-012 §4). */
export function traceabilityQuery(pid: string, scope: TraceabilityScope) {
  return queryOptions({
    queryKey: traceabilityKeys.answer(pid, scope),
    queryFn: ({ signal }) =>
      apiGet<Traceability>(`/api/p/${encodeURIComponent(pid)}/traceability?scope=${scope}`, signal),
  });
}

function TraceabilityPage(): ReactNode {
  const { pid } = traceabilityRoute.useParams();
  // The route's search also carries the layout's keys: the page reads its own (D67-2).
  const filters = traceabilitySearch(traceabilityRoute.useSearch());
  const intl = useIntl();
  useProjectTitle(pid, intl.formatMessage(LABELS.traceability));
  // A scope change keeps the previous answer on screen until the new one arrives (D67-3).
  const answer = useQuery({
    ...traceabilityQuery(pid, filters.scope ?? 'current'),
    placeholderData: keepPreviousData,
  });
  const header = useQuery(projectHeaderQuery(pid));
  return <TraceabilityView pid={pid} filters={filters} answer={answer} header={header.data} />;
}

/** `/p/$pid/traceability`: the Traceability page. */
export const traceabilityRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: 'traceability',
  validateSearch: traceabilitySearch,
  component: TraceabilityPage,
  staticData: { nav: { group: 'work', order: NAV_ORDER.traceability, label: LABELS.traceability } },
});
