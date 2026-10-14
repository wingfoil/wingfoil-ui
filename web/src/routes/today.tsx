/**
 * Today `/p/$pid/today` (US-T-01…US-T-06, US-T-11; ux-reference §4.1) — the landing view of a
 * project from v0.2: `/p/$pid` redirects here (D36-1; v0.1 landed on the Memory list, W3-22). Its
 * sidebar entry is the first, above the named groups (D36-2).
 *
 * Reads: the project header (shared with the layout) for the role view, then `GET /today` for that
 * view (`todayQuery`, the key shared with the notification bell, D31-6). Both keys sit under
 * `['p', pid]`: the `repo` event refreshes Today (T-03.2, T-04.2); a role view change re-reads the
 * header, whose new `roleView` is a new Today key (T-02.3).
 */
import { useQuery } from '@tanstack/react-query';
import { createRoute, redirect } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { projectHeaderQuery, todayQuery } from '../api/queries.js';
import { useProjectTitle } from '../shell/page-title.js';
import { TodayView } from '../today/TodayView.js';
import { NAV_ORDER } from './nav.js';
import { projectRoute } from './project.js';

const LABELS = defineMessages({ today: { id: 'shell.nav.today' } });

function TodayPage(): ReactNode {
  const { pid } = todayRoute.useParams();
  const intl = useIntl();
  useProjectTitle(pid, intl.formatMessage(LABELS.today));
  const header = useQuery(projectHeaderQuery(pid));
  // The role view of the header (`null`: no `?view=`, D31-5); read once the header is known.
  const today = useQuery({ ...todayQuery(pid, header.data?.roleView ?? null), enabled: header.data !== undefined });
  // Keyed by the project: the layout is not remounted on a `$pid` change (review F1).
  return <TodayView key={pid} pid={pid} header={header} today={today} />;
}

/** `/p/$pid/today`: Today. */
export const todayRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: 'today',
  component: TodayPage,
  staticData: { nav: { group: 'start', order: NAV_ORDER.today, label: LABELS.today } },
});

/** `/p/$pid`: the project's landing view — Today from v0.2 (D36-1). */
export const projectIndexRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: '/',
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/p/$pid/today', params, replace: true });
  },
});
