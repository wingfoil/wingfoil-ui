/**
 * The direct read of a Memory element file (spec-001 §4.2, adr-001 D1a): only at the `path`
 * `memory search` returned, confined to the project; its frontmatter checked against
 * `contracts/files/element.schema.json` and its `id`, `type` and `status` against the match —
 * a difference is a read error of that element (REQ-ARC-04). Replaced by `memory show` (or
 * equivalent) when WingFoil adds one.
 */
import type { ElementFrontmatter, MemoryMatch } from '@wingfoil-ui/contracts';
import { DirectReadError, nodeReadFs, readConfined, type ReadFs } from './confine.js';
import { parseFrontmatterFile } from './frontmatter.js';

/** An element as its file holds it. */
export interface ElementContent {
  /** Path relative to the project root, as `memory search` returned it. */
  path: string;
  frontmatter: ElementFrontmatter;
  /** Markdown body. */
  body: string;
}

/** Parse the text of an element file (`file` names it in errors). */
export function parseElement(text: string, file: string): Omit<ElementContent, 'path'> {
  return parseFrontmatterFile<ElementFrontmatter>(text, file, 'files/element.schema.json');
}

/** A {@link DirectReadError} `mismatch` when the file's `id`, `type` or `status` differ from `match`. */
export function checkMatch(
  frontmatter: Pick<ElementFrontmatter, 'id' | 'type' | 'status'>,
  match: Pick<MemoryMatch, 'path' | 'id' | 'type' | 'status'>,
): void {
  for (const field of ['id', 'type', 'status'] as const) {
    if (frontmatter[field] !== match[field]) {
      throw new DirectReadError(
        'mismatch',
        match.path,
        `${match.path}: ${field} "${frontmatter[field]}" differs from memory search ("${match[field]}")`,
      );
    }
  }
}

/** Read the element of `match`, a match of `memory search` on the project at `root`. */
export async function readElement(
  root: string,
  match: Pick<MemoryMatch, 'path' | 'id' | 'type' | 'status'>,
  fs: ReadFs = nodeReadFs,
): Promise<ElementContent> {
  const parsed = parseElement(await readConfined(root, root, match.path, fs), match.path);
  checkMatch(parsed.frontmatter, match);
  return { path: match.path, ...parsed };
}
