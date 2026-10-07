/**
 * The Memory list (ux-reference §4.4, prototype Memory screen): the heading and the number of
 * types; row 1, the type filters of `memory.yaml` with counts; row 2, the state filters — with *All
 * types* the four buckets of the descriptor, with a type its states —; the rows (type tag, title,
 * id, *local changes*, age in the state, state pill with the descriptor's tone), each opening the
 * element panel. Read-only in v0.1: no "+ Ingestion", no producer note, no missing-references chip
 * (W3-26). Filters are links: the URL holds them.
 *
 * Renders the server's data as is: the bucket and the tone come with each element's descriptor
 * (spec-003 §8), never re-derived; type and state names are shown as written.
 */
import type { UseQueryResult } from '@tanstack/react-query';
import type { ElementList, ListedElement, MemoryYaml, ProjectConfig } from '@wingfoil-ui/contracts';
import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { ApiError } from '../api/client.js';
import { ErrorText } from '../shell/ErrorText.js';
import { ageOf, bucketFilters, filterRows, stateFilters, typeFilters, type ListFilters } from './model.js';
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

/** An error of a query as the catalogue renders it. */
function QueryError({ error }: { error: Error }): ReactNode {
  const e = error instanceof ApiError ? error : new ApiError(0, 'internal', error.message, undefined);
  return (
    <div className="memory-error" role="alert">
      <ErrorText error={e} />
    </div>
  );
}

/** The type definitions of the configuration, when they could be read. */
function typesOf(config: ProjectConfig | undefined): MemoryYaml | undefined {
  return config && 'data' in config.types ? config.types.data : undefined;
}

/** One filter link: its name, its count, the router's `aria-current` when it is the URL's filter. */
function FilterLink({
  pid,
  search,
  name,
  count,
  tone,
}: {
  pid: string;
  search: ListFilters;
  name: ReactNode;
  count: number;
  tone?: string | undefined;
}): ReactNode {
  const intl = useIntl();
  const label = typeof name === 'string' ? name : '';
  return (
    <li>
      <Link
        className="filter-link"
        to="/p/$pid/memory"
        params={{ pid }}
        search={search}
        activeOptions={{ exact: true }}
        aria-label={intl.formatMessage({ id: 'memory.filter.withCount' }, { name: label, count })}
      >
        {tone !== undefined && <span className={`filter-dot tone-${tone}`} aria-hidden="true" />}
        <span>{name}</span>
        <span className="filter-count">{count}</span>
      </Link>
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
  return (
    <li>
      <Link
        className="memory-row"
        to="/p/$pid/e/$eid"
        params={{ pid, eid: element.id }}
        data-eid={element.id}
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
        <Age since={element.descriptor?.since} now={now} />
        <span className={tone === undefined ? 'state-pill' : `state-pill tone-${tone}`}>{element.status}</span>
      </Link>
    </li>
  );
}

/** The Memory list. */
export function MemoryList({ pid, filters, config, elements, withArchived }: MemoryListProps): ReactNode {
  const intl = useIntl();
  const list = elements.data;
  const selected = filters.type;
  const types = typesOf(config.data);
  const typesError = list?.typesError !== undefined || (config.data !== undefined && types === undefined);
  const base = list?.elements ?? [];
  // A selected type lists its archived elements too, once read (W3-24); its count stays on `base`.
  const pool = filters.type !== undefined ? (withArchived?.data?.elements ?? base) : base;
  const ofType = filters.type !== undefined ? pool.filter((e) => e.type === filters.type) : [];
  const rows = filterRows(pool, filters);
  const listRef = useRef<HTMLUListElement>(null);

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
    (withArchived === undefined || withArchived.data !== undefined || withArchived.error !== null);
  useEffect(() => {
    const eid = pendingRow.current;
    if (!ready || eid === undefined) return;
    pendingRow.current = undefined;
    const row = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-eid]') ?? [])].find(
      (a) => a.dataset['eid'] === eid,
    );
    row?.focus();
  }, [ready]);

  // Every refresh that changed the list is announced (directive `accessibility`): each one renders a
  // new node in the live region (keyed by a counter), and a filter change clears it (review F3).
  // The ages are computed against the time of the last read.
  const filterKey = JSON.stringify([filters.type, filters.state, filters.bucket]);
  const [announcement, setAnnouncement] = useState<{ n: number; filterKey: string } | undefined>(undefined);
  const [now, setNow] = useState(Date.now);
  const previous = useRef<ElementList | undefined>(undefined);
  useEffect(() => {
    if (previous.current !== undefined && list !== undefined && previous.current !== list) {
      setAnnouncement((a) => ({ n: (a?.n ?? 0) + 1, filterKey }));
      setNow(Date.now());
    }
    previous.current = list;
  }, [list, filterKey]);

  return (
    <div className="page memory">
      <div className="memory-head">
        <h1 className="page-title">
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
      ) : !list ? (
        <p className="muted" role="status">
          <FormattedMessage id="memory.loading" />
        </p>
      ) : (
        <>
          {typesError && (
            <p className="memory-notice">
              <FormattedMessage id="memory.notice.typesError" />
            </p>
          )}
          {list.eventsError && (
            <p className="memory-notice">
              <FormattedMessage id="memory.notice.eventsError" />
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
              pid={pid}
              search={{}}
              name={intl.formatMessage({ id: 'memory.filter.allTypes' })}
              count={base.length}
            />
            {typeFilters(types, base).map((t) => (
              <FilterLink key={t.type} pid={pid} search={{ type: t.type }} name={t.type} count={t.count} />
            ))}
          </ul>
          {selected !== undefined ? (
            <ul className="filter-row filter-states" aria-label={intl.formatMessage({ id: 'memory.filter.states' })}>
              <FilterLink
                pid={pid}
                search={{ type: selected }}
                name={intl.formatMessage({ id: 'memory.filter.allStates' })}
                count={ofType.length}
              />
              {stateFilters(types?.types[selected]?.states?.sequence, ofType).map((s) => (
                <FilterLink
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
            !typesError && (
              <ul className="filter-row filter-states" aria-label={intl.formatMessage({ id: 'memory.filter.states' })}>
                <FilterLink
                  pid={pid}
                  search={{}}
                  name={intl.formatMessage({ id: 'memory.filter.allStates' })}
                  count={base.length}
                />
                {bucketFilters(base).map((b) => (
                  <FilterLink
                    key={b.key}
                    pid={pid}
                    search={{ bucket: b.key }}
                    name={intl.formatMessage(b.label)}
                    count={b.count}
                  />
                ))}
              </ul>
            )
          )}
          <ul ref={listRef} className="memory-rows" aria-label={intl.formatMessage({ id: 'memory.list.label' })}>
            {rows.map((e) => (
              <Row key={e.id} pid={pid} element={e} now={now} />
            ))}
          </ul>
          {rows.length === 0 && (
            <p className="memory-empty">
              {filters.type !== undefined && ofType.length === 0 ? (
                <FormattedMessage id="memory.empty.type" values={{ type: filters.type }} />
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
