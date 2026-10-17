/**
 * What the element panel's footer shows (task-037; spec-003 §3, §4, §6; ux-reference §4.2): a pure
 * reading of the action descriptor (its verbs with their role and enablement, its actor) and of the
 * user's identity from the project header. Nothing here knows a type, a state or a kind name
 * (REQ-ARC-05): the descriptor is rendered, never re-derived (spec-003 §8). The order of the rules
 * is decision D37-5:
 *
 * 1. a user who is not identified as one member gets only a read-only line (S-13.2, S-15.2);
 * 2. no gate verb — a `submit`: the single-action footer (task-038, D38-6, D38-7: every member,
 *    `submit` requires no role on WingFoil 0.2.2); the workflow engine acts (`waiting`, S-24.2,
 *    S-24.3, RP-13); no one acts (`final`, S-24.1, D37-7); or nothing (an undeclared state: its
 *    chip says it);
 * 3. a gate verb whose role the member does not hold → informational (G-09.x, REQ-SEC-07, D37-6);
 * 4. otherwise the gate footer: every outcome, approve first (D37-2), each with the descriptor's
 *    enablement, and the engine note of a state that is both a gate and a waiting state (S-24.4).
 */
import type { ActionDescriptor, DescriptorVerb, DisabledReason, ProjectHeader } from '@wingfoil-ui/contracts';
import { joinEmail } from '../project/join.js';

/** A verb of the gate footer. */
export type GateVerb = 'approve' | 'reject';

/** One outcome button of the gate footer. */
export interface GateOutcome {
  verb: GateVerb;
  /** The state the outcome leads to. */
  to: string;
  /** Whether the four rules of spec-003 §6 hold (the reason field is checked by the footer). */
  enabled: boolean;
  /** The first failing rule, when not enabled. */
  reason?: DisabledReason;
}

/** What the footer shows. */
export type FooterView =
  /** Not identified in the team: the read-only line, with *How to join* when it applies (D35-8). */
  | { kind: 'readOnly'; email?: string }
  /** No verb, the workflow engine acts. */
  | { kind: 'waiting'; state: string }
  /** No verb, no one acts. */
  | { kind: 'final' }
  /** Nothing in this footer. */
  | { kind: 'none' }
  /** The single-action footer: *Submit → to*, with the descriptor's enablement (task-038). */
  | { kind: 'submit'; to: string; enabled: boolean; reason?: DisabledReason }
  /** The gate's role is not the member's: who can act. `members` is absent when unknown. */
  | { kind: 'reserved'; role: string; members?: string[]; engineAdvance: boolean }
  /** Every outcome, approve first. */
  | { kind: 'gate'; outcomes: GateOutcome[]; approve: boolean; engineAdvance: boolean };

function isGateVerb(v: DescriptorVerb): v is DescriptorVerb & { verb: GateVerb } {
  return v.verb === 'approve' || v.verb === 'reject';
}

/** The footer of an element whose descriptor is `descriptor`, for the user of `header`. */
export function footerView(descriptor: ActionDescriptor, header: ProjectHeader): FooterView {
  const identity = header.identity;
  if (identity.kind !== 'member') {
    const email = joinEmail(header);
    return email === undefined ? { kind: 'readOnly' } : { kind: 'readOnly', email };
  }
  const gate = descriptor.verbs.filter(isGateVerb);
  const engine = descriptor.actor.kind === 'engine';
  if (gate.length === 0) {
    const submit = descriptor.verbs.find((v) => v.verb === 'submit');
    if (submit) {
      return {
        kind: 'submit',
        to: submit.to,
        enabled: submit.enabled,
        ...(submit.reason ? { reason: submit.reason } : {}),
      };
    }
    if (descriptor.verbs.length > 0) return { kind: 'none' };
    if (engine) return { kind: 'waiting', state: descriptor.status };
    if (descriptor.actor.kind === 'none') return { kind: 'final' };
    return { kind: 'none' };
  }
  const missing = gate.find((v) => v.role !== null && !identity.roles.includes(v.role));
  if (missing?.role) {
    const members = descriptor.actor.kind === 'role' ? descriptor.actor.members : undefined;
    return {
      kind: 'reserved',
      role: missing.role,
      ...(members && members.length > 0 ? { members } : {}),
      engineAdvance: engine,
    };
  }
  const outcomes = [...gate.filter((v) => v.verb === 'approve'), ...gate.filter((v) => v.verb === 'reject')].map(
    (v): GateOutcome => ({
      verb: v.verb,
      to: v.to,
      enabled: v.enabled,
      ...(v.reason ? { reason: v.reason } : {}),
    }),
  );
  return { kind: 'gate', outcomes, approve: outcomes.some((o) => o.verb === 'approve'), engineAdvance: engine };
}

/** Whether `reason` is empty for the CLI: nothing but whitespace (G-07.2). */
export function isBlank(reason: string): boolean {
  return reason.trim() === '';
}

/** Whether the element is final: no verb and no one to act (S-24.1, D37-7). */
export function isFinal(descriptor: ActionDescriptor | undefined): boolean {
  return descriptor !== undefined && descriptor.verbs.length === 0 && descriptor.actor.kind === 'none';
}
