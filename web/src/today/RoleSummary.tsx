/**
 * The all-roles summary of Today (task-042, US-S-23; spec-003 §5 `summary`; decisions D42-5…D42-7):
 * a card between the greeting and Requires you with one line per role the member holds, as the
 * server sends them (DNA order, the count, at most 3 rows, `more` — REQ-PERF-11; absent for a
 * single-role member, S-23.3). Nothing is recomputed here (spec-003 §8).
 *
 * A line is a button "approver · 2" that switches the role view (S-23.2), followed by its items
 * (links to the element panel) and "N more", which switches to that view too (D42-7). The line of
 * the current view is marked and is no switch. Each switch is described by "Switches the role view"
 * (review R7) — a `hidden` element: `aria-describedby` still resolves it and browse mode does not
 * read it as stray text (review round 2, R2-3). The switch itself is Today's (`onSwitch`): its
 * refusal is shown by Today, outside this card, which a refetch may remove (review R2); once the new
 * view is read, Today moves the focus to Requires you (D42-6).
 */
import type { TodaySummaryLine } from '@wingfoil-ui/contracts';
import { Link } from '@tanstack/react-router';
import { useId, type ReactNode } from 'react';
import { Button } from 'react-aria-components';
import { FormattedMessage, useIntl } from 'react-intl';

/** Props of {@link RoleSummary}. */
export interface RoleSummaryProps {
  pid: string;
  lines: readonly TodaySummaryLine[];
  /** The current role view. */
  view: string | null;
  /** Switch the role view to `role` (Today runs the request and moves the focus, D42-6). */
  onSwitch(role: string): void;
}

/** The summary card. */
export function RoleSummary({ pid, lines, view, onSwitch }: RoleSummaryProps): ReactNode {
  const intl = useIntl();
  const titleId = useId();
  const hintId = useId();
  return (
    <section className="today-card today-summary" aria-labelledby={titleId}>
      <h2 className="today-card-title" id={titleId}>
        <FormattedMessage id="today.summary.title" />
      </h2>
      <span id={hintId} hidden>
        <FormattedMessage id="today.summary.switchHint" />
      </span>
      <ul className="today-summary-lines">
        {lines.map((line) => {
          const current = line.role === view;
          const label = <FormattedMessage id="today.summary.line" values={{ role: line.role, count: line.count }} />;
          return (
            <li key={line.role} className="today-summary-line" {...(current ? { 'aria-current': 'true' } : {})}>
              <span className="today-summary-head">
                {current ? (
                  <>
                    <span className="today-summary-role">{label}</span>
                    <span className="today-summary-current">
                      <FormattedMessage id="today.summary.current" />
                    </span>
                  </>
                ) : (
                  <Button
                    className="button today-summary-role"
                    aria-describedby={hintId}
                    onPress={() => onSwitch(line.role)}
                  >
                    {label}
                  </Button>
                )}
              </span>
              {line.items.length > 0 && (
                <ul className="today-summary-items">
                  {line.items.map(({ element }) => (
                    <li key={element.id} data-eid={element.id}>
                      <Link className="today-summary-item" to="/p/$pid/e/$eid" params={{ pid, eid: element.id }}>
                        {element.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {line.more > 0 &&
                (current ? (
                  <span className="today-summary-more">
                    <FormattedMessage id="today.summary.more" values={{ more: line.more }} />
                  </span>
                ) : (
                  <Button
                    className="button today-summary-more"
                    aria-label={intl.formatMessage(
                      { id: 'today.summary.moreLabel' },
                      { more: line.more, role: line.role },
                    )}
                    aria-describedby={hintId}
                    onPress={() => onSwitch(line.role)}
                  >
                    <FormattedMessage id="today.summary.more" values={{ more: line.more }} />
                  </Button>
                ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
