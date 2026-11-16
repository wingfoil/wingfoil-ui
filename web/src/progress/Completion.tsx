/**
 * The project completion figure (task-065 D65-5, D65-7; US-T-12, US-T-14; spec-012 §3; ux-reference
 * §7), shared by Today's progress card and the Traceability view (task-067, its Q1 (a)): the
 * server's `completion` figure of `/progress` or `/traceability`, rendered as served — the web
 * computes no percentage (spec-003 §8).
 *
 * - `shown`: "Project completion 25 %" as a link to the Memory list's figure filter
 *   (`/p/<pid>/memory?figure=completion`, task-066), a thin bar of the percent (decorative), and the
 *   explanation — "Mean of reference completion over 2 references with at least 1 linked element:
 *   US-M-01 50 %, US-S-01 0 %", ", and <n> more" past the listed references — in a React Aria tooltip
 *   that opens on hover and on keyboard focus, closes with Escape, and is the link's accessible
 *   description while open (T-14.1, T-14.2);
 * - `unavailable`: its reason's text in its place, not a link — `no-reference-categories` with a
 *   link to Configuration › Taxonomy (T-12.2), `no-linked-elements` naming the scope (T-12.6).
 *
 * API: `<ProgressCompletion pid figure scopeName />`; `<CompletionExplanation figure />` for a view
 * that shows the explanation elsewhere. Classes: `progress-completion`, `progress-completion-link`,
 * `progress-bar`, `progress-tooltip`, `progress-reason`.
 */
import type { CompletionFigure } from '@wingfoil-ui/contracts';
import { Link } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { Focusable, Tooltip, TooltipTrigger } from 'react-aria-components';
import { FormattedMessage, useIntl } from 'react-intl';
import './progress.css';

/** Props of {@link ProgressCompletion}. */
export interface ProgressCompletionProps {
  /** The project, for the links. */
  pid: string;
  /** The `completion` figure as the server sent it. */
  figure: CompletionFigure;
  /** The scope in texts (the current element's short id, else its id) — for `no-linked-elements`. */
  scopeName: string | null;
}

/**
 * The explanation of a shown completion (T-14.1), nothing for an unavailable one. Each reference is
 * a message element of its own and the list's separators are the catalogue locale's `Intl` list
 * format, so no message is formatted into another as text (spec-008 §3; the X-09.1 key build).
 */
export function CompletionExplanation({ figure }: { figure: CompletionFigure }): ReactNode {
  const intl = useIntl();
  if (figure.state !== 'shown') return null;
  const list = (
    <span className="progress-references">
      {intl.formatList(
        figure.references.map((r) => (
          <span key={r.id} className="progress-reference">
            <FormattedMessage id="progress.completion.reference" values={{ id: r.id, percent: r.percent }} />
          </span>
        )),
        { type: 'unit', style: 'short' },
      )}
    </span>
  );
  const more = figure.referencesCount - figure.references.length;
  return more > 0 ? (
    <FormattedMessage id="progress.completion.explanationMore" values={{ count: figure.referencesCount, list, more }} />
  ) : (
    <FormattedMessage id="progress.completion.explanation" values={{ count: figure.referencesCount, list }} />
  );
}

/** The completion figure: the link with its bar and explanation, or the reason in its place. */
export function ProgressCompletion({ pid, figure, scopeName }: ProgressCompletionProps): ReactNode {
  // React Aria's `Focusable` passes the trigger's focus handlers to the router link, not its hover
  // ones: the pointer opens the tooltip here, keyboard focus and Escape stay React Aria's.
  const [open, setOpen] = useState(false);
  if (figure.state !== 'shown') {
    return (
      <span className="progress-reason">
        {figure.reason.code === 'no-reference-categories' ? (
          <FormattedMessage
            id="progress.completion.noCategories"
            values={{
              link: (chunks: ReactNode[]) => (
                <Link to="/p/$pid/configuration/taxonomy" params={{ pid }}>
                  {chunks}
                </Link>
              ),
            }}
          />
        ) : (
          <FormattedMessage id="progress.completion.noLinked" values={{ scope: scopeName ?? '' }} />
        )}
      </span>
    );
  }
  return (
    <span className="progress-completion">
      <TooltipTrigger delay={300} isOpen={open} onOpenChange={setOpen}>
        <Focusable>
          <Link
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            className="progress-figure-link progress-completion-link"
            to="/p/$pid/memory"
            params={{ pid }}
            search={{ figure: 'completion' }}
          >
            <FormattedMessage
              id="progress.completion.figure"
              values={{
                percent: figure.percent,
                label: (chunks: ReactNode[]) => <span className="progress-figure-label">{chunks}</span>,
                value: (chunks: ReactNode[]) => <span className="progress-figure-value">{chunks}</span>,
              }}
            />
          </Link>
        </Focusable>
        <Tooltip className="progress-tooltip" placement="bottom">
          <CompletionExplanation figure={figure} />
        </Tooltip>
      </TooltipTrigger>
      <span className="progress-bar" aria-hidden="true">
        <span className="progress-bar-fill" style={{ width: `${figure.percent}%` }} />
      </span>
    </span>
  );
}
