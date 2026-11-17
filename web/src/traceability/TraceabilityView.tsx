/**
 * The Traceability page (US-R-01; ux-reference §4.8 v0.3; spec-012 §4; task-067, D67-2 … D67-12):
 * the ui.yaml warning, the scope control, the figures, the no-ui.yaml note, the search and the
 * category and status filters, the references table, the missing-references section and the notices,
 * over one answer of `GET /traceability`. Renders the server's references and figures; filters and
 * counts over the answer are its only computations (D67-4).
 *
 * task-081 (D81-6, D81-7): the open row — one at a time, never in the address — is kept per project
 * while the settled answer still has its reference (a refresh, a scope change once its answer is
 * there); a filter that hides it keeps it open. A refresh moves no focus and announces nothing.
 */
import type { UseQueryResult } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { ProjectHeader, Traceability, UiCategory } from '@wingfoil-ui/contracts';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { QueryError } from '../docs/QueryError.js';
import { UiYamlWarning } from '../shell/UiYamlWarning.js';
import { Figures } from './Figures.js';
import { MissingSection } from './MissingSection.js';
import {
  categoryFacets,
  effectiveFilters,
  referenceKey,
  statusFacets,
  visibleReferences,
  type StatusFilter,
  type TraceabilityFilters,
} from './model.js';
import { ReferenceTable } from './ReferenceTable.js';
import './traceability.css';

/** The `select` value of each status filter in the catalogue (ICU selectors take no hyphen). */
const STATUS_SELECT: Record<StatusFilter | 'all', string> = {
  all: 'all',
  completed: 'completed',
  partial: 'partial',
  'not-started': 'notStarted',
  'no-elements': 'noElements',
};

/** The pause after the last filter or search change before the row count is announced (F-7). */
const ANNOUNCE_PAUSE_MS = 500;

/** Props of {@link TraceabilityView}. */
export interface TraceabilityViewProps {
  pid: string;
  filters: TraceabilityFilters;
  answer: UseQueryResult<Traceability>;
  /** The project header (the identity of the *Use preset* rule, Q3). */
  header: ProjectHeader | undefined;
}

/** A toggle button of a filter group (`aria-pressed`, the count in its name, D67-8). */
function Toggle({
  pressed,
  label,
  onPress,
  children,
}: {
  pressed: boolean;
  label: string;
  onPress: () => void;
  children: ReactNode;
}): ReactNode {
  return (
    <button type="button" className="trace-toggle" aria-pressed={pressed} aria-label={label} onClick={onPress}>
      {children}
    </button>
  );
}

/** A group of toggle buttons with its visible label. */
function Group({
  label,
  className,
  children,
}: {
  label: ReactNode;
  className?: string;
  children: ReactNode;
}): ReactNode {
  const id = useId();
  return (
    <div className={className ? `trace-group ${className}` : 'trace-group'} role="group" aria-labelledby={id}>
      <span id={id} className="trace-group-label">
        {label}
      </span>
      {children}
    </div>
  );
}

/** The page. */
export function TraceabilityView({ pid, filters, answer, header }: TraceabilityViewProps): ReactNode {
  const intl = useIntl();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const data = answer.data;

  /** Moves to `next` filters (the scope kept unless given); the search replaces its entry. */
  const go = (next: TraceabilityFilters, replace = false): void => {
    void navigate({ to: '/p/$pid/traceability', params: { pid }, search: next, replace });
  };
  const withFilter = (patch: Partial<Record<keyof TraceabilityFilters, string | undefined>>): TraceabilityFilters => {
    const merged: Record<string, string | undefined> = { ...filters, ...patch };
    return Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined)) as TraceabilityFilters;
  };

  // The search field types locally, so no keystroke is lost, and follows the address when it changes
  // otherwise (back, Clear filters; D67-2) — state adjusted while rendering, not in an effect.
  const [q, setQ] = useState(filters.q ?? '');
  const [addressQ, setAddressQ] = useState(filters.q);
  if (addressQ !== filters.q) {
    setAddressQ(filters.q);
    setQ(filters.q ?? '');
  }

  const elements = useMemo(() => new Map((data?.elements ?? []).map((e) => [e.id, e])), [data]);
  const rows = useMemo(() => (data ? visibleReferences(data, filters) : []), [data, filters]);

  // The number of rows is announced after a filter or search change, never after a refresh (D67-8),
  // and only after a pause, so typing announces once (review round 1, F-7). The first filters seen
  // announce nothing; each new filter key, once its answer is there and the pause is over, renders one
  // new node in the polite region (keyed by a counter). A refresh keeps the key: nothing.
  const filterKey = JSON.stringify(filters);
  const settled = data !== undefined && !answer.isPlaceholderData;
  const [announced, setAnnounced] = useState<{ key: string; n: number; count?: number }>({ key: filterKey, n: 0 });
  useEffect(() => {
    if (!settled || announced.key === filterKey) return;
    const timer = window.setTimeout(() => {
      setAnnounced((a) => ({ key: filterKey, n: a.n + 1, count: rows.length }));
    }, ANNOUNCE_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [settled, filterKey, rows.length, announced.key]);
  const announcement = announced.key === filterKey ? announced.count : undefined;

  const clear = (): void => {
    go(filters.scope ? { scope: filters.scope } : {});
    searchRef.current?.focus();
  };

  // The last answer read, so that a failed read of the other scope keeps the scope control (and the
  // focus on it) above its error (review round 1, F-5).
  // Kept per project: another project's answer never shows above this one's error (R2-3).
  const [lastAnswer, setLastAnswer] = useState<{ pid: string; answer: Traceability } | undefined>(undefined);
  if (data !== undefined && (lastAnswer?.pid !== pid || lastAnswer.answer !== data))
    setLastAnswer({ pid, answer: data });
  const shown = data ?? (lastAnswer?.pid === pid ? lastAnswer.answer : undefined);

  // The open row (D81-6): of this project only (the route is not remounted on a switch, R2-3), and
  // closed once the settled answer has no such reference — not while a placeholder is shown.
  const [open, setOpen] = useState<{ pid: string; key: string } | undefined>(undefined);
  if (
    open !== undefined &&
    (open.pid !== pid ||
      (data !== undefined && !answer.isPlaceholderData && !data.references.some((r) => referenceKey(r) === open.key)))
  )
    setOpen(undefined);
  const openKey = open?.pid === pid ? open.key : undefined;
  const toggleRow = (key: string): void => {
    setOpen((o) => (o?.pid === pid && o.key === key ? undefined : { pid, key }));
  };
  const current = shown?.scope.current ?? null;
  const scopeElement = current
    ? { element: current.shortId ?? current.id, type: shown?.scope.type ?? current.type }
    : undefined;
  const wholeProject = filters.scope === 'project';

  let body: ReactNode;
  if (answer.error && !data) {
    body = <QueryError error={answer.error} />;
  } else if (!data) {
    body = (
      <p className="muted" role="status">
        <FormattedMessage id="traceability.loading" />
      </p>
    );
  } else {
    const applied = effectiveFilters(filters, data);
    const project = data.scope.applied === 'project';
    const categories = categoryFacets(data.references);
    const statuses = statusFacets(data.references, applied.category, project);
    const inCategory = data.references.filter((r) => applied.category === undefined || r.category === applied.category);
    const noFile = data.ui.source !== 'file';
    const offerPreset = data.ui.source === 'none' && header?.identity.kind === 'member';
    const count = (name: string, n: number): string =>
      intl.formatMessage({ id: 'traceability.filter.withCount' }, { name, count: n });
    const statusLabel = (s: StatusFilter | 'all', n: number): string =>
      intl.formatMessage({ id: 'traceability.status.withCount' }, { status: STATUS_SELECT[s], count: n });
    const statusName = (s: StatusFilter | 'all'): string =>
      intl.formatMessage({ id: 'traceability.status.option' }, { status: STATUS_SELECT[s] });
    body = (
      <>
        <Figures pid={pid} answer={data} projectVersion={header?.wingfoil.version ?? null} />
        {noFile && (
          <p className="trace-note">
            <span>
              <FormattedMessage id="traceability.noUiYaml" />
            </span>
            {offerPreset && (
              <Link to="/p/$pid/configuration/taxonomy" params={{ pid }}>
                <FormattedMessage id="traceability.noUiYaml.preset" />
              </Link>
            )}
            <Link to="/p/$pid/configuration/taxonomy" params={{ pid }}>
              <FormattedMessage id="traceability.noUiYaml.taxonomy" />
            </Link>
          </p>
        )}
        {(data.unreadable.length > 0 || data.capped.length > 0 || data.eventsError) && (
          <div className="trace-notices">
            {data.unreadable.length > 0 && (
              <p className="trace-notice">
                <FormattedMessage
                  id="traceability.notice.unreadable"
                  values={{ count: data.unreadable.length, ids: data.unreadable.join(', ') }}
                />
              </p>
            )}
            {data.capped.length > 0 && (
              <p className="trace-notice">
                <FormattedMessage
                  id="traceability.notice.capped"
                  values={{ count: data.capped.length, ids: data.capped.join(', ') }}
                />
              </p>
            )}
            {data.eventsError && (
              <p className="trace-notice">
                <FormattedMessage id="traceability.notice.eventsError" />
              </p>
            )}
          </div>
        )}
        {data.references.length === 0 ? (
          <p className="trace-empty">
            {data.patterns ? (
              <FormattedMessage id="traceability.empty.none" />
            ) : (
              <FormattedMessage id="traceability.empty.noPatterns" />
            )}
          </p>
        ) : (
          <>
            <div className="trace-filters">
              <input
                ref={searchRef}
                type="search"
                className="field-input trace-search"
                aria-label={intl.formatMessage({ id: 'traceability.search.label' })}
                placeholder={intl.formatMessage({ id: 'traceability.search.label' })}
                value={q}
                onChange={(event) => {
                  const value = event.target.value;
                  setQ(value);
                  go(withFilter({ q: value === '' ? undefined : value }), true);
                }}
              />
              <Group label={<FormattedMessage id="traceability.category.label" />}>
                <Toggle
                  pressed={applied.category === undefined}
                  label={intl.formatMessage(
                    { id: 'traceability.category.allWithCount' },
                    { count: data.references.length },
                  )}
                  onPress={() => go(withFilter({ category: undefined }))}
                >
                  <FormattedMessage id="traceability.category.all" />
                  <span className="trace-count">{data.references.length}</span>
                </Toggle>
                {categories.map((c: { value: UiCategory; count: number }) => (
                  <Toggle
                    key={c.value}
                    pressed={applied.category === c.value}
                    label={count(c.value, c.count)}
                    onPress={() => go(withFilter({ category: c.value }))}
                  >
                    {c.value}
                    <span className="trace-count">{c.count}</span>
                  </Toggle>
                ))}
              </Group>
              <Group label={<FormattedMessage id="traceability.status.label" />}>
                <Toggle
                  pressed={applied.status === undefined}
                  label={statusLabel('all', inCategory.length)}
                  onPress={() => go(withFilter({ status: undefined }))}
                >
                  {statusName('all')}
                  <span className="trace-count">{inCategory.length}</span>
                </Toggle>
                {statuses.map((s) => (
                  <Toggle
                    key={s.value}
                    pressed={applied.status === s.value}
                    label={statusLabel(s.value, s.count)}
                    onPress={() => go(withFilter({ status: s.value }))}
                  >
                    {statusName(s.value)}
                    <span className="trace-count">{s.count}</span>
                  </Toggle>
                ))}
              </Group>
            </div>
            {rows.length === 0 ? (
              <div className="trace-empty">
                <p>
                  <FormattedMessage id="traceability.empty.filter" />
                </p>
                <button type="button" className="button button-quiet" onClick={clear}>
                  <FormattedMessage id="traceability.clear" />
                </button>
              </div>
            ) : (
              <ReferenceTable
                pid={pid}
                references={rows}
                elements={elements}
                busy={answer.isPlaceholderData}
                openKey={openKey}
                onToggle={toggleRow}
              />
            )}
          </>
        )}
        <MissingSection pid={pid} answer={data} elements={elements} />
      </>
    );
  }

  return (
    <div className="page traceability">
      <h1 className="page-title">
        <FormattedMessage id="traceability.title" />
      </h1>
      <div
        className="visually-hidden"
        role="status"
        aria-label={intl.formatMessage({ id: 'traceability.updates.label' })}
      >
        {announcement !== undefined && (
          <span key={announced.n}>
            <FormattedMessage id="traceability.count" values={{ count: announcement }} />
          </span>
        )}
      </div>
      {shown && <UiYamlWarning status={shown.ui} />}
      {scopeElement !== undefined && (
        <Group label={<FormattedMessage id="traceability.scope.label" />} className="trace-scope">
          <Toggle
            pressed={!wholeProject}
            label={intl.formatMessage({ id: 'traceability.scope.current' }, scopeElement)}
            onPress={() => go(withFilter({ scope: undefined }))}
          >
            <FormattedMessage id="traceability.scope.current" values={scopeElement} />
          </Toggle>
          <Toggle
            pressed={wholeProject}
            label={intl.formatMessage({ id: 'traceability.scope.project' })}
            onPress={() => go(withFilter({ scope: 'project' }))}
          >
            <FormattedMessage id="traceability.scope.project" />
          </Toggle>
        </Group>
      )}
      {body}
    </div>
  );
}
