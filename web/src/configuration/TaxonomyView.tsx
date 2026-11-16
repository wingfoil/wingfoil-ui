/**
 * Configuration › Taxonomy (US-C-01, C-01.1, C-01.3, AC-1; ux-reference §4.11; task-064 D64-4): what
 * the 8 UI categories mean, then the project's `taxonomy` as the server serves it — one row per
 * declared type with its category (or "No category") and origin, the required references, the
 * reference patterns in file order with their origin — each key explained with an example. A
 * pattern is shown as served (`patterns[].match`, its backslashes kept, W1-18), never compiled here.
 * No category or type name is written in this file (REQ-ARC-05): they come from the data, and the
 * category list and its meanings from the catalogue. *Use preset* follows the intro (task-079, D79-3).
 */
import type { UiConfig } from '@wingfoil-ui/contracts';
import { useId, type ReactNode } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { Origin, UiFrame } from './UiFrame.js';
import { UsePreset } from './UsePreset.js';

const TITLE = defineMessages({ taxonomy: { id: 'settings.taxonomy.title' } });

const code = (chunks: ReactNode[]) => <code>{chunks}</code>;

/** The 8 categories, each with its meaning (one catalogue message: no category name in the code). */
function Categories(): ReactNode {
  const id = useId();
  return (
    <>
      <h3 id={id} className="config-subtitle">
        <FormattedMessage id="settings.taxonomy.categories.title" />
      </h3>
      <ul className="config-categories" aria-labelledby={id}>
        <FormattedMessage
          id="settings.taxonomy.categories.list"
          values={{
            item: (chunks: ReactNode[]) => <li>{chunks}</li>,
            name: (chunks: ReactNode[]) => <code className="config-category">{chunks}</code>,
          }}
        />
      </ul>
    </>
  );
}

/** Types → categories, with the required references. */
function Types({ taxonomy }: { taxonomy: UiConfig['taxonomy'] }): ReactNode {
  const intl = useIntl();
  const id = useId();
  const requires = new Map(taxonomy.requires.value.map((r) => [r.type, r.categories]));
  return (
    <>
      <h3 id={id} className="config-subtitle">
        <FormattedMessage id="settings.taxonomy.types.title" />
      </h3>
      <p className="config-help">
        <FormattedMessage id="settings.taxonomy.types.help" values={{ code }} />
      </p>
      <p className="config-example">
        <code>
          <FormattedMessage id="settings.taxonomy.types.example" />
        </code>
      </p>
      <p className="config-key-line">
        <code>
          <FormattedMessage id="settings.taxonomy.key.requires" />
        </code>
        <Origin origin={taxonomy.requires.origin} />
      </p>
      <div className="config-table-wrap">
        <table className="config-table config-types" aria-labelledby={id}>
          <thead>
            <tr>
              <th scope="col">
                <FormattedMessage id="settings.taxonomy.column.type" />
              </th>
              <th scope="col">
                <FormattedMessage id="settings.taxonomy.column.category" />
              </th>
              <th scope="col">
                <FormattedMessage id="settings.taxonomy.column.requires" />
              </th>
            </tr>
          </thead>
          <tbody>
            {taxonomy.categories.map((row) => {
              const required = requires.get(row.type) ?? [];
              return (
                <tr key={row.type}>
                  <th scope="row">
                    <code>{row.type}</code>
                  </th>
                  <td>
                    <span className="config-value">
                      {row.category === null ? (
                        <span className="config-none">
                          <FormattedMessage id="settings.taxonomy.noCategory" />
                        </span>
                      ) : (
                        <code>{row.category}</code>
                      )}
                      <Origin origin={row.origin} />
                    </span>
                  </td>
                  <td>
                    {required.length === 0 ? (
                      <span className="config-none">
                        <FormattedMessage id="settings.taxonomy.noRequires" />
                      </span>
                    ) : (
                      intl.formatList(required, { type: 'unit', style: 'short' })
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** The reference patterns, in file order (the first match wins). */
function Patterns({ patterns }: { patterns: UiConfig['taxonomy']['patterns'] }): ReactNode {
  const id = useId();
  return (
    <>
      <h3 id={id} className="config-subtitle">
        <FormattedMessage id="settings.taxonomy.patterns.title" />
      </h3>
      <p className="config-help">
        <FormattedMessage id="settings.taxonomy.patterns.help" />
      </p>
      <p className="config-help">
        <FormattedMessage id="settings.taxonomy.patterns.rules" values={{ code }} />
      </p>
      <p className="config-example">
        <code>
          <FormattedMessage id="settings.taxonomy.patterns.example" />
        </code>
      </p>
      <p className="config-key-line">
        <code>
          <FormattedMessage id="settings.taxonomy.key.patterns" />
        </code>
        <Origin origin={patterns.origin} />
      </p>
      {patterns.value.length === 0 ? (
        <p className="config-none">
          <FormattedMessage id="settings.taxonomy.patterns.none" />
        </p>
      ) : (
        <div className="config-table-wrap">
          <table className="config-table config-patterns" aria-labelledby={id}>
            <thead>
              <tr>
                <th scope="col">
                  <FormattedMessage id="settings.taxonomy.column.pattern" />
                </th>
                <th scope="col">
                  <FormattedMessage id="settings.taxonomy.column.category" />
                </th>
              </tr>
            </thead>
            <tbody>
              {patterns.value.map((p, i) => (
                <tr key={i}>
                  <td>
                    <code className="config-pattern">{p.match}</code>
                  </td>
                  <td>
                    <code>{p.category}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** The Taxonomy tab of project `pid`. */
export function TaxonomyView({ pid }: { pid: string }): ReactNode {
  return (
    <UiFrame pid={pid} title={TITLE.taxonomy}>
      {(ui) => (
        <>
          <p className="page-intro">
            <FormattedMessage id="settings.taxonomy.intro" values={{ code }} />
          </p>
          <UsePreset pid={pid} ui={ui} />
          <Categories />
          <Types taxonomy={ui.taxonomy} />
          <Patterns patterns={ui.taxonomy.patterns} />
        </>
      )}
    </UiFrame>
  );
}
