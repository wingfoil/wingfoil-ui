/**
 * Traceability (spec-012 §4, task-074): `GET /api/p/:pid/traceability?scope=`
 * (`contracts/api/traceability.schema.json`) — every categorised reference with its linked
 * elements, the completion and coverage figures, the elements missing required references and every
 * element the answer names. Every id is a full id; titles and pattern reference ids arrive escaped
 * (§9).
 */
import type { ApiError, ListedElement } from './api.js';
import type { CompletionFigure, ReadOnlyFigure, Shown, Unavailable } from './progress.js';
import type { ElementRef, UiCategory, UiConfigStatus } from './ui-config.js';

/** The scope a Traceability answer covers: the current element's, or the whole project. */
export type TraceabilityScope = 'current' | 'project';

/** The status of a reference row: the four filters of R-01.3. */
export type ReferenceStatus = 'completed' | 'in-progress' | 'not-started' | 'no-elements';

/** One reference row. */
export interface TraceabilityReference {
  /** An element reference's target id, or a pattern reference's escaped value (its id only, D9). */
  id: string;
  category: UiCategory;
  /** An element reference: `id` is a listed element's, which `elements` names. */
  element: boolean;
  /** The linked elements in the applied scope, natural id order. */
  linked: string[];
  done: number;
  total: number;
  /** `null` when `total` is 0. */
  percent: number | null;
  status: ReferenceStatus;
}

/** `figures.coverage`: the elements carrying every required category (project-wide). */
export type CoverageFigure =
  Shown<{ carrying: number; total: number; percent: number | null }> | Unavailable<'no-requires'>;

/** An element the answer names: its `/elements` row (no `missingCategories`), done and in scope. */
export interface TraceabilityElement extends Omit<ListedElement, 'missingCategories'> {
  /** Descriptor kind `last`. */
  done: boolean;
  /** In the current element's scope; `true` for every element when there is none (task-074 Q1). */
  inScope: boolean;
}

/** `GET /api/p/:pid/traceability?scope=` (spec-012 §4). */
export interface Traceability {
  ui: UiConfigStatus;
  /** The effective `taxonomy.patterns` is non-empty. */
  patterns: boolean;
  scope: { type: string | null; current: ElementRef | null; applied: TraceabilityScope };
  figures: {
    completion: CompletionFigure;
    phaseCompletion: ReadOnlyFigure;
    coverage: CoverageFigure;
    referencesWithoutElements: number;
  };
  references: TraceabilityReference[];
  /** The elements missing required references (spec-012 §5), natural id order. */
  missing: { id: string; categories: UiCategory[] }[];
  elements: TraceabilityElement[];
  unreadable: string[];
  capped: string[];
  /** Why the descriptors were computed without events. */
  eventsError?: ApiError;
}
