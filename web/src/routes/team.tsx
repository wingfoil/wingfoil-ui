/**
 * The Team view `/p/$pid/team` (US-R-07; ux-reference §2 *Rules and context*, §4.10; W3-39, W3-44).
 * Reads: `GET /config` (the DNA's team), `GET /elements` (the descriptors give the pending gates;
 * the Memory list's cached read) and `GET /api/p/:pid` (who "you" is). The filters live in the URL
 * (`?q=&role=&gates=1`).
 */
import { useQuery } from '@tanstack/react-query';
import { createRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { elementsQuery, projectConfigQuery, projectHeaderQuery } from '../api/queries.js';
import { TITLES, usePageTitle } from '../shell/page-title.js';
import { searchOf, teamSearch, type TeamFilters } from '../team/model.js';
import { TeamView } from '../team/TeamView.js';
import { useProjectName } from './dna.js';
import { NAV_ORDER } from './nav.js';
import { projectRoute } from './project.js';

const LABELS = defineMessages({ team: { id: 'shell.nav.team' } });

/** The search parameters kept in the URL. */
export function teamRouteSearch(search: Record<string, unknown>): ReturnType<typeof searchOf> {
  return searchOf(teamSearch(search));
}

function TeamPage(): ReactNode {
  const { pid } = teamRoute.useParams();
  const search = teamRoute.useSearch();
  const navigate = teamRoute.useNavigate();
  const intl = useIntl();
  usePageTitle(TITLES.projectView, { project: useProjectName(pid), view: intl.formatMessage(LABELS.team) });
  const { gates, ...text } = search;
  const filters: TeamFilters = { ...text, ...(gates ? { gates: true } : {}) };
  const setFilters = (next: TeamFilters): void => {
    void navigate({ search: searchOf(next), replace: true });
  };
  return (
    <TeamView
      pid={pid}
      filters={filters}
      onFilters={setFilters}
      config={useQuery(projectConfigQuery(pid))}
      elements={useQuery(elementsQuery(pid, false))}
      header={useQuery(projectHeaderQuery(pid))}
    />
  );
}

/** `/p/$pid/team`: the Team view. */
export const teamRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: 'team',
  validateSearch: teamRouteSearch,
  component: TeamPage,
  staticData: { nav: { group: 'rules', order: NAV_ORDER.team, label: LABELS.team } },
});
