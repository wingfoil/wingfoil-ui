// task-072 D72-6 (spec-004 §3, §5; bug-035) — `docs.schema.json` and `file-content.schema.json`: a
// documentation path is an address and stays as the working tree names it; the text the page shows
// is its `label`, required next to it.
import { Ajv } from 'ajv';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DocumentationIndex, FileContent } from '../../contracts/src/api.js';
import { REPO_ROOT } from '../harness/cli.js';

const load = (file: string): object =>
  JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts/api', file), 'utf8')) as object;
const ajv = new Ajv({ allErrors: true });
const validDocs = ajv.compile(load('docs.schema.json'));
const validContent = ajv.compile(load('file-content.schema.json'));

describe('docs.schema.json', () => {
  it('a document has its path and its label', () => {
    const index: DocumentationIndex = {
      roots: ['docs'],
      documents: [{ path: 'docs/a\u202e.md', label: 'docs/a\\u202e.md' }],
    };
    expect(validDocs(index), JSON.stringify(validDocs.errors)).toBe(true);
  });

  it('a document without a label is refused', () => {
    expect(validDocs({ roots: ['docs'], documents: [{ path: 'docs/a.md' }] })).toBe(false);
  });
});

describe('file-content.schema.json', () => {
  it('a file has its path, its label, its size and its content', () => {
    const file: FileContent = { path: 'docs/a\u202e.md', label: 'docs/a\\u202e.md', size: 1, content: 'x' };
    expect(validContent(file), JSON.stringify(validContent.errors)).toBe(true);
  });

  it('a file without a label is refused', () => {
    expect(validContent({ path: 'docs/a.md', size: 1, content: 'x' })).toBe(false);
  });
});
