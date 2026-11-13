/**
 * The text of a held gate's reason (spec-005 §4a, spec-003 §3; task-069 D69-10, D69-11): the
 * catalogue's `element.reason.<code>` with its parameters, shown by the gate footer and by Today's
 * *Waiting on others* row (one text per code). REQ-ARC-05: the code is data from the descriptor.
 */
import type { HoldReason } from '@wingfoil-ui/contracts';
import type { ReactNode } from 'react';
import { FormattedMessage } from 'react-intl';

/** The catalogue text of `reason`. */
export function HoldText({ reason }: { reason: HoldReason }): ReactNode {
  return reason.code === 'held-by-config' ? (
    <FormattedMessage id="element.reason.heldByConfig" />
  ) : (
    <FormattedMessage id="element.reason.heldUntilReferencesDone" values={{ count: reason.count }} />
  );
}
