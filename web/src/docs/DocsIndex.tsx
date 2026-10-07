/**
 * The documentation index (US-R-08, R-08.1; ux-reference §4.9, prototype; decision W3-28): the
 * documents of `GET /docs` grouped by folder, numbered as the prototype (`1`, `1.1`), each entry
 * with its file name as the title and its full path. No description: the API gives paths only.
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
  /** The folder (`.` for the repository root). */
  folder: string;
  /** The documents: number (`1.1`), file name (the title) and path. */
  entries: { number: string; name: string; path: string }[];
}

/** The documents grouped by folder, in the index's order (sorted by path). */
export function indexSections(paths: readonly string[]): IndexSection[] {
  const sections = new Map<string, string[]>();
  for (const path of paths) {
    const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '.';
    sections.set(folder, [...(sections.get(folder) ?? []), path]);
  }
  return [...sections].map(([folder, list], i) => ({
    number: String(i + 1),
    folder,
    entries: list.map((path, j) => ({ number: `${i + 1}.${j + 1}`, name: path.slice(path.lastIndexOf('/') + 1), path })),
  }));
}

/** Props of {@link DocsIndex}. */
export interface DocsIndexProps {
  pid: string;
  index: Pick<UseQueryResult<DocumentationIndex>, 'data' | 'error'>;
}

/** The index page's content. */
export function DocsIndex({ pid, index }: DocsIndexProps): ReactNode {
  const sections = index.data ? indexSections(index.data.documents.map((d) => d.path)) : [];
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
                  <div className="docs-path">{entry.path}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
