/**
 * The DNA view (US-R-05, US-S-27; ux-reference §4.5; W3-45): the project, its modules, stack
 * (technologies and methodologies), team and roles (members, roles, agents) and paths, read-only.
 * An empty list reads "No … declared"; an optional field WingFoil 0.2.2 may omit (project fields,
 * stack lists, a member's email, an agent's approval authority) is simply left out. A failed
 * `dna show` stays in this view with the CLI's message (S-27.1); the `repo` event of the fixed file
 * refreshes it (S-27.2).
 */
import type { UseQueryResult } from '@tanstack/react-query';
import type { ApiError as ApiErrorBody, DnaAgent, DnaShow, ProjectConfig } from '@wingfoil-ui/contracts';
import { useId, type ReactNode } from 'react';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import { ApiError } from '../api/client.js';
import { ErrorText } from '../shell/ErrorText.js';
import './rules.css';

/** Props of {@link DnaView}. */
export interface DnaViewProps {
  config: Pick<UseQueryResult<ProjectConfig>, 'data' | 'error'>;
}

/** An error of the view: the request's, or the `dna` section's (the CLI's message). */
export function RulesError({ error, frame }: { error: Error | ApiErrorBody; frame?: ReactNode }): ReactNode {
  const body =
    error instanceof ApiError
      ? error
      : error instanceof Error
        ? new ApiError(0, 'internal', error.message, undefined)
        : new ApiError(0, error.code, error.message, error.detail);
  return (
    <div className="rules-error" role="alert">
      {frame !== undefined && <p className="rules-error-frame">{frame}</p>}
      <ErrorText error={body} />
    </div>
  );
}

/** A titled section of the view (a labelled region). */
export function Section({ title, children }: { title: ReactNode; children: ReactNode }): ReactNode {
  const id = useId();
  return (
    <section className="rules-section" aria-labelledby={id}>
      <h2 id={id} className="rules-section-title">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** The "nothing declared" texts of the sections. */
const NONE = defineMessages({
  modules: { id: 'dna.modules.none' },
  technologies: { id: 'dna.technologies.none' },
  methodologies: { id: 'dna.methodologies.none' },
  members: { id: 'dna.members.none' },
  roles: { id: 'dna.roles.none' },
  agents: { id: 'dna.agents.none' },
  paths: { id: 'dna.paths.none' },
});

/** A muted "nothing declared" line. */
function None({ message }: { message: MessageDescriptor }): ReactNode {
  return (
    <p className="muted rules-none">
      <FormattedMessage {...message} />
    </p>
  );
}

/** The agent lines, by area and approval authority. */
const AGENT: Readonly<Record<'dna' | 'dnaApproves' | 'team' | 'teamApproves', MessageDescriptor>> = defineMessages({
  dna: { id: 'dna.agent.executes' },
  dnaApproves: { id: 'dna.agent.executesOnly' },
  team: { id: 'team.agent.executes' },
  teamApproves: { id: 'team.agent.executesOnly' },
});

/** Role names as chips. */
export function RoleChips({ roles, current }: { roles: readonly string[]; current?: string | null }): ReactNode {
  return (
    <ul className="role-chips">
      {roles.map((r) => (
        <li key={r} className="role-chip" {...(r === current ? { 'data-current': 'true' } : {})}>
          {r}
        </li>
      ))}
    </ul>
  );
}

/** "executes as … · never approves" for an agent (ux-reference §4.10). */
export function AgentLine({ agent, area }: { agent: DnaAgent; area: 'dna' | 'team' }): ReactNode {
  const intl = useIntl();
  const roles = intl.formatList(agent.executes_as, { type: 'unit', style: 'short' });
  const approves = agent.approval_authority === true;
  const message =
    area === 'dna' ? (approves ? AGENT.dnaApproves : AGENT.dna) : approves ? AGENT.teamApproves : AGENT.team;
  return intl.formatMessage(message, { roles });
}

/** The sections of a readable DNA. */
function DnaSections({ dna }: { dna: DnaShow }): ReactNode {
  const technologies = dna.stacks.technologies ?? [];
  const methodologies = dna.stacks.methodologies ?? [];
  const agents = dna.team.agents ?? [];
  const paths = Object.entries(dna.paths);
  return (
    <div className="rules-grid">
      <Section title={<FormattedMessage id="dna.modules.title" />}>
        {dna.modules.length === 0 ? (
          <None message={NONE.modules} />
        ) : (
          <ul className="rules-list">
            {dna.modules.map((m) => (
              <li key={m.name} className="rules-item">
                <span className="rules-name">{m.name}</span>
                {m.description !== undefined && m.description !== '' && (
                  <span className="rules-text">{m.description}</span>
                )}
                {m.path !== undefined && <span className="rules-path">{m.path}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={<FormattedMessage id="dna.stack.title" />}>
        <h3 className="rules-subtitle">
          <FormattedMessage id="dna.technologies.title" />
        </h3>
        {technologies.length === 0 ? (
          <None message={NONE.technologies} />
        ) : (
          <ul className="rules-list">
            {technologies.map((t) => (
              <li key={t.name} className="rules-item">
                <span className="rules-name">{t.name}</span>
                {t.category !== undefined && t.version !== undefined ? (
                  <span className="rules-meta">
                    <FormattedMessage id="dna.technology.meta" values={{ category: t.category, version: t.version }} />
                  </span>
                ) : (
                  (t.category ?? t.version) !== undefined && (
                    <span className="rules-meta">{t.category ?? t.version}</span>
                  )
                )}
                {t.notes !== undefined && <span className="rules-text">{t.notes}</span>}
              </li>
            ))}
          </ul>
        )}
        <h3 className="rules-subtitle">
          <FormattedMessage id="dna.methodologies.title" />
        </h3>
        {methodologies.length === 0 ? (
          <None message={NONE.methodologies} />
        ) : (
          <ul className="rules-list">
            {methodologies.map((m) => (
              <li key={m.name} className="rules-item">
                <span className="rules-name">{m.name}</span>
                {m.phase !== undefined && <span className="rules-meta">{m.phase}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={<FormattedMessage id="dna.team.title" />}>
        <h3 className="rules-subtitle">
          <FormattedMessage id="dna.members.title" />
        </h3>
        {dna.team.members.length === 0 ? (
          <None message={NONE.members} />
        ) : (
          <ul className="rules-list">
            {dna.team.members.map((m) => (
              <Member key={m.name} name={m.name} roles={m.roles} />
            ))}
          </ul>
        )}
        <h3 className="rules-subtitle">
          <FormattedMessage id="dna.roles.title" />
        </h3>
        {dna.team.roles.length === 0 ? (
          <None message={NONE.roles} />
        ) : (
          <ul className="rules-list">
            {dna.team.roles.map((r) => (
              <li key={r.name} className="rules-item">
                <span className="role-chip">{r.name}</span>
                {r.description !== undefined && <span className="rules-text">{r.description}</span>}
              </li>
            ))}
          </ul>
        )}
        <h3 className="rules-subtitle">
          <FormattedMessage id="dna.agents.title" />
        </h3>
        {agents.length === 0 ? (
          <None message={NONE.agents} />
        ) : (
          <ul className="rules-list">
            {agents.map((a) => (
              <li key={a.name} className="rules-item">
                <span className="rules-name">{a.name}</span>
                <span className="rules-text">
                  <AgentLine agent={a} area="dna" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={<FormattedMessage id="dna.paths.title" />}>
        {paths.length === 0 ? (
          <None message={NONE.paths} />
        ) : (
          <dl className="rules-paths">
            {paths.map(([category, values]) => (
              <div key={category} className="rules-item">
                <dt className="rules-name">{category}</dt>
                {values.length === 0 ? (
                  <dd className="muted">
                    <FormattedMessage id="dna.paths.none" />
                  </dd>
                ) : (
                  values.map((v) => (
                    <dd key={v} className="rules-path">
                      {v}
                    </dd>
                  ))
                )}
              </div>
            ))}
          </dl>
        )}
      </Section>
    </div>
  );
}

/** A member of the DNA with its roles. */
function Member({ name, roles }: { name: string; roles: string[] }): ReactNode {
  const id = useId();
  return (
    <li className="rules-item" aria-labelledby={id}>
      <span id={id} className="rules-name">
        {name}
      </span>
      {roles.length === 0 ? (
        <span className="muted">
          <FormattedMessage id="dna.member.noRole" />
        </span>
      ) : (
        <RoleChips roles={roles} />
      )}
    </li>
  );
}

/** The DNA view. */
export function DnaView({ config }: DnaViewProps): ReactNode {
  const section = config.data?.dna;
  const dna = section && 'data' in section ? section.data : undefined;
  return (
    <div className="page rules">
      <div className="rules-head">
        <h1 className="page-title">
          <FormattedMessage id="dna.title" />
        </h1>
        {dna?.project?.description !== undefined && dna.project.description !== '' && (
          <p className="page-intro">{dna.project.description}</p>
        )}
        {dna?.project?.methodology !== undefined && dna.project.methodology !== '' && (
          <p className="rules-meta">
            <FormattedMessage id="dna.project.methodology" values={{ name: dna.project.methodology }} />
          </p>
        )}
      </div>
      {config.error ? (
        <RulesError error={config.error} />
      ) : section && 'error' in section ? (
        <RulesError error={section.error} frame={<FormattedMessage id="dna.error" />} />
      ) : dna ? (
        <DnaSections dna={dna} />
      ) : (
        <p className="muted" role="status">
          <FormattedMessage id="dna.loading" />
        </p>
      )}
    </div>
  );
}
