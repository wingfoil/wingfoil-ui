/**
 * The inline detail of a Traceability row (ux-reference §4.8 v0.3 *Inline detail*; spec-012 §4;
 * task-081, D81-5): the next row of the table, one cell spanning the columns, headed by the
 * reference id. The category; for an element reference its title, state pill and *Open*; the
 * completion x/y, or "No linked element"; then each linked element as one link to its element page
 * in the main region (P2) — "short id · title · state pill · who must act", the texts of Today's
 * *Waiting on others* through the shared part (`element/WhoMustAct.tsx`, D81-1), nothing for a done
 * element. No description or source for a pattern reference (D9). Every repository string is text.
 */
import { Link } from '@tanstack/react-router';
import type { TraceabilityElement, TraceabilityReference } from '@wingfoil-ui/contracts';
import type { ReactNode } from 'react';
import { FormattedMessage } from 'react-intl';
import { namesSomeone, WhoMustAct } from '../element/WhoMustAct.js';
import { keyText, referenceText } from '../text/key-text.js';

/** The state pill of an element, its tone as data. */
export function StatePill({ element }: { element: TraceabilityElement }): ReactNode {
  const tone = element.descriptor?.tone;
  return (
    <span className={tone === undefined ? 'state-pill' : `state-pill tone-${tone}`}>{keyText(element.status)}</span>
  );
}

/** One linked element: a link to its element page with who must act. */
function DetailItem({
  pid,
  id,
  element,
}: {
  pid: string;
  id: string;
  element: TraceabilityElement | undefined;
}): ReactNode {
  if (element === undefined) {
    // Review round 1 F-2: an id the answer does not name (not expected, spec-012 §4) — the id alone.
    return (
      <li>
        <Link className="trace-detail-item" to="/p/$pid/e/$eid" params={{ pid, eid: id }}>
          <span className="trace-detail-id">{keyText(id)}</span>
        </Link>
      </li>
    );
  }
  const descriptor = element.descriptor;
  const values = {
    id: <span className="trace-detail-id">{keyText(element.shortId ?? id)}</span>,
    title: <span className="trace-detail-title">{element.title}</span>,
    state: <StatePill element={element} />,
  };
  const who = !element.done && descriptor !== undefined && namesSomeone(descriptor);
  return (
    <li>
      <Link className="trace-detail-item" to="/p/$pid/e/$eid" params={{ pid, eid: id }}>
        {who ? (
          <FormattedMessage
            id="traceability.detail.elementWho"
            values={{
              ...values,
              // Its own element: the who-must-act text is a message of its own (the key build).
              who: (
                <span className="trace-detail-who">
                  <WhoMustAct descriptor={descriptor} />
                </span>
              ),
            }}
          />
        ) : (
          <FormattedMessage id="traceability.detail.element" values={values} />
        )}
      </Link>
    </li>
  );
}

/** Props of {@link ReferenceDetail}. */
export interface ReferenceDetailProps {
  pid: string;
  id: string;
  reference: TraceabilityReference;
  elements: ReadonlyMap<string, TraceabilityElement>;
}

/** The detail row of `reference`, its id `id` (the toggle's `aria-controls`). */
export function ReferenceDetail({ pid, id, reference, elements }: ReferenceDetailProps): ReactNode {
  const target = reference.element ? elements.get(reference.id) : undefined;
  return (
    <tr className="trace-detail-row" id={id}>
      <td colSpan={3}>
        <div className="trace-detail">
          <h2 className="trace-detail-heading">{referenceText(reference)}</h2>
          <div className="trace-detail-head">
            <span className="type-tag trace-category">{keyText(reference.category)}</span>
            {target && <span className="trace-ref-title">{target.title}</span>}
            {target && <StatePill element={target} />}
            {reference.element && (
              <Link className="trace-detail-open" to="/p/$pid/e/$eid" params={{ pid, eid: reference.id }}>
                <FormattedMessage id="traceability.detail.open" />
              </Link>
            )}
          </div>
          <p className="trace-detail-completion">
            {reference.total === 0 ? (
              <FormattedMessage id="traceability.detail.noLinked" />
            ) : (
              <FormattedMessage
                id="traceability.detail.completion"
                values={{ finished: reference.done, total: reference.total }}
              />
            )}
          </p>
          {reference.linked.length > 0 && (
            <ul className="trace-detail-list">
              {reference.linked.map((linked) => (
                <DetailItem key={linked} pid={pid} id={linked} element={elements.get(linked)} />
              ))}
            </ul>
          )}
        </div>
      </td>
    </tr>
  );
}
