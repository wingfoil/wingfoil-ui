/**
 * The element's history (spec-002 §2: `memory history`, the CLI's reconstruction), newest first:
 * what happened and who did it, the transition, the reason, the date and the commit (short hash,
 * full hash as its title). A commit that is not a WingFoil verb is "edited outside a WingFoil verb".
 */
import type { HistoryEntry } from '@wingfoil-ui/contracts';
import type { ReactNode } from 'react';
import { FormattedDate, FormattedMessage } from 'react-intl';
import { historyLines } from './model.js';

/** Props of {@link History}. */
export interface HistoryProps {
  entries: readonly HistoryEntry[];
}

/** The history list. */
export function History({ entries }: HistoryProps): ReactNode {
  if (entries.length === 0) {
    return (
      <p className="muted">
        <FormattedMessage id="element.history.none" />
      </p>
    );
  }
  return (
    <ol className="history">
      {historyLines(entries).map((line) => (
        <li key={line.sha} className="history-entry">
          <span className="history-what">
            <FormattedMessage id="element.history.entry" values={{ operation: line.operation, name: line.name }} />
          </span>
          {line.from !== null && line.to !== null && (
            <span className="history-transition">
              <FormattedMessage id="element.history.transition" values={{ from: line.from, to: line.to }} />
            </span>
          )}
          {line.reason !== null && (
            <span className="history-reason">
              <FormattedMessage id="element.history.reason" values={{ reason: line.reason }} />
            </span>
          )}
          <span className="history-meta">
            <time dateTime={line.timestamp}>
              <FormattedDate value={line.timestamp} dateStyle="medium" timeStyle="short" />
            </time>
            <code className="history-sha" title={line.sha}>
              {line.shortSha}
            </code>
          </span>
        </li>
      ))}
    </ol>
  );
}
