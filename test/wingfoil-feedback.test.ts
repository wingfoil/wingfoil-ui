// task-023 — the WingFoil feedback inbox (WingFoil dl-163 R1, R4) and the `wingfoil-cli` directive
// that governs it, as WingFoil-Templates' `tests/wingfoil-feedback.test.ts` checks its own.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { REPO_ROOT } from './harness/cli.js';

const INBOX = path.join(REPO_ROOT, 'docs', 'wingfoil-feedback');
const DIRECTIVE = path.join(REPO_ROOT, '.wingfoil', 'directives', 'custom', 'wingfoil-cli.md');
const NOTE_FILE = /^F-\d{3}-[a-z0-9-]+\.md$/;
const FIELDS = ['id', 'title', 'kind', 'status', 'wingfoil_version', 'answered_by'];
const KINDS = ['defect', 'gap', 'request'];
const STATUSES = ['open', 'needs-info', 'captured', 'resolved', 'declined', 'duplicate'];
/** The first body line: the id the note was migrated from (task-023), or the W-entries it reports (dl-007). */
const FIRST_LINE =
  /^\n(?:Formerly R-\d{2}\.|Formerly W-\d{2} candidate\.|Formerly W-\d{2} and W-\d{2} candidates\.|Formerly an unnamed W-xx candidate\.)\n/;

interface Note {
  file: string;
  fields: Record<string, unknown>;
  body: string;
}

function readNotes(): Note[] {
  return readdirSync(INBOX)
    .filter((name) => NOTE_FILE.test(name))
    .sort()
    .map((file) => {
      const text = readFileSync(path.join(INBOX, file), 'utf8');
      const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
      if (match === null) throw new Error(`${file} has no frontmatter`);
      const fields = parse(match[1] ?? '') as Record<string, unknown>;
      return { file, fields, body: text.slice(match[0].length) };
    });
}

/** Rows of the first Markdown table after a heading (header and rule skipped), as trimmed cells. */
function tableAfter(text: string, heading: string): string[][] {
  const start = text.indexOf(heading);
  if (start < 0) throw new Error(`no ${heading}`);
  const lines = text.slice(start).split('\n');
  const first = lines.findIndex((line) => line.startsWith('|'));
  const end = lines.findIndex((line, index) => index > first && !line.startsWith('|'));
  return (
    lines
      .slice(first + 2, end < 0 ? undefined : end)
      // Cells are split on unescaped pipes: a title may hold `\|`.
      .map((line) =>
        line
          .slice(1, -1)
          .split(/(?<!\\)\|/)
          .map((cell) => cell.trim()),
      )
  );
}

describe('the WingFoil feedback inbox (dl-163)', () => {
  const notes = readNotes();

  it('holds only the README and the notes', () => {
    const stray = readdirSync(INBOX).filter((name) => name !== 'README.md' && !NOTE_FILE.test(name));
    expect(stray).toEqual([]);
  });

  it('has notes numbered from F-001 without gaps, each named after its id', () => {
    expect(notes.length).toBeGreaterThan(0);
    notes.forEach((note, index) => {
      const id = `F-${String(index + 1).padStart(3, '0')}`;
      expect(note.fields['id'], note.file).toBe(id);
      expect(note.file.startsWith(`${id}-`), note.file).toBe(true);
    });
  });

  it('gives every note exactly the six fields of dl-163 R4, with allowed values', () => {
    for (const note of notes) {
      expect(Object.keys(note.fields), note.file).toEqual(FIELDS);
      const title = note.fields['title'];
      expect(typeof title === 'string' && title !== '', note.file).toBe(true);
      expect(KINDS, note.file).toContain(note.fields['kind']);
      expect(STATUSES, note.file).toContain(note.fields['status']);
      expect(String(note.fields['wingfoil_version']), note.file).toMatch(/^\d+\.\d+\.\d+/);
      const answered = note.fields['answered_by'];
      const strings = Array.isArray(answered) && answered.every((id) => typeof id === 'string');
      expect(strings, note.file).toBe(true);
    }
  });

  it('opens with the id the note was migrated from', () => {
    for (const note of notes) expect(note.body, note.file).toMatch(FIRST_LINE);
  });

  it('states what was observed and what was expected, with no other section', () => {
    for (const note of notes) {
      expect(note.body, note.file).toMatch(/\n## Observed\n[\s\S]+\n## Expected\n[\s\S]*\S/);
      const sections = note.body.match(/^## .+$/gm) ?? [];
      expect(sections, note.file).toEqual(['## Observed', '## Expected']);
      // dl-163 R4 has no Replies: refused at any heading level.
      expect(note.body, note.file).not.toMatch(/^#{1,6}\s+Replies\b/im);
    }
  });

  it('lists every note in the README ledger as the note says', () => {
    const readme = readFileSync(path.join(INBOX, 'README.md'), 'utf8');
    expect(readme).toMatch(/\*\*Source key:\*\*/);
    expect(readme).toMatch(/\*\*Last sync:\*\*/);
    const rows = tableAfter(readme, '## Ledger');
    expect(rows.map((row) => row.length)).toEqual(notes.map(() => 5));
    notes.forEach((note, index) => {
      const [link, title, kind, status, answered] = rows[index] ?? [];
      expect(link).toBe(`[${String(note.fields['id'])}](${note.file})`);
      expect(title).toBe(String(note.fields['title']).replace(/\|/g, '\\|'));
      expect(kind).toBe(note.fields['kind']);
      expect(status).toBe(note.fields['status']);
      expect(answered).toBe((note.fields['answered_by'] as string[]).join(', '));
    });
  });

  it('links the known behaviours of wingfoil-cli only to existing notes', () => {
    const ids = new Set(notes.map((note) => String(note.fields['id'])));
    const rows = tableAfter(readFileSync(DIRECTIVE, 'utf8'), '## Known behaviours');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row, row[0]).toHaveLength(5);
      const refs = (row[3] ?? '')
        .split(',')
        .map((ref) => ref.trim())
        .filter((ref) => ref !== '');
      for (const ref of refs) expect(ids.has(ref), `${row[0] ?? ''}: ${ref}`).toBe(true);
    }
  });
});
