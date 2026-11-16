/**
 * The Memory list `/p/$pid/memory` (US-M-01, US-M-02, US-S-25, US-S-26; ux-reference §4.4), the
 * landing view of a project in v0.1 (W3-22); from v0.2 `/p/$pid` opens Today (`routes/today.tsx`,
 * task-036 D36-1). The filters live in the URL (`?type=&state=` or `?bucket=` — from v0.3 with its
 * `&state=`; `?missing=refs`; `?figure=<code>`, task-066 D66-2), so the back navigation from the
 * element page restores them (W3-23) and a filtered list can be shared.
 *
 * Reads: `GET /config` (the types of `memory.yaml`) and `GET /elements` (non-archived) — the
 * audited Memory list (TT-PERF-05), nothing per row; `GET /elements?archived=true` only once a type
 * is selected (W3-24); `GET /progress` only while a known figure is in the URL (task-066 D66-8). Every
 * key sits under `['p', pid]`: the `repo` event refreshes the list (S-26.1, S-25.2).
 */
import { useQuery } from '@tanstack/react-query';
import { createRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { elementsQuery, progressQuery, projectConfigQuery } from '../api/queries.js';
import { figureCode } from '../memory/figure.js';
import { MemoryList } from '../memory/MemoryList.js';
import { isListedType, MISSING_REFS, typesOf, type ListFilters } from '../memory/model.js';
import { useProjectTitle } from '../shell/page-title.js';
import { NAV_ORDER } from './nav.js';
import { projectRoute } from './project.js';

const LABELS = defineMessages({ memory: { id: 'shell.nav.memory' } });

/** A search parameter kept when it is a non-empty text. */
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * The list's search parameters (task-066 D66-2), in this precedence: a known `figure` alone (the
 * other filters cleared; an unknown code dropped); else an optional `type` with one choice of the
 * state row — `missing=refs`, or with a type its `state`, or without a type a `bucket` and its
 * optional `state`.
 */
export function memorySearch(search: Record<string, unknown>): ListFilters {
  const figure = figureCode(search['figure']);
  if (figure !== undefined) return { figure };
  const type = text(search['type']);
  const state = text(search['state']);
  const bucket = text(search['bucket']);
  const missing = search['missing'] === MISSING_REFS ? MISSING_REFS : undefined;
  const typed = type !== undefined ? { type } : {};
  if (missing !== undefined) return { ...typed, missing };
  if (type !== undefined) return { type, ...(state !== undefined ? { state } : {}) };
  return bucket !== undefined ? { bucket, ...(state !== undefined ? { state } : {}) } : {};
}

function MemoryPage(): ReactNode {
  const { pid } = memoryRoute.useParams();
  // The route's search also carries the address's other keys (the layout's search passes them on):
  // the list reads its own precedence again (task-066 D66-2).
  const filters = memorySearch(memoryRoute.useSearch());
  const intl = useIntl();
  useProjectTitle(pid, intl.formatMessage(LABELS.memory));
  const config = useQuery(projectConfigQuery(pid));
  const elements = useQuery(elementsQuery(pid, false));
  // The archived elements are read once a listed type is selected (W3-24), then kept for the
  // session; a type the project does not list reads nothing more (review F5).
  const settled = elements.data !== undefined && (config.data !== undefined || config.error !== null);
  const listed =
    settled && filters.type !== undefined && isListedType(typesOf(config.data), elements.data.elements, filters.type);
  const archived = useQuery({ ...elementsQuery(pid, true), enabled: listed });
  // The figure's ids come with `/progress`, read only while a figure is asked for (D66-8).
  const progress = useQuery({ ...progressQuery(pid), enabled: filters.figure !== undefined });
  return (
    <MemoryList
      pid={pid}
      filters={filters}
      config={config}
      elements={elements}
      withArchived={listed ? archived : undefined}
      progress={filters.figure !== undefined ? progress : undefined}
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
