/**
 * The bodies of the project-state views (spec-012 §2, §3; task-059 D59-10): the one place they are
 * written. Every element title passes the character escape of repository text (`neutralise`,
 * spec-004 §5, K1), every pattern reference id is the escaped value it is keyed by; element ids,
 * types and states stay as `memory search` returned them; `ui` is the effective configuration's
 * status, already sanitised (task-054 D54-6).
 */
import type {
  ApiCapabilityReason,
  ElementRef,
  MemoryMatch,
  Progress,
  Traceability,
  TraceabilityScope,
} from '@wingfoil-ui/contracts';
import { toneOf } from '../descriptor/descriptor.js';
import { neutralise } from '../git/redact.js';
import type { ShortIds } from '../reads/short-id.js';
import type { IndexedElement, ReferenceIndex } from '../references/index.js';
import type { EffectiveUiConfig, UiCategory } from '../ui-config/types.js';
import { scopeType } from './current.js';
import { REFERENCE_STATUS } from '../presets/api.js';
import {
  completionFigure,
  coverageFigure,
  iteratedFigure,
  openDefectsFigure,
  pendingGatesFigure,
  type FigureInputs,
} from './figures.js';
import { naturalOrder } from './order.js';
import { traceabilityRows } from './traceability.js';

/** The `ElementRef` of `element` (spec-012 §2): its title escaped, its tone from its kind. */
export function elementRef(element: IndexedElement, match: Pick<MemoryMatch, 'title'>, shortIds: ShortIds): ElementRef {
  const shortId = shortIds(element);
  return {
    id: element.id,
    ...(shortId !== undefined ? { shortId } : {}),
    title: neutralise(match.title),
    type: element.type,
    status: element.status,
    tone: toneOf(element.kind),
  };
}

/** The scope type as `/config` `ui` echoes it (escaped, §9). */
function escapedScopeType(ui: FigureInputs['ui']): string | null {
  const type = scopeType(ui);
  return type === null ? null : neutralise(type);
}

/** What `/progress` needs beyond the figures' inputs. */
export interface ProgressInputs extends FigureInputs {
  /** The `memory search` match of a listed id (its title). */
  match(id: string): Pick<MemoryMatch, 'title'>;
  shortIds: ShortIds;
  /** The reason of the capability `workflow-position` (`GET /api/p/:pid`). */
  phaseReason: ApiCapabilityReason;
}

/** `GET /api/p/:pid/progress` (spec-012 §3). */
export function progressBody(inputs: ProgressInputs): Progress {
  const { ui, index, current } = inputs;
  const readOnly = { state: 'read-only' as const, reason: inputs.phaseReason };
  return {
    ui: ui.status,
    mode: ui.progress.mode.value,
    scope: {
      type: escapedScopeType(ui),
      current: current ? elementRef(current, inputs.match(current.id), inputs.shortIds) : null,
      basis: current ? 'derived' : null,
    },
    figures: {
      completion: completionFigure(inputs),
      phase: readOnly,
      phaseCompletion: readOnly,
      iterated: iteratedFigure(inputs),
      openDefects: openDefectsFigure(inputs),
      pendingGates: pendingGatesFigure(inputs),
    },
    unreadable: naturalOrder(index.unreadable),
    capped: naturalOrder(index.capped),
  };
}

/** What `/traceability` reads (spec-012 §4, task-074 D74-4). */
export interface TraceabilityInputs {
  index: ReferenceIndex;
  ui: EffectiveUiConfig;
  /** The current element (D59-2), `undefined` for none — whatever scope was asked. */
  current: IndexedElement | undefined;
  /** The `scope` asked (default `current`). */
  asked: TraceabilityScope;
  /** The missing-reference flag of the state (spec-012 §5, `missingOf`). */
  missing: ReadonlyMap<string, readonly UiCategory[]>;
  /** The `memory search` match of a listed id (its title). */
  match(id: string): Pick<MemoryMatch, 'title'>;
  shortIds: ShortIds;
  /** The reason of the capability `workflow-position` (`GET /api/p/:pid`). */
  phaseReason: ApiCapabilityReason;
}

/** An element the answer names, before its `/elements` row is written (per request, D74-5). */
export interface NamedElement {
  id: string;
  /** Descriptor kind `last` (the API's `done`, `DONE_FIELD`). */
  finished: boolean;
  inScope: boolean;
}

/** The body of `/traceability` but its element rows, and the elements those rows are for. */
export interface TraceabilityParts {
  body: Omit<Traceability, 'elements' | 'eventsError'>;
  elements: NamedElement[];
}

/** `GET /api/p/:pid/traceability?scope=` (spec-012 §4) without its element rows. */
export function traceabilityParts(inputs: TraceabilityInputs): TraceabilityParts {
  const { index, ui, current, missing } = inputs;
  const applied: TraceabilityScope = inputs.asked === 'current' && current ? 'current' : 'project';
  const scoped = applied === 'current' ? current : undefined;
  const references = traceabilityRows({ index, ui, current: scoped, applied });
  const named = naturalOrder([
    ...references.flatMap((r) => (r.element ? [r.id, ...r.linked] : r.linked)),
    ...missing.keys(),
  ]);
  // Q1 (a): the current element's scope whenever one exists, whatever was asked.
  const inScope = current ? new Set(index.inScope(current).map((e) => e.id)) : undefined;
  return {
    body: {
      ui: ui.status,
      patterns: ui.patterns.value.length > 0,
      scope: {
        type: escapedScopeType(ui),
        current: current ? elementRef(current, inputs.match(current.id), inputs.shortIds) : null,
        applied,
      },
      figures: {
        completion: completionFigure({ index, ui, current: scoped }),
        phaseCompletion: { state: 'read-only', reason: inputs.phaseReason },
        coverage: coverageFigure(index, ui.requires.value, missing),
        referencesWithoutElements: references.filter((r) => r.status === REFERENCE_STATUS.noElements).length,
      },
      references,
      missing: naturalOrder(missing.keys()).map((id) => ({ id, categories: [...missing.get(id)!] })),
      unreadable: naturalOrder(index.unreadable),
      capped: naturalOrder(index.capped),
    },
    elements: named.map((id) => ({
      id,
      finished: index.get(id)?.finished ?? false,
      inScope: inScope ? inScope.has(id) : true,
    })),
  };
}
