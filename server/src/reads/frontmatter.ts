/**
 * Frontmatter of a Markdown file (spec-001 §4.2–§4.3): YAML between the first two `---` lines,
 * then the body. YAML 1.2 core schema: dates and versions stay as written (no timestamp type);
 * `# …` comments are ignored.
 */
import { isMap, isScalar, LineCounter, parseDocument, visit } from 'yaml';
import { schemaProblems, type ContractSchema } from '../contracts.js';
import { DirectReadError } from './confine.js';

/** A parsed Markdown file. */
export interface FrontmatterFile<T> {
  frontmatter: T;
  /** Everything after the closing `---` line. */
  body: string;
}

/**
 * The parse options of every frontmatter and of `memory.yaml` (bug-032): YAML 1.2 core schema,
 * merge keys (`<<`) resolved as WingFoil's js-yaml does, and the library's own duplicate-key check
 * off — it is quadratic (1 MiB of keys took about 99 s, task-055 P4b); {@link duplicateKey} does it
 * in one pass. The alias limit (resource exhaustion) stays at the library's default.
 */
export const FRONTMATTER_PARSE_OPTIONS = Object.freeze({
  schema: 'core',
  merge: true,
  uniqueKeys: false,
  prettyErrors: false,
} as const);

/**
 * The first key repeated in a mapping, compared as the library does (the parsed scalar values;
 * a merge key `<<` is not a key of its own), with its line and column; `undefined` when none.
 */
function duplicateKey(doc: ReturnType<typeof parseDocument>, lines: LineCounter): string | undefined {
  let found: string | undefined;
  visit(doc, {
    Map(_, map) {
      if (!isMap(map)) return undefined;
      const seen = new Set<unknown>();
      for (const pair of map.items) {
        const key = pair.key;
        if (!isScalar(key) || key.value === '<<') continue;
        if (seen.has(key.value)) {
          const at = lines.linePos(key.range?.[0] ?? 0);
          found = `duplicate key ${String(key.value)} (line ${at.line}, column ${at.col})`;
          return visit.BREAK;
        }
        seen.add(key.value);
      }
      return undefined;
    },
  });
  return found;
}

/** Parse YAML text, or a {@link DirectReadError} `shape` naming `file`. */
export function parseYaml(text: string, file: string): unknown {
  const fail = (message: string): never => {
    throw new DirectReadError('shape', file, `${file}: invalid YAML (${message})`);
  };
  const lines = new LineCounter();
  const doc = parseDocument(text, { ...FRONTMATTER_PARSE_OPTIONS, lineCounter: lines });
  const error = doc.errors[0];
  if (error) fail(error.message.split('\n')[0] ?? '');
  const duplicate = duplicateKey(doc, lines);
  if (duplicate !== undefined) fail(duplicate);
  try {
    return doc.toJS();
  } catch (e) {
    return fail((e as Error).message.split('\n')[0] ?? '');
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
