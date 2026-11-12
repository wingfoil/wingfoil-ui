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
 * - **Single-action footer** (G3, task-038, D38-6, D38-7): *Submit → <to>* (primary) and *Cancel*
 *   for every member identified in the team; disabled like the outcomes (focusable, the reason as
 *   its description, G-11.2, X-07.3).
 * - **Read-only line** for a user not identified as one member (S-13.2, S-15.2), with *How to join*
 *   when it applies; **reserved line** for a member without the gate's role (G-09.x); the engine
 *   notes (S-24.2 … S-24.4, RP-13); the final note (S-24.1).
 * - **Held gate** (v0.3, task-069; S-24.5, S-24.6): the hold's line — in the gate footer, with no
 *   approve and an empty reason, for a member holding the reject's role; alone for any other member.
 *
 * The write's result is a toast of the shell, raised by `useElementWrite` (task-038, D38-10,
 * D38-11); the footer's polite status region only says that the write is running. The reason is
 * kept on a refusal. After a success the actions stay disabled until the new state arrives (review
 * F4), and the focus moves to the panel's heading (review F5).
 */
import type { ElementDetail, ProjectHeader } from '@wingfoil-ui/contracts';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from 'react';
import { FormattedMessage, defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { Button } from 'react-aria-components';
import type { DisabledReason } from '@wingfoil-ui/contracts';
import { hashKey, useQueryClient } from '@tanstack/react-query';
import { useElementWrite, type ElementWriteVerb } from '../api/writes.js';
import { useHowToJoin } from '../project/HowToJoin.js';
import { UpdateLink } from '../repository/UpdateLink.js';
import { footerView, isBlank, type FooterView, type GateOutcome } from './footer.js';
import { HoldText } from './HoldText.js';
import { elementKeys } from './queries.js';

/** The catalogue texts of the disabled reasons (spec-003 §6, spec-008 §4 `<area>.reason.<code>`). */
const REASONS = defineMessages({
  'not-in-team': { id: 'element.reason.notInTeam' },
  'version-unsupported': { id: 'element.reason.versionUnsupported' },
  'local-changes': { id: 'element.reason.localChanges' },
  'copy-behind': { id: 'element.reason.copyBehind' },
  'copy-diverged': { id: 'element.reason.copyDiverged' },
  'copy-detached': { id: 'element.reason.copyDetached' },
  'state-limit': { id: 'element.reason.stateLimit' },
});

/** The project and the footer's callback for the *Update* link of the copy-behind reason (D40-2). */
const ReasonLink = createContext<{ pid: string; onStarted(): void; onSucceeded(): void; onFailed(): void } | null>(
  null,
);

/** *Update* in the copy-behind reason (G-12.1, G-12.2): the sidebar's update, from the footer. */
function ReasonUpdateLink({ children }: { children: ReactNode }): ReactNode {
  const link = useContext(ReasonLink);
  if (!link) return children;
  return (
    <UpdateLink pid={link.pid} onStarted={link.onStarted} onSucceeded={link.onSucceeded} onFailed={link.onFailed}>
      {children}
    </UpdateLink>
  );
}

/** The reason's message and its arguments. */
function reasonMessage(reason: DisabledReason): {
  descriptor: MessageDescriptor;
  values: Record<string, string | number | ((chunks: ReactNode[]) => ReactNode)>;
} {
  switch (reason.code) {
    case 'version-unsupported':
      return { descriptor: REASONS[reason.code], values: { range: reason.range } };
    case 'state-limit':
      return { descriptor: REASONS[reason.code], values: { state: reason.state, limit: reason.limit } };
    case 'copy-behind':
      return {
        descriptor: REASONS[reason.code],
        values: {
          commits: reason.commits,
          // task-040: the reason ends with "— Update", the update of the project (D40-2).
          update: (chunks) => <ReasonUpdateLink key="update">{chunks}</ReasonUpdateLink>,
        },
      };
    default:
      return { descriptor: REASONS[reason.code], values: {} };
  }
}

/** A reason's identity: its code and parameters, whatever the order of its keys. */
function reasonKey(reason: DisabledReason): string {
  const fields = reason as unknown as Record<string, unknown>;
  return JSON.stringify(
    Object.keys(fields)
      .sort()
      .map((k) => [k, fields[k]]),
  );
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
  const write = useElementWrite();
  const root = useRef<HTMLDivElement>(null);
  // The focus request is used once per panel: a refetch remounting the footer must not move it.
  const focusPendingRef = useRef(focusReason);
  const view: FooterView | undefined = detail.descriptor && header ? footerView(detail.descriptor, header) : undefined;
  // After the reason's *Update* was pressed: once the new descriptor no longer blocks (the link is
  // gone) the request is used, and the focus goes to the footer's next step — the gate's reason, else
  // its first enabled action, else the panel's heading — only when it is still in the footer, nowhere,
  // or on the heading the bug-046 fallback gave it when the refetch removed the link before the
  // update's reply (D40-2, review R3; task-077 security review round 2, R2-2). The request is made by
  // the press (the link's per-call callbacks go with it when a refresh removes it before the reply),
  // dropped by a refusal while the link is shown, and used once the link is gone. It lives for one
  // update (review round 3, R3-3): after a success with the link still shown, the next read of the
  // element that still says copy-behind drops it. `fallbackFocus` is the heading the bug-046 fallback
  // focused *during* this update (R3-2): cleared when an update starts and when the heading loses the
  // focus, so a heading the user focused on purpose is never taken for it.
  const focusAfterUpdate = useRef(false);
  const fallbackFocus = useRef<HTMLElement | null>(null);
  const updateSucceededAt = useRef<number | undefined>(undefined);
  const queryClient = useQueryClient();
  const elementHash = hashKey(elementKeys.detail(pid, detail.element.id));
  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        const since = updateSucceededAt.current;
        if (since === undefined || event.type !== 'updated' || event.action.type !== 'success') return;
        if (event.query.queryHash !== elementHash || event.query.state.dataUpdatedAt < since) return;
        updateSucceededAt.current = undefined;
        const read = event.query.state.data as ElementDetail | undefined;
        if (read?.descriptor?.verbs.some((v) => v.reason?.code === 'copy-behind')) focusAfterUpdate.current = false;
      }),
    [queryClient, elementHash],
  );
  useEffect(() => {
    const slot = root.current;
    if (!focusAfterUpdate.current || slot === null || slot.querySelector('.update-link') !== null) return;
    focusAfterUpdate.current = false;
    const active = document.activeElement;
    const fromFallback = active !== null && active === fallbackFocus.current;
    fallbackFocus.current = null;
    if (active !== null && active !== document.body && !slot.contains(active) && !fromFallback) return;
    const next =
      slot.querySelector<HTMLElement>('.gate-reason-field, .gate-outcome:not([aria-disabled="true"])') ??
      (slot.closest('[data-element-view]')?.querySelector('.drawer-title') as HTMLElement | null);
    next?.focus();
  });

  // bug-046: the server publishes `repo` before it answers a decision, so the refetch may replace the
  // footer — and remove the control that holds the focus — before `onSuccess` runs. Whenever a render
  // removes the focused footer control (the footer's kind changes, the gate's controls unmount), the
  // focus goes to the element's heading at once, not to `<body>`. `holdsFocus` follows the focus in
  // and out of the footer; a blur toward nothing (a removal in some engines, or a click on no control)
  // is checked in a microtask, once the event's handlers and the render that caused it have run: only
  // a control that left the document moves the focus, and only from `<body>`. The heading it focuses
  // is remembered, so that D40-2 (above) can still move the focus on to the reason after an *Update*.
  const holdsFocus = useRef(false);
  const focusHeadingIfLost = (): void => {
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    const heading = root.current?.closest('[data-element-view]')?.querySelector<HTMLElement>('.drawer-title');
    if (!heading) return;
    heading.focus();
    // Remembered only while an *Update* request is pending, until the heading loses the focus (R3-2).
    if (!focusAfterUpdate.current) return;
    fallbackFocus.current = heading;
    heading.addEventListener(
      'blur',
      () => {
        if (fallbackFocus.current === heading) fallbackFocus.current = null;
      },
      { once: true },
    );
  };
  useLayoutEffect(() => {
    if (!holdsFocus.current) return;
    if (root.current?.contains(document.activeElement)) return;
    holdsFocus.current = false;
    focusHeadingIfLost();
  });
  const onFocusIn = (): void => {
    holdsFocus.current = true;
  };
  const onFocusOut = (event: FocusEvent<HTMLDivElement>): void => {
    const next = event.relatedTarget;
    if (next instanceof Node && root.current?.contains(next)) return;
    const left = event.target;
    queueMicrotask(() => {
      if (root.current?.contains(document.activeElement)) return;
      holdsFocus.current = false;
      if (!left.isConnected) focusHeadingIfLost();
    });
  };

  // The result and a refusal are toasts (`useElementWrite`); here only what follows a success.
  const run = (verb: ElementWriteVerb, reason: string | undefined, onDone: () => void) => {
    write.mutate(
      {
        pid,
        eid: detail.element.id,
        verb,
        expectedStatus: detail.element.status,
        ...(reason !== undefined ? { reason } : {}),
      },
      {
        onSuccess: () => {
          onDone();
          // The action that had the focus goes with the new state: the panel's heading takes it.
          (root.current?.closest('[data-element-view]')?.querySelector('.drawer-title') as HTMLElement | null)?.focus();
        },
      },
    );
  };
  const decide = (o: GateOutcome, reason: string, onDecided: () => void) => run(o.verb, reason, onDecided);
  const submit = (onSubmitted: () => void) => run('submit', undefined, onSubmitted);

  return (
    <div ref={root} className="element-footer-slot" onFocus={onFocusIn} onBlur={onFocusOut}>
      <p className="visually-hidden" role="status">
        {write.isPending &&
          (write.variables.verb === 'submit' ? (
            <FormattedMessage id="element.submit.pending" />
          ) : (
            <FormattedMessage id="element.gate.pending" />
          ))}
      </p>
      {view && (
        <ReasonLink.Provider
          value={{
            pid,
            onStarted: () => {
              focusAfterUpdate.current = true;
              fallbackFocus.current = null;
              updateSucceededAt.current = undefined;
            },
            onSucceeded: () => {
              updateSucceededAt.current = Date.now();
            },
            onFailed: () => {
              focusAfterUpdate.current = false;
              fallbackFocus.current = null;
            },
          }}
        >
          <FooterContent
            view={view}
            detail={detail}
            busy={write.isPending}
            focusPendingRef={focusPendingRef}
            onDecide={decide}
            onSubmit={submit}
            onClose={onClose}
            onFocusReasonUsed={onFocusReasonUsed}
          />
        </ReasonLink.Provider>
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
  onSubmit,
  onClose,
  onFocusReasonUsed,
}: {
  view: FooterView;
  detail: ElementDetail;
  busy: boolean;
  focusPendingRef: { current: boolean };
  onDecide(o: GateOutcome, reason: string, onDecided: () => void): void;
  onSubmit(onSubmitted: () => void): void;
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
    case 'held':
      return (
        <p className="element-footer element-footer-note">
          <HoldText reason={view.reason} />
        </p>
      );
    case 'submit':
      return (
        <SubmitFooter
          key={`${detail.element.id}:${detail.element.status}`}
          view={view}
          busy={busy}
          onSubmit={onSubmit}
          onClose={onClose}
        />
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

/** The single-action footer (G3, task-038): *Submit → <to>*, then *Cancel*. */
function SubmitFooter({
  view,
  busy,
  onSubmit,
  onClose,
}: {
  view: Extract<FooterView, { kind: 'submit' }>;
  busy: boolean;
  onSubmit(onSubmitted: () => void): void;
  onClose(): void;
}): ReactNode {
  // Submitted from this state: disabled until the new state remounts this footer (reviews F4, F12).
  const [submitted, setSubmitted] = useState(false);
  const blockedId = useId();
  const blockedText = !view.enabled && view.reason ? reasonMessage(view.reason) : undefined;
  const disabled = !view.enabled || busy || submitted;
  return (
    <div className="element-footer submit-footer">
      {blockedText && (
        <p id={blockedId} className="gate-hint gate-blocked">
          <FormattedMessage {...blockedText.descriptor} values={blockedText.values} />
        </p>
      )}
      <div className="gate-actions">
        {/* A native button: focusable while disabled, the reason as its description (D37-3). */}
        <button
          type="button"
          className="button button-primary gate-outcome"
          aria-disabled={disabled ? true : undefined}
          aria-describedby={blockedText ? blockedId : undefined}
          onClick={() => {
            if (!disabled) onSubmit(() => setSubmitted(true));
          }}
        >
          <FormattedMessage id="element.submit.action" values={{ to: view.to }} />
        </button>
        <span className="gate-spacer" />
        <Button className="button button-quiet" onPress={onClose}>
          <FormattedMessage id="common.action.cancel" />
        </Button>
      </div>
    </div>
  );
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
  onDecide(o: GateOutcome, reason: string, onDecided: () => void): void;
  onClose(): void;
  onFocusReasonUsed: (() => void) | undefined;
}): ReactNode {
  const intl = useIntl();
  const fallback = view.approve ? intl.formatMessage(TEXTS.defaultReason) : '';
  const [reason, setReason] = useState(fallback);
  // Whether the user edited the field, and whether the last clear was the reject rule's (D37-4).
  const [touched, setTouched] = useState(false);
  const [autoCleared, setAutoCleared] = useState(false);
  // A decision succeeded from this state: its outcomes stay disabled until the new state arrives,
  // which remounts this footer (keyed by id and status; reviews F4, F12).
  const [decided, setDecided] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const hintId = useId();
  const blockedId = useId();
  const heldId = useId();
  const blank = isBlank(reason);

  useEffect(() => {
    if (!focusPendingRef.current) return;
    focusPendingRef.current = false;
    field.current?.focus();
    onFocusReasonUsed?.();
  }, [focusPendingRef, onFocusReasonUsed]);

  /** G-06.3: a reject chosen while the default is untouched clears it (focus or a click without one). */
  const clearsDefault = (o: GateOutcome) => !touched && o.verb === 'reject' && reason === fallback && fallback !== '';

  /** D37-4: Approve chosen after the reject rule emptied the field restores the default. */
  const restoresDefault = (o: GateOutcome) => !touched && o.verb === 'approve' && autoCleared && reason === '';

  const onOutcomeFocus = (o: GateOutcome) => {
    if (touched) return;
    if (clearsDefault(o)) {
      setReason('');
      setAutoCleared(true);
    } else if (restoresDefault(o)) {
      setReason(fallback);
      setAutoCleared(false);
    }
  };

  // One line per distinct reason the descriptor reports, in the outcomes' order (task-073 Q3, option
  // A): rules 1–4 of spec-003 §6 give every outcome the same one — the single line of v0.2 —, rule 5
  // (`state-limit`) only the approve. Each disabled outcome is described by its own reason's line.
  const blockedLines: { key: string; id: string; text: ReturnType<typeof reasonMessage> }[] = [];
  for (const o of view.outcomes) {
    if (o.enabled || !o.reason) continue;
    const key = reasonKey(o.reason);
    if (blockedLines.some((line) => line.key === key)) continue;
    const id = blockedLines.length === 0 ? blockedId : `${blockedId}-${blockedLines.length}`;
    blockedLines.push({ key, id, text: reasonMessage(o.reason) });
  }
  const lineOf = (o: GateOutcome) =>
    !o.enabled && o.reason ? blockedLines.find((line) => line.key === reasonKey(o.reason!))?.id : undefined;

  return (
    <section className="element-footer gate-footer" aria-labelledby={titleId}>
      <h3 id={titleId} className="section-title">
        <FormattedMessage id="element.gate.title" />
      </h3>
      {view.held && (
        <p id={heldId} className="gate-hint gate-held">
          <HoldText reason={view.held} />
        </p>
      )}
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
      {blockedLines.map(({ key, id, text }) => (
        <p key={key} id={id} className="gate-hint gate-blocked">
          <FormattedMessage {...text.descriptor} values={text.values} />
        </p>
      ))}
      {view.engineAdvance && (
        <p className="gate-hint">
          <FormattedMessage id="element.gate.engineAdvance" />
        </p>
      )}
      <div className="gate-actions">
        {view.outcomes.map((o) => {
          const disabled = !o.enabled || blank || busy || decided;
          const reasonId = lineOf(o) ?? (blank ? hintId : undefined);
          // A held gate's line describes each reject too (review F5).
          const describedBy = [view.held ? heldId : undefined, reasonId].filter(Boolean).join(' ') || undefined;
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
                // Its mirror: Approve after that automatic clear restores the default (D37-4, F13).
                if (restoresDefault(o)) {
                  setReason(fallback);
                  setAutoCleared(false);
                  return;
                }
                if (!disabled) onDecide(o, reason, () => setDecided(true));
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
