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
import { useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { ProjectHeader, Today, TodayActionRow, TodayRow } from '@wingfoil-ui/contracts';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Button } from 'react-aria-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { ApiError } from '../api/client.js';
import { useSetRoleView } from '../api/projects.js';
import { projectHeaderQuery } from '../api/queries.js';
import { useHowToJoin } from '../project/HowToJoin.js';
import { ErrorText } from '../shell/ErrorText.js';
import { greetingName, identityNote, rowReason, waitingWho } from './model.js';
import { RoleSummary } from './RoleSummary.js';
import './today.css';

type Read<T> = Pick<UseQueryResult<T>, 'data' | 'error'>;

/**
 * The control to focus when Today mounts again — the opener: set when a Requires you action, a
 * Requires you title link, a Waiting on others link or an item of the all-roles summary (review
 * round 2, R2-1) opens the element panel, used once by Today of
 * the same project after the panel is closed — *Cancel*, Escape or its Close (bug-018, task-043 AC-7,
 * review R1 / D43-10; the Memory list's opener handling, X-06.3, W3-23). `opener` is the class of
 * the control inside the element's row.
 */
let returnOpener: { pid: string; eid: string; opener: string } | undefined;

/** Whether a click on a link is followed in this page (primary button, no modifier key). */
function navigatesHere(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/**
 * Record the control of class `opener` in the row of `eid` as the opener of the element panel
 * (bug-018). Given the click of a link, only a click followed in this page counts (a modified or
 * middle click opens the panel elsewhere).
 */
export function rememberOpener(pid: string, eid: string, opener: string, event?: MouseEvent<HTMLAnchorElement>): void {
  if (event === undefined || navigatesHere(event)) returnOpener = { pid, eid, opener };
}

/** Props of {@link TodayView}. */
export interface TodayViewProps {
  pid: string;
  /** The project header; `dataUpdatedAt` clears a refused summary switch once read again (R2-1). */
  header: Read<ProjectHeader> & Pick<UseQueryResult<ProjectHeader>, 'dataUpdatedAt'>;
  /** `GET /today` for the header's role view; not started until the header is read. */
  today: Read<Today> & Pick<UseQueryResult<Today>, 'isFetching'>;
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
        <Link
          className="today-title"
          to="/p/$pid/e/$eid"
          params={{ pid, eid: element.id }}
          onClick={(event) => {
            rememberOpener(pid, element.id, 'today-title', event);
          }}
        >
          {element.title}
        </Link>
        <Reason row={row} now={now} />
      </span>
      <span className={`state-pill tone-${descriptor.tone}`}>{element.status}</span>
      <Button
        className="button button-primary today-action"
        aria-label={intl.formatMessage({ id: 'today.actionLabel' }, { action, id: element.id })}
        onPress={() => {
          // The focus comes back here when the panel closes (bug-018).
          rememberOpener(pid, element.id, 'today-action');
          // A gate opens with its reason focused (task-037, G-04.3, D37-1): the second click decides.
          void navigate({
            to: '/p/$pid/e/$eid',
            params: { pid, eid: element.id },
            state: { gateFocus: action === 'approve' || action === 'review' },
          });
        }}
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
      <Link
        className="today-waiting-row"
        to="/p/$pid/e/$eid"
        params={{ pid, eid: element.id }}
        onClick={(event) => {
          rememberOpener(pid, element.id, 'today-waiting-row', event);
        }}
      >
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
  // D42-6: a switch from the all-roles summary. The Requires you heading takes the focus once the
  // asked view is read (the pressed button is gone while it loads). The request is forgotten on a
  // refusal, on a failed Today read, or when another view is read first (review R1). The refusal is
  // shown here, outside the summary that a refetch may remove (review R2); the view is keyed by the
  // project, so nothing of it reaches another project.
  const roleView = useSetRoleView();
  const switchRequest = useRef<{ role: string; from: string | null } | null>(null);
  const requiresHeading = useRef<HTMLHeadingElement>(null);
  // A refusal is reported once the header was read again (the hook's `onError` awaits it); it stays
  // until the header is read once more — a later switch from the header, a `repo` event — or another
  // switch starts here (review round 2, R2-1; the header's own pattern, `ProjectHeader.tsx`).
  const refusedAt = useRef(0);
  const { isError, reset } = roleView;
  const queryClient = useQueryClient();
  useEffect(() => {
    // Only when the refusal arrives: the header read that follows it is the baseline — read from the
    // cache, which may hold it before this render does.
    if (isError) refusedAt.current = queryClient.getQueryState(projectHeaderQuery(pid).queryKey)?.dataUpdatedAt ?? 0;
  }, [isError, queryClient, pid]);
  useEffect(() => {
    if (isError && header.dataUpdatedAt > refusedAt.current) reset();
  }, [header.dataUpdatedAt, isError, reset]);
  const switchTo = (role: string): void => {
    if (roleView.isPending) return;
    reset();
    switchRequest.current = { role, from: data?.view ?? null };
    roleView.mutate(
      { pid, role },
      {
        onError: () => {
          switchRequest.current = null;
        },
      },
    );
  };
  useEffect(() => {
    const request = switchRequest.current;
    if (request === null) return;
    if (today.error) {
      switchRequest.current = null;
      return;
    }
    if (data === undefined || data.view === request.from) return;
    if (data.view === request.role) requiresHeading.current?.focus();
    switchRequest.current = null;
  }, [data, today.error]);
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

  // Back from the element panel (bug-018): its opener — the action or the link that opened it — is
  // taken when Today mounts, and focused once Today is read again — not from a cached answer that the
  // refetch may change (a decided gate leaves Requires you). When the opener is no longer listed, the
  // main region has the focus. Only while nothing else holds it (the page, or `<main>` after the panel closed): a
  // focus the user moved meanwhile is kept, and the request dropped (the Memory list's rule).
  const pageRef = useRef<HTMLDivElement>(null);
  const pendingOpener = useRef<{ eid: string; opener: string } | undefined>(undefined);
  useEffect(() => {
    if (returnOpener?.pid === pid) pendingOpener.current = { eid: returnOpener.eid, opener: returnOpener.opener };
    returnOpener = undefined;
  }, [pid]);
  const settled = (data !== undefined && !today.isFetching) || today.error !== null;
  useEffect(() => {
    const pending = pendingOpener.current;
    if (!settled || pending === undefined) return;
    pendingOpener.current = undefined;
    const active = document.activeElement;
    if (active !== null && active !== document.body && active.id !== 'main') return;
    const target =
      [...(pageRef.current?.querySelectorAll<HTMLElement>('li[data-eid]') ?? [])]
        .filter((li) => li.dataset['eid'] === pending.eid)
        .map((li) => li.querySelector<HTMLElement>(`.${pending.opener}`))
        .find((el) => el !== null) ?? document.getElementById('main');
    target?.focus();
  }, [settled]);

  const error = header.error ?? today.error;
  return (
    <div className="page today" ref={pageRef}>
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
      {roleView.error && (
        <div className="today-switch-error" role="alert">
          <ErrorText error={roleView.error} />
        </div>
      )}
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
          {data.summary && <RoleSummary pid={pid} lines={data.summary} view={data.view} onSwitch={switchTo} />}
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
