/**
 * The project layout `/p/$pid` (decision W3-6; ux-reference §2): the views sidebar and the view of
 * the child route in `<main>`. `$pid` is the opaque project id (REQ-SEC-04).
 *
 * **Adding a view (tasks 017–020):** write `routes/<view>.tsx` exporting
 * `createRoute({ getParentRoute: () => projectRoute, path: '<view>', component })`, add the route
 * to `PROJECT_ROUTES` in `routes/tree.ts`, and its entry to a group of {@link PROJECT_NAV} with a
 * label from `defineMessages` (so that the catalogue check sees the id). The project header
 * (task-016) goes above `<Outlet/>` in `ProjectLayout`.
 */
import { createRoute, Link, Outlet } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import { rootRoute } from './root.js';

/** One view of the sidebar. */
export interface NavItem {
  /** Stable key of the entry. */
  id: string;
  label: MessageDescriptor;
  /** Route path of the view, e.g. `/p/$pid/memory` (`$pid` filled from the current project). */
  to: string;
}

/** A group of the sidebar (ux-reference §2). */
export interface NavGroup {
  id: 'work' | 'rules' | 'repository';
  label: MessageDescriptor;
  items: NavItem[];
}

const GROUPS = defineMessages({
  work: { id: 'shell.nav.group.work' },
  rules: { id: 'shell.nav.group.rules' },
  repository: { id: 'shell.nav.group.repository' },
});

/** The sidebar's registry: Work · Rules and context · Repository. Empty groups are not shown. */
export const PROJECT_NAV: NavGroup[] = [
  { id: 'work', label: GROUPS.work, items: [] },
  { id: 'rules', label: GROUPS.rules, items: [] },
  { id: 'repository', label: GROUPS.repository, items: [] },
];

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
      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <div key={g.id}>
            <div className="nav-group-label" id={`nav-group-${g.id}`}>
              <FormattedMessage {...g.label} />
            </div>
            <ul aria-labelledby={`nav-group-${g.id}`}>
              {g.items.map((item) => (
                <li key={item.id}>
                  <Link
                    className="nav-link"
                    to={item.to as '/'}
                    params={{ pid } as never}
                    activeProps={{ 'aria-current': 'page' }}
                  >
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
  return (
    <>
      <ProjectNav pid={pid} groups={PROJECT_NAV} />
      <main id="main" className="shell-main" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  );
}

/** `/p/$pid`: the layout of every project view. */
export const projectRoute = createRoute({ getParentRoute: () => rootRoute, path: '/p/$pid', component: ProjectLayout });
