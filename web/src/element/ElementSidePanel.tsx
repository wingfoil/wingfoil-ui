/**
 * The element's side panel (task-077 D77-2; spec-011 §2; ux-reference §4.2 v0.1 W4-8, v0.2 bug-018,
 * v0.3): the drawer on the right over the current view — Today, or the view the bell was used on —
 * with the same content and footers as the element page (`ElementContent`, `ElementFooter`). It
 * carries `data-element-view` and the title class `drawer-title` (the footer finds its heading by
 * them, D62-3), and `.drawer` / `.drawer-header` / `.element-footer-slot` for the toasts (D77-8).
 *
 * Non-modal (decision W4-8): no backdrop and no focus trap, so the shell and the view under it stay
 * operable. The focus moves into the panel when it opens; it closes with *Close* or Escape (pressed
 * inside the panel and not handled by an inner control, review R8), not with a click outside.
 */
import type { UseQueryResult } from '@tanstack/react-query';
import type { DirectiveList, ElementDetail, MemoryHistory, ProjectHeader } from '@wingfoil-ui/contracts';
import { useEffect, useRef, type ReactNode } from 'react';
import { Button, Dialog, Heading } from 'react-aria-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { ambiguousDetail, Candidates } from './Candidates.js';
import { ElementDirectives } from './Directives.js';
import { ElementFooter } from './ElementFooter.js';
import { ElementContent, QueryError } from './ElementView.js';
import { isFinal } from './footer.js';
import { StateMachine } from './StateMachine.js';

/** Props of {@link ElementSidePanel}. */
export interface ElementSidePanelProps {
  pid: string;
  /** The value of `panel=` (the heading while the element loads or fails). */
  eid: string;
  element: Pick<UseQueryResult<ElementDetail>, 'data' | 'error'>;
  history: Pick<UseQueryResult<MemoryHistory>, 'data' | 'error'>;
  directives: Pick<UseQueryResult<DirectiveList>, 'data' | 'error'>;
  header: Pick<UseQueryResult<ProjectHeader>, 'data'>;
  /** Opened by a gate's *Approve* / *Review*: the gate footer's reason takes the focus (D37-1). */
  focusReason?: boolean;
  /** Called once the reason took that focus. */
  onFocusReasonUsed?(): void;
  onClose(): void;
}

/**
 * Whether the heading should take the focus a frame after the panel opened: the focus is on the
 * dialog itself (React Aria's `Dialog` focuses itself on mount when nothing inside it has the
 * focus), was lost, or went back to the trigger of a popover that closed (the bell's) — but not when
 * it is on a control inside the panel (the footer's reason, D37-1) or one the user chose outside.
 */
function headingShouldTakeFocus(root: Element | null): boolean {
  const active = document.activeElement;
  if (root === null) return false;
  if (active === root) return true;
  if (root.contains(active)) return false;
  return active === null || active === document.body || active.closest('.bell-trigger') !== null;
}

/** The panel. */
export function ElementSidePanel({
  pid,
  eid,
  element,
  history,
  directives,
  header,
  focusReason = false,
  onFocusReasonUsed,
  onClose,
}: ElementSidePanelProps): ReactNode {
  const intl = useIntl();
  const heading = useRef<HTMLHeadingElement>(null);
  const detail = element.data;
  // The value names this element (a short value is rewritten by the controller, D77-3).
  const shown = detail !== undefined && detail.element.id === eid ? detail : undefined;
  const ambiguous = ambiguousDetail(element.error);

  // The heading takes the focus when the panel opens or shows another element, unless the focus is
  // already inside the panel (the footer's reason, D37-1); once more a frame later when a popover
  // that closed (the bell's) gave the focus back to its trigger meanwhile (D77-7).
  useEffect(() => {
    const root = heading.current?.closest('[data-element-view]') ?? null;
    if (!root?.contains(document.activeElement)) heading.current?.focus({ preventScroll: true });
    const frame = requestAnimationFrame(() => {
      if (headingShouldTakeFocus(heading.current?.closest('[data-element-view]') ?? null)) {
        heading.current?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [pid, eid]);

  return (
    <div
      className="drawer"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        event.preventDefault();
        onClose();
      }}
    >
      <Dialog className="drawer-dialog" data-element-view="">
        <div className="drawer-header">
          <div className="drawer-topline">
            {shown && <span className="type-tag">{shown.element.type}</span>}
            {/* The address's value is isolated from the text around it (bidi, review F-5). */}
            <span className="element-id">{shown ? shown.element.id : <bdi>{eid}</bdi>}</span>
            <Button className="button button-quiet" onPress={onClose}>
              <FormattedMessage id="common.action.close" />
            </Button>
          </div>
          <Heading slot="title" level={2} ref={heading} className="drawer-title" tabIndex={-1}>
            {shown ? shown.element.title : element.error ? <bdi>{eid}</bdi> : <FormattedMessage id="element.loading" />}
          </Heading>
          {shown && (
            <StateMachine
              sequence={shown.states?.sequence}
              current={shown.element.status}
              tone={shown.descriptor?.tone}
              final={isFinal(shown.descriptor)}
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
          {ambiguous ? (
            <Candidates pid={pid} eid={eid} detail={ambiguous} linkTo="panel" />
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
      </Dialog>
    </div>
  );
}
