/**
 * The all-roles summary of Today (task-042, task-076; US-S-23; spec-003 §5 `summary`; decisions
 * D42-5, D42-6, D76-2): *Your roles*, a card between the greeting and Requires you holding one line
 * of role tags, as the server sends them (DNA order, each with its count and no item —
 * REQ-PERF-11 v0.3; absent for a single-role member, S-23.3). Nothing is recomputed here (spec-003
 * §8).
 *
 * A tag is a button "approver · 2" that switches the role view (S-23.2, S-23.5). The tag of the
 * current view is marked (`aria-current`, "current view") and is no switch. Each switch is described
 * by "Switches the role view" (review R7) — a `hidden` element: `aria-describedby` still resolves it
 * and browse mode does not read it as stray text (review round 2, R2-3). The switch itself is
 * Today's (`onSwitch`): its refusal is shown by Today, outside this card, which a refetch may remove
 * (review R2); once the new view is read, Today moves the focus to Requires you (D42-6).
 */
import type { TodaySummaryLine } from '@wingfoil-ui/contracts';
import { useId, type ReactNode } from 'react';
import { Button } from 'react-aria-components';
import { FormattedMessage } from 'react-intl';

/** Props of {@link RoleSummary}. */
export interface RoleSummaryProps {
  lines: readonly TodaySummaryLine[];
  /** The current role view. */
  view: string | null;
  /** Switch the role view to `role` (Today runs the request and moves the focus, D42-6). */
  onSwitch(role: string): void;
}

/** The summary card: its heading and one line of role tags. */
export function RoleSummary({ lines, view, onSwitch }: RoleSummaryProps): ReactNode {
  const titleId = useId();
  const hintId = useId();
  return (
    <section className="today-card today-summary" aria-labelledby={titleId}>
      <div className="today-summary-bar">
        <h2 className="today-card-title" id={titleId}>
          <FormattedMessage id="today.summary.title" />
        </h2>
        <span id={hintId} hidden>
          <FormattedMessage id="today.summary.switchHint" />
        </span>
        <ul className="today-summary-tags">
          {lines.map((line) => {
            const current = line.role === view;
            const label = <FormattedMessage id="today.summary.line" values={{ role: line.role, count: line.count }} />;
            return (
              <li key={line.role} className="today-summary-tag" {...(current ? { 'aria-current': 'true' } : {})}>
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
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
