/**
 * The Team view (US-R-07; ux-reference §4.10, prototype Team screen; W3-39, W3-44): one card per
 * member (initials, name, email, roles, "you", pending gates on their roles), the agents in their
 * own section ("executes as … · never approves"), filters by text, role and "with pending gates".
 * The pending gates come from the action descriptors (`team/model.ts`), never from the states.
 */
import type { UseQueryResult } from '@tanstack/react-query';
import type { ElementList, ProjectConfig, ProjectHeader } from '@wingfoil-ui/contracts';
import { Link } from '@tanstack/react-router';
import { useId, useState, type ReactNode } from 'react';
import { Checkbox, Input, Label, SearchField } from 'react-aria-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { AgentLine, RoleChips, RulesError, Section } from '../dna/DnaView.js';
import { filterCards, memberCards, roleFilters, searchOf, type MemberCard, type TeamFilters } from './model.js';
import '../dna/rules.css';

/** Props of {@link TeamView}. */
export interface TeamViewProps {
  pid: string;
  filters: TeamFilters;
  onFilters(filters: TeamFilters): void;
  config: Pick<UseQueryResult<ProjectConfig>, 'data' | 'error'>;
  elements: Pick<UseQueryResult<ElementList>, 'data' | 'error'>;
  header: Pick<UseQueryResult<ProjectHeader>, 'data'>;
}

/** One member card. */
function Card({ card }: { card: MemberCard }): ReactNode {
  const nameId = useId();
  return (
    <li className="member-card" aria-labelledby={nameId}>
      <div className="member-head">
        <span className="member-initials" aria-hidden="true">
          {card.initials}
        </span>
        <span className="member-who">
          <span className="member-name">
            <span id={nameId} className="member-name-text">
              {card.name}
            </span>
            {card.me && (
              <span className="member-you">
                <FormattedMessage id="team.member.you" />
              </span>
            )}
          </span>
          {card.email !== undefined && <span className="member-email">{card.email}</span>}
        </span>
      </div>
      <RoleChips roles={card.roles} />
      {card.pendingGates !== undefined && (
        <span className={card.pendingGates > 0 ? 'member-gates member-gates-some' : 'member-gates'}>
          <FormattedMessage id="team.member.pendingGates" values={{ count: card.pendingGates }} />
        </span>
      )}
    </li>
  );
}

/** The filters: text, "with pending gates", roles. */
function Filters({
  pid,
  filters,
  onFilters,
  roles,
}: {
  pid: string;
  filters: TeamFilters;
  onFilters(filters: TeamFilters): void;
  roles: string[];
}): ReactNode {
  const intl = useIntl();
  // The field keeps what is typed; the URL follows it.
  const [text, setText] = useState(filters.q ?? '');
  const { role: _role, ...withoutRole } = filters;
  return (
    <div className="team-filters">
      <div className="team-filter-row">
        <SearchField
          className="team-search"
          value={text}
          onChange={(value) => {
            setText(value);
            const { q: _q, ...rest } = filters;
            onFilters(value === '' ? rest : { ...rest, q: value });
          }}
        >
          <Label className="visually-hidden">
            <FormattedMessage id="team.filter.search" />
          </Label>
          <Input className="team-search-input" placeholder={intl.formatMessage({ id: 'team.filter.search' })} />
        </SearchField>
        <Checkbox
          className="team-gates"
          isSelected={filters.gates === true}
          onChange={(selected) => {
            const { gates: _g, ...rest } = filters;
            onFilters(selected ? { ...rest, gates: true } : rest);
          }}
        >
          <span className="team-gates-box" aria-hidden="true" />
          <FormattedMessage id="team.filter.gates" />
        </Checkbox>
      </div>
      <ul className="filter-row" aria-label={intl.formatMessage({ id: 'team.filter.roles' })}>
        <li>
          <Link
            className="filter-link"
            to="/p/$pid/team"
            params={{ pid }}
            search={searchOf(withoutRole)}
            activeOptions={{ exact: true, includeSearch: true }}
          >
            <FormattedMessage id="team.filter.allRoles" />
          </Link>
        </li>
        {roles.map((r) => (
          <li key={r}>
            <Link
              className="filter-link"
              to="/p/$pid/team"
              params={{ pid }}
              search={searchOf({ ...withoutRole, role: r })}
              activeOptions={{ exact: true, includeSearch: true }}
            >
              {r}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The Team view. */
export function TeamView({ pid, filters, onFilters, config, elements, header }: TeamViewProps): ReactNode {
  const intl = useIntl();
  const section = config.data?.dna;
  const dna = section && 'data' in section ? section.data : undefined;
  const identity = header.data?.identity;
  const me = identity?.kind === 'member' ? identity.name : undefined;
  // Without descriptors (an unreadable `memory.yaml`) the gates are unknown, like a failed read.
  const gatesUnknown = elements.error !== null || elements.data?.typesError !== undefined;
  const known = gatesUnknown ? undefined : elements.data?.elements;
  const cards = dna ? memberCards(dna.team.members, known, me) : [];
  const shown = filterCards(cards, filters);
  const agents = dna?.team.agents ?? [];
  return (
    <div className="page rules">
      <div className="rules-head">
        <h1 className="page-title">
          <FormattedMessage id="team.title" />
        </h1>
        <p className="page-intro">
          <FormattedMessage id="team.intro" />
        </p>
      </div>
      {config.error ? (
        <RulesError error={config.error} />
      ) : section && 'error' in section ? (
        <RulesError error={section.error} frame={<FormattedMessage id="dna.error" />} />
      ) : dna ? (
        <>
          <Filters
            pid={pid}
            filters={filters}
            onFilters={onFilters}
            roles={roleFilters(dna.team.members, dna.team.roles)}
          />
          {gatesUnknown && (
            <p className="rules-notice">
              <FormattedMessage id="team.gates.error" />
            </p>
          )}
          {filters.gates && !gatesUnknown && known === undefined && (
            <p className="muted" role="status">
              <FormattedMessage id="team.gates.loading" />
            </p>
          )}
          <ul className="member-cards" aria-label={intl.formatMessage({ id: 'team.members.label' })}>
            {shown.map((c) => (
              <Card key={c.name} card={c} />
            ))}
          </ul>
          {shown.length === 0 && (known !== undefined || !filters.gates) && (
            <p className="muted">
              <FormattedMessage id="team.members.noMatch" />
            </p>
          )}
          <Section title={<FormattedMessage id="team.agents.title" />}>
            {agents.length === 0 ? (
              <p className="muted rules-none">
                <FormattedMessage id="team.agents.none" />
              </p>
            ) : (
              <ul className="rules-list">
                {agents.map((a) => (
                  <li key={a.name} className="rules-item">
                    <span className="rules-name">{a.name}</span>
                    <span className="rules-text">
                      <AgentLine agent={a} area="team" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      ) : (
        <p className="muted" role="status">
          <FormattedMessage id="team.loading" />
        </p>
      )}
    </div>
  );
}
