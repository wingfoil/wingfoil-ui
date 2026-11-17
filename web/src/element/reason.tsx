/**
 * The texts of the disabled reasons (spec-003 §6, spec-008 §4 `<area>.reason.<code>`) and the *Update*
 * link of the copy-behind reason (task-040, D40-2), shared by the element footer (task-037, task-038)
 * and *Use preset* on Configuration › Taxonomy (task-079, D79-6): moved here from `ElementFooter.tsx`
 * unchanged.
 */
import type { DisabledReason } from '@wingfoil-ui/contracts';
import { createContext, useContext, type ReactNode } from 'react';
import { defineMessages, FormattedMessage, type MessageDescriptor } from 'react-intl';
import { UpdateLink } from '../repository/UpdateLink.js';

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

/** The callbacks of the *Update* link of the copy-behind reason: the project and the caller's focus rule (D40-2). */
export interface ReasonLinkContext {
  pid: string;
  onStarted(): void;
  onSucceeded(): void;
  onFailed(): void;
}

/** The project and the caller's callbacks for the *Update* link of the copy-behind reason (D40-2). */
export const ReasonLink = createContext<ReasonLinkContext | null>(null);

/** *Update* in the copy-behind reason (G-12.1, G-12.2): the sidebar's update, from the reason. */
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
export function reasonMessage(reason: DisabledReason): {
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

/** Props of {@link ReasonText}. */
export interface ReasonTextProps {
  reason: DisabledReason;
  /** The *Update* link's project and callbacks; without them the copy-behind reason has no link. */
  link?: ReasonLinkContext;
}

/** A reason's text, with its *Update* link when `link` is given (task-079, D79-6). */
export function ReasonText({ reason, link }: ReasonTextProps): ReactNode {
  const text = reasonMessage(reason);
  const message = <FormattedMessage {...text.descriptor} values={text.values} />;
  return link ? <ReasonLink.Provider value={link}>{message}</ReasonLink.Provider> : message;
}
