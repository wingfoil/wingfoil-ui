/**
 * The content of an element (US-G-01; ux-reference §4.2, prototype drawer): the rejection banner,
 * the notices, the summary with the missing required fields, the references (the frontmatter
 * fields), the directives of the current role view (task-019) and the history with commits. Shown
 * by the element page (task-062, `ElementPage`) and, from task-077, the side panel: the same
 * content and footers in both places (ux-reference §4.2 v0.3). It renders the server's data as is —
 * the tone of the current state is the descriptor's (spec-003 §8), never re-derived.
 *
 * The summary rendered as Markdown and *Open document* (task-078, US-G-03) load with markdown-it on
 * first use (`element/document.tsx`, D78-7), so the renderer stays out of the entry chunk.
 */
import type { UseQueryResult } from '@tanstack/react-query';
import type { ElementDetail, MemoryHistory } from '@wingfoil-ui/contracts';
import { lazy, Suspense, type ReactNode } from 'react';
import { FormattedMessage } from 'react-intl';
import { ApiError } from '../api/client.js';
import { ErrorText } from '../shell/ErrorText.js';
import { History } from './History.js';
import { fieldEntries } from './model.js';
import './element.css';

const ElementDocument = lazy(() => import('./document.js'));

/** An error of a query as the catalogue renders it. */
export function QueryError({ error }: { error: Error }): ReactNode {
  const e = error instanceof ApiError ? error : new ApiError(0, 'internal', error.message, undefined);
  return (
    <div className="element-error" role="alert">
      <ErrorText error={e} />
    </div>
  );
}

/** The element's sections, once it is read. */
export function ElementContent({
  pid,
  detail,
  history,
  children,
}: {
  pid: string;
  detail: ElementDetail;
  history: Pick<UseQueryResult<MemoryHistory>, 'data' | 'error'>;
  /** The Directives section (between References and History). */
  children: ReactNode;
}): ReactNode {
  const rejection = detail.descriptor?.rejection;
  const missing = (detail.required ?? []).filter((r) => r.missing);
  const fields = fieldEntries(detail.frontmatter);
  return (
    <>
      {detail.element.localChanges && (
        <p className="element-notice">
          <FormattedMessage id="element.localChanges" />
        </p>
      )}
      {rejection && (
        <p className="rejection-banner">
          {rejection.reason === null ? (
            <FormattedMessage id="element.rejection.noReason" values={{ name: rejection.by }} />
          ) : (
            <FormattedMessage
              id="element.rejection.withReason"
              values={{ name: rejection.by, reason: rejection.reason }}
            />
          )}
        </p>
      )}
      {detail.eventsError && (
        <p className="element-notice">
          <FormattedMessage id="element.notice.eventsError" />
        </p>
      )}
      {!detail.descriptor && (
        <p className="element-notice">
          <FormattedMessage id="element.notice.typesError" />
        </p>
      )}

      <section className="element-section" aria-labelledby="element-summary">
        <h3 id="element-summary" className="section-title">
          <FormattedMessage id="element.summary.title" />
        </h3>
        <Suspense
          fallback={
            <p className="muted" role="status">
              <FormattedMessage id="element.summary.loading" />
            </p>
          }
        >
          <ElementDocument pid={pid} detail={detail} />
        </Suspense>
        {missing.length > 0 && (
          <ul className="missing-list">
            {missing.map((r) => (
              <li key={r.field} className="missing-field">
                <FormattedMessage id="element.required.missing" values={{ field: r.field }} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="element-section" aria-labelledby="element-fields">
        <h3 id="element-fields" className="section-title">
          <FormattedMessage id="element.fields.title" />
        </h3>
        {fields.length === 0 ? (
          <p className="muted">
            <FormattedMessage id="element.fields.none" />
          </p>
        ) : (
          <dl className="field-list">
            {fields.map((f) => (
              <div key={f.field} className="field-row">
                <dt className="field-name">{f.field}</dt>
                <dd className="field-values">
                  {f.values.length === 0 ? (
                    <FormattedMessage id="element.fields.empty" />
                  ) : (
                    f.values.map((v, i) => (
                      <span key={i} className="field-value">
                        {v}
                      </span>
                    ))
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {children}

      <section className="element-section" aria-labelledby="element-history">
        <h3 id="element-history" className="section-title">
          <FormattedMessage id="element.history.title" />
        </h3>
        {history.error ? (
          <QueryError error={history.error} />
        ) : history.data ? (
          <History entries={history.data.entries} />
        ) : (
          <p className="muted" role="status">
            <FormattedMessage id="element.history.loading" />
          </p>
        )}
      </section>
    </>
  );
}
