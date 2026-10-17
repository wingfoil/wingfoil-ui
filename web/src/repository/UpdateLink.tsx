/**
 * *Update* inside the element footer's copy-behind reason (task-040, G-12.1, G-12.2, D40-2): a native
 * button styled as a link that runs the same update as the sidebar (`useGitOperation`, no body; an
 * update cannot be cancelled, RP-37). While any transport of the project runs — from here or from
 * the sidebar — it is aria-disabled and a press is ignored (D40-4). A refusal shows in the sidebar
 * (the last update error, D40-5); `onUpdated` lets the footer move the focus once the new
 * descriptor arrives.
 */
import type { ReactNode } from 'react';
import { useGitOperation, useRunningGitOperation } from '../api/git.js';
import './git-status.css';

/** Props of {@link UpdateLink}. */
export interface UpdateLinkProps {
  pid: string;
  children: ReactNode;
  /** Called after a successful update. */
  onUpdated?(): void;
}

/** The link. */
export function UpdateLink({ pid, children, onUpdated }: UpdateLinkProps): ReactNode {
  const operation = useGitOperation();
  const busy = useRunningGitOperation(pid) !== undefined;
  return (
    <button
      type="button"
      className="link-button update-link"
      aria-disabled={busy ? true : undefined}
      onClick={() => {
        if (busy) return;
        operation.mutate({ pid, op: 'update' }, { ...(onUpdated ? { onSuccess: () => onUpdated() } : {}) });
      }}
    >
      {children}
    </button>
  );
}
