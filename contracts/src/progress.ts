/**
 * The project-state views of spec-012 (task-059): the progress card's figures of
 * `GET /api/p/:pid/progress` (`contracts/api/progress.schema.json`, §3) and the missing-reference
 * flag of `GET /api/p/:pid/elements` (`elements.schema.json`, §5). Every id is a full id; titles and
 * pattern reference ids arrive escaped (§9).
 */
import type { ApiCapabilityReason } from './api.js';
import type { ElementRef, UiCategory, UiConfigStatus } from './ui-config.js';

/** A figure the card shows, with its data. */
export type Shown<T> = { state: 'shown' } & T;

/** A figure the card does not show, and why. */
export interface Unavailable<C extends string> {
  state: 'unavailable';
  reason: { code: C };
}

/** A figure that needs a later WingFoil or release (the capability `workflow-position`'s reason). */
export interface ReadOnlyFigure {
  state: 'read-only';
  reason: ApiCapabilityReason;
}

/** One reference counted by `completion` (spec-012 §3): its in-scope linked elements. */
export interface CompletionReference {
  id: string;
  done: number;
  total: number;
  percent: number;
}

/** `figures.completion`. */
export type CompletionFigure =
  | Shown<{
      /** The unweighted mean of the references' completion, 0 … 1. */
      value: number;
      percent: number;
      /** At most 10, natural id order. */
      references: CompletionReference[];
      referencesCount: number;
      ids: string[];
    }>
  | Unavailable<'no-reference-categories' | 'no-linked-elements'>;

/** `figures.iterated`. */
export type IteratedFigure =
  | Shown<{ type: string; done: number; total: number; ids: string[]; doneIds: string[] }>
  | Unavailable<'no-iterates-type'>;

/** `figures.openDefects`. */
export type OpenDefectsFigure = Shown<{ type: string; count: number; ids: string[] }> | Unavailable<'no-defects-type'>;

/** `figures.pendingGates`. */
export type PendingGatesFigure = Shown<{ count: number; ids: string[] }>;

/** `GET /api/p/:pid/progress` (spec-012 §3). */
export interface Progress {
  ui: UiConfigStatus;
  mode: 'sequence' | 'flow';
  scope: { type: string | null; current: ElementRef | null; basis: 'derived' | null };
  figures: {
    completion: CompletionFigure;
    phase: ReadOnlyFigure;
    phaseCompletion: ReadOnlyFigure;
    iterated: IteratedFigure;
    openDefects: OpenDefectsFigure;
    pendingGates: PendingGatesFigure;
  };
  /** Elements whose file could not be read. */
  unreadable: string[];
  /** Elements indexed incompletely. */
  capped: string[];
}

/** `missingReferences` of `GET /api/p/:pid/elements` (spec-012 §5). */
export interface MissingReferences {
  /** `taxonomy.requires` names at least one type: the filter is offered, also with 0. */
  shown: boolean;
  unreadable: string[];
  capped: string[];
}

export type { UiCategory };
