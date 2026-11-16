/**
 * The references table of Traceability (ux-reference §4.8 v0.3 *Table*; spec-012 §4; D67-7): three
 * columns — *Reference*, *Linked elements*, *Completion* — one row per reference in the server's
 * order. A pattern reference shows its category and id only (RP3-14 D9: no title, no hover card, no
 * link); an element reference its short id as a link to its element page, its title and its state
 * pill. Each linked element is a chip: its short id, its tone, a link to its element page in the main
 * region (RP3-16 P2) named "short id — title — state", with a tooltip (full title, id, state) on
 * hover and on focus, closed with Escape.
 *
 * Each row carries a stable key (`data-ref` the id, React's key the kind and id) and the *Reference*
 * cell a slot before the reference, so task-081 adds the row toggle and its detail row (W3-3).
 */
import { Link } from '@tanstack/react-router';
import type { TraceabilityElement, TraceabilityReference } from '@wingfoil-ui/contracts';
import type { ReactNode } from 'react';
import { Link as AriaLink, Tooltip, TooltipTrigger } from 'react-aria-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { Bar } from './Figures.js';
import { referenceKey } from './model.js';

/** The state pill of an element, its tone as data. */
function StatePill({ element }: { element: TraceabilityElement }): ReactNode {
  const tone = element.descriptor?.tone;
  return <span className={tone === undefined ? 'state-pill' : `state-pill tone-${tone}`}>{element.status}</span>;
}

/** One chip: a link to the element page with its tooltip. */
function Chip({ pid, id, element }: { pid: string; id: string; element: TraceabilityElement | undefined }): ReactNode {
  const intl = useIntl();
  const short = element?.shortId ?? id;
  const tone = element?.descriptor?.tone;
  return (
    <TooltipTrigger delay={300} closeDelay={0}>
      {/* A React Aria link (navigating through the router, app.tsx), so the tooltip opens on hover
          as on focus. */}
      <AriaLink
        className={tone === undefined ? 'trace-chip' : `trace-chip tone-${tone}`}
        href={`/p/${encodeURIComponent(pid)}/e/${encodeURIComponent(id)}`}
        aria-label={intl.formatMessage(
          { id: 'traceability.chip.name' },
          { id: short, title: element?.title ?? id, state: element?.status ?? '' },
        )}
      >
        {short}
      </AriaLink>
      <Tooltip className="trace-tooltip" placement="top">
        <span className="trace-tooltip-title">{element?.title ?? id}</span>
        <span className="trace-tooltip-id">{id}</span>
        {element && <span className="trace-tooltip-state">{element.status}</span>}
      </Tooltip>
    </TooltipTrigger>
  );
}

/** The *Reference* cell: the category, then the id (pattern) or the element. */
function ReferenceCell({
  pid,
  reference,
  element,
}: {
  pid: string;
  reference: TraceabilityReference;
  element: TraceabilityElement | undefined;
}): ReactNode {
  return (
    <td className="trace-ref">
      <span className="type-tag trace-category">{reference.category}</span>
      {reference.element ? (
        <span className="trace-ref-element">
          <Link className="trace-ref-id" to="/p/$pid/e/$eid" params={{ pid, eid: reference.id }}>
            {element?.shortId ?? reference.id}
          </Link>
          {element && <span className="trace-ref-title">{element.title}</span>}
          {element && <StatePill element={element} />}
        </span>
      ) : (
        <span className="trace-ref-id">{reference.id}</span>
      )}
    </td>
  );
}

/** The table. */
export function ReferenceTable({
  pid,
  references,
  elements,
  busy,
}: {
  pid: string;
  references: readonly TraceabilityReference[];
  elements: ReadonlyMap<string, TraceabilityElement>;
  busy: boolean;
}): ReactNode {
  const intl = useIntl();
  return (
    <div className="trace-table-wrap">
      <table
        className="trace-table"
        aria-label={intl.formatMessage({ id: 'traceability.table.label' })}
        aria-busy={busy || undefined}
      >
        <thead>
          <tr>
            <th scope="col">
              <FormattedMessage id="traceability.column.reference" />
            </th>
            <th scope="col">
              <FormattedMessage id="traceability.column.linked" />
            </th>
            <th scope="col">
              <FormattedMessage id="traceability.column.completion" />
            </th>
          </tr>
        </thead>
        <tbody>
          {references.map((r) => (
            <tr key={referenceKey(r)} data-ref={r.id}>
              <ReferenceCell pid={pid} reference={r} element={r.element ? elements.get(r.id) : undefined} />
              <td className="trace-linked">
                {r.linked.map((id) => (
                  <Chip key={id} pid={pid} id={id} element={elements.get(id)} />
                ))}
              </td>
              <td className="trace-completion">
                {r.total === 0 ? (
                  <FormattedMessage id="traceability.completion.none" />
                ) : (
                  <>
                    <Bar percent={r.percent} />
                    <FormattedMessage
                      id="traceability.completion.value"
                      values={{ percent: r.percent ?? 0, finished: r.done, total: r.total }}
                    />
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
