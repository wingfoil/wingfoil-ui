/**
 * The element panel (US-G-01; ux-reference §4.2, prototype drawer): a modal drawer on the right with
 * the type tag, id and Close; the title; the state machine; the rejection banner; the summary with
 * the missing required fields; the references (the frontmatter fields); the history with commits.
 * Read-only in v0.1: no Edit, no action footer (decision 6). It renders the server's data as is —
 * the tone of the current state is the descriptor's (spec-003 §8), never re-derived.
 *
 * Closes with Close or Escape, not with a click outside (ux-reference §5).
 */
import type { UseQueryResult } from '@tanstack/react-query';
import type { ElementDetail, MemoryHistory } from '@wingfoil-ui/contracts';
import type { ReactNode } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { ApiError } from '../api/client.js';
import { ErrorText } from '../shell/ErrorText.js';
import { History } from './History.js';
import { fieldEntries, summaryOf } from './model.js';
import { StateMachine } from './StateMachine.js';
import './element.css';

/** Props of {@link ElementPanel}. */
export interface ElementPanelProps {
  /** The element id of the URL (the heading while the element loads or fails). */
  eid: string;
  element: Pick<UseQueryResult<ElementDetail>, 'data' | 'error'>;
  history: Pick<UseQueryResult<MemoryHistory>, 'data' | 'error'>;
  onClose(): void;
}

/** An error of a query as the catalogue renders it. */
function QueryError({ error }: { error: Error }): ReactNode {
  const e = error instanceof ApiError ? error : new ApiError(0, 'internal', error.message, undefined);
  return (
    <div className="element-error" role="alert">
      <ErrorText error={e} />
    </div>
  );
}

/** The drawer around the panel's content. */
export function ElementPanel({ eid, element, history, onClose }: ElementPanelProps): ReactNode {
  const intl = useIntl();
  const detail = element.data;
  return (
    <ModalOverlay
      className="drawer-overlay"
      isOpen
      onOpenChange={(shown) => {
        if (!shown) onClose();
      }}
    >
      <Modal className="drawer">
        <Dialog className="drawer-dialog">
          <div className="drawer-header">
            <div className="drawer-topline">
              {detail && <span className="type-tag">{detail.element.type}</span>}
              <span className="element-id">{eid}</span>
              <Button className="button button-quiet" onPress={onClose}>
                <FormattedMessage id="common.action.close" />
              </Button>
            </div>
            <Heading slot="title" level={2} className="drawer-title">
              {detail ? detail.element.title : eid}
            </Heading>
            {detail && (
              <StateMachine
                sequence={detail.states?.sequence}
                current={detail.element.status}
                tone={detail.descriptor?.tone}
              />
            )}
          </div>
          {/* The body scrolls: focusable so that the keyboard can scroll it (axe scrollable-region-focusable). */}
          <div
            className="drawer-body"
            role="region"
            tabIndex={0}
            aria-label={intl.formatMessage({ id: 'element.body.label' })}
          >
            {element.error ? (
              <QueryError error={element.error} />
            ) : detail ? (
              <ElementContent detail={detail} history={history} />
            ) : (
              <p className="muted" role="status">
                <FormattedMessage id="element.loading" />
              </p>
            )}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** The panel's sections, once the element is read. */
function ElementContent({
  detail,
  history,
}: {
  detail: ElementDetail;
  history: ElementPanelProps['history'];
}): ReactNode {
  const rejection = detail.descriptor?.rejection;
  const summary = summaryOf(detail.body);
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
        <p className="element-summary">{summary ?? <FormattedMessage id="element.summary.none" />}</p>
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

      {/* task-019 (US-G-02): the *Directives* section of the element's roles goes here, between
          References and History (ux-reference §4.2). */}

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
