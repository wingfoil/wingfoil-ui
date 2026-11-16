/**
 * The `ui.yaml` warning (spec-005 §2, spec-012 §2; task-064 D64-6, Q4 (a)): when the server ignored
 * `.wingfoil/ui.yaml` (`status.source` `ignored`), "ui.yaml ignored: {failure}" — `failure` as the
 * server sent it, already through its sanitiser. A static paragraph read in the page's order, not an
 * alert: it would be announced again at every refetch (the ARIA role `note` is a fixture type's name,
 * which REQ-ARC-05 keeps out of the code). Shared by the views that read a `ui` status: the Configuration tabs
 * (task-064), Today (task-065) and Traceability (task-067). Nothing is rendered otherwise.
 */
import type { UiConfigStatus } from '@wingfoil-ui/contracts';
import type { ReactNode } from 'react';
import { FormattedMessage } from 'react-intl';
import './ui-yaml-warning.css';

/** Props of {@link UiYamlWarning}. */
export interface UiYamlWarningProps {
  /** The `ui` status of the answer (`/config` `ui.status`, `/progress` `ui`, `/traceability` `ui`). */
  status: UiConfigStatus | undefined;
  /** Extra class names (the view's placement). */
  className?: string;
}

/** The warning, when the file was ignored. */
export function UiYamlWarning({ status, className }: UiYamlWarningProps): ReactNode {
  if (status?.source !== 'ignored' || status.warning === undefined) return null;
  return (
    <p className={className ? `ui-yaml-warning ${className}` : 'ui-yaml-warning'}>
      <FormattedMessage id="shell.uiYaml.ignored" values={{ failure: status.warning.failure }} />
    </p>
  );
}
