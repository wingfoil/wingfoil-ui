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
import { Component, lazy, Suspense, type ReactNode } from 'react';
import { Button } from 'react-aria-components';
import { FormattedMessage } from 'react-intl';
import { ApiError } from '../api/client.js';
import { ownAddress } from '../session/session.js';
import { ErrorText } from '../shell/ErrorText.js';
import { History } from './History.js';
import { fieldEntries } from './model.js';
import './element.css';

const ElementDocument = lazy(() => import('./document.js'));

/**
 * How *Reload the page* loads the page again: its own address without the fragment, as the session
 * recovery does (task-063 D63-6; task-078 review round 2, R2-5). An object, so tests can replace it.
 */
export const pageReload = {
  replace(address: string): void {
    window.location.replace(address);
  },
};

/**
 * The summary's place when the document module cannot be loaded or throws (task-078 security review
 * round 1, F-2): e.g. a tab left open across an upgrade, whose old chunk is gone. A line from the
 * catalogue and *Reload the page* — a rejected `React.lazy` import is cached, so only a reload
 * fetches the module again; the rest of the element (its footer included) and the shell stay.
 */
class DocumentBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="element-notice element-document-unavailable">
        <p>
          <FormattedMessage id="element.document.unavailable" />
        </p>
        <Button className="button" onPress={() => pageReload.replace(ownAddress(window.location.href))}>
          <FormattedMessage id="element.document.reload" />
        </Button>
      </div>
    );
  }
}

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
        <DocumentBoundary key={`${pid}:${detail.element.id}`}>
          <Suspense
            fallback={
              <p className="muted" role="status">
                <FormattedMessage id="element.summary.loading" />
              </p>
            }
          >
            <ElementDocument pid={pid} detail={detail} />
          </Suspense>
        </DocumentBoundary>
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
