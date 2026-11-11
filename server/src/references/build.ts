/**
 * The builder of the reference index (spec-012 §1, task-055 D55-4, D55-5, D55-7): from the
 * `memory search` matches and a source of each file's values, the two reference rules in order,
 * the kinds, the in-scope rule; at most {@link INDEX_READS} files read at a time; the pattern tests
 * within {@link PATTERN_BUDGET_MS} per build, in slices that serve the event loop, their results
 * kept across builds by a {@link PatternMemo}. Pure but for the source and the clock.
 */
import type { MemoryMatch, MemoryYaml } from '@wingfoil-ui/contracts';
import { stateKind } from '../descriptor/descriptor.js';
import { DirectReadError, type DirectReadErrorKind } from '../reads/confine.js';
import { resolveStates } from '../reads/memory-yaml.js';
import { MAX_PATTERN_VALUE } from '../ui-config/patterns.js';
import type { UiCategory, UiPattern } from '../ui-config/types.js';
import {
  INDEX_READS,
  PATTERN_BUDGET_MS,
  PATTERN_SLICE_MS,
  type FileValues,
  type IndexedElement,
  type Reference,
  type ReferenceIndex,
} from './index.js';

/** Where the values of each listed element come from (the snapshot's reuse, D55-6). */
export interface ValueSource {
  /** The values of `match`'s file; rejects with a {@link DirectReadError} when it cannot be read. */
  values(match: MemoryMatch): Promise<FileValues>;
}

/** No pattern matched the value. */
const NO_MATCH = -1;

/**
 * The results of rule 2 per distinct value, for one pattern list (its entries' `match` and
 * `category`, in order), kept across builds: a new state tests only values not tested before.
 */
export class PatternMemo {
  private key: string | undefined;
  private results = new Map<string, number>();
  private generation = 0;

  /** The results for `patterns`; a different list starts afresh. */
  for(patterns: readonly UiPattern[]): Map<string, number> {
    const key = JSON.stringify(patterns.map((p) => [p.match, p.category]));
    if (key !== this.key) {
      this.key = key;
      this.results = new Map();
    }
    return this.results;
  }

  /** A build starts: its generation, the newest (review round 2 N2). */
  begin(): number {
    this.generation += 1;
    return this.generation;
  }

  /** Whether `generation` is the newest build's: only that build prunes the results. */
  newest(generation: number): boolean {
    return generation === this.generation;
  }
}

/** Options of {@link buildReferenceIndex}. */
export interface BuildOptions {
  /** The cached `memory search` (the non-archived elements), in its order. */
  matches: readonly MemoryMatch[];
  memoryYaml: MemoryYaml;
  /** The effective `taxonomy.categories`. */
  categories: ReadonlyMap<string, UiCategory | null>;
  /** The effective `taxonomy.patterns`, in file order. */
  patterns: readonly UiPattern[];
  source: ValueSource;
  memo: PatternMemo;
  /** Milliseconds (default `performance.now`). */
  clock?: () => number;
  /** Serves the event loop between slices (default: `setImmediate`). */
  pause?: () => Promise<void>;
  budgetMs?: number;
  sliceMs?: number;
}

/**
 * Whether rule 2 may test `value`: at most 256 code points, no line break. A value of at most 256
 * UTF-16 units has at most 256 code points; one above 512 units has more than 256 (a code point is
 * at most 2 units); only the values between are counted (review round 2 N1).
 */
export function testable(value: string): boolean {
  if (value.includes('\n') || value.includes('\r')) return false;
  if (value.length <= MAX_PATTERN_VALUE) return true;
  if (value.length > 2 * MAX_PATTERN_VALUE) return false;
  let points = 0;
  for (const _ of value) if (++points > MAX_PATTERN_VALUE) return false;
  return true;
}

/** Values walked between two looks at the clock in the passes around the pattern tests. */
const STEP_VALUES = 16;

/** `items` mapped by `work` with at most `limit` running at a time, in order. */
async function pooled<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      out[i] = await work(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

type Read = { ok: true; file: FileValues } | { ok: false; kind: DirectReadErrorKind };

/** Build the index of one state. */
export async function buildReferenceIndex(options: BuildOptions): Promise<ReferenceIndex> {
  const { matches, memoryYaml, categories, patterns, source } = options;
  const clock = options.clock ?? (() => performance.now());
  const pause = options.pause ?? (() => new Promise<void>((resolve) => setImmediate(resolve)));
  const budget = options.budgetMs ?? PATTERN_BUDGET_MS;
  const slice = options.sliceMs ?? PATTERN_SLICE_MS;

  let sliceStart = clock();
  const reads = await pooled(matches, INDEX_READS, async (match): Promise<Read> => {
    try {
      return { ok: true, file: await source.values(match) };
    } catch (error) {
      // Any other failure of one file is a read error of that file, never a failed index.
      return { ok: false, kind: error instanceof DirectReadError ? error.kind : 'missing' };
    }
  });

  // One slice clock for the whole build (review round 2 N1), started before the reads (round 3):
  // every pass serves the event loop once a slice is spent — the walks before and after the pattern
  // tests every STEP_VALUES values, the pattern tests after each test (review round 1 F2).
  let walked = 0;
  const yieldIfSpent = async (now: number): Promise<void> => {
    if (now - sliceStart >= slice) {
      await pause();
      sliceStart = clock();
    }
  };
  const step = async (): Promise<void> => {
    walked += 1;
    if (walked % STEP_VALUES === 0) await yieldIfSpent(clock());
  };

  const byId = new Map(matches.map((m) => [m.id, m]));
  const generation = options.memo.begin();
  const results = options.memo.for(patterns);
  // This build's own results, read by its pass after the tests: a newer build of another state may
  // prune the shared ones meanwhile (review round 2 N2).
  const own = new Map<string, number>();
  const testables = new Map<string, boolean>();
  const isTestable = (value: string): boolean => {
    let t = testables.get(value);
    if (t === undefined) testables.set(value, (t = testable(value)));
    return t;
  };
  const pending: string[] = [];
  const current = new Set<string>();
  for (let i = 0; i < reads.length; i += 1) {
    const read = reads[i]!;
    if (!read.ok) continue;
    const self = matches[i]!.id;
    for (const value of read.file.values) {
      await step();
      if ((byId.has(value) && value !== self) || current.has(value) || !isTestable(value)) continue;
      current.add(value);
      const kept = results.get(value);
      if (kept !== undefined) own.set(value, kept);
      else pending.push(value);
    }
  }
  if (patterns.length > 0) {
    // A value whose tests the budget cuts stays untested (review round 1 F2).
    let spent = 0;
    values: for (const value of pending) {
      let found = NO_MATCH;
      for (let j = 0; j < patterns.length; j += 1) {
        if (spent >= budget) break values;
        const start = clock();
        const hit = patterns[j]!.regex.test(value);
        const end = clock();
        spent += end - start;
        await yieldIfSpent(end);
        if (hit) {
          found = j;
          break;
        }
      }
      results.set(value, found);
      own.set(value, found);
    }
  }
  // The kept results hold the values of the newest build only (review round 1 F3, round 2 N2).
  if (options.memo.newest(generation)) {
    for (const value of results.keys()) {
      await step();
      if (!current.has(value)) results.delete(value);
    }
  }

  const elements: IndexedElement[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i]!;
    const read = reads[i]!;
    const kind = stateKind(resolveStates(memoryYaml, match.type), match.status);
    const base = {
      id: match.id,
      type: match.type,
      status: match.status,
      path: match.path,
      kind,
      finished: kind === 'last',
    };
    if (!read.ok) {
      elements.push({ ...base, unreadable: read.kind, values: [], references: [], capped: false });
      continue;
    }
    const references: Reference[] = [];
    let untested = false;
    for (const value of read.file.values) {
      await step();
      const target = value !== match.id ? byId.get(value) : undefined;
      if (target) {
        references.push({ value, kind: 'element', id: target.id, category: categories.get(target.type) ?? null });
        continue;
      }
      if (patterns.length === 0 || !isTestable(value)) continue;
      const found = own.get(value);
      if (found === undefined) untested = true;
      else if (found !== NO_MATCH) references.push({ value, kind: 'pattern', category: patterns[found]!.category });
    }
    elements.push({
      ...base,
      values: read.file.values,
      ...(read.file.version !== undefined ? { version: read.file.version } : {}),
      references,
      capped: read.file.capped || untested,
    });
  }
  return indexOf(elements, step);
}

/** The queries of {@link ReferenceIndex} over `elements`; the inverted index walked in slices (`step`). */
async function indexOf(elements: readonly IndexedElement[], step: () => Promise<void>): Promise<ReferenceIndex> {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const order = new Map(elements.map((e, i) => [e.id, i]));
  const carriers = new Map<string, IndexedElement[]>();
  for (const e of elements) {
    if (e.unreadable) continue;
    for (const value of e.values) {
      await step();
      const list = carriers.get(value);
      if (list) list.push(e);
      else carriers.set(value, [e]);
    }
  }
  const carrying = (value: string): readonly IndexedElement[] => carriers.get(value) ?? [];
  const inScope = (c: IndexedElement): readonly IndexedElement[] => {
    // An empty `version` is no version (task-059 review round 1 F-2): empty template fields carry it.
    const found = new Set([...carrying(c.id), ...(c.version ? carrying(c.version) : [])]);
    found.delete(c);
    return [...found].sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  };
  return {
    elements,
    get: (id) => byId.get(id),
    unreadable: elements.filter((e) => e.unreadable !== undefined).map((e) => e.id),
    capped: elements.filter((e) => e.capped).map((e) => e.id),
    carrying,
    inScope,
    referencingNotDone(id) {
      const c = byId.get(id);
      if (!c) return 0;
      return inScope(c).filter((e) => !e.finished).length;
    },
  };
}
