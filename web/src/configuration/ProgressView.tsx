/**
 * Configuration › Progress (US-C-01, C-01.2, AC-2; ux-reference §4.11; task-064 D64-5): one row per
 * key of `progress` and `holds` — `mode`, `scope`, `phases`, `iterates`, `defects`, `holds` — with
 * its value as served, its origin, its meaning and its allowed values. `scope` adds the element the
 * server derived for it (`scope.current`, "derived"; spec-012 §2) as a link to its element page with
 * its state, or "No current <type>" in `sequence` mode. `phases` are matched to the workflow from
 * v0.4 only (RP3-14 D2). No type or state name is written in this file (REQ-ARC-05).
 */
import { Link } from '@tanstack/react-router';
import type { UiConfig } from '@wingfoil-ui/contracts';
import type { ReactNode } from 'react';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import { isPathSyntaxId } from '../element/queries.js';
import '../memory/memory.css';
import { Origin, UiFrame } from './UiFrame.js';

const TITLE = defineMessages({ progress: { id: 'settings.progress.title' } });

/** The keys of the tab, in order, with their name, meaning and allowed values. */
const KEYS = {
  mode: defineMessages({
    name: { id: 'settings.progress.key.mode' },
    meaning: { id: 'settings.progress.mode.meaning' },
    allowed: { id: 'settings.progress.mode.allowed' },
  }),
  scope: defineMessages({
    name: { id: 'settings.progress.key.scope' },
    meaning: { id: 'settings.progress.scope.meaning' },
    allowed: { id: 'settings.progress.scope.allowed' },
  }),
  phases: defineMessages({
    name: { id: 'settings.progress.key.phases' },
    meaning: { id: 'settings.progress.phases.meaning' },
    allowed: { id: 'settings.progress.phases.allowed' },
  }),
  iterates: defineMessages({
    name: { id: 'settings.progress.key.iterates' },
    meaning: { id: 'settings.progress.iterates.meaning' },
    allowed: { id: 'settings.progress.typeAllowed' },
  }),
  defects: defineMessages({
    name: { id: 'settings.progress.key.defects' },
    meaning: { id: 'settings.progress.defects.meaning' },
    allowed: { id: 'settings.progress.typeAllowed' },
  }),
  holds: defineMessages({
    name: { id: 'settings.progress.key.holds' },
    meaning: { id: 'settings.progress.holds.meaning' },
    allowed: { id: 'settings.progress.holds.allowed' },
  }),
} satisfies Record<string, { name: MessageDescriptor; meaning: MessageDescriptor; allowed: MessageDescriptor }>;

const code = (chunks: ReactNode[]) => <code>{chunks}</code>;

/** A value as an ICU `select` key: `when-references-done` → `whenReferencesDone` (ICU keys hold no `-`). */
function selectorOf(value: string): string {
  return value.replace(/-(\w)/g, (_m, c: string) => c.toUpperCase());
}

/** "None": a key with no value. */
function None(): ReactNode {
  return (
    <span className="config-none">
      <FormattedMessage id="settings.progress.none" />
    </span>
  );
}

/** One row: the key, its value and origin (plus `extra`), its meaning and allowed values. */
function Row({
  messages,
  value,
  extra,
}: {
  messages: (typeof KEYS)[keyof typeof KEYS];
  value: ReactNode;
  extra?: ReactNode;
}): ReactNode {
  return (
    <tr>
      <th scope="row">
        <code>
          <FormattedMessage {...messages.name} />
        </code>
      </th>
      <td>
        {value}
        {extra}
      </td>
      <td>
        <p className="config-meaning">
          <FormattedMessage {...messages.meaning} />
        </p>
        <p className="config-allowed">
          <FormattedMessage {...messages.allowed} />
        </p>
      </td>
    </tr>
  );
}

/** The current element of `scope` (mode `sequence`): a link to its page, or "No current <type>". */
function Current({ pid, scope }: { pid: string; scope: UiConfig['progress']['scope'] }): ReactNode {
  const current = scope.current;
  // The short id of spec-011 §1 (N4, as Today's rows), else the full id; the link keeps the full id.
  const names = current ? (
    <>
      <span className="element-id">{current.shortId ?? current.id}</span>
      <span className="config-current-title">{current.title}</span>
    </>
  ) : null;
  return (
    <div className="config-current">
      <span className="config-current-label">
        <FormattedMessage id="settings.progress.scope.current" />
      </span>
      {current ? (
        <>
          {isPathSyntaxId(current.id) ? (
            // An id the URL parser reads as path syntax is never a link (as Candidates.tsx).
            <span className="config-current-link">{names}</span>
          ) : (
            <Link className="config-current-link" to="/p/$pid/e/$eid" params={{ pid, eid: current.id }}>
              {names}
            </Link>
          )}
          <span className={`state-pill tone-${current.tone}`}>{current.status}</span>
        </>
      ) : (
        <span className="config-none">
          <FormattedMessage id="settings.progress.scope.noCurrent" values={{ type: scope.value?.type ?? '' }} />
        </span>
      )}
      <Origin origin="derived" />
    </div>
  );
}

/** The rows of the tab. */
function ProgressRows({ pid, ui }: { pid: string; ui: UiConfig }): ReactNode {
  const { mode, scope, phases, iterates, defects } = ui.progress;
  const holds = ui.holds;
  return (
    <>
      <Row
        messages={KEYS.mode}
        value={
          <span className="config-value">
            <code>{mode.value}</code>
            <Origin origin={mode.origin} />
          </span>
        }
      />
      <Row
        messages={KEYS.scope}
        value={
          <span className="config-value">
            {scope.value === null ? (
              <span>
                <FormattedMessage id="settings.progress.scope.whole" />
              </span>
            ) : (
              <code>{scope.value.type}</code>
            )}
            <Origin origin={scope.origin} />
          </span>
        }
        extra={mode.value === 'sequence' && scope.value !== null ? <Current pid={pid} scope={scope} /> : undefined}
      />
      <Row
        messages={KEYS.phases}
        value={
          <span className="config-value">
            {phases.value.length === 0 ? (
              <None />
            ) : (
              <ol className="config-phases">
                {phases.value.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
            )}
            <Origin origin={phases.origin} />
          </span>
        }
      />
      {(
        [
          [KEYS.iterates, iterates],
          [KEYS.defects, defects],
        ] as const
      ).map(([messages, v]) => (
        <Row
          key={messages.name.id}
          messages={messages}
          value={
            <span className="config-value">
              {v.value === null ? <None /> : <code>{v.value}</code>}
              <Origin origin={v.origin} />
            </span>
          }
        />
      ))}
      <Row
        messages={KEYS.holds}
        value={
          <span className="config-value">
            {holds.value.length === 0 ? (
              <span className="config-none">
                <FormattedMessage id="settings.progress.holds.none" />
              </span>
            ) : (
              <ul className="config-holds">
                {holds.value.map((h) => (
                  <li key={`${h.type}\u0000${h.state}`}>
                    <FormattedMessage
                      id="settings.progress.hold"
                      values={{ code, type: h.type, state: h.state, rule: selectorOf(h.approve), approve: h.approve }}
                    />
                  </li>
                ))}
              </ul>
            )}
            <Origin origin={holds.origin} />
          </span>
        }
      />
    </>
  );
}

/** The Progress tab of project `pid`. */
export function ProgressView({ pid }: { pid: string }): ReactNode {
  const intl = useIntl();
  return (
    <UiFrame pid={pid} title={TITLE.progress}>
      {(ui) => (
        <>
          <p className="page-intro">
            <FormattedMessage id="settings.progress.intro" values={{ code }} />
          </p>
          <div className="config-table-wrap">
            <table
              className="config-table config-progress"
              aria-label={intl.formatMessage({ id: 'settings.progress.table' })}
            >
              <thead>
                <tr>
                  <th scope="col">
                    <FormattedMessage id="settings.progress.column.key" />
                  </th>
                  <th scope="col">
                    <FormattedMessage id="settings.progress.column.value" />
                  </th>
                  <th scope="col">
                    <FormattedMessage id="settings.progress.column.meaning" />
                  </th>
                </tr>
              </thead>
              <tbody>
                <ProgressRows pid={pid} ui={ui} />
              </tbody>
            </table>
          </div>
        </>
      )}
    </UiFrame>
  );
}
