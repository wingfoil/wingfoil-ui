/**
 * Pure helpers of the Memory list (ux-reference §4.4; `memory-list.feature`): the type filters of
 * `memory.yaml` with counts, the state filters (the type's states, or the buckets of the action
 * descriptor with *All types*) and the filtering. Nothing here knows a type, state or bucket name
 * (REQ-ARC-05, spec-003 §8 vocabulary note): types and states are the project's data, the bucket of
 * an element is its descriptor's, and the bucket labels are catalogue messages whose ids follow the
 * bucket codes by the lowerCamel rule (`to-approve` → `memory.bucket.toApprove`).
 */
import type { Bucket, ListedElement, MemoryYaml, ProjectConfig, Tone } from '@wingfoil-ui/contracts';
import { defineMessage, type MessageDescriptor } from 'react-intl';

/** `a-b-c` → `aBC`, as a type. */
type LowerCamel<S extends string> = S extends `${infer A}-${infer B}` ? `${A}${Capitalize<LowerCamel<B>>}` : S;

/** The key of a bucket in the URL and in its catalogue id: its code in lowerCamel case. */
export type BucketKey = LowerCamel<Bucket>;

/** The catalogue id of a bucket label. */
type BucketMessageId = `memory.bucket.${BucketKey}`;

const BUCKET_PREFIX = 'memory.bucket.';

/**
 * The four bucket labels, in the order of the feature header (W3-27): *To approve · In progress ·
 * Waiting/drafts/closed · Done*.
 */
const BUCKET_MESSAGES = [
  defineMessage({ id: 'memory.bucket.toApprove' }),
  defineMessage({ id: 'memory.bucket.inProgress' }),
  defineMessage({ id: 'memory.bucket.waiting' }),
  defineMessage({ id: 'memory.bucket.done' }),
] as const satisfies readonly { id: BucketMessageId }[];

// Every bucket code of the contracts has its label (a compile-time check).
type MissingBucket = Exclude<BucketMessageId, (typeof BUCKET_MESSAGES)[number]['id']>;
const everyBucketLabelled: MissingBucket extends never ? true : never = true;
void everyBucketLabelled;

/** A bucket filter: its key (URL and catalogue) and its label. */
export interface BucketFilterDef {
  key: BucketKey;
  label: MessageDescriptor;
}

/** The bucket filters, in the feature header's order. */
export const BUCKET_FILTERS: readonly BucketFilterDef[] = BUCKET_MESSAGES.map((label) => ({
  key: label.id.slice(BUCKET_PREFIX.length) as BucketKey,
  label,
}));

/** The key of a bucket code (`undefined` for an element without bucket: archived, or no descriptor). */
export function bucketKeyOf(bucket: Bucket | undefined): BucketKey | undefined {
  return bucket?.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()) as BucketKey | undefined;
}

/** A type filter with its count. */
export interface TypeFilter {
  type: string;
  count: number;
}

/** Count `values` by name, keeping the order of first appearance. */
function countBy(values: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return counts;
}

/**
 * The type filters: the types of `memory.yaml` in file order with their counts (zero included), then
 * the types found on elements that `memory.yaml` does not declare, under their own names (W3-25).
 * Without the type definitions, the types of the elements.
 */
export function typeFilters(types: MemoryYaml | undefined, elements: readonly ListedElement[]): TypeFilter[] {
  const counts = countBy(elements.map((e) => e.type));
  const declared = Object.keys(types?.types ?? {});
  const extra = [...counts.keys()].filter((t) => !declared.includes(t));
  return [...declared, ...extra].map((type) => ({ type, count: counts.get(type) ?? 0 }));
}

/** A state filter of one type: the state, its count and the tone of its elements (data), if any. */
export interface StateFilter {
  state: string;
  count: number;
  tone?: Tone;
}

/**
 * The state filters of one type: its `sequence`, then the states of its elements outside it (an
 * undeclared or archived state), under their own names (W3-25). The tone is the descriptor's of an
 * element in that state; a state with no element has none.
 */
export function stateFilters(
  sequence: readonly string[] | undefined,
  elements: readonly ListedElement[],
): StateFilter[] {
  const counts = countBy(elements.map((e) => e.status));
  const order = sequence ?? [];
  const extra = [...counts.keys()].filter((s) => !order.includes(s));
  return [...order, ...extra].map((state) => {
    const tone = elements.find((e) => e.status === state && e.descriptor)?.descriptor?.tone;
    return { state, count: counts.get(state) ?? 0, ...(tone ? { tone } : {}) };
  });
}

/** A bucket filter with its count. */
export interface BucketFilter extends BucketFilterDef {
  count: number;
}

/** The bucket filters with the count of elements whose descriptor is in each bucket. */
export function bucketFilters(elements: readonly ListedElement[]): BucketFilter[] {
  const counts = countBy(elements.flatMap((e) => bucketKeyOf(e.descriptor?.bucket) ?? []));
  return BUCKET_FILTERS.map((b) => ({ ...b, count: counts.get(b.key) ?? 0 }));
}

/** The filters of the list (the URL's search parameters). */
export interface ListFilters {
  type?: string;
  state?: string;
  bucket?: string;
}

/** The elements of `elements` that pass `filters`: a type and its state, or (all types) a bucket. */
export function filterRows(elements: readonly ListedElement[], filters: ListFilters): ListedElement[] {
  const { type, state, bucket } = filters;
  if (type !== undefined) {
    return elements.filter((e) => e.type === type && (state === undefined || e.status === state));
  }
  if (bucket !== undefined) return elements.filter((e) => bucketKeyOf(e.descriptor?.bucket) === bucket);
  return [...elements];
}

/** A relative age: a negative value (in the past) and its unit, for `Intl.RelativeTimeFormat`. */
export interface Age {
  value: number;
  unit: 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';
}

const AGE_STEPS: readonly [Age['unit'], number][] = [
  ['year', 365 * 86_400],
  ['month', 30 * 86_400],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/** The age of `since` (ISO 8601) at `now` (ms) in its largest whole unit; a future time is 0 s. */
export function ageOf(since: string, now: number): Age {
  const seconds = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  for (const [unit, size] of AGE_STEPS) {
    if (seconds >= size) return { value: -Math.floor(seconds / size), unit };
  }
  return { value: -seconds, unit: 'second' };
}

/** The type definitions of the configuration, when they could be read. */
export function typesOf(config: ProjectConfig | undefined): MemoryYaml | undefined {
  return config && 'data' in config.types ? config.types.data : undefined;
}

/** Whether `type` is one of the type filters (declared, or found on an element). */
export function isListedType(types: MemoryYaml | undefined, elements: readonly ListedElement[], type: string): boolean {
  return typeFilters(types, elements).some((t) => t.type === type);
}
