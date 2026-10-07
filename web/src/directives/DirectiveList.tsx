/**
 * The directive list (US-R-06; ux-reference §4.6, prototype Directives screen; W3-43): "only mine /
 * all" as a two-option toggle kept in the URL; each directive with its title (a link to its page),
 * id and bound roles, the role of the current view highlighted. Outside the team "only mine" is
 * disabled with the reason and "all" is selected (R-06.4).
 */
import type { UseQueryResult } from '@tanstack/react-query';
import type { DirectiveList as DirectiveListData, ProjectHeader } from '@wingfoil-ui/contracts';
import { Link } from '@tanstack/react-router';
import { useId, type ReactNode } from 'react';
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { RoleChips, RulesError } from '../dna/DnaView.js';
import { effectiveShow, SHOW_ALL, shownDirectives, type ListedDirective } from './model.js';
import '../dna/rules.css';

/** Props of {@link DirectiveList}. */
export interface DirectiveListProps {
  pid: string;
  /** `?show=` of the URL. */
  requested: typeof SHOW_ALL | undefined;
  onShowAll(all: boolean): void;
  directives: Pick<UseQueryResult<DirectiveListData>, 'data' | 'error'>;
  header: Pick<UseQueryResult<ProjectHeader>, 'data'>;
}

/** The "only mine" key of the toggle. */
const MINE = 'mine';

/** The bound roles of a directive, or "All roles" for a global one. */
export function DirectiveRoles({ entry, current }: { entry: ListedDirective; current?: string | null }): ReactNode {
  return entry.global ? (
    <ul className="role-chips">
      <li className="role-chip role-chip-global">
        <FormattedMessage id="directives.global" />
      </li>
    </ul>
  ) : (
    <RoleChips roles={entry.roles} current={current ?? null} />
  );
}

/** One directive of the list. */
function Row({ pid, entry, current }: { pid: string; entry: ListedDirective; current: string | null }): ReactNode {
  const id = useId();
  return (
    <li className="directive-row" data-directive={entry.frontmatter.id} aria-labelledby={id}>
      <div className="directive-head">
        <Link
          id={id}
          className="directive-title"
          to="/p/$pid/directives/$did"
          params={{ pid, did: entry.frontmatter.id }}
        >
          {entry.frontmatter.title}
        </Link>
        <span className="rules-path">{entry.frontmatter.id}</span>
      </div>
      <DirectiveRoles entry={entry} current={current} />
    </li>
  );
}

/** The list page. */
export function DirectiveList({ pid, requested, onShowAll, directives, header }: DirectiveListProps): ReactNode {
  const intl = useIntl();
  const reasonId = useId();
  // Until the header answers, the user is taken as a member (the default "only mine").
  const member = header.data === undefined || header.data.identity.kind === 'member';
  const show = effectiveShow(requested, member);
  const entries = directives.data ? shownDirectives(directives.data.entries, show) : [];
  const current = header.data?.roleView ?? header.data?.roleViews[0] ?? null;
  return (
    <div className="page rules">
      <div className="rules-head">
        <h1 className="page-title">
          <FormattedMessage id="directives.title" />
        </h1>
        <p className="page-intro">
          <FormattedMessage id="directives.intro" />
        </p>
      </div>
      <div className="directive-filter">
        <ToggleButtonGroup
          className="segmented"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[show === 'all' ? SHOW_ALL : MINE]}
          onSelectionChange={(keys) => onShowAll(keys.has(SHOW_ALL))}
          aria-label={intl.formatMessage({ id: 'directives.filter.label' })}
          {...(!member ? { 'aria-describedby': reasonId } : {})}
        >
          <ToggleButton id={MINE} className="segment" isDisabled={!member}>
            <FormattedMessage id="directives.filter.mine" />
          </ToggleButton>
          <ToggleButton id={SHOW_ALL} className="segment">
            <FormattedMessage id="directives.filter.all" />
          </ToggleButton>
        </ToggleButtonGroup>
        {!member && (
          <span id={reasonId} className="muted">
            <FormattedMessage id="directives.filter.noRole" />
          </span>
        )}
      </div>
      {directives.error ? (
        <RulesError error={directives.error} />
      ) : directives.data ? (
        <>
          <ul className="directive-list" aria-label={intl.formatMessage({ id: 'directives.list.label' })}>
            {entries.map((e) => (
              <Row key={e.frontmatter.id} pid={pid} entry={e} current={current} />
            ))}
          </ul>
          {entries.length === 0 && (
            <p className="muted">
              <FormattedMessage id="directives.list.empty" />
            </p>
          )}
          {directives.data.warnings.length > 0 && (
            <ul className="rules-notice">
              {directives.data.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="muted" role="status">
          <FormattedMessage id="directives.loading" />
        </p>
      )}
    </div>
  );
}
