/**
 * Who must act on an element (spec-003 §4, §5, §8; ux-reference §4.1 *Waiting on others*, §4.8
 * v0.3 *Inline detail*): shared by Today's *Waiting on others* rows and the Traceability detail
 * (task-081, D81-1, extracted from Today's `Who` and `waitingWho` unchanged). Read from the action
 * descriptor only — the actor and a held gate's hold come from the server, never re-derived — and
 * rendered with the texts of *Waiting on others*: "Jordan (submitter) must act", "Reserved to
 * approver — Morgan, Alex", "Waiting for the workflow engine", a held gate's reason, nothing for no
 * one.
 */
import type { ActionDescriptor, HoldReason } from '@wingfoil-ui/contracts';
import type { ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { HoldText } from './HoldText.js';

/** Who must act (D36-6). */
export type WaitingWho =
  | { kind: 'member'; name: string; basis?: string }
  | { kind: 'role'; role: string; members: string[] }
  | { kind: 'engine' }
  /** A held gate (v0.3, spec-003 §5): its hold's reason in place of "Reserved to approver". */
  | { kind: 'held'; reason: HoldReason }
  | { kind: 'none' };

/** Who must act on the element of `descriptor`, from its actor (spec-003 §4, §8). */
export function whoMustAct(descriptor: ActionDescriptor): WaitingWho {
  const { actor, approveHeld } = descriptor;
  if (approveHeld) return { kind: 'held', reason: approveHeld.reason };
  switch (actor.kind) {
    case 'member':
      return actor.member === undefined
        ? { kind: 'none' }
        : { kind: 'member', name: actor.member.name, ...(actor.basis ? { basis: actor.basis } : {}) };
    case 'role':
      return actor.role === undefined
        ? { kind: 'none' }
        : { kind: 'role', role: actor.role, members: actor.members ?? [] };
    case 'engine':
      return { kind: 'engine' };
    case 'none':
      return { kind: 'none' };
  }
}

/** Whether {@link WhoMustAct} renders anything for `descriptor`. */
export function namesSomeone(descriptor: ActionDescriptor): boolean {
  return whoMustAct(descriptor).kind !== 'none';
}

/**
 * The text of who must act. The members' list keeps Today's class `today-members` (its own
 * element: a list of names is data, which the catalogue check reads alone), so Today's markup is
 * the same as before the extraction (D81-2, `test/web/today/who-pinned.test.tsx`).
 */
export function WhoMustAct({ descriptor }: { descriptor: ActionDescriptor }): ReactNode {
  const intl = useIntl();
  const who = whoMustAct(descriptor);
  switch (who.kind) {
    case 'member':
      return who.basis === undefined ? (
        <FormattedMessage id="today.waiting.memberNoBasis" values={{ name: who.name }} />
      ) : (
        <FormattedMessage id="today.waiting.member" values={{ name: who.name, basis: who.basis }} />
      );
    case 'role':
      return who.members.length === 0 ? (
        <FormattedMessage id="today.waiting.roleNoMember" values={{ role: who.role }} />
      ) : (
        <FormattedMessage
          id="today.waiting.role"
          values={{
            role: who.role,
            members: (
              <span className="today-members">{intl.formatList(who.members, { type: 'unit', style: 'short' })}</span>
            ),
          }}
        />
      );
    case 'engine':
      return <FormattedMessage id="today.waiting.engine" />;
    case 'held':
      return <HoldText reason={who.reason} />;
    case 'none':
      return null;
  }
}
