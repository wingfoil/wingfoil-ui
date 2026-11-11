/**
 * Mapping keys as WingFoil's loader stores them (bug-037, task-075 D75-9): the pinned CLI reads every
 * frontmatter and `memory.yaml` with `js-yaml` 4.x `load` and its default schema, which turns each key
 * into `String()` of its value — so `1` and `"1"`, `true` and `"true"`, `~` and `"null"` are one key
 * there, and a file holding both is left out as a "duplicated mapping key", while `2026-01-01` (a
 * `Date`) and `"2026-01-01"` are two. The server parses with `yaml` (YAML 1.2 core schema) and compares
 * the {@link jsYamlKey} of each key, computed from the node by js-yaml's rules (no runtime dependency
 * on it; the differential test `test/server/reads/yaml-keys.test.ts` runs both):
 *
 * - a quoted or block scalar, or one tagged `!!str` or `!`: its string;
 * - a plain scalar: js-yaml's implicit types in its order — null, bool, int, float, timestamp — else its
 *   text; `!!null`, `!!bool`, `!!int`, `!!float`, `!!timestamp` through that type alone;
 * - an alias: the form of its anchored node; a map: `[object Object]`; a sequence: its items' forms as
 *   `Array.prototype.toString` joins them (`null` empty, a map `[object Object]`) — a nested sequence
 *   is refused, as js-yaml refuses it, and so is a collection tagged other than `!!map`/`!!seq`;
 * - any other tag (`!!binary`, `!!set`, a local tag): refused as unsupported — fail closed (declared
 *   residual: the CLI may list such a file; this repository has none).
 *
 * A date's form is `String(date)` in the server's time zone, the one the CLI child inherits.
 */
import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  visit,
  type Alias,
  type Document,
  type Node,
  type Scalar,
  type YAMLMap,
  type YAMLSeq,
} from 'yaml';

/** A key js-yaml would refuse, or one whose form is not emulated (a nested sequence, another tag). */
export class UnsupportedKeyError extends Error {
  override name = 'UnsupportedKeyError';
}

const TAG = 'tag:yaml.org,2002:';

/** js-yaml's `null` type (`type/null.js`). */
function isNull(data: string): boolean {
  return data === '~' || data === 'null' || data === 'Null' || data === 'NULL';
}

/** js-yaml's `bool` type: the value, or `undefined`. */
function bool(data: string): boolean | undefined {
  if (data === 'true' || data === 'True' || data === 'TRUE') return true;
  if (data === 'false' || data === 'False' || data === 'FALSE') return false;
  return undefined;
}

const isDigit = (c: string): boolean => c >= '0' && c <= '9';
const isOctal = (c: string): boolean => c >= '0' && c <= '7';
const isHex = (c: string): boolean => isDigit(c) || (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f');

/** js-yaml's `parseYamlInteger`. */
function parseInteger(data: string): number {
  let value = data;
  let sign = 1;
  if (value[0] === '-' || value[0] === '+') {
    if (value[0] === '-') sign = -1;
    value = value.slice(1);
  }
  if (value === '0') return 0;
  if (value[0] === '0') {
    if (value[1] === 'b') return sign * parseInt(value.slice(2), 2);
    if (value[1] === 'x') return sign * parseInt(value.slice(2), 16);
    if (value[1] === 'o') return sign * parseInt(value.slice(2), 8);
  }
  return sign * parseInt(value, 10);
}

/** js-yaml's `int` type (`resolveYamlInteger`): the value, or `undefined`. */
function integer(data: string): number | undefined {
  let index = 0;
  if (data.length === 0) return undefined;
  if (data[index] === '-' || data[index] === '+') index += 1;
  let digits: (c: string) => boolean = isDigit;
  if (data[index] === '0') {
    if (index + 1 === data.length) return parseInteger(data);
    index += 1;
    const base = data[index];
    if (base === 'b' || base === 'x' || base === 'o') {
      digits = base === 'b' ? (c) => c === '0' || c === '1' : base === 'x' ? isHex : isOctal;
      index += 1;
      if (index === data.length) return undefined;
    }
  }
  if (index === data.length) return undefined;
  for (; index < data.length; index += 1) if (!digits(data[index]!)) return undefined;
  const value = parseInteger(data);
  return Number.isFinite(value) ? value : undefined;
}

const FLOAT =
  /^(?:[-+]?(?:[0-9]+)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$/;
const FLOAT_SPECIAL = /^(?:[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$/;

/** js-yaml's `float` type (`resolveYamlFloat`, `constructYamlFloat`): the value, or `undefined`. */
function float(data: string): number | undefined {
  if (!FLOAT.test(data)) return undefined;
  if (!Number.isFinite(parseFloat(data)) && !FLOAT_SPECIAL.test(data)) return undefined;
  let value = data.toLowerCase();
  const sign = value[0] === '-' ? -1 : 1;
  if (value[0] === '-' || value[0] === '+') value = value.slice(1);
  if (value === '.inf') return sign * Number.POSITIVE_INFINITY;
  if (value === '.nan') return NaN;
  return sign * parseFloat(value);
}

const DATE = /^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$/;
const TIMESTAMP =
  /^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\.([0-9]*))?(?:[ \t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$/;

/** js-yaml's `timestamp` type (`constructYamlTimestamp`): the date, or `undefined`. */
function timestamp(data: string): Date | undefined {
  const match = DATE.exec(data) ?? TIMESTAMP.exec(data);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!match[4]) return new Date(Date.UTC(year, month, day));
  let fraction = 0;
  if (match[7]) fraction = Number(match[7].slice(0, 3).padEnd(3, '0'));
  const date = new Date(Date.UTC(year, month, day, Number(match[4]), Number(match[5]), Number(match[6]), fraction));
  if (match[9]) {
    let delta = (Number(match[10]) * 60 + Number(match[11] ?? 0)) * 60_000;
    if (match[9] === '-') delta = -delta;
    if (delta) date.setTime(date.getTime() - delta);
  }
  return date;
}

/** The value js-yaml constructs for a scalar's `data` under `tag` (`undefined`: implicit). */
function scalarValue(data: string, tag: string | undefined): unknown {
  const types: Record<string, (d: string) => unknown> = {
    null: (d) => (isNull(d) ? null : undefined),
    bool,
    int: integer,
    float,
    timestamp,
  };
  if (tag === undefined) {
    for (const name of ['null', 'bool', 'int', 'float', 'timestamp']) {
      const value = types[name]!(data);
      if (value !== undefined) return value;
    }
    return data;
  }
  const name = tag.startsWith(TAG) ? tag.slice(TAG.length) : undefined;
  if (name === 'str' || tag === '!') return data;
  const type = name !== undefined && Object.hasOwn(types, name) ? types[name] : undefined;
  const value = type?.(data);
  if (value === undefined) throw new UnsupportedKeyError(`tag ${tag}`);
  return value;
}

/** The value js-yaml constructs for a scalar node. */
function scalarOf(node: Scalar): unknown {
  const data = typeof node.source === 'string' ? node.source : String(node.value ?? '');
  // Only a plain scalar is resolved implicitly; a quoted or block one is a string.
  if (node.tag === undefined && node.type !== 'PLAIN') return data;
  // An empty node is js-yaml's `null` (no content), unless tagged as another type.
  if (data === '' && node.type === 'PLAIN' && (node.tag === undefined || node.tag === `${TAG}null`)) return null;
  return scalarValue(data, node.tag);
}

/**
 * What the key forms of one document share: the node each alias names — found in one pass in
 * document order, the latest anchor of its name before it (task-075 review round 1 F-1: `yaml`'s
 * `Alias.resolve` walks the whole document per alias) — and the form of each aliased sequence.
 */
export interface KeyContext {
  aliases: ReadonlyMap<Alias, Node | undefined>;
  forms: Map<unknown, string>;
  /**
   * The steps the `yaml` library's `toJS` would take to resolve the aliases (bug-042): its
   * `Alias.resolve` scans the anchored nodes and aliases before each alias, so each alias costs the
   * number of them before it — a cost that grows with the square of their number.
   */
  resolveSteps: number;
}

/**
 * The most alias-resolution steps a parse accepts (bug-042, task-075 AC-5): about 1 100 aliases of
 * distinct anchors (tens of ms of `toJS`), far beyond what a frontmatter or `memory.yaml` holds; a
 * file above it is refused as unreadable before `toJS`, which would block the server (4 000 such
 * aliases took 0.4 s, 175 000 in a 5 MiB file tens of minutes). `yaml`'s own `maxAliasCount` (100
 * per anchor, weighted by the aliases inside it) bounds the repeated aliases of one anchor only.
 */
export const MAX_ALIAS_RESOLVE_STEPS = 2_000_000;

/** The {@link KeyContext} of `doc`: one visit of its nodes. */
export function keyContext(doc: Document): KeyContext {
  const anchors = new Map<string, Node>();
  const aliases = new Map<Alias, Node | undefined>();
  // The anchored nodes and aliases seen so far, as `yaml`'s `Alias.resolve` lists them.
  let listed = 0;
  let resolveSteps = 0;
  const anchor = (_: unknown, node: Scalar | YAMLMap | YAMLSeq): void => {
    if (node.anchor) {
      anchors.set(node.anchor, node);
      listed += 1;
    }
  };
  visit(doc, {
    Scalar: anchor,
    Map: anchor,
    Seq: anchor,
    Alias(_, node) {
      aliases.set(node, anchors.get(node.source));
      resolveSteps += listed;
      listed += 1;
    },
  });
  return { aliases, forms: new Map(), resolveSteps };
}

/** The node `node` stands for: an alias's anchored node, else itself. */
function target(node: unknown, context: KeyContext): unknown {
  return isAlias(node) ? context.aliases.get(node) : node;
}

/**
 * A collection key's tag as js-yaml accepts it (review round 1 F-5): none (`!` resolves to the
 * collection's own tag in `yaml`), `!!map` on a map, `!!seq` on a sequence; any other is refused.
 */
function checkCollectionTag(node: YAMLMap | YAMLSeq, own: 'map' | 'seq'): void {
  if (node.tag !== undefined && node.tag !== `${TAG}${own}`) throw new UnsupportedKeyError(`tag ${node.tag}`);
}

/** The key form of an item of a sequence key: `Array.prototype.toString`'s, per item. */
function itemForm(node: unknown, context: KeyContext): string {
  const item = target(node, context);
  if (item === null || item === undefined) return '';
  if (isSeq(item)) throw new UnsupportedKeyError('nested sequence');
  if (isMap(item)) {
    checkCollectionTag(item, 'map');
    return '[object Object]';
  }
  if (isScalar(item)) {
    const value = scalarOf(item);
    return value === null || value === undefined ? '' : String(value);
  }
  throw new UnsupportedKeyError('node');
}

/**
 * The text js-yaml stores the key `node` under (`null`: a missing key); an
 * {@link UnsupportedKeyError} for a key whose form is not emulated. The `context` of the document
 * ({@link keyContext}) resolves aliases and keeps the form of each aliased sequence, so many aliases
 * of one long sequence cost its length once (linear, bug-032).
 */
export function jsYamlKey(node: unknown, context: KeyContext): string {
  const key = target(node, context);
  if (key === null || key === undefined) return 'null';
  if (isMap(key)) {
    checkCollectionTag(key, 'map');
    return '[object Object]';
  }
  if (isSeq(key)) {
    checkCollectionTag(key, 'seq');
    const known = context.forms.get(key);
    if (known !== undefined) return known;
    const form = key.items.map((item) => itemForm(item, context)).join(',');
    context.forms.set(key, form);
    return form;
  }
  if (isScalar(key)) return String(scalarOf(key));
  throw new UnsupportedKeyError('node');
}

/**
 * Whether item `index` of `map` has an empty key js-yaml refuses (bug-040, task-075 AC-4): in a block
 * mapping, an implicit key with no content, no tag and no anchor (`: a`, "incomplete explicit mapping
 * pair") — an explicit one (`?` then nothing) is js-yaml's `null`, and so is one in a flow
 * collection. The explicit indicator is read from the source tokens (`keepSourceTokens`); an item
 * whose tokens are missing counts as implicit (fail closed).
 */
export function isImplicitEmptyKey(map: YAMLMap, index: number): boolean {
  if (map.flow) return false;
  const pair = map.items[index];
  const key = pair?.key;
  const empty =
    key === null ||
    key === undefined ||
    (isScalar(key) && key.type === 'PLAIN' && key.source === '' && key.tag === undefined && !key.anchor);
  if (!empty) return false;
  const tokens = (map.srcToken as { items?: { start?: { type: string }[] }[] } | undefined)?.items;
  const start = tokens && tokens.length === map.items.length ? tokens[index]?.start : undefined;
  return !(start ?? []).some((token) => token.type === 'explicit-key-ind');
}

/**
 * Whether `node` is a merge key as js-yaml and `yaml` resolve one: a plain untagged `<<`, or a
 * `!!merge` scalar whose text is `<<` (quoted or not) or that is empty and plain (review round 1
 * F-5, round 2 F-7); a quoted empty `!!merge` key is refused as an unsupported key. Declared
 * residual: `yaml` also merges a `!!str <<` key, which js-yaml stores as the key `<<`.
 */
export function isMergeKey(node: unknown): boolean {
  if (!isScalar(node)) return false;
  // js-yaml resolves `!!merge` on `<<` or on an empty node — a quoted `''` is no empty node (F-7).
  if (node.tag === `${TAG}merge`) return node.source === '<<' || (node.source === '' && node.type === 'PLAIN');
  return node.tag === undefined && node.type === 'PLAIN' && node.source === '<<';
}
