// REQ-ARC-05 (TT-ARC-05) — methodology independence: an ESLint rule reporting every string literal
// equal to a type or state name of the three fixtures (`kanban`, `custom`, `unknown`). The names
// are read from the fixtures' captured WingFoil output (`test/contracts/samples/wingfoil-<pinned>/`:
// `files/memory.yaml` types and states, `memory-search.json` statuses) plus WingFoil's implicit
// `deprecated`, so a fixture change re-captured there updates the rule. Applied by
// `eslint.config.js` to `server/` and `web/` outside `presets/` and the tests.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SAMPLES = path.join(ROOT, 'test', 'contracts', 'samples');
const FIXTURES = ['kanban', 'custom', 'unknown'];

/** The type and state names of the three fixtures, over every captured WingFoil version. */
export function methodologyNames() {
  const names = new Set(['deprecated']);
  const addStates = (states) => {
    for (const s of states?.sequence ?? []) names.add(s);
    for (const [gate, { reject }] of Object.entries(states?.gates ?? {})) names.add(gate).add(reject);
    for (const s of states?.waiting ?? []) names.add(s);
  };
  const versions = readdirSync(SAMPLES, { withFileTypes: true }).filter((e) => e.isDirectory());
  for (const { name: version } of versions) {
    for (const fixture of FIXTURES) {
      const dir = path.join(SAMPLES, version, fixture);
      const memory = parse(readFileSync(path.join(dir, 'files', 'memory.yaml'), 'utf8'), { merge: true });
      addStates(memory.defaults?.states);
      for (const [type, def] of Object.entries(memory.types ?? {})) {
        names.add(type);
        addStates(def?.states);
      }
      for (const m of JSON.parse(readFileSync(path.join(dir, 'memory-search.json'), 'utf8')).matches) {
        names.add(m.status);
      }
    }
  }
  return names;
}

/** A word of a regex source bounded by `^`, `$`, `(`, `)`, `|`, `(?:` or `\\b` on both sides. */
const WORD_IN_PATTERN = /(?<=^|[|(^:]|\\b)([a-z][a-z0-9-]*)(?=$|[|)$]|\\b)/g;

const MESSAGE =
  'REQ-ARC-05: "{{value}}" is a type or state name of a fixture — read it from the project ' +
  '(memory.yaml, the action descriptor) or move it to server/src/presets/';

/** The ESLint plugin holding the rule `no-methodology-literal`. */
export const methodologyPlugin = {
  rules: {
    'no-methodology-literal': {
      meta: {
        type: 'problem',
        docs: { description: 'REQ-ARC-05: no type or state name of the fixtures outside server/src/presets/' },
        schema: [],
        messages: { literal: MESSAGE },
      },
      create(context) {
        const names = methodologyNames();
        const check = (node, value) => {
          if (names.has(value)) context.report({ node, messageId: 'literal', data: { value } });
        };
        /** A key written as a bare identifier (`{ draft: 1 }`, `enum K { draft }`, `x: T` members). */
        const checkKey = (node) => {
          if (!node.computed && node.key?.type === 'Identifier') check(node.key, node.key.name);
        };
        return {
          Literal(node) {
            if (node.regex) {
              // Words of a regular expression that stand alone between anchors, groups or
              // alternatives: `/^(draft|pending)$/`, `/\bdone\b/`.
              for (const m of node.regex.pattern.matchAll(WORD_IN_PATTERN)) check(node, m[1]);
              return;
            }
            if (typeof node.value !== 'string') return;
            // Module specifiers name files, not states.
            const parent = node.parent;
            if (
              parent &&
              (parent.type === 'ImportDeclaration' ||
                parent.type === 'ExportNamedDeclaration' ||
                parent.type === 'ExportAllDeclaration' ||
                parent.type === 'ImportExpression') &&
              parent.source === node
            ) {
              return;
            }
            check(node, node.value);
          },
          TemplateLiteral(node) {
            if (node.expressions.length === 0) check(node, node.quasis[0].value.cooked);
          },
          // Shorthand properties (`{ task }`) are variables, not written keys, and method names
          // (`{ open() {} }`, `get resolved()`) name behaviour, not methodology data: not checked.
          'ObjectExpression > Property'(node) {
            if (!node.shorthand && !node.method && node.kind === 'init') checkKey(node);
          },
          TSPropertySignature: checkKey,
          PropertyDefinition: checkKey,
          TSAbstractPropertyDefinition: checkKey,
          // Class and interface methods, getters and setters (MethodDefinition,
          // TSAbstractMethodDefinition, TSMethodSignature) are exempt by design, as above.
          TSEnumMember(node) {
            if (node.id.type === 'Identifier') check(node.id, node.id.name);
          },
        };
      },
    },
  },
};
