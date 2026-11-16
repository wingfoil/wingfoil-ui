/**
 * The three figure cards of Traceability (ux-reference §4.8 v0.3 *Figures*; spec-012 §4; D67-6):
 * project completion over the applied scope, phase completion read-only (RP3-14 D2) and reference
 * coverage, project-wide. Every number is the server's.
 *
 * **The Q1 seam** (decided by the approver 2026-11-16): the completion figure with its explanation
 * on hover and focus (T-14.1, T-14.2) and the phase read-only texts (T-15.x) are task-065's shared
 * module `web/src/progress/` (keys `progress.completion.*`, `progress.phaseCompletion.*`). Until it
 * is merged, {@link CompletionCard} and {@link PhaseCompletionCard} below render the figure's value
 * only, from the temporary keys `traceability.seam.*`; wiring them to that module replaces these two
 * components and drops those keys.
 */
import { Link } from '@tanstack/react-router';
import type { ReadOnlyFigure, Traceability } from '@wingfoil-ui/contracts';
import type { ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

/** A decorative bar; its text is always next to it (AC-3). */
export function Bar({ percent }: { percent: number | null }): ReactNode {
  return (
    <span className="trace-bar" aria-hidden="true">
      <span className="trace-bar-fill" style={{ width: `${percent ?? 0}%` }} />
    </span>
  );
}

/** A link to Configuration › Taxonomy, as the chunk of a message. */
function taxonomyLink(pid: string) {
  return function TaxonomyLink(chunks: ReactNode[]): ReactNode {
    return (
      <Link to="/p/$pid/configuration/taxonomy" params={{ pid }}>
        {chunks}
      </Link>
    );
  };
}

/** Q1 seam: the completion card until task-065's `web/src/progress/` is merged. */
function CompletionCard({ pid, answer }: { pid: string; answer: Traceability }): ReactNode {
  const figure = answer.figures.completion;
  const current = answer.scope.applied === 'current' ? answer.scope.current : null;
  return (
    <div className="trace-card">
      {figure.state === 'shown' ? (
        <>
          <p className="trace-card-value">
            <FormattedMessage id="traceability.seam.completion" values={{ percent: figure.percent }} />
          </p>
          <Bar percent={figure.percent} />
        </>
      ) : figure.reason.code === 'no-reference-categories' ? (
        <p className="trace-card-note">
          <FormattedMessage id="traceability.seam.completionNeedsReferences" values={{ link: taxonomyLink(pid) }} />
        </p>
      ) : (
        <p className="trace-card-note">
          <FormattedMessage
            id="traceability.seam.completionNoLinked"
            values={{ scope: current ? (current.shortId ?? current.id) : '' }}
          />
        </p>
      )}
    </div>
  );
}

/** Q1 seam: the phase completion card (read-only, D2) until task-065's module is merged. */
function PhaseCompletionCard({ figure }: { figure: ReadOnlyFigure }): ReactNode {
  const reason = figure.reason;
  return (
    <div className="trace-card">
      <p className="trace-card-note">
        <FormattedMessage
          id="traceability.seam.phaseCompletion"
          values={{
            needsVersion: reason.code === 'needs-version' ? 'yes' : 'no',
            minVersion: reason.code === 'needs-version' ? reason.minVersion : '',
          }}
        />
      </p>
    </div>
  );
}

/** The coverage card: project-wide in both scopes (spec-012 §4). */
function CoverageCard({ pid, answer }: { pid: string; answer: Traceability }): ReactNode {
  const figure = answer.figures.coverage;
  if (figure.state !== 'shown') {
    return (
      <div className="trace-card">
        <p className="trace-card-note">
          <FormattedMessage id="traceability.coverage.noRequires" values={{ link: taxonomyLink(pid) }} />
        </p>
      </div>
    );
  }
  return (
    <div className="trace-card">
      <p className="trace-card-value">
        <FormattedMessage
          id="traceability.coverage.value"
          values={{ carrying: figure.carrying, total: figure.total }}
        />
      </p>
      <Bar percent={figure.percent} />
      {answer.scope.applied === 'project' && (
        <p className="trace-card-note">
          <FormattedMessage
            id="traceability.coverage.without"
            values={{ count: answer.figures.referencesWithoutElements }}
          />
        </p>
      )}
    </div>
  );
}

/** The figures region. */
export function Figures({ pid, answer }: { pid: string; answer: Traceability }): ReactNode {
  const intl = useIntl();
  return (
    <section className="trace-figures" aria-label={intl.formatMessage({ id: 'traceability.figures.label' })}>
      <CompletionCard pid={pid} answer={answer} />
      <PhaseCompletionCard figure={answer.figures.phaseCompletion} />
      <CoverageCard pid={pid} answer={answer} />
    </section>
  );
}
