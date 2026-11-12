/**
 * The candidates of an ambiguous short id (spec-011 §3, the 409 `ambiguous-id`; ux-reference §4.2
 * v0.3, dl-012 R2; task-062 D62-5): shown instead of *not found*, each candidate a link to its
 * element page — or, in the side panel, a `?panel=<full id>` link on the same view that takes the
 * short value's place (task-077 D77-3) — the type, the short id, the title and the state as the server answered them (the
 * title already through the character escape of repository texts, rendered as text).
 */
import type { AmbiguousCandidate, AmbiguousIdDetail } from '@wingfoil-ui/contracts';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { ApiError } from '../api/client.js';
import { isPathSyntaxId } from './queries.js';
import { panelLinkOptions } from './side-panel.js';

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

/** The text of a candidate's link: type, title, full id, state. */
function CandidateText({ candidate: c }: { candidate: AmbiguousCandidate }): ReactNode {
  return (
    <>
      <span className="type-tag">{c.type}</span>
      <span className="candidate-names">
        <span className="candidate-title">{c.title}</span>
        <span className="element-id">{c.id}</span>
      </span>
      <span className="state-pill">{c.status}</span>
    </>
  );
}

/** Props of {@link Candidates}. */
export interface CandidatesProps {
  pid: string;
  /** The id of the address (the short id that matched several elements). */
  eid: string;
  detail: AmbiguousIdDetail;
  /** Where a candidate opens: its element page (default), or the side panel of the current view. */
  linkTo?: 'page' | 'panel';
}

/** The list of candidates, each a link to its element page. */
export function Candidates({ pid, eid, detail, linkTo = 'page' }: CandidatesProps): ReactNode {
  const intl = useIntl();
  const label = intl.formatMessage({ id: 'element.candidates.title' }, { id: eid });
  const heading = <FormattedMessage id="element.candidates.title" values={{ id: <bdi>{eid}</bdi> }} />;
  return (
    <section className="element-section element-candidates">
      {/* The address's value isolated from the text around it (bidi; task-077 F-5, R2-5); the list's
          name stays the plain text. */}
      {linkTo === 'panel' ? <h3 className="section-title">{heading}</h3> : <h2 className="section-title">{heading}</h2>}
      <ul className="candidate-list" aria-label={label}>
        {detail.candidates.map((c) => (
          <li key={c.id}>
            {linkTo === 'panel' ? (
              // The candidate takes the short value's place, as the canonical rewrite does (D77-3).
              <Link className="candidate-link" {...panelLinkOptions(c.id, true)}>
                <CandidateText candidate={c} />
              </Link>
            ) : (
              <Link className="candidate-link" to="/p/$pid/e/$eid" params={{ pid, eid: c.id }}>
                <CandidateText candidate={c} />
              </Link>
            )}
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
