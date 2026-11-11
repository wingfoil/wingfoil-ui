/**
 * The bodies of the project-state views (spec-012 §2, §3; task-059 D59-10): the one place they are
 * written. Every element title passes the character escape of repository text (`neutralise`,
 * spec-004 §5, K1), every pattern reference id is the escaped value it is keyed by; element ids,
 * types and states stay as `memory search` returned them; `ui` is the effective configuration's
 * status, already sanitised (task-054 D54-6).
 */
import type { ApiCapabilityReason, ElementRef, MemoryMatch, Progress } from '@wingfoil-ui/contracts';
import { toneOf } from '../descriptor/descriptor.js';
import { neutralise } from '../git/redact.js';
import type { ShortIds } from '../reads/short-id.js';
import type { IndexedElement } from '../references/index.js';
import { scopeType } from './current.js';
import {
  completionFigure,
  iteratedFigure,
  openDefectsFigure,
  pendingGatesFigure,
  type FigureInputs,
} from './figures.js';
import { naturalOrder } from './order.js';

/** The `ElementRef` of `element` (spec-012 §2): its title escaped, its tone from its kind. */
export function elementRef(element: IndexedElement, match: Pick<MemoryMatch, 'title'>, shortIds: ShortIds): ElementRef {
  throw new Error('not implemented (red)');
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
  throw new Error('not implemented (red)');
}
