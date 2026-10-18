/**
 * An API error rendered from the catalogue (spec-008 §4), for the screens that show one: the
 * message of its code with the detail as arguments, plus the tool output verbatim for
 * `cli-refused` and `git-refused`.
 */
import type { ReactNode } from 'react';
import { FormattedMessage } from 'react-intl';
import type { ApiError } from '../api/client.js';
import { errorMessage } from '../api/error-message.js';

/** Arguments of a catalogue text that are names git gives (S3-2). */
const GIT_NAMES = ['files', 'upstream', 'branch'] as const;

/**
 * `values` with each name git gives (a file in the way, an upstream, a branch) in a `git-name` span:
 * shown left to right with no bidi reordering, whatever bidi character the name holds (task-040,
 * review round 3 S3-2).
 */
export function withGitNames<V extends Record<string, unknown>>(values: V): V {
  const out: Record<string, unknown> = { ...values };
  for (const k of GIT_NAMES) {
    const v = values[k];
    if (typeof v === 'string') {
      out[k] = (
        <span className="git-name" key={k}>
          {v}
        </span>
      );
    }
  }
  return out as V;
}

/** Props of {@link ErrorText}. */
export interface ErrorTextProps {
  error: Pick<ApiError, 'code' | 'message' | 'detail'>;
}

/** The error's message, and the tool output when there is one. */
export function ErrorText({ error }: ErrorTextProps): ReactNode {
  const { descriptor, values, verbatim } = errorMessage(error);
  return (
    <>
      <p>
        <FormattedMessage {...descriptor} values={withGitNames(values)} />
      </p>
      {verbatim !== undefined && <pre className="verbatim">{verbatim}</pre>}
    </>
  );
}
