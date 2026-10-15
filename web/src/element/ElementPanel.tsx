/**
 * The element panel (US-G-01; ux-reference §4.2, prototype drawer): a non-modal drawer on the right with
 * the type tag, id and Close; the title; the state machine; the rejection banner; the summary with
 * the missing required fields; the references (the frontmatter fields); the directives of the
 * current role view (task-019); the history with commits.
 * Read-only in v0.1 (decision 6); from v0.2 the footer below the body (task-037, `ElementFooter`):
 * the gate footer, or what the user is told instead. No Edit. It renders the server's data as is —
 * the tone of the current state is the descriptor's (spec-003 §8), never re-derived.
 *
 * Non-modal (decision W4-8, task-015): the header and the sidebar stay operable while it is open —
 * the project switcher above all (S-16.2: a switch leaves the panel's route, so the panel goes). The
 * focus moves into the panel when it opens; it closes with Close or Escape (pressed inside the
 * panel and not handled by an inner control), not with a click outside (ux-reference §5).
 */
import type { UseQueryResult } from '@tanstack/react-query';
import type { DirectiveList, ElementDetail, MemoryHistory, ProjectHeader } from '@wingfoil-ui/contracts';
import type { ReactNode } from 'react';
import { Button, Dialog, Heading } from 'react-aria-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { ApiError } from '../api/client.js';
import { ErrorText } from '../shell/ErrorText.js';
import { ElementDirectives } from './Directives.js';
import { ElementFooter } from './ElementFooter.js';
import { isFinal } from './footer.js';
import { History } from './History.js';
import { fieldEntries, summaryOf } from './model.js';
import { StateMachine } from './StateMachine.js';
import './element.css';

/** Props of {@link ElementPanel}. */
export interface ElementPanelProps {
  pid: string;
  /** The element id of the URL (the heading while the element loads or fails). */
  eid: string;
  element: Pick<UseQueryResult<ElementDetail>, 'data' | 'error'>;
  history: Pick<UseQueryResult<MemoryHistory>, 'data' | 'error'>;
  /** `GET /directives` of the project (task-019: one read per project, not per element). */
  directives: Pick<UseQueryResult<DirectiveList>, 'data' | 'error'>;
  /** `GET /api/p/:pid`: whether the user holds a role (the panel's directives, W3-38). */
  header: Pick<UseQueryResult<ProjectHeader>, 'data'>;
  /** Opened from Today: the gate footer's reason takes the focus (task-037, G-04.3, D37-1). */
  focusReason?: boolean;
  /** Called once the reason took that focus (the route forgets the request, review F7). */
  onFocusReasonUsed?(): void;
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
export function ElementPanel({
  pid,
  eid,
  element,
  history,
  directives,
  header,
  focusReason = false,
  onFocusReasonUsed,
  onClose,
}: ElementPanelProps): ReactNode {
  const intl = useIntl();
  const detail = element.data;
  return (
    // Escape pressed inside the panel closes it, unless an inner control handled it first (React
    // handler: it sees the inner React and React Aria handlers' preventDefault, review R8). The
    // portals of other overlays (the switcher's popover) are not React children of the panel.
    <div
      className="drawer"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        event.preventDefault();
        onClose();
      }}
    >
      <Dialog className="drawer-dialog">
        <div className="drawer-header">
          <div className="drawer-topline">
            {detail && <span className="type-tag">{detail.element.type}</span>}
            <span className="element-id">{eid}</span>
            <Button className="button button-quiet" onPress={onClose}>
              <FormattedMessage id="common.action.close" />
            </Button>
          </div>
          <Heading slot="title" level={2} className="drawer-title" tabIndex={-1}>
            {detail ? detail.element.title : eid}
          </Heading>
          {detail && (
            <StateMachine
              sequence={detail.states?.sequence}
              current={detail.element.status}
              tone={detail.descriptor?.tone}
              final={isFinal(detail.descriptor)}
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
            <ElementContent detail={detail} history={history}>
              <ElementDirectives pid={pid} directives={directives} header={header} />
            </ElementContent>
          ) : (
            <p className="muted" role="status">
              <FormattedMessage id="element.loading" />
            </p>
          )}
        </div>
        {detail && !element.error && (
          <ElementFooter
            key={`${pid}:${eid}`}
            pid={pid}
            detail={detail}
            header={header.data}
            focusReason={focusReason}
            onClose={onClose}
            {...(onFocusReasonUsed ? { onFocusReasonUsed } : {})}
          />
        )}
      </Dialog>
    </div>
  );
}

/** The panel's sections, once the element is read. */
function ElementContent({
  detail,
  history,
  children,
}: {
  detail: ElementDetail;
  history: ElementPanelProps['history'];
  /** The Directives section (between References and History). */
  children: ReactNode;
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
