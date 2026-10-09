/**
 * The element panel's *Directives* section (US-G-02; ux-reference §4.2; W3-38): the directives of
 * the current role view — the server's `mine`, bound to the view's role or global — each a link to
 * its page in the Directives view (G-02.2). Outside the team: the global directives, with the
 * reason. `GET /directives` is the Directives view's cached read, once per project and repository
 * state, never per element; a failed read stays inside this section.
 */
import type { UseQueryResult } from '@tanstack/react-query';
import type { DirectiveList, ProjectHeader } from '@wingfoil-ui/contracts';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { FormattedMessage } from 'react-intl';
import { ApiError } from '../api/client.js';
import { panelDirectives } from '../directives/model.js';
import { ErrorText } from '../shell/ErrorText.js';
import '../dna/rules.css';

/** Props of {@link ElementDirectives}. */
export interface ElementDirectivesProps {
  pid: string;
  directives: Pick<UseQueryResult<DirectiveList>, 'data' | 'error'>;
  header: Pick<UseQueryResult<ProjectHeader>, 'data'>;
}

/** The section. */
export function ElementDirectives({ pid, directives, header }: ElementDirectivesProps): ReactNode {
  const member = header.data === undefined ? undefined : header.data.identity.kind === 'member';
  const data = directives.data;
  const ready = data !== undefined && member !== undefined;
  const entries = ready ? panelDirectives(data.entries, member) : [];
  const error = directives.error;
  return (
    <section className="element-section" aria-labelledby="element-directives">
      <h3 id="element-directives" className="section-title">
        <FormattedMessage id="element.directives.title" />
      </h3>
      {error ? (
        <div className="element-error" role="alert">
          <ErrorText
            error={error instanceof ApiError ? error : new ApiError(0, 'internal', error.message, undefined)}
          />
        </div>
      ) : !ready ? (
        <p className="muted" role="status">
          <FormattedMessage id="element.directives.loading" />
        </p>
      ) : (
        <>
          {!member && (
            <p className="muted">
              <FormattedMessage id="element.directives.noRole" />
            </p>
          )}
          {entries.length === 0 ? (
            <p className="muted">
              <FormattedMessage id="element.directives.none" />
            </p>
          ) : (
            <ul className="directive-links">
              {entries.map((e) => (
                <li key={e.frontmatter.id} className="directive-link-item">
                  <Link to="/p/$pid/directives/$did" params={{ pid, did: e.frontmatter.id }}>
                    {e.frontmatter.title}
                  </Link>
                  <span className="field-value">{e.frontmatter.id}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
