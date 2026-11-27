/**
 * "Elements missing required references (<n>)" (ux-reference §4.8 v0.3 *Missing references*;
 * spec-012 §4 `missing`; D67-10): every element whose type has `taxonomy.requires` and that carries
 * no reference of a required category — the set of the Memory list's filter (task-066) — each row a
 * link to its element page with its type, short id, title, "needs <categories>" and the reused
 * badge "missing refs"; *Show in Memory* opens the list with that filter (`?missing=refs`, task-066
 * D66-2, W3-1). Shown only when `requires` is not empty (the coverage figure is shown then).
 */
import { Link } from '@tanstack/react-router';
import type { Traceability, TraceabilityElement } from '@wingfoil-ui/contracts';
import { useId, type ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { MissingRefsBadge } from '../memory/MissingRefsBadge.js';
import { MISSING_REFS } from '../memory/model.js';
import { keyText } from '../text/key-text.js';

function MissingRow({
  pid,
  id,
  categories,
  element,
}: {
  pid: string;
  id: string;
  categories: Traceability['missing'][number]['categories'];
  element: TraceabilityElement | undefined;
}): ReactNode {
  const intl = useIntl();
  const descriptionId = useId();
  return (
    <li>
      <Link
        className="trace-missing-row"
        to="/p/$pid/e/$eid"
        params={{ pid, eid: id }}
        aria-describedby={descriptionId}
      >
        {element && <span className="type-tag">{keyText(element.type)}</span>}
        <span className="trace-missing-id">{keyText(element?.shortId ?? id)}</span>
        {element && <span className="trace-missing-title">{element.title}</span>}
        <span className="trace-missing-needs">
          <FormattedMessage
            id="traceability.missing.needs"
            values={{ categories: intl.formatList(categories.map(keyText), { type: 'conjunction' }) }}
          />
        </span>
        <MissingRefsBadge categories={categories} descriptionId={descriptionId} />
      </Link>
    </li>
  );
}

/** The section. */
export function MissingSection({
  pid,
  answer,
  elements,
}: {
  pid: string;
  answer: Traceability;
  elements: ReadonlyMap<string, TraceabilityElement>;
}): ReactNode {
  const intl = useIntl();
  const headingId = useId();
  if (answer.figures.coverage.state !== 'shown') return null;
  return (
    <section className="trace-missing" aria-labelledby={headingId}>
      <div className="trace-missing-head">
        <h2 id={headingId} className="trace-section-title">
          <FormattedMessage id="traceability.missing.title" values={{ count: answer.missing.length }} />
        </h2>
        <Link to="/p/$pid/memory" params={{ pid }} search={{ missing: MISSING_REFS }}>
          <FormattedMessage id="traceability.missing.show" />
        </Link>
      </div>
      {answer.missing.length === 0 ? (
        <p className="trace-card-note">
          <FormattedMessage id="traceability.missing.none" />
        </p>
      ) : (
        <ul className="trace-missing-list" aria-label={intl.formatMessage({ id: 'traceability.missing.label' })}>
          {answer.missing.map((m) => (
            <MissingRow key={m.id} pid={pid} id={m.id} categories={m.categories} element={elements.get(m.id)} />
          ))}
        </ul>
      )}
    </section>
  );
}
