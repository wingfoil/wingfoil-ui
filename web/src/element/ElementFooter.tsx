/**
 * The footer of the element panel (task-037; ux-reference §4.2 *Gate footer*, §5 "2-click gates",
 * "All gate options visible"): what `footerView` (`footer.ts`) says the user can do on the element.
 *
 * - **Gate footer** (G2): the reason field, then every outcome side by side — approve first and
 *   primary, each reject after it (D37-2) — then *Cancel*. The reason is required for every
 *   outcome; approve offers an editable default, selected when the field takes the focus (G-06.1);
 *   an untouched default is cleared when the focus moves to a reject (G-06.3) and restored when it
 *   moves to Approve while that clear left the field empty (D37-4). Outcomes stay focusable when
 *   disabled (`aria-disabled`, D37-3): the reason (empty, or the descriptor's rule of spec-003 §6)
 *   is shown and is their accessible description.
 * - **Read-only line** for a user not identified as one member (S-13.2, S-15.2), with *How to join*
 *   when it applies; **reserved line** for a member without the gate's role (G-09.x); the engine
 *   notes (S-24.2 … S-24.4, RP-13); the final note (S-24.1).
 *
 * The write's feedback until task-038's toasts (D37-9): a polite status region says "<id> is now
 * <state>" (the state the server answered) and a refusal is an alert; both live outside the part
 * that changes with the refetched state (review F2), the reason is kept. After a success the
 * outcomes stay disabled until the new state arrives (review F4), and the focus moves to the
 * panel's heading (review F5).
 */
import type { ElementDetail, ProjectHeader } from '@wingfoil-ui/contracts';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { FormattedMessage, defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { Button } from 'react-aria-components';
import type { ApiError } from '../api/client.js';
import { useElementWrite } from '../api/writes.js';
import { useHowToJoin } from '../project/HowToJoin.js';
import { ErrorText } from '../shell/ErrorText.js';
import { footerView, isBlank, type FooterView, type GateOutcome } from './footer.js';

/** The catalogue texts of the disabled reasons (spec-003 §6, spec-008 §4 `<area>.reason.<code>`). */
const REASONS = defineMessages({
  'not-in-team': { id: 'element.reason.notInTeam' },
  'version-unsupported': { id: 'element.reason.versionUnsupported' },
  'local-changes': { id: 'element.reason.localChanges' },
  'copy-behind': { id: 'element.reason.copyBehind' },
  'copy-diverged': { id: 'element.reason.copyDiverged' },
  'copy-detached': { id: 'element.reason.copyDetached' },
});

/** The reason's message and its arguments. */
function reasonMessage(reason: NonNullable<GateOutcome['reason']>): {
  descriptor: MessageDescriptor;
  values: Record<string, string | number>;
} {
  switch (reason.code) {
    case 'version-unsupported':
      return { descriptor: REASONS[reason.code], values: { range: reason.range } };
    case 'copy-behind':
      return { descriptor: REASONS[reason.code], values: { commits: reason.commits } };
    default:
      return { descriptor: REASONS[reason.code], values: {} };
  }
}

/** Props of {@link ElementFooter}. */
export interface ElementFooterProps {
  pid: string;
  detail: ElementDetail;
  header: ProjectHeader | undefined;
  /** Opened from Today: the reason takes the focus once (G-04.3, D37-1). */
  focusReason: boolean;
  /** Cancel: what Close does. */
  onClose(): void;
  /** Called once the reason took the focus asked by `focusReason` (review F7). */
  onFocusReasonUsed?(): void;
}

/** The footer, and the panel's write status (keyed by element by the caller). */
export function ElementFooter({
  pid,
  detail,
  header,
  focusReason,
  onClose,
  onFocusReasonUsed,
}: ElementFooterProps): ReactNode {
  const [done, setDone] = useState<{ id: string; state: string } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  // The status a successful decision was made from: its outcomes stay disabled until it changes.
  const [decidedFrom, setDecidedFrom] = useState<string | null>(null);
  const write = useElementWrite();
  const root = useRef<HTMLDivElement>(null);
  // The focus request is used once per panel: a refetch remounting the footer must not move it.
  const focusPendingRef = useRef(focusReason);
  const view: FooterView | undefined = detail.descriptor && header ? footerView(detail.descriptor, header) : undefined;

  const decide = (o: GateOutcome, reason: string) => {
    setDone(null);
    setError(null);
    const from = detail.element.status;
    write.mutate(
      { pid, eid: detail.element.id, verb: o.verb, expectedStatus: from, reason },
      {
        onSuccess: (data) => {
          const to = data.result['to'];
          setDone({ id: detail.element.id, state: typeof to === 'string' ? to : o.to });
          setDecidedFrom(from);
          // The outcome that had the focus goes with the new state: the panel's heading takes it.
          (root.current?.closest('[role="dialog"]')?.querySelector('.drawer-title') as HTMLElement | null)?.focus();
        },
        onError: (e) => setError(e),
      },
    );
  };

  return (
    <div ref={root} className="element-footer-slot">
      <p className="visually-hidden" role="status">
        {write.isPending ? (
          <FormattedMessage id="element.gate.pending" />
        ) : done ? (
          <FormattedMessage id="element.gate.done" values={done} />
        ) : null}
      </p>
      {view && (
        <FooterContent
          view={view}
          detail={detail}
          busy={write.isPending || decidedFrom === detail.element.status}
          focusPendingRef={focusPendingRef}
          onDecide={decide}
          onClose={onClose}
          onFocusReasonUsed={onFocusReasonUsed}
        />
      )}
      {error && (
        <div className="element-footer gate-error" role="alert">
          <ErrorText error={error} />
        </div>
      )}
    </div>
  );
}

function FooterContent({
  view,
  detail,
  busy,
  focusPendingRef,
  onDecide,
  onClose,
  onFocusReasonUsed,
}: {
  view: FooterView;
  detail: ElementDetail;
  busy: boolean;
  focusPendingRef: { current: boolean };
  onDecide(o: GateOutcome, reason: string): void;
  onClose(): void;
  onFocusReasonUsed: (() => void) | undefined;
}): ReactNode {
  switch (view.kind) {
    case 'none':
      return null;
    case 'readOnly':
      return <ReadOnlyLine email={view.email} />;
    case 'waiting':
      return (
        <p className="element-footer element-footer-note">
          <FormattedMessage id="element.waiting.engine" values={{ state: view.state }} />
        </p>
      );
    case 'final':
      return (
        <p className="element-footer element-footer-note">
          <FormattedMessage id="element.final" />
        </p>
      );
    case 'reserved':
      return (
        <div className="element-footer element-footer-note">
          <p>
            {view.members ? (
              <FormattedMessage
                id="element.gate.reserved"
                values={{
                  role: view.role,
                  members: <span className="element-footer-members">{view.members.join(', ')}</span>,
                }}
              />
            ) : (
              <FormattedMessage id="element.gate.reservedNoMember" values={{ role: view.role }} />
            )}
          </p>
          {view.engineAdvance && (
            <p>
              <FormattedMessage id="element.gate.engineAdvance" />
            </p>
          )}
        </div>
      );
    case 'gate':
      return (
        <GateFooter
          key={`${detail.element.id}:${detail.element.status}`}
          view={view}
          busy={busy}
          focusPendingRef={focusPendingRef}
          onDecide={onDecide}
          onClose={onClose}
          onFocusReasonUsed={onFocusReasonUsed}
        />
      );
  }
}

/** "Read-only: … — How to join" (S-13.2), or a pointer to the header's notice (S-15.2). */
function ReadOnlyLine({ email }: { email: string | undefined }): ReactNode {
  const join = useHowToJoin();
  return (
    <p className="element-footer element-footer-note">
      {email === undefined ? (
        <FormattedMessage id="element.readOnly.other" />
      ) : (
        <>
          <span>
            <FormattedMessage id="element.readOnly.notInTeam" values={{ email }} />
          </span>{' '}
          <Button className="button button-quiet element-footer-join" onPress={() => join.show()}>
            <FormattedMessage id="shell.howToJoin.open" />
          </Button>
        </>
      )}
    </p>
  );
}

const TEXTS = defineMessages({
  defaultReason: {
    id: 'element.gate.reason.default',
    description: 'Pre-filled reason of an approval; it is written into the commit of the decision',
  },
});

/** The gate footer proper (G2). */
function GateFooter({
  view,
  busy,
  focusPendingRef,
  onDecide,
  onClose,
  onFocusReasonUsed,
}: {
  view: Extract<FooterView, { kind: 'gate' }>;
  busy: boolean;
  focusPendingRef: { current: boolean };
  onDecide(o: GateOutcome, reason: string): void;
  onClose(): void;
  onFocusReasonUsed: (() => void) | undefined;
}): ReactNode {
  const intl = useIntl();
  const fallback = view.approve ? intl.formatMessage(TEXTS.defaultReason) : '';
  const [reason, setReason] = useState(fallback);
  // Whether the user edited the field, and whether the last clear was the reject rule's (D37-4).
  const [touched, setTouched] = useState(false);
  const [autoCleared, setAutoCleared] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const hintId = useId();
  const blockedId = useId();
  const blank = isBlank(reason);

  useEffect(() => {
    if (!focusPendingRef.current) return;
    focusPendingRef.current = false;
    field.current?.focus();
    onFocusReasonUsed?.();
  }, [focusPendingRef, onFocusReasonUsed]);

  /** G-06.3: a reject chosen while the default is untouched clears it (focus or a click without one). */
  const clearsDefault = (o: GateOutcome) => !touched && o.verb === 'reject' && reason === fallback && fallback !== '';

  const onOutcomeFocus = (o: GateOutcome) => {
    if (touched) return;
    if (clearsDefault(o)) {
      setReason('');
      setAutoCleared(true);
    } else if (o.verb === 'approve' && autoCleared && reason === '') {
      setReason(fallback);
      setAutoCleared(false);
    }
  };

  // The first rule the descriptor reports (the same for every outcome of a state, spec-003 §6).
  const blocked = view.outcomes.find((o) => !o.enabled && o.reason)?.reason;
  const blockedText = blocked ? reasonMessage(blocked) : undefined;

  return (
    <section className="element-footer gate-footer" aria-labelledby={titleId}>
      <h3 id={titleId} className="section-title">
        <FormattedMessage id="element.gate.title" />
      </h3>
      <label className="gate-reason">
        <span className="gate-reason-label">
          <FormattedMessage id="element.gate.reason.label" />
        </span>
        <textarea
          ref={field}
          className="gate-reason-field"
          rows={2}
          value={reason}
          placeholder={intl.formatMessage({ id: 'element.gate.reason.placeholder' })}
          aria-describedby={blank ? hintId : undefined}
          onFocus={(e) => {
            if (!touched && reason !== '' && reason === fallback) e.currentTarget.select();
          }}
          onChange={(e) => {
            setReason(e.currentTarget.value);
            setTouched(true);
            setAutoCleared(false);
          }}
        />
      </label>
      {blank && (
        <p id={hintId} className="gate-hint">
          <FormattedMessage id="element.gate.reason.required" />
        </p>
      )}
      {blockedText && (
        <p id={blockedId} className="gate-hint gate-blocked">
          <FormattedMessage {...blockedText.descriptor} values={blockedText.values} />
        </p>
      )}
      {view.engineAdvance && (
        <p className="gate-hint">
          <FormattedMessage id="element.gate.engineAdvance" />
        </p>
      )}
      <div className="gate-actions">
        {view.outcomes.map((o) => {
          const disabled = !o.enabled || blank || busy;
          const describedBy = !o.enabled && blockedText ? blockedId : blank ? hintId : undefined;
          return (
            // A native button: React Aria's Button drops the focus when disabled (D37-3).
            <button
              key={`${o.verb}:${o.to}`}
              type="button"
              className={`button ${o.verb === 'approve' ? 'button-primary' : 'button-danger'} gate-outcome`}
              aria-disabled={disabled ? true : undefined}
              aria-describedby={describedBy}
              onFocus={() => onOutcomeFocus(o)}
              onClick={() => {
                // A click that did not focus the button (Safari, Firefox on macOS, a tap) must not
                // send the approval's default as a rejection reason (review F1).
                if (clearsDefault(o)) {
                  setReason('');
                  setAutoCleared(true);
                  return;
                }
                if (!disabled) onDecide(o, reason);
              }}
            >
              <FormattedMessage id="element.gate.outcome" values={{ verb: o.verb, to: o.to }} />
            </button>
          );
        })}
        <span className="gate-spacer" />
        <Button className="button button-quiet" onPress={onClose}>
          <FormattedMessage id="common.action.cancel" />
        </Button>
      </div>
    </section>
  );
}
