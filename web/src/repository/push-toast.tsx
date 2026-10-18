/**
 * The toast of a failed *Push* from the sidebar (task-040, D40-5; Y-08.2; ux-reference §5): red and
 * sticky, "Not pushed — the commit stays local" (or "N commits stay local"), then the error — git's
 * text verbatim in the `error.gitRefused` frame (local folders and URL userinfo already redacted by
 * the server, spec-010 §4) or a catalogue text (a spec-010 §5 code, `not-in-team`, `internal`, …).
 * Keyed by the project, so a new push replaces the previous one.
 */
import { FormattedMessage } from 'react-intl';
import type { ApiError } from '../api/client.js';
import { ErrorText } from '../shell/ErrorText.js';
import type { ToastInput } from '../shell/toasts.js';

/** The toast key of a project's push result. */
export function pushToastKey(pid: string): string {
  return `push:${pid}`;
}

/**
 * The toast of a push of `commits` commits that `error` refused; `project` names the project when
 * the page shows another one (review round 2 R2-4).
 */
export function pushFailureToast(
  pid: string,
  commits: number,
  error: Pick<ApiError, 'code' | 'message' | 'detail'>,
  project?: string,
): ToastInput {
  return {
    key: pushToastKey(pid),
    tone: 'error',
    sticky: true,
    title:
      project === undefined ? (
        <FormattedMessage id="shell.git.pushFailed" values={{ count: commits }} />
      ) : (
        <FormattedMessage id="shell.git.pushFailedIn" values={{ count: commits, project }} />
      ),
    body: <ErrorText error={error} />,
  };
}
