/**
 * The three figure cards of Traceability (ux-reference §4.8 v0.3 *Figures*; spec-012 §4; D67-6):
 * project completion over the applied scope, phase completion read-only (RP3-14 D2) and reference
 * coverage, project-wide. Every number is the server's.
 *
 * The completion and phase completion cards are task-065's shared module `web/src/progress/`
 * (task-067 Q1 (a), decided by the approver 2026-11-16): the completion with its explanation on hover
 * and keyboard focus (T-14.1, T-14.2) and the phase read-only text (T-15.2).
 */
import { Link } from '@tanstack/react-router';
import type { Traceability } from '@wingfoil-ui/contracts';
import { ProgressCompletion } from '../progress/Completion.js';
import { PhaseReadOnly } from '../progress/PhaseReadOnly.js';
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

/** The completion card: task-065's shared figure over the applied scope (Q1 (a)). */
function CompletionCard({ pid, answer }: { pid: string; answer: Traceability }): ReactNode {
  const current = answer.scope.applied === 'current' ? answer.scope.current : null;
  return (
    <div className="trace-card">
      <ProgressCompletion
        pid={pid}
        figure={answer.figures.completion}
        scopeName={current ? (current.shortId ?? current.id) : null}
        linkToFilter={answer.scope.applied === 'current'}
      />
    </div>
  );
}

/** The phase completion card: read-only (D2), task-065's shared text (Q1 (a)). */
function PhaseCompletionCard({
  answer,
  projectVersion,
}: {
  answer: Traceability;
  projectVersion: string | null;
}): ReactNode {
  return (
    <div className="trace-card">
      <PhaseReadOnly
        figure="phaseCompletion"
        reason={answer.figures.phaseCompletion.reason}
        projectVersion={projectVersion}
      />
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
export function Figures({
  pid,
  answer,
  projectVersion,
}: {
  pid: string;
  answer: Traceability;
  /** The project's WingFoil version (the header's), `null` when unknown. */
  projectVersion: string | null;
}): ReactNode {
  const intl = useIntl();
  return (
    <section className="trace-figures" aria-label={intl.formatMessage({ id: 'traceability.figures.label' })}>
      <CompletionCard pid={pid} answer={answer} />
      <PhaseCompletionCard answer={answer} projectVersion={projectVersion} />
      <CoverageCard pid={pid} answer={answer} />
    </section>
  );
}
