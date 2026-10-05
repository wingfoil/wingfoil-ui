/**
 * The direct read of a directive file (spec-001 §4.3, adr-001 D1a): only at `.wingfoil/<path>` for
 * a `path` `directives list` returned, confined to `.wingfoil/`; its frontmatter checked against
 * `contracts/files/directive.schema.json` and its `id` against the list entry. Replaced by
 * `directives show` (or equivalent) when WingFoil adds one.
 */
import path from 'node:path';
import type { DirectiveEntry, DirectiveFrontmatter } from '@wingfoil-ui/contracts';
import { DirectReadError, nodeReadFs, readConfined, type ReadFs } from './confine.js';
import { parseFrontmatterFile } from './frontmatter.js';

/** A directive as its file holds it. */
export interface DirectiveContent {
  /** Path relative to `.wingfoil/`, as `directives list` returned it. */
  path: string;
  frontmatter: DirectiveFrontmatter;
  /** Markdown body (rendered in the Directives view). */
  body: string;
}

/** Parse the text of a directive file (`file` names it in errors). */
export function parseDirective(text: string, file: string): Omit<DirectiveContent, 'path'> {
  return parseFrontmatterFile<DirectiveFrontmatter>(text, file, 'files/directive.schema.json');
}

/** Read the directive of `entry`, an entry of `directives list` on the project at `root`. */
export async function readDirective(
  root: string,
  entry: Pick<DirectiveEntry, 'path' | 'frontmatter'>,
  fs: ReadFs = nodeReadFs,
): Promise<DirectiveContent> {
  const parsed = parseDirective(await readConfined(root, path.join(root, '.wingfoil'), entry.path, fs), entry.path);
  if (parsed.frontmatter.id !== entry.frontmatter.id) {
    throw new DirectReadError(
      'mismatch',
      entry.path,
      `${entry.path}: id "${parsed.frontmatter.id}" differs from directives list ("${entry.frontmatter.id}")`,
    );
  }
  return { path: entry.path, ...parsed };
}
