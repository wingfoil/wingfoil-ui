/** An error of a documentation query, rendered from the catalogue. */
import type { ReactNode } from 'react';
import { ApiError } from '../api/client.js';
import { ErrorText } from '../shell/ErrorText.js';

/** The kinds of a refused working-tree path (spec-004 §5) the document page names. */
const REFUSED_KINDS = new Set(['outside', 'missing', 'not-allowed', 'too-large']);

/** The refusal kind of a 404 of `/files/content`, if `error` is one. */
export function refusedKind(error: unknown): string | undefined {
  if (!(error instanceof ApiError) || error.code !== 'not-found') return undefined;
  const kind = (error.detail as { kind?: unknown } | undefined)?.kind;
  return typeof kind === 'string' && REFUSED_KINDS.has(kind) ? kind : undefined;
}

/** `error` as an alert, through `ErrorText`. */
export function QueryError({ error }: { error: Error }): ReactNode {
  const e = error instanceof ApiError ? error : new ApiError(0, 'internal', error.message, undefined);
  return (
    <div className="docs-error" role="alert">
      <ErrorText error={e} />
    </div>
  );
}
