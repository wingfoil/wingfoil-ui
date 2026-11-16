/**
 * *Use preset* on Configuration › Taxonomy (task-079, AC-1; spec-005 §5; ux-reference §4.11, §5;
 * D79-2 … D79-7): a section right after the tab's intro (Q3 (a)) with the button — hidden, disabled
 * with its reason (the element footer's texts and *Update* link), or offered (`presetControl`) — and
 * the dialog that applies one of the shipped presets through task-060's route as one `chore(ui)`
 * commit, naming the file and the commit before Confirm.
 *
 * - The dialog closes with Cancel or Escape, never with a click outside it (ux-reference §5); while
 *   the write runs its buttons are disabled, Escape is ignored and a polite status says so.
 * - The dialog and the write outlive the button (D79-5, Q2 (a)): the server announces the commit
 *   before it answers (bug-046's lesson), so `/config` may read the new file and hide the button
 *   while the answer is on its way; the dialog stays until the answer, and a state that changes while
 *   it is open is the server's to refuse, with the refusal's text.
 * - The result is a toast (`useUiPresetWrite`); then the focus goes to *Use preset* when it is still
 *   shown (Cancel, Escape, a refusal), else to the main region (an applied preset hides it).
 * - After the reason's *Update* succeeds and the reason goes away, the focus moves to *Use preset*
 *   when it was on the link or nowhere (D79-6; the bug-046 rule: never left on `<body>`).
 */
import { useQuery } from '@tanstack/react-query';
import type { UiConfig, UiPresetId } from '@wingfoil-ui/contracts';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button, Dialog, Heading, Label, Modal, ModalOverlay, Radio, RadioGroup } from 'react-aria-components';
import { FormattedMessage } from 'react-intl';
import { projectHeaderQuery } from '../api/queries.js';
import { useUiPresetWrite } from '../api/ui-config.js';
import { ReasonText } from '../element/reason.js';
import { PRESET_IDS, presetControl } from './preset-control.js';
import { PresetName } from './preset-toast.js';
import { selectorOf } from './selector.js';

/** Where the focus goes once the dialog is closed. */
type FocusAfter = 'control' | 'main' | null;

/** *Use preset* for project `pid`, whose served `ui` section is `ui`. */
export function UsePreset({ pid, ui }: { pid: string; ui: UiConfig }): ReactNode {
  const headerQuery = useQuery(projectHeaderQuery(pid));
  const header = headerQuery.data;
  const control = presetControl(header, ui);
  const write = useUiPresetWrite();
  const pending = write.isPending;
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<UiPresetId | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const section = useRef<HTMLElement>(null);
  const focusAfter = useRef<FocusAfter>(null);
  const focusAfterUpdate = useRef(false);
  // When the reason's *Update* succeeded: the first header read after it decides (review round 1 F-5).
  const updateSucceededAt = useRef<number | undefined>(undefined);
  const headingId = useId();
  const reasonId = useId();

  // Once the dialog is closed: before React Aria's own restore (a frame later), which then leaves the
  // focus where it is.
  useEffect(() => {
    if (open || focusAfter.current === null) return;
    const target = focusAfter.current;
    focusAfter.current = null;
    if (target === 'control' && button.current?.isConnected) button.current.focus();
    else document.getElementById('main')?.focus();
  }, [open]);

  // D79-6: the reason's *Update* succeeded and its link is gone.
  useEffect(() => {
    const since = updateSucceededAt.current;
    if (since !== undefined && headerQuery.dataUpdatedAt >= since) {
      updateSucceededAt.current = undefined;
      // The copy still blocks after the update (diverged, or another reason): the request is dropped, so
      // a later, unrelated enablement never moves the focus (review round 1 F-5).
      if (control.kind !== 'enabled') focusAfterUpdate.current = false;
    }
    if (!focusAfterUpdate.current || control.kind !== 'enabled') return;
    focusAfterUpdate.current = false;
    const active = document.activeElement;
    if (active === null || active === document.body || section.current?.contains(active)) button.current?.focus();
  });

  const close = (then: FocusAfter): void => {
    focusAfter.current = then;
    setOpen(false);
    setChoice(null);
  };
  const confirm = (): void => {
    if (choice === null || pending) return;
    write.mutate({ pid, preset: choice }, { onSuccess: () => close('main'), onError: () => close('control') });
  };

  const disabled = control.kind !== 'enabled';
  return (
    <>
      {control.kind !== 'hidden' && (
        <section ref={section} className="preset-section" aria-labelledby={headingId}>
          <h3 id={headingId} className="config-subtitle">
            <FormattedMessage id="settings.preset.title" />
          </h3>
          <p className="config-help">
            <FormattedMessage id="settings.preset.help" />
          </p>
          {control.kind === 'disabled' && (
            <p id={reasonId} className="gate-hint gate-blocked preset-blocked">
              <ReasonText
                reason={control.reason}
                link={{
                  pid,
                  onStarted: () => {
                    focusAfterUpdate.current = true;
                    updateSucceededAt.current = undefined;
                  },
                  onSucceeded: () => {
                    updateSucceededAt.current = Date.now();
                  },
                  onFailed: () => {
                    focusAfterUpdate.current = false;
                    updateSucceededAt.current = undefined;
                  },
                }}
              />
            </p>
          )}
          {/* A native button: focusable while disabled, the reason as its description (D37-3). */}
          <button
            ref={button}
            type="button"
            className="button button-primary preset-open"
            aria-disabled={disabled ? true : undefined}
            aria-describedby={control.kind === 'disabled' ? reasonId : undefined}
            onClick={() => {
              if (!disabled && !pending) setOpen(true);
            }}
          >
            <FormattedMessage id="settings.preset.open" />
          </button>
        </section>
      )}
      <PresetDialog
        isOpen={open}
        isPending={pending}
        choice={choice}
        onChoose={setChoice}
        onCancel={() => close('control')}
        onConfirm={confirm}
      />
    </>
  );
}

/** Props of {@link PresetDialog}. */
interface PresetDialogProps {
  isOpen: boolean;
  isPending: boolean;
  choice: UiPresetId | null;
  onChoose(preset: UiPresetId): void;
  onCancel(): void;
  onConfirm(): void;
}

/** The dialog: the three presets with what each is made for, the file and the commit, Confirm and Cancel. */
function PresetDialog({ isOpen, isPending, choice, onChoose, onCancel, onConfirm }: PresetDialogProps): ReactNode {
  const effectId = useId();
  const choiceId = useId();
  return (
    <ModalOverlay
      className="modal-overlay"
      isOpen={isOpen}
      isKeyboardDismissDisabled={isPending}
      onOpenChange={(next) => {
        if (!next && !isPending) onCancel();
      }}
    >
      <Modal className="modal">
        <Dialog className="dialog preset-dialog">
          <Heading slot="title" className="dialog-title">
            <FormattedMessage id="settings.preset.title" />
          </Heading>
          <RadioGroup
            className="preset-choices"
            value={choice}
            isDisabled={isPending}
            onChange={(value) => onChoose(value as UiPresetId)}
          >
            <Label className="preset-legend">
              <FormattedMessage id="settings.preset.legend" />
            </Label>
            {PRESET_IDS.map((id) => (
              <Radio
                key={id}
                value={id}
                className="preset-choice"
                aria-labelledby={`${choiceId}-${id}-name`}
                aria-describedby={`${choiceId}-${id}-note`}
              >
                <span id={`${choiceId}-${id}-name`} className="preset-choice-name">
                  <PresetName preset={id} />
                </span>
                <span id={`${choiceId}-${id}-note`} className="preset-choice-note">
                  <FormattedMessage id="settings.preset.madeFor" values={{ preset: selectorOf(id) }} />
                </span>
              </Radio>
            ))}
          </RadioGroup>
          {choice !== null && (
            <p id={effectId} className="preset-effect">
              <FormattedMessage
                id="settings.preset.effect"
                values={{
                  commit: (
                    <code key="commit">
                      <FormattedMessage
                        id="settings.preset.commit"
                        values={{ name: <PresetName key="name" preset={choice} /> }}
                      />
                    </code>
                  ),
                }}
              />
            </p>
          )}
          <p className="visually-hidden" role="status">
            {isPending && <FormattedMessage id="settings.preset.pending" />}
          </p>
          <div className="dialog-actions">
            <Button className="button" isDisabled={isPending} onPress={onCancel}>
              <FormattedMessage id="common.action.cancel" />
            </Button>
            <Button
              className="button button-primary"
              isDisabled={choice === null || isPending}
              {...(choice !== null ? { 'aria-describedby': effectId } : {})}
              onPress={onConfirm}
            >
              <FormattedMessage id="settings.preset.confirm" />
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
