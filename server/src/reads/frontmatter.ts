/**
 * Frontmatter of a Markdown file (spec-001 §4.2–§4.3): YAML between the first two `---` lines,
 * then the body. YAML 1.2 core schema: dates and versions stay as written (no timestamp type);
 * `# …` comments are ignored.
 */
import { parse } from 'yaml';
import { schemaProblems, type ContractSchema } from '../contracts.js';
import { DirectReadError } from './confine.js';

/** A parsed Markdown file. */
export interface FrontmatterFile<T> {
  frontmatter: T;
  /** Everything after the closing `---` line. */
  body: string;
}

/** Parse YAML text, or a {@link DirectReadError} `shape` naming `file`. */
export function parseYaml(text: string, file: string): unknown {
  try {
    // Merge keys (`<<`) resolved as WingFoil's js-yaml does; the alias limit (resource exhaustion)
    // stays at the library's default.
    return parse(text, { schema: 'core', merge: true, prettyErrors: false });
  } catch (e) {
    throw new DirectReadError('shape', file, `${file}: invalid YAML (${(e as Error).message.split('\n')[0] ?? ''})`);
  }
}

/** Throw a `shape` error when `data` fails the schema at `contracts/<schemaFile>`. */
export function checkShape(schemaFile: ContractSchema, data: unknown, file: string): void {
  const problems = schemaProblems(schemaFile, data);
  if (problems) throw new DirectReadError('shape', file, `${file}: unexpected content (${problems.join('; ')})`);
}

/**
 * Split `text` into its frontmatter, validated against `contracts/<schemaFile>`, and its body; a
 * file without a closed frontmatter is a `shape` error. Lines end with LF or CRLF (WingFoil's
 * delimiter is `^---\r?\n…\r?\n---`); the body is returned with LF line ends.
 */
export function parseFrontmatterFile<T>(text: string, file: string, schemaFile: ContractSchema): FrontmatterFile<T> {
  const lines = text.split(/\r?\n/);
  const close = lines[0]?.trimEnd() === '---' ? lines.findIndex((l, i) => i > 0 && l.trimEnd() === '---') : -1;
  if (close === -1) throw new DirectReadError('shape', file, `${file}: no frontmatter`);
  const frontmatter = parseYaml(lines.slice(1, close).join('\n'), file);
  checkShape(schemaFile, frontmatter, file);
  return { frontmatter: frontmatter as T, body: lines.slice(close + 1).join('\n') };
}
