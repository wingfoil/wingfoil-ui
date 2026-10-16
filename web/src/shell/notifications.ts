/**
 * Pure helpers of the notification bell (task-042; ux-reference §3 *Notifications*; spec-003 §5,
 * spec-002 §1): the count of the bell and one line of its *Updates*. Nothing here knows a type,
 * state or role name (REQ-ARC-05): they are the project's data.
 */
import type { MemoryEventEntry, Today } from '@wingfoil-ui/contracts';
import { memberName } from '../element/model.js';

/**
 * The bell's count: the length of Requires you (spec-003 §5); `undefined` without a Today read or
 * for a user who is not identified (`requiresYou: null`), who has nothing to unblock.
 */
export function bellCount(today: Today | undefined): number | undefined {
  return today?.requiresYou?.length;
}

/** One line of the bell's *Updates*. */
export interface UpdateLine {
  sha: string;
  /** The element's id. */
  id: string;
  operation: MemoryEventEntry['operation'];
  /** Who did it: the approver of an approve or reject, else the commit author (as the history). */
  name: string;
  from: string | null;
  to: string | null;
  /** ISO 8601. */
  timestamp: string;
}

/** The line of a Memory event. */
export function updateLine(event: MemoryEventEntry): UpdateLine {
  return {
    sha: event.sha,
    id: event.id,
    operation: event.operation,
    name: memberName(event.approver ?? event.author),
    from: event.from,
    to: event.to,
    timestamp: event.timestamp,
  };
}
