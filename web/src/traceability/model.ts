/**
 * The pure part of the Traceability page (task-067; ux-reference §4.8 v0.3; spec-012 §4; D67-2,
 * D67-8): the filters of the address, the facets with their counts and the rows shown, over the
 * server's answer — the page computes no figure, no done state and no order of rows or chips.
 *
 * Two words of the API coincide with fixture names (REQ-ARC-05): a status and a category. Neither is
 * written here (Q2 (a), decided by the approver 2026-11-16): the status key maps the three other
 * statuses and takes the remaining member of the contract's union as `partial`, the address word of
 * "In progress"; the category order ranks the seven other categories and puts the remaining one in its
 * closed place. A unit test pins both against the schema lists (`test/web/traceability/model.test.ts`).
 */
import type { ReferenceStatus, Traceability, TraceabilityReference, UiCategory } from '@wingfoil-ui/contracts';

/** A status filter of the address and of the status buttons (`partial` is "In progress"). */
export type StatusFilter = 'completed' | 'partial' | 'not-started' | 'no-elements';

/** The status filters, in the order of §4.8. */
export const STATUS_FILTERS: readonly StatusFilter[] = ['completed', 'partial', 'not-started', 'no-elements'];

/** The status filter of a reference's server `status`. */
export function statusKey(status: ReferenceStatus): StatusFilter {
  switch (status) {
    case 'completed':
    case 'not-started':
    case 'no-elements':
      return status;
    default:
      // The remaining member of the union: some, not all, linked elements done.
      return 'partial';
  }
}

/** The rank of each category in the closed order (spec-005 §1, ux-reference §6) but one. */
const RANKS: Partial<Record<UiCategory, number>> = {
  work: 0,
  defect: 1,
  decision: 2,
  spec: 3,
  requirement: 4,
  feature: 5,
  external: 7,
};

/** The rank of the category the table above leaves out: between `feature` and `external`. */
const REMAINING_RANK = 6;

/** Compares two categories in the closed order. */
export function byCategoryOrder(a: UiCategory, b: UiCategory): number {
  return (RANKS[a] ?? REMAINING_RANK) - (RANKS[b] ?? REMAINING_RANK);
}

/** The page's search parameters (D67-2); absent keys are *All* / the current scope. */
export interface TraceabilityFilters {
  scope?: 'project';
  category?: string;
  status?: StatusFilter;
  q?: string;
}

/** A search parameter kept when it is a non-empty text. */
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** The page's filters from the address; unknown values dropped. */
export function traceabilitySearch(search: Record<string, unknown>): TraceabilityFilters {
  const category = text(search['category']);
  const status = STATUS_FILTERS.find((s) => s === search['status']);
  const q = text(search['q']);
  return {
    ...(search['scope'] === 'project' ? { scope: 'project' as const } : {}),
    ...(category !== undefined ? { category } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(q !== undefined ? { q } : {}),
  };
}

/** The filters that apply to `answer`: a category it does not list and `no-elements` in the current scope ignored. */
export function effectiveFilters(
  filters: TraceabilityFilters,
  answer: Traceability,
): { category?: UiCategory; status?: StatusFilter; q: string } {
  const category = answer.references.find((r) => r.category === filters.category)?.category;
  const project = answer.scope.applied === 'project';
  const status = filters.status === 'no-elements' && !project ? undefined : filters.status;
  return {
    ...(category !== undefined ? { category } : {}),
    ...(status !== undefined ? { status } : {}),
    q: filters.q ?? '',
  };
}

/** A value of a facet and the count of the rows that have it. */
export interface Facet<V> {
  value: V;
  count: number;
}

/** Each category found among `references`, in the closed order, with its count. */
export function categoryFacets(references: readonly TraceabilityReference[]): Facet<UiCategory>[] {
  const counts = new Map<UiCategory, number>();
  for (const r of references) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  return [...counts.keys()].sort(byCategoryOrder).map((value) => ({ value, count: counts.get(value) ?? 0 }));
}

/** The status filters with their counts within `category`; `no-elements` only with the whole project. */
export function statusFacets(
  references: readonly TraceabilityReference[],
  category: UiCategory | undefined,
  project: boolean,
): Facet<StatusFilter>[] {
  const within = references.filter((r) => category === undefined || r.category === category);
  return STATUS_FILTERS.filter((s) => project || s !== 'no-elements').map((value) => ({
    value,
    count: within.filter((r) => statusKey(r.status) === value).length,
  }));
}

/** The key of a row: its kind and its id (an element row and a pattern row may share an id). */
export function referenceKey(reference: TraceabilityReference): string {
  return `${reference.element ? 'e' : 'p'}:${reference.id}`;
}

/**
 * The rows `filters` leave, in the server's order: category, status and the search — a
 * case-insensitive substring of the id and, for an element reference, of its title (never a regular
 * expression).
 */
export function visibleReferences(answer: Traceability, filters: TraceabilityFilters): TraceabilityReference[] {
  const { category, status, q } = effectiveFilters(filters, answer);
  const needle = q.toLowerCase();
  const titles = new Map(answer.elements.map((e) => [e.id, e.title]));
  return answer.references.filter((r) => {
    if (category !== undefined && r.category !== category) return false;
    if (status !== undefined && statusKey(r.status) !== status) return false;
    if (needle === '') return true;
    if (r.id.toLowerCase().includes(needle)) return true;
    const title = r.element ? titles.get(r.id) : undefined;
    return title !== undefined && title.toLowerCase().includes(needle);
  });
}
