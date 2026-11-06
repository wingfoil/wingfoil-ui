/**
 * The `ui` section of `GET /api/p/:pid/config` (spec-012 §2; task-068 D68-3) from the effective
 * configuration of a repository state: every key with its origin, the declared types in
 * `memory.yaml`'s order, the other lists in file order. It is the one place the section's strings
 * are written, and every string it echoes from `ui.yaml` — and the type names, which come from
 * `memory.yaml` — passes the character escape of repository texts (`neutralise`: controls, bidi
 * and invisible characters as visible escapes; spec-012 §9 K1, spec-004 §5): the fields of
 * {@link ECHOED_UI_FIELDS} — `patterns[].match`, a regular-expression source, with its backslashes
 * kept as written (`neutraliseKeepingBackslashes`, the approver's Q4-b of task-068). The enum values are passed as they are, and so is `status`, whose
 * `failure` the effective configuration already passed through `redactLocalPaths` (escaping it
 * again would double each backslash).
 */
import type { ElementRef, UiConfig } from '@wingfoil-ui/contracts';
import { neutralise, neutraliseKeepingBackslashes } from '../git/redact.js';
import type { EffectiveUiConfig } from './types.js';

/** The fields of the section whose strings are escaped (task-056 sweeps the API's repository texts). */
export const ECHOED_UI_FIELDS = [
  'taxonomy.categories[].type',
  'taxonomy.patterns.value[].match',
  'taxonomy.requires.value[].type',
  'progress.scope.value.type',
  'progress.phases.value[]',
  'progress.iterates.value',
  'progress.defects.value',
  'holds.value[].type',
  'holds.value[].state',
  'artifacts.value[].path',
  'artifacts.value[].phase',
] as const;

const echo = (text: string): string => neutralise(text);
const echoNullable = (text: string | null): string | null => (text === null ? null : echo(text));

/**
 * The section for `effective`; `current` is the element `scope` points to, built by its caller
 * with its title escaped (task-059), `null` until then.
 */
export function uiConfigBody(effective: EffectiveUiConfig, current: ElementRef | null = null): UiConfig {
  const { status, categories, patterns, requires, progress, holds, artifacts } = effective;
  return {
    status: status.warning ? { source: status.source, warning: { ...status.warning } } : { source: status.source },
    taxonomy: {
      categories: [...categories.value].map(([name, category]) => ({
        type: echo(name),
        category,
        origin: categories.origin,
      })),
      patterns: {
        // A regular-expression source: its backslashes kept as written (Q4-b).
        value: patterns.value.map(({ match, category }) => ({ match: neutraliseKeepingBackslashes(match), category })),
        origin: patterns.origin,
      },
      requires: {
        value: [...requires.value].map(([name, list]) => ({ type: echo(name), categories: [...list] })),
        origin: requires.origin,
      },
    },
    progress: {
      mode: { value: progress.mode.value, origin: progress.mode.origin },
      scope: {
        value: progress.scope.value ? { type: echo(progress.scope.value.type) } : null,
        origin: progress.scope.origin,
        current,
      },
      phases: { value: progress.phases.value.map(echo), origin: progress.phases.origin },
      iterates: { value: echoNullable(progress.iterates.value), origin: progress.iterates.origin },
      defects: { value: echoNullable(progress.defects.value), origin: progress.defects.origin },
    },
    holds: {
      value: [...holds.value].flatMap(([name, states]) =>
        [...states].map(([state, approve]) => ({ type: echo(name), state: echo(state), approve })),
      ),
      origin: holds.origin,
    },
    artifacts: {
      value: artifacts.value.map(({ path, phase }) => ({ path: echo(path), phase: echo(phase) })),
      origin: artifacts.origin,
    },
  };
}
