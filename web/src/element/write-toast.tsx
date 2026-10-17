/**
 * The toast of a governed write (task-038; ux-reference §5 *Feedback*; spec-004 §5):
 *
 * - success (D38-3): "Approved <id>" (Submitted, Rejected), one line per commit — the short hash
 *   and the subject of the `wf(…)` commit — and "pushed" when the auto-push pushed it;
 * - a failed auto-push (D38-4): the write still succeeded, so the toast stays polite, but it is
 *   sticky and says "Not pushed — the commit stays local" with the reason: a code from the
 *   catalogue (`push-timeout`, `internal`, a spec-010 §5 code), or git's message verbatim;
 * - a refusal (D38-5): a red toast, "<Verb> of <id> not done", and the error from the catalogue
 *   (`cli-refused` with the CLI's text verbatim, `element-changed`, `write-incomplete`, …).
 *
 * Keyed by the element, so a new result replaces the previous one (D38-2).
 */
import type { WriteResponse } from '@wingfoil-ui/contracts';
import { FormattedMessage } from 'react-intl';
import type { ApiError } from '../api/client.js';
import type { ElementWriteVariables } from '../api/writes.js';
import { ErrorText } from '../shell/ErrorText.js';
import type { ToastInput } from '../shell/toasts.js';

/** Characters of a commit hash shown in a toast (`git log --oneline`'s minimum). */
export const SHORT_SHA = 7;

/** The toast key of an element's write result. */
export function writeToastKey(v: Pick<ElementWriteVariables, 'pid' | 'eid'>): string {
  return `write:${v.pid}:${v.eid}`;
}

/** The toast of a successful write. */
export function writeSuccessToast(v: ElementWriteVariables, data: WriteResponse): ToastInput {
  const failed = data.push.status === 'failed';
  return {
    key: writeToastKey(v),
    tone: 'success',
    ...(failed ? { sticky: true } : {}),
    title: <FormattedMessage id="element.write.done" values={{ verb: v.verb, id: v.eid }} />,
    body: (
      <>
        {data.commits.length > 0 && (
          <ul className="toast-commits">
            {data.commits.map((c) => (
              <li key={c.sha}>
                <FormattedMessage
                  id="element.write.commit"
                  values={{ sha: <code>{c.sha.slice(0, SHORT_SHA)}</code>, subject: c.subject }}
                />
              </li>
            ))}
          </ul>
        )}
        {data.push.status === 'pushed' && (
          <p className="toast-pushed">
            <FormattedMessage id="element.write.pushed" />
          </p>
        )}
        {failed && (
          <>
            <p className="toast-attention">
              <FormattedMessage id="element.write.notPushed" />
            </p>
            <ErrorText
              error={
                data.push.code === undefined && data.push.message !== undefined
                  ? { code: 'git-refused', message: data.push.message, detail: undefined }
                  : { code: data.push.code ?? 'internal', message: '', detail: undefined }
              }
            />
          </>
        )}
      </>
    ),
  };
}

/** The toast of a refused write. */
export function writeRefusalToast(v: ElementWriteVariables, error: ApiError): ToastInput {
  return {
    key: writeToastKey(v),
    tone: 'error',
    title: <FormattedMessage id="element.write.refused" values={{ verb: v.verb, id: v.eid }} />,
    body: <ErrorText error={error} />,
  };
}
