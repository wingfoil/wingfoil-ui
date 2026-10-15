/**
 * Today (task-036; ux-reference §4.1, prototype Today; spec-003 §5; decisions D36-3…D36-8, D36-11):
 *
 * - the greeting — "Morgan, 2 things require you" — and the role view line (D36-5); "Today" for a
 *   user who is not identified, with the identity sentence (D36-8: *How to join* for a user not in
 *   the team, else a pointer to the read-only notice of the header);
 * - *Requires you* — rows in the server's order: type tag, title (a link to the element panel),
 *   reason (D36-7), state pill with the descriptor's tone, and one primary action, a button that
 *   opens the element panel (D36-3: no write here; the gate and submit footers are task-037's and
 *   task-038's); "Nothing requires you" when empty (D36-4);
 * - *Waiting on others* — rows linking to the panel, with who must act (D36-6); hidden when empty;
 * - the all-roles summary of a member holding several roles, between the greeting and Requires you
 *   (task-042, D42-5; `RoleSummary.tsx`): a switch from it moves the focus to the Requires you
 *   heading once the new view is read (D42-6).
 *
 * A refusal of `GET /today` (no partial Today, D31-3) is an error, never an empty list. A refetch
 * that changed the rows is announced in a polite status region (D36-11). Rows, order, actor, tone
 * and action are data of the server (spec-003 §8), never re-derived.
 */
import type { UseQueryResult } from '@tanstack/react-query';
import type { ProjectHeader, Today, TodayActionRow, TodayRow } from '@wingfoil-ui/contracts';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from 'react-aria-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { ApiError } from '../api/client.js';
import { useHowToJoin } from '../project/HowToJoin.js';
import { ErrorText } from '../shell/ErrorText.js';
import { greetingName, identityNote, rowReason, waitingWho } from './model.js';
import { RoleSummary } from './RoleSummary.js';
import './today.css';

type Read<T> = Pick<UseQueryResult<T>, 'data' | 'error'>;

/** Props of {@link TodayView}. */
export interface TodayViewProps {
  pid: string;
  header: Read<ProjectHeader>;
  /** `GET /today` for the header's role view; not started until the header is read. */
  today: Read<Today>;
}

/** A failed read as an API error (a non-API failure renders as `internal`). */
function asApiError(error: Error): ApiError {
  return error instanceof ApiError ? error : new ApiError(0, 'internal', error.message, undefined);
}

/** The reason of a Requires you row (D36-7). */
function Reason({ row, now }: { row: TodayActionRow; now: number }): ReactNode {
  const reason = rowReason(row, now);
  switch (reason.kind) {
    case 'rejection':
      return (
        <span className="today-reason today-reason-rejection">
          {reason.reason === null ? (
            <FormattedMessage id="element.rejection.noReason" values={{ name: reason.by }} />
          ) : (
            <FormattedMessage id="element.rejection.withReason" values={{ name: reason.by, reason: reason.reason }} />
          )}
        </span>
      );
    case 'undeclared':
      return (
        <span className="today-reason">
          <FormattedMessage id="today.reason.undeclared" values={{ state: reason.state, type: reason.type }} />
        </span>
      );
    case 'age':
      return (
        <span className="today-reason">
          <FormattedMessage
            id="today.reason.age"
            values={{
              state: reason.state,
              // Its own element: the age is a message of its own (the catalogue check reads it alone).
              age: (
                <span>
                  <FormattedMessage id="today.age" values={{ unit: reason.age.unit, count: reason.age.count }} />
                </span>
              ),
            }}
          />
        </span>
      );
    case 'state':
      return <span className="today-reason">{reason.state}</span>;
  }
}

/** One Requires you row: the title opens the panel, and so does its one action (D36-3). */
function RequiresYouRow({ pid, row, now }: { pid: string; row: TodayActionRow; now: number }): ReactNode {
  const intl = useIntl();
  const navigate = useNavigate();
  const { element, descriptor, action } = row;
  return (
    <li className="today-row" data-eid={element.id}>
      <span className="type-tag today-tag">{element.type}</span>
      <span className="today-names">
        <Link className="today-title" to="/p/$pid/e/$eid" params={{ pid, eid: element.id }}>
          {element.title}
        </Link>
        <Reason row={row} now={now} />
      </span>
      <span className={`state-pill tone-${descriptor.tone}`}>{element.status}</span>
      <Button
        className="button button-primary today-action"
        aria-label={intl.formatMessage({ id: 'today.actionLabel' }, { action, id: element.id })}
        onPress={() =>
          // A gate opens with its reason focused (task-037, G-04.3, D37-1): the second click decides.
          void navigate({
            to: '/p/$pid/e/$eid',
            params: { pid, eid: element.id },
            state: { gateFocus: action === 'approve' || action === 'review' },
          })
        }
      >
        <FormattedMessage id="today.action" values={{ action }} />
      </Button>
    </li>
  );
}

/** Who must act on a Waiting on others row (D36-6). */
function Who({ row }: { row: TodayRow }): ReactNode {
  const intl = useIntl();
  const who = waitingWho(row);
  switch (who.kind) {
    case 'member':
      return who.basis === undefined ? (
        <FormattedMessage id="today.waiting.memberNoBasis" values={{ name: who.name }} />
      ) : (
        <FormattedMessage id="today.waiting.member" values={{ name: who.name, basis: who.basis }} />
      );
    case 'role':
      return who.members.length === 0 ? (
        <FormattedMessage id="today.waiting.roleNoMember" values={{ role: who.role }} />
      ) : (
        <FormattedMessage
          id="today.waiting.role"
          values={{
            role: who.role,
            // Its own element: a list of names is data (the catalogue check reads it alone).
            members: (
              <span className="today-members">{intl.formatList(who.members, { type: 'unit', style: 'short' })}</span>
            ),
          }}
        />
      );
    case 'engine':
      return <FormattedMessage id="today.waiting.engine" />;
    case 'none':
      return null;
  }
}

/** One Waiting on others row: a link to the element panel. */
function WaitingRow({ pid, row }: { pid: string; row: TodayRow }): ReactNode {
  const { element, descriptor } = row;
  return (
    <li data-eid={element.id}>
      <Link className="today-waiting-row" to="/p/$pid/e/$eid" params={{ pid, eid: element.id }}>
        <span className="type-tag today-tag">{element.type}</span>
        <span className="today-waiting-title">{element.title}</span>
        <span className={`state-pill tone-${descriptor.tone}`}>{element.status}</span>
        <span className="today-who">
          <Who row={row} />
        </span>
      </Link>
    </li>
  );
}

/** The sentence shown in place of Requires you to a user not identified in the team (D36-8). */
function IdentitySentence({ header }: { header: ProjectHeader }): ReactNode {
  const join = useHowToJoin();
  const note = identityNote(header);
  if (note === undefined) return null;
  return (
    <p className="today-identity">
      {note === 'notInTeam' ? (
        <>
          <FormattedMessage id="today.notInTeam" />{' '}
          <Button className="button today-join" onPress={() => join.show()}>
            <FormattedMessage id="shell.howToJoin.open" />
          </Button>
        </>
      ) : (
        <FormattedMessage id="today.unidentified" />
      )}
    </p>
  );
}

/** Today of project `pid`. */
export function TodayView({ pid, header, today }: TodayViewProps): ReactNode {
  const intl = useIntl();
  const requiresId = useId();
  const waitingId = useId();
  const data = today.data;
  const name = header.data ? greetingName(header.data) : undefined;
  const rows = data?.requiresYou ?? null;

  // A refetch that changed the Requires you rows of the same role view is announced (directive
  // `accessibility`, D36-11): each one renders a new node in the live region (keyed by a counter).
  // The first read of another role view is not a change, and clears the announcement; a refetch
  // where only Waiting on others changed keeps the rows' reference (the query's structural
  // sharing), so it is not announced (review F1). The view is keyed by the project (`routes/today.tsx`):
  // nothing of one project is compared with another. The ages count from the last read.
  const [announcement, setAnnouncement] = useState<{ n: number; count: number } | undefined>(undefined);
  const [now, setNow] = useState(Date.now);
  const previous = useRef<Today | undefined>(undefined);
  // D42-6: the role view a summary switch asked for; the Requires you heading takes the focus once
  // that view is read (the pressed button is gone while it loads).
  const focusView = useRef<string | null>(null);
  const requiresHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusView.current === null || data?.view !== focusView.current) return;
    requiresHeading.current?.focus();
    focusView.current = null;
  }, [data]);
  useEffect(() => {
    const before = previous.current;
    if (data === undefined) return;
    previous.current = data;
    if (before === undefined || before === data) return;
    setNow(Date.now());
    if (before.view !== data.view) setAnnouncement(undefined);
    else if (before.requiresYou !== data.requiresYou && data.requiresYou) {
      const count = data.requiresYou.length;
      setAnnouncement((a) => ({ n: (a?.n ?? 0) + 1, count }));
    }
  }, [data]);

  const error = header.error ?? today.error;
  return (
    <div className="page today">
      <div className="today-head">
        <h1 className="page-title">
          {data && rows !== null && name !== undefined ? (
            <FormattedMessage id="today.greeting" values={{ name, count: rows.length }} />
          ) : (
            <FormattedMessage id="today.title" />
          )}
        </h1>
        {data?.view != null && (
          <p className="page-intro">
            <FormattedMessage id="today.roleView" values={{ view: data.view }} />
          </p>
        )}
      </div>
      <div className="visually-hidden" role="status" aria-label={intl.formatMessage({ id: 'today.updates.label' })}>
        {announcement && (
          <span key={announcement.n}>
            <FormattedMessage id="today.updated" values={{ count: announcement.count }} />
          </span>
        )}
      </div>
      {error ? (
        <div className="today-error" role="alert">
          <ErrorText error={asApiError(error)} />
        </div>
      ) : !data || !header.data ? (
        <p className="muted" role="status">
          <FormattedMessage id="today.loading" />
        </p>
      ) : (
        <>
          <IdentitySentence header={header.data} />
          {data.summary && (
            <RoleSummary
              pid={pid}
              lines={data.summary}
              view={data.view}
              onSwitch={(role) => (focusView.current = role)}
            />
          )}
          {rows !== null && (
            <section className="today-card" aria-labelledby={requiresId}>
              <h2 className="today-card-title" id={requiresId} ref={requiresHeading} tabIndex={-1}>
                <FormattedMessage id="today.requiresYou.title" />
              </h2>
              {rows.length === 0 ? (
                <p className="today-empty">
                  <FormattedMessage id="today.requiresYou.empty" />
                </p>
              ) : (
                <ul className="today-rows">
                  {rows.map((row) => (
                    <RequiresYouRow key={row.element.id} pid={pid} row={row} now={now} />
                  ))}
                </ul>
              )}
            </section>
          )}
          {data.waitingOnOthers.length > 0 && (
            <section className="today-card" aria-labelledby={waitingId}>
              <h2 className="today-card-title" id={waitingId}>
                <FormattedMessage id="today.waiting.title" />
              </h2>
              <ul className="today-rows">
                {data.waitingOnOthers.map((row) => (
                  <WaitingRow key={row.element.id} pid={pid} row={row} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
