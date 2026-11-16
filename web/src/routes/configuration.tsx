/**
 * Configuration `/p/$pid/configuration` (ux-reference §2 pinned entry, §4.11; task-041, D41-1,
 * D41-2): the sidebar's pinned *Configuration* entry, a heading and a row of sub-tabs — links, one
 * URL each; v0.2 has one, *UI settings* (`/p/$pid/configuration/ui-settings`), where
 * `/p/$pid/configuration` leads. The UI settings are global to every project: the same tab under
 * every project. v0.3 (task-064, D64-1, Q1 (a)) appends *Taxonomy* and *Progress*, the project's
 * `.wingfoil/ui.yaml` as `/config` serves it; the landing tab stays *UI settings*.
 */
import { createRoute, Link, Outlet, redirect } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ProgressView } from '../configuration/ProgressView.js';
import { TaxonomyView } from '../configuration/TaxonomyView.js';
import { UiSettingsView } from '../settings/UiSettingsView.js';
import { useProjectTitle } from '../shell/page-title.js';
import { NAV_ORDER } from './nav.js';
import { projectRoute } from './project.js';

const LABELS = defineMessages({ configuration: { id: 'shell.nav.configuration' } });

function ConfigurationLayout(): ReactNode {
  const { pid } = configurationRoute.useParams();
  const intl = useIntl();
  useProjectTitle(pid, intl.formatMessage(LABELS.configuration));
  return (
    <div className="page settings-page">
      <h1 className="page-title">
        <FormattedMessage id="settings.title" />
      </h1>
      <nav className="settings-tabs" aria-label={intl.formatMessage({ id: 'settings.sections.label' })}>
        <Link
          className="settings-tab"
          to="/p/$pid/configuration/ui-settings"
          params={{ pid }}
          activeProps={{ 'aria-current': 'page' }}
        >
          <FormattedMessage id="settings.tab.ui" />
        </Link>
        <Link
          className="settings-tab"
          to="/p/$pid/configuration/taxonomy"
          params={{ pid }}
          activeProps={{ 'aria-current': 'page' }}
        >
          <FormattedMessage id="settings.tab.taxonomy" />
        </Link>
        <Link
          className="settings-tab"
          to="/p/$pid/configuration/progress"
          params={{ pid }}
          activeProps={{ 'aria-current': 'page' }}
        >
          <FormattedMessage id="settings.tab.progress" />
        </Link>
      </nav>
      <Outlet />
    </div>
  );
}

/** `/p/$pid/configuration`: the Configuration page, pinned at the bottom of the sidebar. */
export const configurationRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: 'configuration',
  component: ConfigurationLayout,
  staticData: { nav: { group: 'pinned', order: NAV_ORDER.configuration, label: LABELS.configuration } },
});

/** `/p/$pid/configuration/`: leads to the first tab. */
const configurationIndexRoute = createRoute({
  getParentRoute: () => configurationRoute,
  path: '/',
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/p/$pid/configuration/ui-settings', params, replace: true });
  },
});

/** `/p/$pid/configuration/ui-settings`: the UI settings tab. */
export const uiSettingsRoute = createRoute({
  getParentRoute: () => configurationRoute,
  path: 'ui-settings',
  component: UiSettingsView,
});

/** The Taxonomy tab (task-064). */
function TaxonomyPage(): ReactNode {
  const { pid } = taxonomyRoute.useParams();
  return <TaxonomyView key={pid} pid={pid} />;
}

/** The Progress tab (task-064). */
function ProgressPage(): ReactNode {
  const { pid } = progressRoute.useParams();
  return <ProgressView key={pid} pid={pid} />;
}

/** `/p/$pid/configuration/taxonomy`: the Taxonomy tab (task-064, D64-4). */
export const taxonomyRoute = createRoute({
  getParentRoute: () => configurationRoute,
  path: 'taxonomy',
  component: TaxonomyPage,
});

/** `/p/$pid/configuration/progress`: the Progress tab (task-064, D64-5). */
export const progressRoute = createRoute({
  getParentRoute: () => configurationRoute,
  path: 'progress',
  component: ProgressPage,
});

/** The Configuration route with its tabs (one line of `PROJECT_ROUTES`). */
export const configurationRoutes = configurationRoute.addChildren([
  configurationIndexRoute,
  uiSettingsRoute,
  taxonomyRoute,
  progressRoute,
]);
