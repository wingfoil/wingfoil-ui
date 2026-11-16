/**
 * The read-only phase figures (task-065 D65-6; US-T-15; spec-012 §3, RP3-14 D2), shared by Today's
 * progress card and the Traceability view (task-067): until v0.4 `phase` and `phaseCompletion` are
 * `read-only` with the reason of the capability `workflow-position` (spec-001 §6), rendered as a
 * text in the figure's place, never a link:
 *
 * - `needs-version` — "Phase — needs WingFoil 0.3 (this project: 0.2.2)" (T-15.1) and "Phase
 *   completion — needs WingFoil 0.3" (T-15.2), the minimum version without a zero patch
 *   ({@link majorMinor}), the project's version as the header reads it;
 * - `not-in-release` — "… — comes with a later WingFoil UI release" (WingFoil 0.3 or later);
 * - `unsupported-version` — "… — supported <min> to <max>"; `not-released` — "… — in no released
 *   WingFoil yet".
 *
 * API: `<PhaseReadOnly figure="phase" | "phaseCompletion" reason projectVersion />`,
 * `phaseValues(reason, projectVersion)` for the same text elsewhere (an announcement); class
 * `progress-reason`.
 */
import type { ApiCapabilityReason } from '@wingfoil-ui/contracts';
import type { ReactNode } from 'react';
import { FormattedMessage } from 'react-intl';
import { majorMinor } from './version.js';
import './progress.css';

/** Props of {@link PhaseReadOnly}. */
export interface PhaseReadOnlyProps {
  /** Which figure. */
  figure: 'phase' | 'phaseCompletion';
  /** The figure's reason as the server sent it. */
  reason: ApiCapabilityReason;
  /** The project's WingFoil version (the header's), `null` when unknown. */
  projectVersion: string | null;
}

/** The catalogue `select` value of each reason code. */
const CODES = {
  'needs-version': 'needsVersion',
  'not-in-release': 'notInRelease',
  'unsupported-version': 'unsupportedVersion',
  'not-released': 'notReleased',
} as const satisfies Record<ApiCapabilityReason['code'], string>;

/**
 * The arguments of the `progress.phase.readOnly` / `progress.phaseCompletion.readOnly` messages for
 * `reason` (one `select` per figure, spec-008 §4's deviation recorded in its Process Notes: a code
 * this table does not know falls into the `other` branch).
 */
export function phaseValues(
  reason: ApiCapabilityReason,
  projectVersion: string | null,
): Record<'code' | 'minVersion' | 'version' | 'min' | 'max', string> {
  return {
    code: CODES[reason.code],
    minVersion: reason.code === 'needs-version' ? majorMinor(reason.minVersion) : '',
    version: projectVersion ?? '',
    min: reason.code === 'unsupported-version' ? reason.range.min : '',
    max: reason.code === 'unsupported-version' ? reason.range.max : '',
  };
}

/**
 * Whether the phase text names no project version: `needs-version` before the project header is
 * read — "Phase — needs WingFoil 0.3", never "(this project: )" (review round 2, R2-1).
 */
export function phaseWithoutVersion(reason: ApiCapabilityReason, projectVersion: string | null): boolean {
  return reason.code === 'needs-version' && projectVersion === null;
}

/** The read-only text of a phase figure. */
export function PhaseReadOnly({ figure, reason, projectVersion }: PhaseReadOnlyProps): ReactNode {
  const values = phaseValues(reason, projectVersion);
  return (
    <span className="progress-reason">
      {figure === 'phase' && phaseWithoutVersion(reason, projectVersion) ? (
        <FormattedMessage id="progress.phase.readOnlyNoVersion" values={{ minVersion: values.minVersion }} />
      ) : figure === 'phase' ? (
        <FormattedMessage id="progress.phase.readOnly" values={values} />
      ) : (
        <FormattedMessage id="progress.phaseCompletion.readOnly" values={values} />
      )}
    </span>
  );
}
