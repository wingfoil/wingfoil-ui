/**
 * Today's progress card (task-065 D65-3 … D65-9; US-T-12 … US-T-15, C-04.1; ux-reference §4.1 item 2
 * and its v0.3 block; spec-012 §3): the figures of `GET /api/p/:pid/progress` as the server sends
 * them — the web computes none (spec-003 §8).
 *
 * - the shared `ui.yaml` warning above the card (task-064's `UiYamlWarning`, D65-9);
 * - the scope: the current element (its short id, else its id, and its title — a link to its side
 *   panel — and its state pill), "No current <type>" or "Whole project" (D65-4); no phase strip and no
 *   `flow` columns until v0.4 (RP3-14 D2);
 * - one list of figures in the order of §4.1: the completion and the read-only phase figures (the
 *   shared `web/src/progress/` module), then iterated, open defects and pending gates, each a link to
 *   the Memory list's figure filter (`?figure=<code>`, task-066) named by its visible text
 *   (D65-5, Q2 (b): the type as written);
 * - the notes of the unreadable and capped elements (D65-8);
 * - its own loading status and error: a failed read is an error in the card, never an empty card,
 *   and the card shows with its own read whatever the state of Today's (task-080 Q2 (a));
 * - a refetch that changes a figure's text is announced politely, "Progress updated: Pending gates
 *   2"; the first read is not (D65-8).
 */
import type { Progress } from '@wingfoil-ui/contracts';
import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { FormattedMessage, useIntl, type IntlShape } from 'react-intl';
import { ApiError } from '../api/client.js';
import { panelLinkOptions, usePanelOpen } from '../element/side-panel.js';
import { ProgressCompletion } from '../progress/Completion.js';
import { PhaseReadOnly } from '../progress/PhaseReadOnly.js';
import { ErrorText } from '../shell/ErrorText.js';
import { UiYamlWarning } from '../shell/UiYamlWarning.js';
import { cardFigures, scopeName, type CardFigure } from './progress.js';

/** The `label` and `value` tags of a figure message, as elements. */
const FIGURE_TAGS = {
  label: (chunks: ReactNode[]) => <span className="progress-figure-label">{chunks}</span>,
  value: (chunks: ReactNode[]) => <span className="progress-figure-value">{chunks}</span>,
};

/** The `label` and `value` tags of a figure message, as their text. */
const TEXT_TAGS = {
  label: (chunks: string[]) => chunks.join(''),
  value: (chunks: string[]) => chunks.join(''),
};

/** Props of {@link ProgressCard}. */
export interface ProgressCardProps {
  pid: string;
  /** `GET /progress` (`progressQuery`, the key shared with the Memory list's figure filter). */
  progress: Pick<UseQueryResult<Progress>, 'data' | 'error'>;
  /** The project's WingFoil version (the header's), for the read-only phase texts. */
  projectVersion: string | null;
}

/** A formatted message as one string. */
function joined(text: string | unknown[]): string {
  return Array.isArray(text) ? text.join('') : text;
}

/** The text of one of the card's own figures. */
function figureText(intl: IntlShape, figure: CardFigure): string {
  const values = { ...figure.values, ...TEXT_TAGS };
  switch (figure.message) {
    case 'iterated':
      return joined(intl.formatMessage({ id: 'today.progress.iterated' }, values));
    case 'openDefects':
      return joined(intl.formatMessage({ id: 'today.progress.openDefects' }, values));
    case 'pendingGates':
      return joined(intl.formatMessage({ id: 'today.progress.pendingGates' }, values));
  }
}

/** The visible text of each figure that can change between two reads, by figure. */
function figureTexts(intl: IntlShape, progress: Progress): Map<string, string> {
  const texts = new Map<string, string>();
  const completion = progress.figures.completion;
  if (completion.state === 'shown')
    texts.set(
      'completion',
      joined(intl.formatMessage({ id: 'progress.completion.figure' }, { percent: completion.percent, ...TEXT_TAGS })),
    );
  for (const f of cardFigures(progress)) texts.set(f.code, figureText(intl, f));
  return texts;
}

/** The scope line (D65-4). */
function Scope({ progress }: { progress: Progress }): ReactNode {
  const panelOpen = usePanelOpen();
  const { type, current } = progress.scope;
  return (
    <p className="today-progress-scope">
      {current !== null ? (
        <>
          <Link className="today-progress-scope-link" {...panelLinkOptions(current.id, panelOpen)}>
            <FormattedMessage
              id="today.progress.scope.current"
              values={{
                id: current.shortId ?? current.id,
                title: current.title,
                mono: (chunks: ReactNode[]) => <span className="today-id">{chunks}</span>,
              }}
            />
          </Link>
          <span className={`state-pill tone-${current.tone}`}>{current.status}</span>
        </>
      ) : type !== null ? (
        <FormattedMessage id="today.progress.scope.none" values={{ type }} />
      ) : (
        <FormattedMessage id="today.progress.scope.whole" />
      )}
    </p>
  );
}

/** One of the card's own figures: a link to the Memory list filtered on its ids. */
function FigureLink({ pid, figure }: { pid: string; figure: CardFigure }): ReactNode {
  return (
    <Link className="progress-figure-link" to="/p/$pid/memory" params={{ pid }} search={{ figure: figure.code }}>
      {figure.message === 'iterated' ? (
        <FormattedMessage id="today.progress.iterated" values={{ ...figure.values, ...FIGURE_TAGS }} />
      ) : figure.message === 'openDefects' ? (
        <FormattedMessage id="today.progress.openDefects" values={{ ...figure.values, ...FIGURE_TAGS }} />
      ) : (
        <FormattedMessage id="today.progress.pendingGates" values={{ ...figure.values, ...FIGURE_TAGS }} />
      )}
    </Link>
  );
}

/** The figures and the notes of a read answer. */
function Figures({
  pid,
  progress,
  projectVersion,
}: {
  pid: string;
  progress: Progress;
  projectVersion: string | null;
}): ReactNode {
  const intl = useIntl();
  const { completion, phase, phaseCompletion } = progress.figures;
  const ids = (list: string[]) => intl.formatList(list, { type: 'unit', style: 'short' });
  return (
    <>
      <ul className="today-progress-figures" aria-label={intl.formatMessage({ id: 'today.progress.figures' })}>
        <li>
          <ProgressCompletion pid={pid} figure={completion} scopeName={scopeName(progress)} />
        </li>
        <li>
          <PhaseReadOnly figure="phase" reason={phase.reason} projectVersion={projectVersion} />
        </li>
        <li>
          <PhaseReadOnly figure="phaseCompletion" reason={phaseCompletion.reason} projectVersion={projectVersion} />
        </li>
        {cardFigures(progress).map((f) => (
          <li key={f.code}>
            <FigureLink pid={pid} figure={f} />
          </li>
        ))}
      </ul>
      {progress.unreadable.length > 0 && (
        <p className="today-progress-note">
          <FormattedMessage
            id="today.progress.notice.unreadable"
            values={{ count: progress.unreadable.length, ids: ids(progress.unreadable) }}
          />
        </p>
      )}
      {progress.capped.length > 0 && (
        <p className="today-progress-note">
          <FormattedMessage
            id="today.progress.notice.capped"
            values={{ count: progress.capped.length, ids: ids(progress.capped) }}
          />
        </p>
      )}
    </>
  );
}

/** The progress card of project `pid` (keyed by the project with Today, `routes/today.tsx`). */
export function ProgressCard({ pid, progress, projectVersion }: ProgressCardProps): ReactNode {
  const intl = useIntl();
  const titleId = useId();
  const data = progress.data;
  // D65-8: a read whose figure texts differ from the previous one's is announced (a new node each
  // time, keyed by a counter); the first read is not.
  const previous = useRef<Map<string, string> | undefined>(undefined);
  const [announcement, setAnnouncement] = useState<{ n: number; figures: string } | undefined>(undefined);
  useEffect(() => {
    if (data === undefined) return;
    const texts = figureTexts(intl, data);
    const before = previous.current;
    previous.current = texts;
    if (before === undefined) return;
    const changed = [...texts].filter(([key, text]) => before.get(key) !== text).map(([, text]) => text);
    if (changed.length === 0) return;
    const figures = intl.formatList(changed, { type: 'unit', style: 'short' });
    setAnnouncement((a) => ({ n: (a?.n ?? 0) + 1, figures }));
  }, [data, intl]);
  const error = progress.error;
  return (
    <>
      <UiYamlWarning status={data?.ui} className="today-ui-yaml-warning" />
      <section className="today-progress" aria-labelledby={titleId}>
        <h2 className="today-card-title" id={titleId}>
          <FormattedMessage id="today.progress.title" />
        </h2>
        <div className="today-progress-body">
          {error ? (
            <div role="alert">
              <ErrorText
                error={error instanceof ApiError ? error : new ApiError(0, 'internal', error.message, undefined)}
              />
            </div>
          ) : data === undefined ? (
            <p className="muted" role="status">
              <FormattedMessage id="today.progress.loading" />
            </p>
          ) : (
            <>
              <Scope progress={data} />
              <Figures pid={pid} progress={data} projectVersion={projectVersion} />
            </>
          )}
        </div>
        <div
          className="visually-hidden"
          role="status"
          aria-label={intl.formatMessage({ id: 'today.progress.updates.label' })}
        >
          {announcement && (
            <span key={announcement.n}>
              <FormattedMessage id="today.progress.updated" values={{ figures: announcement.figures }} />
            </span>
          )}
        </div>
      </section>
    </>
  );
}
