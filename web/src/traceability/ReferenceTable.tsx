/**
 * The references table of Traceability (ux-reference §4.8 v0.3 *Table*; spec-012 §4; D67-7): three
 * columns — *Reference*, *Linked elements*, *Completion* — one row per reference in the server's
 * order. A pattern reference shows its category and id only (RP3-14 D9: no title, no hover card, no
 * link); an element reference its short id as a link to its element page, its title and its state
 * pill. Each linked element is a chip: its short id, its tone, a link to its element page in the main
 * region (RP3-16 P2) named "short id — title — state", with a tooltip (full title, id, state) on
 * hover and on focus, closed with Escape.
 *
 * Each row carries a stable key (`data-ref` the id, React's key the kind and id), so a refresh keeps
 * the node that holds the focus (task-081, D81-7).
 *
 * task-081 (D81-3, D81-4, Q1 (b)): the row toggle in the *Reference* cell's slot — a button named
 * "Details of <id>", `aria-expanded`, `aria-controls` naming the detail row while it is open; a click
 * on the row toggles it too (not on a link, a button or the end of a text selection) and focuses its
 * toggle; the detail row (`ReferenceDetail.tsx`) right after it. The table can take the focus
 * (`tabIndex={-1}`): when a refresh removes the node that held it (Q1 (b), `TraceabilityView.tsx`).
 */
import { Link } from '@tanstack/react-router';
import type { TraceabilityElement, TraceabilityReference } from '@wingfoil-ui/contracts';
import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Link as AriaLink, Tooltip, TooltipTrigger } from 'react-aria-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { keyText } from '../text/key-text.js';
import { Bar } from './Figures.js';
import { referenceKey } from './model.js';
import { ReferenceDetail, StatePill } from './ReferenceDetail.js';

/** The delay before a chip's tooltip opens, as the other tooltips of the console (`GitStatus`). */
const HOVER_DELAY_MS = 300;

/** One chip: a link to the element page with its tooltip. */
function Chip({ pid, id, element }: { pid: string; id: string; element: TraceabilityElement | undefined }): ReactNode {
  const intl = useIntl();
  const short = element?.shortId ?? id;
  const tone = element?.descriptor?.tone;
  // React Aria opens the tooltip on keyboard focus and closes it on blur and Escape; the trigger
  // being a link, hover is not wired by the trigger itself, so the link's own hover opens it after
  // the same delay (a controlled tooltip).
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <TooltipTrigger delay={HOVER_DELAY_MS} closeDelay={0} isOpen={open} onOpenChange={setOpen}>
      {/* A React Aria link: it navigates through the router (app.tsx `AriaRouterProvider`). */}
      <AriaLink
        onHoverStart={() => {
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setOpen(true), HOVER_DELAY_MS);
        }}
        onHoverEnd={() => {
          window.clearTimeout(timer.current);
          setOpen(false);
        }}
        className={tone === undefined ? 'trace-chip' : `trace-chip tone-${tone}`}
        href={`/p/${encodeURIComponent(pid)}/e/${encodeURIComponent(id)}`}
        aria-label={intl.formatMessage(
          { id: 'traceability.chip.name' },
          { id: keyText(short), title: element?.title ?? id, state: keyText(element?.status ?? '') },
        )}
      >
        {keyText(short)}
      </AriaLink>
      <Tooltip className="trace-tooltip" placement="top">
        <span className="trace-tooltip-title">{element?.title ?? id}</span>
        <span className="trace-tooltip-id">{keyText(id)}</span>
        {element && <span className="trace-tooltip-state">{keyText(element.status)}</span>}
      </Tooltip>
    </TooltipTrigger>
  );
}

/** The *Reference* cell: the category, then the id (pattern) or the element. */
function ReferenceCell({
  pid,
  reference,
  element,
  toggle,
}: {
  pid: string;
  reference: TraceabilityReference;
  element: TraceabilityElement | undefined;
  toggle: ReactNode;
}): ReactNode {
  return (
    <td className="trace-ref">
      {toggle}
      <span className="type-tag trace-category">{keyText(reference.category)}</span>
      {reference.element ? (
        <span className="trace-ref-element">
          <Link className="trace-ref-id" to="/p/$pid/e/$eid" params={{ pid, eid: reference.id }}>
            {keyText(element?.shortId ?? reference.id)}
          </Link>
          {element && <span className="trace-ref-title">{element.title}</span>}
          {element && <StatePill element={element} />}
        </span>
      ) : (
        <span className="trace-ref-id">{keyText(reference.id)}</span>
      )}
    </td>
  );
}

/** Whether a click on a row is on a control, the end of a text selection or a double-click's second. */
function ignoredClick(event: MouseEvent): boolean {
  // Review round 1 F-6: the second click of a double-click (selecting a word) toggles nothing more.
  if (event.detail > 1) return true;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('a, button, input, [role="link"], [role="button"]')) return true;
  const selection = window.getSelection();
  return selection !== null && !selection.isCollapsed && selection.toString() !== '';
}

/** One reference: its row and, when open, its detail row (D81-3). */
function ReferenceRow({
  pid,
  reference,
  elements,
  expanded,
  onToggle,
}: {
  pid: string;
  reference: TraceabilityReference;
  elements: ReadonlyMap<string, TraceabilityElement>;
  expanded: boolean;
  onToggle: (key: string) => void;
}): ReactNode {
  const intl = useIntl();
  const detailId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const key = referenceKey(reference);
  return (
    <>
      {/* A pointer convenience only: the row's toggle is the keyboard's way (D81-4). */}
      <tr
        data-ref={reference.id}
        className={expanded ? 'trace-row trace-row-open' : 'trace-row'}
        onClick={(event) => {
          if (ignoredClick(event)) return;
          onToggle(key);
          toggleRef.current?.focus({ preventScroll: true });
        }}
      >
        <ReferenceCell
          pid={pid}
          reference={reference}
          element={reference.element ? elements.get(reference.id) : undefined}
          toggle={
            <button
              ref={toggleRef}
              type="button"
              className="trace-row-toggle"
              aria-label={intl.formatMessage({ id: 'traceability.detail.toggle' }, { id: keyText(reference.id) })}
              aria-expanded={expanded}
              {...(expanded ? { 'aria-controls': detailId } : {})}
              onClick={() => onToggle(key)}
            />
          }
        />
        <td className="trace-linked">
          {reference.linked.map((id) => (
            <Chip key={id} pid={pid} id={id} element={elements.get(id)} />
          ))}
        </td>
        <td className="trace-completion">
          {reference.total === 0 ? (
            <FormattedMessage id="traceability.completion.none" />
          ) : (
            <>
              <Bar percent={reference.percent} />
              <FormattedMessage
                id="traceability.completion.value"
                values={{ percent: reference.percent ?? 0, finished: reference.done, total: reference.total }}
              />
            </>
          )}
        </td>
      </tr>
      {expanded && <ReferenceDetail pid={pid} id={detailId} reference={reference} elements={elements} />}
    </>
  );
}

/** The table. */
export function ReferenceTable({
  pid,
  references,
  elements,
  busy,
  openKey,
  onToggle,
}: {
  pid: string;
  references: readonly TraceabilityReference[];
  elements: ReadonlyMap<string, TraceabilityElement>;
  busy: boolean;
  /** The open row's key (`referenceKey`), one at a time. */
  openKey: string | undefined;
  onToggle: (key: string) => void;
}): ReactNode {
  const intl = useIntl();
  return (
    <div className="trace-table-wrap">
      <table
        className="trace-table"
        tabIndex={-1}
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
            <ReferenceRow
              key={referenceKey(r)}
              pid={pid}
              reference={r}
              elements={elements}
              expanded={openKey === referenceKey(r)}
              onToggle={onToggle}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
