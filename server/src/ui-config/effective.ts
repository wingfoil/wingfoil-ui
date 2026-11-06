/**
 * The effective configuration of one repository state (spec-005 §2–§3, spec-012 §2 `status`;
 * task-054 D54-1, D54-6, D54-7): the working tree's `.wingfoil/ui.yaml` when it is used, the
 * inferred values otherwise, each value with its origin. An ignored file (not a regular file,
 * above 64 KiB, not YAML, failing the schema or a semantic check) is ignored as a whole, with one
 * warning naming its first failure; it holds nothing.
 */
import type { MemoryYaml } from '@wingfoil-ui/contracts';
import { redactLocalPaths, type LocalRoots } from '../git/redact.js';
import { INFERRED_CATEGORIES } from '../presets/ui-config.js';
import type { UiYamlEntry } from '../reads/ui-yaml.js';
import { schemaFailure, semanticFailure } from './check.js';
import { parseUiYaml } from './parse.js';
import type { EffectiveUiConfig, UiCategory, UiYaml, Valued } from './types.js';

/** The YAML parse and the schema check of one content: the file's shape, or the first failure. */
type Shaped = { ok: true; value: UiYaml } | { ok: false; failure: string };

function shape(text: string): Shaped {
  const parsed = parseUiYaml(text);
  if (!parsed.ok) return parsed;
  const failure = schemaFailure(parsed.data);
  return failure === undefined ? { ok: true, value: parsed.data as UiYaml } : { ok: false, failure };
}

/**
 * The YAML parse and the schema check of the last content, kept by the bytes' SHA-256 (D54-7): a
 * hostile file costs its parse once per content, not once per repository state. The semantic checks
 * (cheap, and dependent on `memory.yaml`) run each time.
 */
export class UiYamlCache {
  /** Parses done (not taken from the cache). */
  parses = 0;
  private last: { sha256: string; shaped: Shaped } | undefined;

  /** The shape of `text`, whose SHA-256 is `sha256`. */
  shape(text: string, sha256: string): Shaped {
    if (this.last?.sha256 !== sha256) {
      this.parses += 1;
      this.last = { sha256, shaped: shape(text) };
    }
    return this.last.shaped;
  }
}

/** The one type whose category is `category`, or `null` when none or several have it. */
function onlyTypeOf(categories: ReadonlyMap<string, UiCategory | null>, category: UiCategory): string | null {
  const types = [...categories].filter(([, c]) => c === category).map(([t]) => t);
  return types.length === 1 ? types[0]! : null;
}

const declared = <T>(value: T): Valued<T> => ({ value, origin: 'declared' });
const inferred = <T>(value: T): Valued<T> => ({ value, origin: 'inferred' });
/** The declared value of a key the file writes, else the inferred one. */
const either = <T>(written: T | undefined, fallback: T): Valued<T> =>
  written === undefined ? inferred(fallback) : declared(written);

/**
 * The effective configuration from the entry read at `.wingfoil/ui.yaml` and the project's types.
 * The failure of an ignored file passes the sanitiser of tool messages with `roots` (it quotes the
 * file's content, spec-012 §2).
 */
export function effectiveUiConfig(
  entry: UiYamlEntry,
  memoryYaml: MemoryYaml,
  roots: LocalRoots,
  cache: UiYamlCache = new UiYamlCache(),
): EffectiveUiConfig {
  let file: UiYaml | undefined;
  let failure: string | undefined;
  if (entry.kind === 'refused') failure = entry.failure;
  else if (entry.kind === 'text') {
    const shaped = cache.shape(entry.text, entry.sha256);
    if (!shaped.ok) failure = shaped.failure;
    else {
      failure = semanticFailure(shaped.value, memoryYaml);
      if (failure === undefined) file = shaped.value;
    }
  }
  const status: EffectiveUiConfig['status'] =
    entry.kind === 'absent'
      ? { source: 'none' }
      : file
        ? { source: 'file' }
        : {
            source: 'ignored',
            warning: { code: 'ui-config-ignored', failure: redactLocalPaths(failure ?? '', roots) },
          };

  const types = Object.keys(memoryYaml.types);
  const writtenCategories = file?.taxonomy?.categories;
  const categories: Valued<ReadonlyMap<string, UiCategory | null>> = writtenCategories
    ? declared(new Map(types.map((t) => [t, Object.hasOwn(writtenCategories, t) ? writtenCategories[t]! : null])))
    : inferred(new Map(types.map((t) => [t, Object.hasOwn(INFERRED_CATEGORIES, t) ? INFERRED_CATEGORIES[t]! : null])));
  const patterns = file?.taxonomy?.patterns;
  const requires = file?.taxonomy?.requires;
  const progress = file?.progress;
  const holds = file?.holds;
  return {
    status,
    categories,
    patterns: either(
      patterns?.map(({ match, category }) => ({ match, category, regex: new RegExp(match, 'u') })),
      [],
    ),
    requires: either(requires ? new Map(Object.entries(requires).map(([t, c]) => [t, [...c]])) : undefined, new Map()),
    progress: {
      mode: either(progress?.mode, 'flow'),
      scope: either(progress?.scope ? { type: progress.scope.type } : undefined, null),
      phases: either(progress?.phases ? [...progress.phases] : undefined, []),
      iterates: either(progress?.iterates, onlyTypeOf(categories.value, 'work')),
      defects: either(progress?.defects, onlyTypeOf(categories.value, 'defect')),
    },
    holds: either(
      holds
        ? new Map(
            Object.entries(holds).map(([t, states]) => [
              t,
              new Map(Object.entries(states).map(([s, h]) => [s, h.approve])),
            ]),
          )
        : undefined,
      new Map(),
    ),
    artifacts: either(
      file?.artifacts?.map(({ path, phase }) => ({ path, phase })),
      [],
    ),
  };
}
