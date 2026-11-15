/**
 * The Memory list (ux-reference §4.4, prototype Memory screen): the heading and the number of
 * types; row 1, the type filters of `memory.yaml` with counts; row 2, the state filters — with *All
 * types* the four buckets of the descriptor, with a type its states — and, from v0.3, the filter
 * "Missing required references" (task-066 D66-4); under a selected bucket, its states (D66-3); the
 * active filter with *Clear filter* (D66-7); the rows (type tag, title, id, *local changes*,
 * "missing refs", age in the state, state pill with the descriptor's tone), each opening the
 * element page (task-062). No "+ Ingestion" and no producer note (W3-26). Filters are links: the
 * URL holds them; a figure of the progress card filters on the ids of `/progress` (D66-9).
 *
 * Renders the server's data as is: the bucket and the tone come with each element's descriptor
 * (spec-003 §8), the missing references with each row (spec-012 §5), a figure's ids with
 * `/progress` — never re-derived; type, state and category names are shown as written.
 */
import type { UseQueryResult } from '@tanstack/react-query';
import type { ElementList, ListedElement, Progress, ProjectConfig } from '@wingfoil-ui/contracts';
import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { ApiError } from '../api/client.js';
import { ErrorText } from '../shell/ErrorText.js';
import { FIGURE_LABELS, figureCode, shownFigure } from './figure.js';
import { MissingRefsBadge } from './MissingRefsBadge.js';
import {
  ageOf,
  BUCKET_FILTERS,
  bucketFilters,
  bucketStateFilters,
  filterRows,
  isListedType,
  MISSING_REFS,
  missingCount,
  stateFilters,
  typeFilters,
  typesOf,
  type ListFilters,
} from './model.js';
import './memory.css';

type Read<T> = Pick<UseQueryResult<T>, 'data' | 'error'>;

/** Props of {@link MemoryList}. */
export interface MemoryListProps {
  pid: string;
  filters: ListFilters;
  config: Read<ProjectConfig>;
  /** The non-archived elements (the landing list and the type counts). */
  elements: Read<ElementList>;
  /** Every element, archived ones included: read once a type is selected (W3-24). */
  withArchived?: Read<ElementList> | undefined;
  /** `GET /progress`: read while a figure is in the URL (task-066 D66-8). */
  progress?: Read<Progress> | undefined;
}

/**
 * The row to focus when the list mounts again: set when a row opens the element panel, used once
 * by the list of the same project after the panel is closed (back navigation, W3-23).
 */
let returnRow: { pid: string; eid: string } | undefined;

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

/** A query's error as an API error (a transport failure is `internal`). */
function toApiError(error: Error): ApiError {
  return error instanceof ApiError ? error : new ApiError(0, 'internal', error.message, undefined);
}

/** An error of a query as the catalogue renders it. */
function QueryError({ error }: { error: Error }): ReactNode {
  const e = toApiError(error);
  return (
    <div className="memory-error" role="alert">
      <ErrorText error={e} />
    </div>
  );
}

/** `filters` without the missing-references filter. */
function withoutMissing(filters: ListFilters): ListFilters {
  const { missing: _missing, ...rest } = filters;
  void _missing;
  return rest;
}

/** Whether two filter sets are the same (every parameter the list reads). */
function sameFilters(a: ListFilters, b: ListFilters): boolean {
  return (
    a.type === b.type &&
    a.state === b.state &&
    a.bucket === b.bucket &&
    a.missing === b.missing &&
    a.figure === b.figure
  );
}

/**
 * A link to the list with `search`. Its `aria-current` is the caller's — computed from the filters
 * the list applies, not from the address, which may carry keys the list ignores (task-066 review
 * round 1, F-1, F-5); a router `Link` would derive it from the address.
 */
function SearchLink({
  pid,
  search,
  current,
  className,
  label,
  onFollow,
  children,
}: {
  pid: string;
  search: ListFilters;
  current?: 'page' | 'true' | undefined;
  className: string;
  label?: string | undefined;
  onFollow?: () => void;
  children: ReactNode;
}): ReactNode {
  const router = useRouter();
  const navigate = useNavigate();
  const target = { to: '/p/$pid/memory', params: { pid }, search } as const;
  return (
    <a
      className={className}
      href={router.buildLocation(target).href}
      aria-current={current}
      aria-label={label}
      onClick={(event) => {
        // Only a click that navigates here (primary button, no modifier: not a new tab or window).
        if (!navigatesHere(event)) return;
        event.preventDefault();
        onFollow?.();
        void navigate(target);
      }}
    >
      {children}
    </a>
  );
}

/**
 * One filter link: its name, its count, `aria-current="page"` when it is the filter the list
 * applies (`applied`); `parent` marks a bucket `aria-current="true"` while one of its states is
 * selected (review round 1, F-5).
 */
function FilterLink({
  pid,
  search,
  applied,
  parent = false,
  name,
  count,
  tone,
}: {
  pid: string;
  search: ListFilters;
  applied: ListFilters;
  parent?: boolean;
  name: ReactNode;
  count: number;
  tone?: string | undefined;
}): ReactNode {
  const intl = useIntl();
  const label = typeof name === 'string' ? name : '';
  const current = sameFilters(applied, search) ? 'page' : parent ? 'true' : undefined;
  return (
    <li>
      <SearchLink
        className="filter-link"
        pid={pid}
        search={search}
        current={current}
        label={intl.formatMessage({ id: 'memory.filter.withCount' }, { name: label, count })}
      >
        {tone !== undefined && <span className={`filter-dot tone-${tone}`} aria-hidden="true" />}
        <span>{name}</span>
        <span className="filter-count">{count}</span>
      </SearchLink>
    </li>
  );
}

/** The age of an element in its current state, from the descriptor's `since` (W3-26). */
function Age({ since, now }: { since: string | undefined; now: number }): ReactNode {
  const intl = useIntl();
  if (since === undefined) return <span className="memory-age" />;
  const age = ageOf(since, now);
  return (
    <time className="memory-age" dateTime={since}>
      {intl.formatRelativeTime(age.value, age.unit, { numeric: 'auto' })}
    </time>
  );
}

/** One row: a link to the element panel. */
function Row({ pid, element, now }: { pid: string; element: ListedElement; now: number }): ReactNode {
  const tone = element.descriptor?.tone;
  const descriptionId = useId();
  const missing = element.missingCategories;
  return (
    <li>
      <Link
        className="memory-row"
        to="/p/$pid/e/$eid"
        params={{ pid, eid: element.id }}
        data-eid={element.id}
        aria-describedby={missing !== undefined ? descriptionId : undefined}
        onClick={(event) => {
          // Only a click that navigates here (primary button, no modifier: not a new tab or window).
          if (navigatesHere(event)) returnRow = { pid, eid: element.id };
        }}
      >
        <span className="type-tag memory-tag">{element.type}</span>
        <span className="memory-names">
          <span className="memory-title">{element.title}</span>
          <span className="memory-id">{element.id}</span>
        </span>
        {element.localChanges && (
          <span className="memory-badge">
            <FormattedMessage id="memory.localChanges" />
          </span>
        )}
        {missing !== undefined && <MissingRefsBadge categories={missing} descriptionId={descriptionId} />}
        <Age since={element.descriptor?.since} now={now} />
        <span className={tone === undefined ? 'state-pill' : `state-pill tone-${tone}`}>{element.status}</span>
      </Link>
    </li>
  );
}

/** The Memory list. */
export function MemoryList({
  pid,
  filters: requested,
  config,
  elements,
  withArchived,
  progress,
}: MemoryListProps): ReactNode {
  const intl = useIntl();
  const list = elements.data;
  const selected = requested.type;
  const types = typesOf(config.data);
  // The missing-references filter (D66-4): offered when `requires` names a type, with a type only when
  // it names that one. Asked for where it is not offered, it is ignored, as an unknown figure (review
  // round 1, F-2): the list applies `filters`, the address keeps what was typed.
  const requiredTypes = config.data?.ui?.taxonomy.requires.value.map((r) => r.type) ?? [];
  const missingOffered =
    list?.missingReferences?.shown === true && (selected === undefined || requiredTypes.includes(selected));
  const filters = requested.missing !== undefined && !missingOffered ? withoutMissing(requested) : requested;
  // No descriptor (unreadable `memory.yaml` on the list's side): no bucket row. The type definitions
  // unavailable — that, a failed `types` section or a failed `GET /config` (review F6) — get the notice.
  const noDescriptors = list?.typesError !== undefined;
  const typesUnavailable = noDescriptors || config.error !== null || (config.data !== undefined && types === undefined);
  const base = list?.elements ?? [];
  // A selected type lists its archived elements too, once read (W3-24); its count stays on `base`.
  const pool = filters.type !== undefined ? (withArchived?.data?.elements ?? base) : base;
  const ofType = filters.type !== undefined ? pool.filter((e) => e.type === filters.type) : [];
  // A figure (D66-9): its ids once `/progress` answered; a figure not shown, or a failed read, filters
  // nothing. The rows wait for the answer (no unfiltered flash).
  const figure = figureCode(filters.figure);
  const shown = figure !== undefined && progress?.data !== undefined ? shownFigure(progress.data, figure) : undefined;
  const awaitingFigure =
    figure !== undefined && progress !== undefined && progress.data === undefined && progress.error === null;
  const rows = filterRows(pool, filters, shown?.ids);
  const selectedBucket =
    selected === undefined && figure === undefined && filters.missing === undefined
      ? BUCKET_FILTERS.find((b) => b.key === filters.bucket)
      : undefined;
  const bucketLabel = selectedBucket?.label;
  // The states of the selected bucket (D66-3); none without descriptors (no bucket on any element).
  const bucketStates = selectedBucket !== undefined ? bucketStateFilters(types, base, selectedBucket.key) : [];
  // A type in the URL that is neither declared nor on an element (review F5), known only once the
  // configuration is settled, as the route's archived read (review N3).
  const configSettled = config.data !== undefined || config.error !== null;
  const unknownType =
    list !== undefined && configSettled && selected !== undefined && !isListedType(types, base, selected);
  const listRef = useRef<HTMLUListElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // *Clear filter* moves the focus to the heading once the cleared list is shown (D66-7).
  const focusHeading = useRef(false);

  // Back from the element panel: the row it was opened from is taken when the list mounts, and
  // focused once the rows are there (W3-23). A later refetch never moves the focus.
  const pendingRow = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (returnRow?.pid === pid) pendingRow.current = returnRow.eid;
    returnRow = undefined;
  }, [pid]);
  // With a type selected, the rows are complete once the archived read is there too (review F4).
  const ready =
    list !== undefined &&
    (selected === undefined || configSettled) &&
    (withArchived === undefined || withArchived.data !== undefined || withArchived.error !== null);
  useEffect(() => {
    const eid = pendingRow.current;
    if (!ready || eid === undefined) return;
    pendingRow.current = undefined;
    // Only while nothing else holds the focus (the page, or `<main>` after the panel closed): a
    // focus the user moved meanwhile is kept, and the row is dropped (review N2).
    const active = document.activeElement;
    if (active !== null && active !== document.body && active.id !== 'main') return;
    const row = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-eid]') ?? [])].find(
      (a) => a.dataset['eid'] === eid,
    );
    row?.focus();
  }, [ready]);

  // Every refresh that changed the list is announced (directive `accessibility`): each one renders a
  // new node in the live region (keyed by a counter), and a filter change clears it (review F3).
  // The ages are computed against the time of the last read.
  const filterKey = JSON.stringify([filters.type, filters.state, filters.bucket, filters.missing, filters.figure]);
  const [announcement, setAnnouncement] = useState<{ n: number; filterKey: string } | undefined>(undefined);
  const [now, setNow] = useState(Date.now);
  const previous = useRef<ElementList | undefined>(undefined);
  const previousFilter = useRef(filterKey);
  useEffect(() => {
    // A filter change drops the announcement, so that coming back to a filter does not show it again
    // (review N1).
    if (previousFilter.current !== filterKey) {
      previousFilter.current = filterKey;
      setAnnouncement(undefined);
    }
    if (previous.current !== undefined && list !== undefined && previous.current !== list) {
      setAnnouncement((a) => ({ n: (a?.n ?? 0) + 1, filterKey }));
      setNow(Date.now());
    }
    previous.current = list;
  }, [list, filterKey]);
  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    pendingRow.current = undefined;
    headingRef.current?.focus();
  }, [filterKey]);

  // The active filter (D66-7): what narrows the list beyond the type, and where *Clear filter* goes.
  const activeName =
    shown !== undefined && figure !== undefined
      ? intl.formatMessage(FIGURE_LABELS[figure], shown.values)
      : filters.missing !== undefined
        ? intl.formatMessage({ id: 'memory.filter.missing' })
        : bucketLabel !== undefined
          ? filters.state !== undefined
            ? intl.formatMessage(
                { id: 'memory.active.bucketState' },
                { bucket: intl.formatMessage(bucketLabel), state: filters.state },
              )
            : intl.formatMessage(bucketLabel)
          : undefined;
  const clearSearch: ListFilters = filters.missing !== undefined && selected !== undefined ? { type: selected } : {};
  const missingRefs = list?.missingReferences;

  return (
    <div className="page memory">
      <div className="memory-head">
        <h1 className="page-title" ref={headingRef} tabIndex={-1}>
          <FormattedMessage id="memory.title" />
        </h1>
        {types && (
          <p className="page-intro">
            <FormattedMessage id="memory.intro" values={{ count: Object.keys(types.types).length }} />
          </p>
        )}
      </div>
      <div className="visually-hidden" role="status" aria-label={intl.formatMessage({ id: 'memory.updates.label' })}>
        {announcement?.filterKey === filterKey && (
          <span key={announcement.n}>
            <FormattedMessage id="memory.updated" />
          </span>
        )}
      </div>
      {elements.error ? (
        <QueryError error={elements.error} />
      ) : !list || awaitingFigure ? (
        <p className="muted" role="status">
          <FormattedMessage id="memory.loading" />
        </p>
      ) : (
        <>
          {typesUnavailable && (
            <p className="memory-notice">
              <FormattedMessage id="memory.notice.typesError" />
            </p>
          )}
          {list.eventsError && (
            <p className="memory-notice">
              <FormattedMessage id="memory.notice.eventsError" />
            </p>
          )}
          {figure !== undefined && progress?.error && (
            <div className="memory-notice" role="alert">
              <p>
                <FormattedMessage id="memory.notice.figureError" />
              </p>
              <ErrorText error={toApiError(progress.error)} />
            </div>
          )}
          {missingOffered && missingRefs !== undefined && missingRefs.unreadable.length > 0 && (
            <p className="memory-notice">
              <FormattedMessage
                id="memory.notice.missingUnreadable"
                values={{ count: missingRefs.unreadable.length, ids: intl.formatList(missingRefs.unreadable) }}
              />
            </p>
          )}
          {missingOffered && missingRefs !== undefined && missingRefs.capped.length > 0 && (
            <p className="memory-notice">
              <FormattedMessage
                id="memory.notice.missingCapped"
                values={{ count: missingRefs.capped.length, ids: intl.formatList(missingRefs.capped) }}
              />
            </p>
          )}
          {list.warnings.length > 0 && (
            <section className="memory-notice" aria-label={intl.formatMessage({ id: 'memory.notice.warnings' })}>
              {list.warnings.map((w) => (
                <pre key={w} className="verbatim">
                  {w}
                </pre>
              ))}
            </section>
          )}
          <ul className="filter-row filter-types" aria-label={intl.formatMessage({ id: 'memory.filter.types' })}>
            <FilterLink
              applied={filters}
              pid={pid}
              search={{}}
              name={intl.formatMessage({ id: 'memory.filter.allTypes' })}
              count={base.length}
            />
            {typeFilters(types, base).map((t) => (
              <FilterLink
                applied={filters}
                key={t.type}
                pid={pid}
                search={{ type: t.type }}
                name={t.type}
                count={t.count}
              />
            ))}
          </ul>
          {unknownType ? null : selected !== undefined ? (
            <ul className="filter-row filter-states" aria-label={intl.formatMessage({ id: 'memory.filter.states' })}>
              <FilterLink
                applied={filters}
                pid={pid}
                search={{ type: selected }}
                name={intl.formatMessage({ id: 'memory.filter.allStates' })}
                count={ofType.length}
              />
              {stateFilters(types?.types[selected]?.states?.sequence, ofType).map((s) => (
                <FilterLink
                  applied={filters}
                  key={s.state}
                  pid={pid}
                  search={{ type: selected, state: s.state }}
                  name={s.state}
                  count={s.count}
                  tone={s.tone}
                />
              ))}
            </ul>
          ) : (
            !noDescriptors && (
              <ul className="filter-row filter-states" aria-label={intl.formatMessage({ id: 'memory.filter.states' })}>
                <FilterLink
                  applied={filters}
                  pid={pid}
                  search={{}}
                  name={intl.formatMessage({ id: 'memory.filter.allStates' })}
                  count={base.length}
                />
                {bucketFilters(base).map((b) => (
                  <FilterLink
                    applied={filters}
                    key={b.key}
                    pid={pid}
                    search={{ bucket: b.key }}
                    parent={selectedBucket?.key === b.key && filters.state !== undefined}
                    name={intl.formatMessage(b.label)}
                    count={b.count}
                  />
                ))}
              </ul>
            )
          )}
          {selectedBucket !== undefined && bucketStates.length > 0 && (
            <ul
              className="filter-row filter-states filter-bucket-states"
              aria-label={intl.formatMessage(
                { id: 'memory.filter.bucketStates' },
                { bucket: intl.formatMessage(selectedBucket.label) },
              )}
            >
              {bucketStates.map((s) => (
                <FilterLink
                  applied={filters}
                  key={s.state}
                  pid={pid}
                  search={{ bucket: selectedBucket.key, state: s.state }}
                  name={s.state}
                  count={s.count}
                  tone={s.tone}
                />
              ))}
            </ul>
          )}
          {missingOffered && !unknownType && (
            <ul
              className="filter-row filter-states filter-refs"
              aria-label={intl.formatMessage({ id: 'memory.filter.references' })}
            >
              <FilterLink
                applied={filters}
                pid={pid}
                search={{ ...(selected !== undefined ? { type: selected } : {}), missing: MISSING_REFS }}
                name={intl.formatMessage({ id: 'memory.filter.missing' })}
                count={missingCount(base, selected)}
                tone="danger"
              />
            </ul>
          )}
          {activeName !== undefined && (
            <div className="memory-active" role="group" aria-label={intl.formatMessage({ id: 'memory.active.label' })}>
              <span className="memory-active-name">{activeName}</span>
              <SearchLink
                className="memory-active-clear"
                pid={pid}
                search={clearSearch}
                onFollow={() => {
                  focusHeading.current = true;
                }}
              >
                <FormattedMessage id="memory.active.clear" />
              </SearchLink>
            </div>
          )}
          <ul ref={listRef} className="memory-rows" aria-label={intl.formatMessage({ id: 'memory.list.label' })}>
            {rows.map((e) => (
              <Row key={e.id} pid={pid} element={e} now={now} />
            ))}
          </ul>
          {rows.length === 0 && (selected === undefined || configSettled) && (
            <p className="memory-empty">
              {selected !== undefined && !unknownType && ofType.length === 0 ? (
                <FormattedMessage id="memory.empty.type" values={{ type: selected }} />
              ) : (
                <FormattedMessage id="memory.empty.filter" />
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
