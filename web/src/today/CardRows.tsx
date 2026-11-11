/**
 * The rows of a Today card in v0.3 (task-061, N2, N3; ux-reference §4.1 v0.3; D61-4 … D61-7): its
 * filters, its rows filtered then limited to {@link ROW_LIMIT}, "No row matches the filters" when a
 * combination keeps none, and "Show all (<n>)" / "Show fewer" past the limit — one button that keeps
 * the focus, with `aria-expanded` and `aria-controls`. The state is the card's own: a filter applies
 * to its card only (T-02.4); Today keys the card by the role view, so another view starts on *All*,
 * collapsed (D61-6). A held gate's row is a row like the others (D61-10).
 */
import type { TodayRow } from '@wingfoil-ui/contracts';
import { useId, useState, type ReactNode } from 'react';
import { Button } from 'react-aria-components';
import { FormattedMessage } from 'react-intl';
import { CardFilters } from './CardFilters.js';
import { effectiveFilter, filterCard, limited, ROW_LIMIT, type CardFilter } from './model.js';

/** Props of {@link CardRows}. */
export interface CardRowsProps<R extends TodayRow> {
  /** The card's rows, as the server sent them (at least one). */
  rows: readonly R[];
  /** One row (an `li` keyed by the element). */
  renderRow(row: R): ReactNode;
}

/** The filters, the rows and the toggle of one card. */
export function CardRows<R extends TodayRow>({ rows, renderRow }: CardRowsProps<R>): ReactNode {
  const listId = useId();
  const [chosen, setChosen] = useState<CardFilter>({});
  const [expanded, setExpanded] = useState(false);
  const filter = effectiveFilter(rows, chosen);
  const matching = filterCard(rows, filter);
  return (
    <>
      <CardFilters rows={rows} filter={filter} onChange={setChosen} />
      {matching.length === 0 ? (
        <p className="today-empty">
          <FormattedMessage id="today.filter.none" />
        </p>
      ) : (
        <ul className="today-rows" id={listId}>
          {limited(matching, expanded).map(renderRow)}
        </ul>
      )}
      {matching.length > ROW_LIMIT && (
        <div className="today-more">
          <Button
            className="button today-toggle"
            aria-expanded={expanded}
            aria-controls={listId}
            onPress={() => setExpanded((e) => !e)}
          >
            {expanded ? (
              <FormattedMessage id="today.rows.showFewer" />
            ) : (
              <FormattedMessage id="today.rows.showAll" values={{ count: matching.length }} />
            )}
          </Button>
        </div>
      )}
    </>
  );
}
