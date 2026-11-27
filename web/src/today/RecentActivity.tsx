/**
 * Recent activity (task-080; US-T-08; ux-reference §4.1 item 6 and v0.3; spec-012 §6; decisions
 * D80-1 … D80-7): the last card of Today, the last 5 Memory events of `GET
 * /api/p/:pid/events/memory?limit=5` (REQ-PERF-11) in the order received — newest first, never
 * re-sorted or filtered (non-Memory commits are not events, spec-002 §3).
 *
 * One row per event: the element's id as written (a link opening its side panel over Today, Q5 (a)
 * of task-065), "from → to" or the operation's word ("created" for an `add`), the name by the bell's
 * rule (`updateLine`: the approver of an approve, a reject or an amend, else the author), and the
 * age, the full time being the link's description (RowSince's pattern, D61-8). Its own loading
 * status and error (a failed read is never an empty card), shown whatever the state of Today's own
 * read (Q2 (a)). The `repo` event refetches it (its key sits under `['p', pid]`) silently. No link
 * "Open the Timeline" while the Timeline is v0.4 (RP3-14 D8); a link forgets the panel's opener (as
 * the bell), so the main region takes the focus when the panel closes (Q3 (a), ux-reference §4.2;
 * review F-2). A row is keyed by its event's sha and id: one commit can be several events (spec-002
 * §3 rule 1; review F-1).
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useId, type ReactNode } from 'react';
import { FormattedMessage, useIntl, type IntlShape } from 'react-intl';
import { ApiError } from '../api/client.js';
import { memoryEventsQuery } from '../api/queries.js';
import { forgetOpener, panelLinkOptions, usePanelOpen } from '../element/side-panel.js';
import { ErrorText } from '../shell/ErrorText.js';
import { updateLine, type UpdateLine } from '../shell/notifications.js';
import { keyText } from '../text/key-text.js';
import { durationOf } from './model.js';
import './recent-activity.css';

/** The number of events Recent activity lists (REQ-PERF-11). */
export const RECENT_ACTIVITY_LIMIT = 5;

/** A failed read as an API error (a non-API failure renders as `internal`). */
function asApiError(error: Error): ApiError {
  return error instanceof ApiError ? error : new ApiError(0, 'internal', error.message, undefined);
}

/** What happened: "from → to", else the operation's word ("created" for an `add`). */
function what(intl: IntlShape, line: UpdateLine): string {
  return line.from !== null && line.to !== null
    ? intl.formatMessage({ id: 'element.history.transition' }, { from: line.from, to: line.to })
    : intl.formatMessage({ id: 'today.activity.operation' }, { operation: line.operation });
}

/** One event: the id (a link to its side panel), what happened and who, its age. */
function ActivityRow({ line, now }: { line: UpdateLine; now: number }): ReactNode {
  const intl = useIntl();
  const panelOpen = usePanelOpen();
  const descriptionId = useId();
  const age = durationOf(line.timestamp, now);
  return (
    <li className="today-activity-row" data-sha={line.sha} data-event-id={line.id}>
      <span className="today-activity-main">
        <FormattedMessage
          id="today.activity.by"
          values={{
            // Its own element: the id is data, a link opening the element's side panel over Today.
            id: (
              <Link
                className="today-activity-id"
                {...panelLinkOptions(line.id, panelOpen)}
                aria-describedby={descriptionId}
                // No focus to return to (Q3 (a)): an earlier row's opener is forgotten (review F-2).
                onClick={(event) => {
                  forgetOpener(event);
                }}
              >
                {keyText(line.id)}
              </Link>
            ),
            // Text, not an element: the transition (or the operation) and the name stay one text with
            // the message's own words — in the key build too, where a lone name would not be data.
            what: what(intl, line),
            name: line.name,
          }}
        />
      </span>
      <time className="today-activity-time" dateTime={line.timestamp}>
        <FormattedMessage
          id="today.activity.ago"
          values={{
            // Its own element: the age is a message of its own (the catalogue check reads it alone).
            age: (
              <span>
                <FormattedMessage id="today.age" values={{ unit: age.unit, count: age.count }} />
              </span>
            ),
          }}
        />
      </time>
      <span id={descriptionId} hidden>
        {intl.formatDate(line.timestamp, { dateStyle: 'full', timeStyle: 'long' })}
      </span>
    </li>
  );
}

/** Recent activity of project `pid`: the last card of Today. */
export function RecentActivity({ pid }: { pid: string }): ReactNode {
  const titleId = useId();
  const events = useQuery(memoryEventsQuery(pid, RECENT_ACTIVITY_LIMIT));
  let body: ReactNode;
  if (events.error) {
    body = (
      <div className="today-activity-note today-activity-error" role="alert">
        <ErrorText error={asApiError(events.error)} />
      </div>
    );
  } else if (!events.data) {
    body = (
      <p className="today-activity-note muted" role="status">
        <FormattedMessage id="today.activity.loading" />
      </p>
    );
  } else if (events.data.events.length === 0) {
    body = (
      <p className="today-activity-note">
        <FormattedMessage id="today.activity.empty" />
      </p>
    );
  } else {
    // The ages count from the last read (a refetch renders them again).
    const now = events.dataUpdatedAt;
    body = (
      <ul className="today-activity-rows">
        {events.data.events.map((event) => (
          // One commit can be several events, one per id (spec-002 §3 rule 1): the key is both.
          <ActivityRow key={`${event.sha}:${event.id}`} line={updateLine(event)} now={now} />
        ))}
      </ul>
    );
  }
  return (
    <section className="today-activity" aria-labelledby={titleId}>
      <h2 className="today-card-title" id={titleId}>
        <FormattedMessage id="today.activity.title" />
      </h2>
      {body}
    </section>
  );
}
