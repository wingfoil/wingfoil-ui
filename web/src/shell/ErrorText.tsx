/**
 * An API error rendered from the catalogue (spec-008 §4), for the screens that show one: the
 * message of its code with the detail as arguments, plus the tool output verbatim for
 * `cli-refused` and `git-refused`.
 */
import type { ReactNode } from 'react';
import { FormattedMessage } from 'react-intl';
import type { ApiError } from '../api/client.js';
import { errorMessage } from '../api/error-message.js';

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
        <FormattedMessage {...descriptor} values={values} />
      </p>
      {verbatim !== undefined && <pre className="verbatim">{verbatim}</pre>}
    </>
  );
}
