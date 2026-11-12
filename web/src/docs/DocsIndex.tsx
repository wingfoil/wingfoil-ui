/**
 * The documentation index (US-R-08, R-08.1; ux-reference §4.9, prototype; decision W3-28): the
 * documents of `GET /docs` grouped by folder, numbered as the prototype (`1`, `1.1`), each entry
 * with its file name as the title and its full path. No description: the API gives paths only.
 * What is shown is each document's `label` (the path as the server escaped it, task-072 D72-6); the
 * link goes to its `path`, the address.
 */
import type { UseQueryResult } from '@tanstack/react-query';
import type { DocumentationIndex } from '@wingfoil-ui/contracts';
import type { ReactNode } from 'react';
import { Link } from 'react-aria-components';
import { FormattedMessage } from 'react-intl';
import { QueryError } from './QueryError.js';
import { documentHref } from './render.js';
import './docs.css';

/** A folder of the index with its documents. */
export interface IndexSection {
  /** `1`, `2`, … */
  number: string;
  /** The folder as shown (`.` for the repository root), from the labels. */
  folder: string;
  /** The documents: number (`1.1`), file name (the title) and label as shown, and the path (the address). */
  entries: { number: string; name: string; label: string; path: string }[];
}

/** The folder of `text` (`.` at the root). */
const folderOf = (text: string): string => (text.includes('/') ? text.slice(0, text.lastIndexOf('/')) : '.');

/**
 * The documents grouped by folder, in the index's order (sorted by path). Grouped by the path; the
 * folder and the file name shown are the label's (the escape writes no `/` and removes none).
 */
export function indexSections(documents: readonly { path: string; label: string }[]): IndexSection[] {
  const sections = new Map<string, { folder: string; list: { path: string; label: string }[] }>();
  for (const doc of documents) {
    const key = folderOf(doc.path);
    const section = sections.get(key) ?? { folder: folderOf(doc.label), list: [] };
    section.list.push(doc);
    sections.set(key, section);
  }
  return [...sections.values()].map(({ folder, list }, i) => ({
    number: String(i + 1),
    folder,
    entries: list.map(({ path, label }, j) => ({
      number: `${i + 1}.${j + 1}`,
      name: label.slice(label.lastIndexOf('/') + 1),
      label,
      path,
    })),
  }));
}

/** Props of {@link DocsIndex}. */
export interface DocsIndexProps {
  pid: string;
  index: Pick<UseQueryResult<DocumentationIndex>, 'data' | 'error'>;
}

/** The index page's content. */
export function DocsIndex({ pid, index }: DocsIndexProps): ReactNode {
  const sections = index.data ? indexSections(index.data.documents) : [];
  return (
    <div className="page docs-index">
      <h1>
        <FormattedMessage id="docs.index.title" />
      </h1>
      <p className="page-intro">
        <FormattedMessage id="docs.index.intro" />
      </p>
      {index.error && <QueryError error={index.error} />}
      {!index.data && !index.error && (
        <p role="status">
          <FormattedMessage id="docs.index.loading" />
        </p>
      )}
      {index.data && sections.length === 0 && (
        <p>
          <FormattedMessage id="docs.index.empty" />
        </p>
      )}
      {sections.map((section, i) => (
        <section key={section.folder} className="docs-section" aria-labelledby={`docs-section-${i}`}>
          <h2 id={`docs-section-${i}`} className="docs-section-title">
            <span className="docs-num" aria-hidden="true">
              {section.number}
            </span>
            <span className="docs-folder">{section.folder}</span>
          </h2>
          <ul className="docs-list">
            {section.entries.map((entry) => (
              <li key={entry.path}>
                <Link className="docs-entry" href={documentHref(pid, entry.path)}>
                  <span className="docs-num" aria-hidden="true">
                    {entry.number}
                  </span>
                  <div className="docs-title">{entry.name}</div>
                  <div className="docs-path">{entry.label}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
