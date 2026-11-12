/**
 * *Update* inside the element footer's copy-behind reason (task-040, G-12.1, G-12.2, D40-2): a native
 * button styled as a link that runs the same update as the sidebar (`useGitOperation`, no body; an
 * update cannot be cancelled, RP-37). While any transport of the project runs — from here or from
 * the sidebar — it is aria-disabled and a press is ignored (D40-4). A refusal shows in the sidebar:
 * the last update error, or its alert when the server does not record it (D40-5, review R2);
 * `onStarted` (when the press starts an update) and `onFailed` (a refusal while the link is still
 * shown) let the footer move the focus once the new descriptor arrives — whichever of the update's
 * reply and the `repo` refresh comes first: a refresh can remove the link, and with it this
 * component and its per-call callbacks, before the reply (task-077 security review round 2, R2-2).
 */
import type { ReactNode } from 'react';
import { startGitOperation, useGitOperation, useRunningGitOperation } from '../api/git.js';
import './git-status.css';

/** Props of {@link UpdateLink}. */
export interface UpdateLinkProps {
  pid: string;
  children: ReactNode;
  /** Called when a press starts the update. */
  onStarted?(): void;
  /** Called when the update failed while the link is still shown. */
  onFailed?(): void;
}

/** The link. */
export function UpdateLink({ pid, children, onStarted, onFailed }: UpdateLinkProps): ReactNode {
  const operation = useGitOperation();
  const busy = useRunningGitOperation(pid) !== undefined;
  return (
    <button
      type="button"
      className="link-button update-link"
      aria-disabled={busy ? true : undefined}
      onClick={() => {
        if (busy) return;
        const started = startGitOperation(
          operation.mutate,
          { pid, op: 'update' },
          onFailed ? { onError: () => onFailed() } : undefined,
        );
        if (started) onStarted?.();
      }}
    >
      {children}
    </button>
  );
}
