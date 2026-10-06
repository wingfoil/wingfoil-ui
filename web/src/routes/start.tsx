/**
 * The start page `/` (decision W3-1): the project list page, shown when no project is open — its
 * heading, one sentence and *Add project…*. Task-015 lists the projects here and in the switcher.
 */
import { createRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Button } from 'react-aria-components';
import { FormattedMessage } from 'react-intl';
import { useAddProject } from '../shell/add-project.js';
import { TITLES, usePageTitle } from '../shell/page-title.js';
import { rootRoute } from './root.js';

function StartPage(): ReactNode {
  usePageTitle(TITLES.projects);
  const addProject = useAddProject();
  return (
    <main id="main" className="shell-main" tabIndex={-1}>
      <div className="page">
        <h1>
          <FormattedMessage id="projects.start.title" />
        </h1>
        <p className="page-intro">
          <FormattedMessage id="projects.start.intro" />
        </p>
        <Button className="button button-primary" onPress={addProject.show}>
          <FormattedMessage id="projects.start.add" />
        </Button>
      </div>
    </main>
  );
}

/** `/`: the project list page. */
export const startRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: StartPage });
