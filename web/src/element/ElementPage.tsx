/**
 * The element page (task-062; spec-011 §2; ux-reference §4.2 v0.3, N5): the element in the main
 * region, with the sidebar, as a page of its own — the type tag, the id and *Close*; the title as
 * the page's level-1 heading; the state machine; the element's content (`ElementView`); the footer
 * (task-037, task-038) in a bar at the bottom of the main region. The page is a region named by its
 * heading and carries `data-element-view` (the footer and the toasts find the element's view by
 * it, D62-3, D62-12).
 *
 * An ambiguous short id shows its candidates (`Candidates`, D62-5) instead of *not found*. *Close*
 * and Escape (pressed inside the page and not handled by an inner control) call `onClose`.
 */
import type { UseQueryResult } from '@tanstack/react-query';
import type { DirectiveList, ElementDetail, MemoryHistory, ProjectHeader } from '@wingfoil-ui/contracts';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from 'react-aria-components';
import { FormattedMessage } from 'react-intl';
import { ambiguousDetail, Candidates } from './Candidates.js';
import { ElementDirectives } from './Directives.js';
import { ElementFooter } from './ElementFooter.js';
import { ElementContent, QueryError } from './ElementView.js';
import { isFinal } from './footer.js';
import { StateMachine } from './StateMachine.js';

/** Props of {@link ElementPage}. */
export interface ElementPageProps {
  pid: string;
  /** The element id of the address (the heading while the element loads or fails). */
  eid: string;
  element: Pick<UseQueryResult<ElementDetail>, 'data' | 'error'>;
  history: Pick<UseQueryResult<MemoryHistory>, 'data' | 'error'>;
  /** `GET /directives` of the project (task-019: one read per project, not per element). */
  directives: Pick<UseQueryResult<DirectiveList>, 'data' | 'error'>;
  /** `GET /api/p/:pid`: the footer's identity and the directives' role view. */
  header: Pick<UseQueryResult<ProjectHeader>, 'data'>;
  /** Opened from Today: the gate footer's reason takes the focus (task-037, G-04.3, D37-1). */
  focusReason?: boolean;
  /** Called once the reason took that focus (the route forgets the request, review F7). */
  onFocusReasonUsed?(): void;
  onClose(): void;
}

/** The page. */
export function ElementPage({
  pid,
  eid,
  element,
  history,
  directives,
  header,
  focusReason = false,
  onFocusReasonUsed,
  onClose,
}: ElementPageProps): ReactNode {
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const detail = element.data;
  // The address names this element (a short id is rewritten by the route, D62-4): only then is the
  // content shown — never the answer of another address held by a stale render.
  const shown = detail !== undefined && detail.element.id === eid ? detail : undefined;
  const ambiguous = ambiguousDetail(element.error);

  // The heading takes the focus when the page opens (as the drawer's did), unless the focus is
  // already inside the page (e.g. the footer's reason, D37-1).
  useEffect(() => {
    const root = heading.current?.closest('[data-element-view]');
    if (root?.contains(document.activeElement)) return;
    heading.current?.focus({ preventScroll: true });
  }, [pid, eid]);

  return (
    <section
      className="page element-page"
      data-element-view=""
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        event.preventDefault();
        onClose();
      }}
    >
      <div className="element-page-header">
        <div className="drawer-topline">
          {shown && <span className="type-tag">{shown.element.type}</span>}
          <span className="element-id">{shown ? shown.element.id : eid}</span>
          <Button className="button button-quiet" onPress={onClose}>
            <FormattedMessage id="common.action.close" />
          </Button>
        </div>
        <h1 id={titleId} ref={heading} className="page-title drawer-title" tabIndex={-1}>
          {/* While the read is pending the heading says so, not the address's id (the topline shows it,
              review F-3); a refusal keeps the address's id as the heading. */}
          {shown ? shown.element.title : element.error ? eid : <FormattedMessage id="element.loading" />}
        </h1>
        {shown && (
          <StateMachine
            sequence={shown.states?.sequence}
            current={shown.element.status}
            tone={shown.descriptor?.tone}
            final={isFinal(shown.descriptor)}
          />
        )}
      </div>
      <div className="element-page-body">
        {ambiguous ? (
          <Candidates pid={pid} eid={eid} detail={ambiguous} />
        ) : element.error ? (
          <QueryError error={element.error} />
        ) : shown ? (
          <ElementContent detail={shown} history={history}>
            <ElementDirectives pid={pid} directives={directives} header={header} />
          </ElementContent>
        ) : (
          <p className="muted" role="status">
            <FormattedMessage id="element.loading" />
          </p>
        )}
      </div>
      {shown && !element.error && (
        <ElementFooter
          key={`${pid}:${eid}`}
          pid={pid}
          detail={shown}
          header={header.data}
          focusReason={focusReason}
          onClose={onClose}
          {...(onFocusReasonUsed ? { onFocusReasonUsed } : {})}
        />
      )}
    </section>
  );
}
