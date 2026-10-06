/**
 * The state machine of the element as chips (ux-reference §4.2): past · current · future along the
 * type's `sequence` (`model.stateChips`). The current chip takes the descriptor's tone as data
 * (`tone-<tone>`, spec-003 §7–§8); each chip's position is also given as text for assistive
 * technology, and the current one is `aria-current="step"`.
 */
import type { Tone } from '@wingfoil-ui/contracts';
import type { ReactNode } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { stateChips, type ChipPosition } from './model.js';

const POSITION = defineMessages({
  past: { id: 'element.states.past' },
  current: { id: 'element.states.current' },
  future: { id: 'element.states.future' },
});

/** Props of {@link StateMachine}. */
export interface StateMachineProps {
  /** The type's `sequence`; absent when the type definitions could not be read. */
  sequence: readonly string[] | undefined;
  current: string;
  /** The descriptor's tone of the current state; absent without a descriptor. */
  tone: Tone | undefined;
}

function chipClass(position: ChipPosition, tone: Tone | undefined): string {
  const base = `state-chip state-chip-${position}`;
  return position === 'current' && tone ? `${base} tone-${tone}` : base;
}

/** The chips of the state machine. */
export function StateMachine({ sequence, current, tone }: StateMachineProps): ReactNode {
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
          {chip.name}
          {chip.position !== 'other' && (
            <span className="visually-hidden">
              <FormattedMessage {...POSITION[chip.position]} />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
