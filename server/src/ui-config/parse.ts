/**
 * The YAML rules of `.wingfoil/ui.yaml` (spec-005 §2, amended 2026-11-05; task-054 D54-3): the
 * YAML 1.2 core schema with no merge keys; aliases (no expansion of a small file into a large
 * tree), every explicit tag (the core ones included: `!!binary` and `!!set` resolve silently, design
 * probe P2), keys that are not plain scalars and duplicate keys are refused. Duplicate keys are found
 * with one set per map — the library's own check is quadratic in the number of keys (probe P2c).
 */
import { isAlias, isMap, isNode, isScalar, LineCounter, parseDocument, visit, type Node } from 'yaml';

/** The parsed data, or the first failure as spec-005 §2 renders it. */
export type UiYamlParse = { ok: true; data: unknown } | { ok: false; failure: string };

/** The first line of a YAML engine message, without the colon that introduces its excerpt. */
function engineMessage(message: string): string {
  return (message.split('\n')[0] ?? '').replace(/:\s*$/, '');
}

/** Parse `text` as `ui.yaml` (D54-3). */
export function parseUiYaml(text: string): UiYamlParse {
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, {
    schema: 'core',
    merge: false,
    uniqueKeys: false,
    prettyErrors: true,
    lineCounter,
  });
  const first = doc.errors[0];
  if (first) return { ok: false, failure: engineMessage(first.message) };

  let failure: string | undefined;
  const at = (node: { range?: [number, number, number] | null } | null | undefined, what: string): void => {
    const pos = lineCounter.linePos(node?.range?.[0] ?? 0);
    failure = `${what} (line ${pos.line}, column ${pos.col})`;
  };
  visit(doc, {
    Alias(_key, node) {
      at(node, 'aliases are not allowed');
      return visit.BREAK;
    },
    Node(_key, node) {
      if (node.tag !== undefined) {
        at(node, 'tags are not allowed');
        return visit.BREAK;
      }
      if (isMap(node)) {
        const seen = new Set<string>();
        for (const pair of node.items) {
          const key = pair.key as Node | null;
          if (!isScalar(key) || isAlias(key) || (key.value !== null && typeof key.value === 'object')) {
            at(isNode(key) ? key : node, isAlias(key) ? 'aliases are not allowed' : 'keys must be plain strings');
            return visit.BREAK;
          }
          if (key.tag !== undefined) {
            at(key, 'tags are not allowed');
            return visit.BREAK;
          }
          const name = String(key.value);
          if (seen.has(name)) {
            at(key, `duplicate key ${name}`);
            return visit.BREAK;
          }
          seen.add(name);
        }
      }
      return undefined;
    },
  });
  if (failure !== undefined) return { ok: false, failure };
  return { ok: true, data: doc.toJS({ maxAliasCount: 0 }) as unknown };
}
