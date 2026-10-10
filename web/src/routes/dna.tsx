/**
 * The DNA view `/p/$pid/dna` (US-R-05, US-S-27; ux-reference §2 *Rules and context*, §4.5). Read:
 * `GET /config` (its `dna` section), the Memory list's cached read; under `['p', pid]`, so the
 * `repo` event of a fixed `dna.yaml` refreshes the view (S-27.2).
 */
import { useQuery } from '@tanstack/react-query';
import { createRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { projectConfigQuery } from '../api/queries.js';
import { DnaView } from '../dna/DnaView.js';
import { useProjectTitle } from '../shell/page-title.js';
import { NAV_ORDER } from './nav.js';
import { projectRoute } from './project.js';

const LABELS = defineMessages({ dna: { id: 'shell.nav.dna' } });

function DnaPage(): ReactNode {
  const { pid } = dnaRoute.useParams();
  const intl = useIntl();
  useProjectTitle(pid, intl.formatMessage(LABELS.dna));
  return <DnaView config={useQuery(projectConfigQuery(pid))} />;
}

/** `/p/$pid/dna`: the DNA view. */
export const dnaRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: 'dna',
  component: DnaPage,
  staticData: { nav: { group: 'rules', order: NAV_ORDER.dna, label: LABELS.dna } },
});
