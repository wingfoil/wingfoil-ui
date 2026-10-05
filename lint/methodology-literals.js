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
  for (const version of readdirSync(SAMPLES)) {
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

const MESSAGE =
  'REQ-ARC-05: "{{value}}" is a type or state name of a fixture — read it from the project ' +
  '(memory.yaml, the action descriptor) or move it to presets/';

/** The ESLint plugin holding the rule `no-methodology-literal`. */
export const methodologyPlugin = {
  rules: {
    'no-methodology-literal': {
      meta: {
        type: 'problem',
        docs: { description: 'REQ-ARC-05: no type or state name of the fixtures outside presets/ and tests' },
        schema: [],
        messages: { literal: MESSAGE },
      },
      create(context) {
        const names = methodologyNames();
        const check = (node, value) => {
          if (names.has(value)) context.report({ node, messageId: 'literal', data: { value } });
        };
        return {
          Literal(node) {
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
        };
      },
    },
  },
};
