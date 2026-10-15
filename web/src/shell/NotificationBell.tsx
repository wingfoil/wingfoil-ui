/**
 * The notification bell (task-042, US-S-21; ux-reference §3 *Notifications*; spec-003 §5;
 * decisions D42-1…D42-4), at the right end of the global header of a project, between the role view
 * and the current user (the project header renders it, keyed by the project):
 *
 * - the count of the items to unblock — the length of Requires you of the header's role view, read
 *   with Today's own query (`todayQuery`, one cache entry for both, D31-6) — as a badge when it is
 *   not 0 and in the button's accessible name (no live region of its own: Today announces its
 *   changes, D42-4);
 * - a panel (the project switcher's popover pattern: Escape closes it, the focus returns to the
 *   bell) with *To unblock* — every Requires you row (spec-003 §5: the same rows), each a link to
 *   the element panel with the gate reason focused as Today's action (D37-1) — and *Updates*, the
 *   last 10 Memory events newest first (TT-PERF-11), read only while the panel is open (D42-2).
 *
 * A write or a `repo` event invalidates the project's queries, so the count follows an action
 * (S-21.3). A refused read is an error inside the panel, never "Nothing to unblock" (D31-3).
 */
import type { ProjectHeader, Today } from '@wingfoil-ui/contracts';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useId, useState, type ReactNode } from 'react';
import { Button, Dialog, DialogTrigger, Heading, Popover } from 'react-aria-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { ApiError } from '../api/client.js';
import { memoryEventsQuery, todayQuery } from '../api/queries.js';
import { durationOf } from '../today/model.js';
import { ErrorText } from './ErrorText.js';
import { Bell } from './icons.js';
import { bellCount, updateLine, type UpdateLine } from './notifications.js';
import './notification-bell.css';

/** How many Memory events *Updates* lists (REQ-PERF-11). */
export const UPDATES_LIMIT = 10;

/** A failed read as an API error (a non-API failure renders as `internal`). */
function asApiError(error: Error): ApiError {
  return error instanceof ApiError ? error : new ApiError(0, 'internal', error.message, undefined);
}

/** Props of {@link NotificationBell}. */
export interface NotificationBellProps {
  pid: string;
  /** The project header: its role view chooses the Today read. */
  header: ProjectHeader;
}

/** The bell of project `pid`. */
export function NotificationBell({ pid, header }: NotificationBellProps): ReactNode {
  const intl = useIntl();
  const [expanded, setExpanded] = useState(false);
  const today = useQuery(todayQuery(pid, header.roleView ?? null));
  const count = bellCount(today.data);
  const close = (): void => setExpanded(false);
  return (
    <DialogTrigger isOpen={expanded} onOpenChange={setExpanded}>
      <Button
        className="button bell-trigger"
        aria-label={intl.formatMessage({ id: 'shell.bell.label' }, { count: count ?? 0 })}
      >
        <Bell />
        {count !== undefined && count > 0 && (
          <span className="bell-count" aria-hidden="true">
            {count}
          </span>
        )}
      </Button>
      <Popover className="menu-popover bell-popover" placement="bottom end">
        <BellPanel pid={pid} today={today} onNavigate={close} />
      </Popover>
    </DialogTrigger>
  );
}

/** Props of {@link BellPanel}. */
interface BellPanelProps {
  pid: string;
  today: Pick<UseQueryResult<Today>, 'data' | 'error'>;
  /** Close the panel (a link was followed). */
  onNavigate(): void;
}

/** The panel: *To unblock* and *Updates* (mounted only while open: *Updates* is read then, D42-2). */
function BellPanel({ pid, today, onNavigate }: BellPanelProps): ReactNode {
  const toUnblockId = useId();
  const updatesId = useId();
  return (
    <Dialog className="bell-panel">
      <div className="bell-head">
        <Heading slot="title" className="bell-title">
          <FormattedMessage id="shell.bell.title" />
        </Heading>
        <Link className="bell-open-today" to="/p/$pid/today" params={{ pid }} onClick={onNavigate}>
          <FormattedMessage id="shell.bell.openToday" />
        </Link>
      </div>
      <section className="bell-section" aria-labelledby={toUnblockId}>
        <h3 className="bell-section-title" id={toUnblockId}>
          <FormattedMessage id="shell.bell.toUnblock" />
        </h3>
        <ToUnblock pid={pid} today={today} onNavigate={onNavigate} />
      </section>
      <section className="bell-section" aria-labelledby={updatesId}>
        <h3 className="bell-section-title" id={updatesId}>
          <FormattedMessage id="shell.bell.updates" />
        </h3>
        <Updates pid={pid} onNavigate={onNavigate} />
      </section>
    </Dialog>
  );
}

/** *To unblock*: the Requires you rows (spec-003 §5), or why there is none. */
function ToUnblock({ pid, today, onNavigate }: BellPanelProps): ReactNode {
  if (today.error) {
    return (
      <div role="alert" className="bell-note">
        <ErrorText error={asApiError(today.error)} />
      </div>
    );
  }
  if (!today.data) {
    return (
      <p role="status" className="bell-note">
        <FormattedMessage id="shell.bell.loading" />
      </p>
    );
  }
  const rows = today.data.requiresYou;
  if (rows === null) {
    return (
      <p className="bell-note">
        <FormattedMessage id="shell.bell.toUnblock.unidentified" />
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="bell-note">
        <FormattedMessage id="shell.bell.toUnblock.empty" />
      </p>
    );
  }
  return (
    <ul className="bell-list">
      {rows.map(({ element, action }) => (
        <li key={element.id} className="bell-item" data-eid={element.id}>
          <span className="type-tag bell-tag">{element.type}</span>
          <span className="bell-verb">
            <FormattedMessage id="today.action" values={{ action }} />
          </span>
          <Link
            className="bell-link"
            to="/p/$pid/e/$eid"
            params={{ pid, eid: element.id }}
            // A gate opens with its reason focused, as from Today's action (D37-1).
            state={{ gateFocus: action === 'approve' || action === 'review' }}
            onClick={onNavigate}
          >
            {element.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** *Updates*: the last Memory events, newest first as received (spec-004 §3). */
function Updates({ pid, onNavigate }: { pid: string; onNavigate(): void }): ReactNode {
  const events = useQuery(memoryEventsQuery(pid, UPDATES_LIMIT));
  const [now] = useState(Date.now);
  if (events.error) {
    return (
      <div role="alert" className="bell-note">
        <ErrorText error={asApiError(events.error)} />
      </div>
    );
  }
  if (!events.data) {
    return (
      <p role="status" className="bell-note">
        <FormattedMessage id="shell.bell.updates.loading" />
      </p>
    );
  }
  if (events.data.events.length === 0) {
    return (
      <p className="bell-note">
        <FormattedMessage id="shell.bell.updates.empty" />
      </p>
    );
  }
  return (
    <ul className="bell-list">
      {events.data.events.map((e) => (
        <UpdateItem key={e.sha} pid={pid} line={updateLine(e)} now={now} onNavigate={onNavigate} />
      ))}
    </ul>
  );
}

/** One Memory event: the element (a link to its panel), what happened, the transition, its age. */
function UpdateItem({
  pid,
  line,
  now,
  onNavigate,
}: {
  pid: string;
  line: UpdateLine;
  now: number;
  onNavigate(): void;
}): ReactNode {
  const age = durationOf(line.timestamp, now);
  return (
    <li className="bell-update" data-sha={line.sha}>
      <span className="bell-update-main">
        <Link
          className="bell-link bell-update-id"
          to="/p/$pid/e/$eid"
          params={{ pid, eid: line.id }}
          onClick={onNavigate}
        >
          {line.id}
        </Link>
        <span className="bell-update-what">
          <FormattedMessage id="element.history.entry" values={{ operation: line.operation, name: line.name }} />
        </span>
        {line.from !== null && line.to !== null && (
          <span className="bell-update-transition">
            <FormattedMessage id="element.history.transition" values={{ from: line.from, to: line.to }} />
          </span>
        )}
      </span>
      <time className="bell-update-time" dateTime={line.timestamp}>
        <FormattedMessage
          id="shell.bell.ago"
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
    </li>
  );
}
