/**
 * Frontmatter of a Markdown file (spec-001 §4.2–§4.3): YAML between the first two `---` lines,
 * then the body. YAML 1.2 core schema: dates and versions stay as written (no timestamp type);
 * `# …` comments are ignored.
 */
import { isMap, LineCounter, parseDocument, visit } from 'yaml';
import { schemaProblems, type ContractSchema } from '../contracts.js';
import { DirectReadError } from './confine.js';
import {
  isImplicitEmptyKey,
  isMergeKey,
  jsYamlKey,
  keyContext,
  MAX_ALIAS_RESOLVE_STEPS,
  UnsupportedKeyError,
  type KeyContext,
} from './yaml-keys.js';

/** A parsed Markdown file. */
export interface FrontmatterFile<T> {
  frontmatter: T;
  /** Everything after the closing `---` line. */
  body: string;
}

/**
 * The parse options of every frontmatter and of `memory.yaml` (bug-032): YAML 1.2 core schema,
 * merge keys (`<<`) resolved as WingFoil's js-yaml does, and the library's own duplicate-key check
 * off — it is quadratic (1 MiB of keys took about 99 s, task-055 P4b); the reader's own check does it
 * in one pass. The alias limit (resource exhaustion) stays at the library's default.
 */
export const FRONTMATTER_PARSE_OPTIONS = Object.freeze({
  schema: 'core',
  merge: true,
  uniqueKeys: false,
  prettyErrors: false,
} as const);

/** The longest key text a refusal quotes, in code points (its first line only). */
const MAX_KEY_TEXT = 64;

/** The source text of `node` in `text`, for a refusal: its first line, at most {@link MAX_KEY_TEXT}. */
function keyText(text: string, node: unknown): string {
  const range = (node as { range?: readonly number[] } | null)?.range;
  if (!range) return '';
  const line = (text.slice(range[0], range[1]).split(/\r?\n/)[0] ?? '').trimEnd();
  const points = [...line];
  return points.length > MAX_KEY_TEXT ? `${points.slice(0, MAX_KEY_TEXT).join('')}…` : line;
}

/**
 * The first key repeated in a mapping, compared as WingFoil's js-yaml stores keys (bug-037,
 * {@link jsYamlKey}; a merge key `<<` is not a key of its own), or a key js-yaml refuses or whose
 * form is not emulated — with its line and column; `undefined` when none. One pass, one set per map.
 */
function duplicateKey(
  doc: ReturnType<typeof parseDocument>,
  context: KeyContext,
  text: string,
  lines: LineCounter,
): string | undefined {
  let found: string | undefined;
  const at = (node: unknown): string => {
    const where = lines.linePos((node as { range?: readonly number[] } | null)?.range?.[0] ?? 0);
    return `(line ${where.line}, column ${where.col})`;
  };
  visit(doc, {
    Map(_, map) {
      if (!isMap(map)) return undefined;
      const seen = new Set<string>();
      for (const [index, pair] of map.items.entries()) {
        const key = pair.key;
        if (isImplicitEmptyKey(map, index)) {
          found = `empty key ${at(key ?? pair.value)}`;
          return visit.BREAK;
        }
        if (isMergeKey(key)) continue;
        let form: string;
        try {
          form = jsYamlKey(key, context);
        } catch (error) {
          if (!(error instanceof UnsupportedKeyError)) throw error;
          found = `unsupported key ${keyText(text, key)} ${at(key)}`;
          return visit.BREAK;
        }
        if (seen.has(form)) {
          found = `duplicate key ${keyText(text, key)} ${at(key)}`;
          return visit.BREAK;
        }
        seen.add(form);
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
  // The source tokens tell an explicit key (`?`) from an implicit one (bug-040).
  const doc = parseDocument(text, { ...FRONTMATTER_PARSE_OPTIONS, lineCounter: lines, keepSourceTokens: true });
  const error = doc.errors[0];
  if (error) fail(error.message.split('\n')[0] ?? '');
  // One pass over the nodes: the aliases and the cost of resolving them (bug-042), before `toJS`.
  const context = keyContext(doc);
  if (context.resolveSteps > MAX_ALIAS_RESOLVE_STEPS) {
    fail(`too many aliases to resolve (over ${MAX_ALIAS_RESOLVE_STEPS} steps)`);
  }
  const duplicate = duplicateKey(doc, context, text, lines);
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

/** Options of {@link parseFrontmatterFile}. */
export interface FrontmatterOptions {
  /**
   * The largest frontmatter, in UTF-8 bytes of exactly the text that would be parsed, accepted; a
   * larger one is a `shape` error, never parsed (the reference index's bound, bug-032).
   */
  maxBytes?: number;
}

/**
 * Split `text` into its frontmatter, validated against `contracts/<schemaFile>`, and its body; a
 * file without a closed frontmatter is a `shape` error. Lines end with LF or CRLF (WingFoil's
 * delimiter is `^---\r?\n…\r?\n---`); the body is returned with LF line ends. The delimiters are
 * found once, here, and `maxBytes` is checked on the text the parse reads (review round 1 F1).
 */
export function parseFrontmatterFile<T>(
  text: string,
  file: string,
  schemaFile: ContractSchema,
  options: FrontmatterOptions = {},
): FrontmatterFile<T> {
  const lines = text.split(/\r?\n/);
  const close = lines[0]?.trimEnd() === '---' ? lines.findIndex((l, i) => i > 0 && l.trimEnd() === '---') : -1;
  if (close === -1) throw new DirectReadError('shape', file, `${file}: no frontmatter`);
  const source = lines.slice(1, close).join('\n');
  if (options.maxBytes !== undefined && Buffer.byteLength(source) > options.maxBytes) {
    throw new DirectReadError('shape', file, `${file}: frontmatter too large (over ${options.maxBytes} bytes)`);
  }
  const frontmatter = parseYaml(source, file);
  checkShape(schemaFile, frontmatter, file);
  return { frontmatter: frontmatter as T, body: lines.slice(close + 1).join('\n') };
}
