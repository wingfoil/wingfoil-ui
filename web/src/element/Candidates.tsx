/**
 * The candidates of an ambiguous short id (spec-011 §3, the 409 `ambiguous-id`; ux-reference §4.2
 * v0.3, dl-012 R2; task-062 D62-5): shown instead of *not found*, each candidate a link to its
 * element page — the type, the short id, the title and the state as the server answered them (the
 * title already through the character escape of repository texts, rendered as text).
 */
import type { AmbiguousCandidate, AmbiguousIdDetail } from '@wingfoil-ui/contracts';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { ApiError } from '../api/client.js';
import { isPathSyntaxId } from './queries.js';

function isText(value: unknown): value is string {
  return typeof value === 'string';
}

function isCandidate(value: unknown): value is AmbiguousCandidate {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  // A candidate's id becomes a link to its page: never one the URL parser reads as path syntax.
  return (
    [c['id'], c['shortId'], c['title'], c['type'], c['status']].every(isText) && !isPathSyntaxId(c['id'] as string)
  );
}

/** The detail of a 409 `ambiguous-id` of the contract's shape, else `undefined` (shown as any error). */
export function ambiguousDetail(error: unknown): AmbiguousIdDetail | undefined {
  if (!(error instanceof ApiError) || error.status !== 409 || error.code !== 'ambiguous-id') return undefined;
  const detail = error.detail as { candidates?: unknown; more?: unknown } | null | undefined;
  if (typeof detail !== 'object' || detail === null) return undefined;
  const { candidates, more } = detail;
  if (!Array.isArray(candidates) || candidates.length === 0 || !candidates.every(isCandidate)) return undefined;
  if (typeof more !== 'number' || !Number.isInteger(more) || more < 0) return undefined;
  return { candidates, more };
}

/** Props of {@link Candidates}. */
export interface CandidatesProps {
  pid: string;
  /** The id of the address (the short id that matched several elements). */
  eid: string;
  detail: AmbiguousIdDetail;
}

/** The list of candidates, each a link to its element page. */
export function Candidates({ pid, eid, detail }: CandidatesProps): ReactNode {
  const intl = useIntl();
  const label = intl.formatMessage({ id: 'element.candidates.title' }, { id: eid });
  return (
    <section className="element-section element-candidates">
      <h2 className="section-title">{label}</h2>
      <ul className="candidate-list" aria-label={label}>
        {detail.candidates.map((c) => (
          <li key={c.id}>
            <Link className="candidate-link" to="/p/$pid/e/$eid" params={{ pid, eid: c.id }}>
              <span className="type-tag">{c.type}</span>
              <span className="candidate-names">
                <span className="candidate-title">{c.title}</span>
                <span className="element-id">{c.id}</span>
              </span>
              <span className="state-pill">{c.status}</span>
            </Link>
          </li>
        ))}
      </ul>
      {detail.more > 0 && (
        <p className="muted">
          <FormattedMessage id="element.candidates.more" values={{ count: detail.more }} />
        </p>
      )}
    </section>
  );
}
