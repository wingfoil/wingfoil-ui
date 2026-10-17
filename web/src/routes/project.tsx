/**
 * The project layout `/p/$pid` (decision W3-6; ux-reference §2): the views sidebar and the view of
 * the child route in `<main>`. `$pid` is the opaque project id (REQ-SEC-04).
 *
 * **Adding a view (tasks 017–020):** see `routes/tree.ts` (route list) and `routes/nav.ts` (the
 * sidebar entry declared on the route). The project header (task-016) is above `<Outlet/>`; it
 * also fills the right end of the global header (current user, role view). The sidebar wrapper
 * `.project-sidebar` holds the views navigation and, in `.sidebar-foot` below it, the git status
 * (task-039, D39-1).
 */
import { createRoute, Link, Outlet, useRouter } from '@tanstack/react-router';
import { useMemo, type ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { HowToJoinProvider } from '../project/HowToJoin.js';
import { ProjectHeader } from '../project/ProjectHeader.js';
import { GitStatus } from '../repository/GitStatus.js';
import { navGroups, type NavGroup } from './nav.js';
import { rootRoute } from './root.js';

/** Props of {@link ProjectNav}. */
export interface ProjectNavProps {
  pid: string;
  groups: readonly NavGroup[];
}

/** The views sidebar of a project. */
export function ProjectNav({ pid, groups }: ProjectNavProps): ReactNode {
  const intl = useIntl();
  return (
    <nav className="project-nav" aria-label={intl.formatMessage({ id: 'shell.nav.label' })}>
      {groups.map((g) => (
        <div key={g.id}>
          {g.label && (
            <div className="nav-group-label" id={`nav-group-${g.id}`}>
              <FormattedMessage {...g.label} />
            </div>
          )}
          <ul aria-labelledby={g.label ? `nav-group-${g.id}` : undefined}>
            {g.items.map((item) => (
              <li key={item.id}>
                <Link className="nav-link" to={item.to} params={{ pid }} activeProps={{ 'aria-current': 'page' }}>
                  <FormattedMessage {...item.label} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function ProjectLayout(): ReactNode {
  const { pid } = projectRoute.useParams();
  const router = useRouter();
  const groups = useMemo(() => navGroups(Object.values(router.routesById)), [router]);
  return (
    <HowToJoinProvider pid={pid}>
      {/* The sidebar (D39-1): the views, then the git status pinned at the bottom (ux-reference §2). */}
      <div className="project-sidebar">
        <ProjectNav pid={pid} groups={groups} />
        <div className="sidebar-foot">
          <GitStatus pid={pid} />
        </div>
      </div>
      <main id="main" className="shell-main" tabIndex={-1}>
        {/* Not keyed: its notices live region survives a project switch (W5-13); the header keys its
            role view part, so nothing of one project's role view reaches another (task-016 R1). */}
        <ProjectHeader pid={pid} />
        <Outlet />
      </main>
    </HowToJoinProvider>
  );
}

/** `/p/$pid`: the layout of every project view. */
export const projectRoute = createRoute({ getParentRoute: () => rootRoute, path: '/p/$pid', component: ProjectLayout });
