/**
 * The state machine of the element as chips (ux-reference §4.2): past · current · future along the
 * type's `sequence` (`model.stateChips`). The current chip takes the descriptor's tone as data
 * (`tone-<tone>`, spec-003 §7–§8). Assistive technology reads one message per chip — the state and
 * its position, e.g. "pending, current state" — instead of the visible name; the current chip is
 * `aria-current="step"`. A final current state — no verb and no one to act (task-037, S-24.1,
 * D37-7) — reads "ready, final state".
 */
import type { Tone } from '@wingfoil-ui/contracts';
import type { ReactNode } from 'react';
import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { stateChips, type ChipPosition } from './model.js';

/** The accessible text of a chip: its state and its position (the visible name is hidden from it). */
const POSITION: Readonly<Record<ChipPosition, MessageDescriptor>> = defineMessages({
  past: { id: 'element.states.past' },
  current: { id: 'element.states.current' },
  future: { id: 'element.states.future' },
  other: { id: 'element.states.other' },
});

/** The accessible text of the current chip of a final state (task-037, D37-7). */
const FINAL: MessageDescriptor = defineMessages({ final: { id: 'element.states.final' } }).final;

/** Props of {@link StateMachine}. */
export interface StateMachineProps {
  /** The type's `sequence`; absent when the type definitions could not be read. */
  sequence: readonly string[] | undefined;
  current: string;
  /** The descriptor's tone of the current state; absent without a descriptor. */
  tone: Tone | undefined;
  /** The current state is final (`isFinal` of the descriptor). */
  final?: boolean;
}

function chipClass(position: ChipPosition, tone: Tone | undefined): string {
  const base = `state-chip state-chip-${position}`;
  return position === 'current' && tone ? `${base} tone-${tone}` : base;
}

/** The chips of the state machine. */
export function StateMachine({ sequence, current, tone, final = false }: StateMachineProps): ReactNode {
  const intl = useIntl();
  return (
    <ol className="state-machine" aria-label={intl.formatMessage({ id: 'element.states.label' })}>
      {stateChips(sequence, current).map((chip) => (
        <li
          key={`${chip.position}:${chip.name}`}
          className={chipClass(chip.position, tone)}
          data-position={chip.position}
          aria-current={chip.position === 'current' ? 'step' : undefined}
        >
          <span aria-hidden="true">{chip.name}</span>
          <span className="visually-hidden">
            {intl.formatMessage(final && chip.position === 'current' ? FINAL : POSITION[chip.position], {
              state: chip.name,
            })}
          </span>
        </li>
      ))}
    </ol>
  );
}
