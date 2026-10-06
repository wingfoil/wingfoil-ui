// spec-008 §6 — placeholder check of the web catalogue (coordinator decision W3-3). The messages
// live in `web/src/i18n/en.json`, not in the code (no `defaultMessage`), so formatjs's own
// `enforce-placeholders` has nothing to compare; this rule reads the catalogue instead. For every
// `<FormattedMessage id="…" values={{…}} />` and `formatMessage({ id: '…' }, {…})` with a literal
// id it reports: an id missing from the catalogue, an argument (or rich-text tag) of the message
// without a value, and a value the message does not use. Values given by a variable, a spread or
// a computed key are not checked (residual risk, left to review).
import { readFileSync } from 'node:fs';
import { CATALOGUE_FILE, messageArguments } from '../web/scripts/catalogue.mjs';

const catalogue = JSON.parse(readFileSync(CATALOGUE_FILE, 'utf8'));

/** Literal string value of a node, or undefined. */
function literal(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  if (node?.type === 'JSXExpressionContainer') return literal(node.expression);
  return undefined;
}

/** Keys of an object literal, or undefined when any key is not static. */
function objectKeys(node) {
  if (node?.type !== 'ObjectExpression') return undefined;
  const keys = [];
  for (const p of node.properties) {
    if (p.type !== 'Property' || p.computed) return undefined;
    if (p.key.type === 'Identifier') keys.push(p.key.name);
    else if (typeof p.key.value === 'string') keys.push(p.key.value);
    else return undefined;
  }
  return keys;
}

function check(context, node, id, valuesNode, hasValues) {
  if (id === undefined) return;
  if (!Object.hasOwn(catalogue, id)) {
    context.report({ node, message: `spec-008: message id missing from the catalogue: ${id}` });
    return;
  }
  const { args, tags } = messageArguments(catalogue[id]);
  const wanted = [...args, ...tags];
  let given = [];
  if (hasValues) {
    given = objectKeys(valuesNode);
    if (given === undefined) return;
  }
  for (const name of wanted) {
    if (!given.includes(name)) context.report({ node, message: `spec-008: no value for {${name}} of ${id}` });
  }
  for (const name of given) {
    if (!wanted.includes(name)) context.report({ node, message: `spec-008: ${id} has no argument {${name}}` });
  }
}

const rule = {
  meta: { type: 'problem', schema: [] },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'FormattedMessage') return;
        const attr = (name) => node.attributes.find((a) => a.type === 'JSXAttribute' && a.name.name === name);
        if (node.attributes.some((a) => a.type === 'JSXSpreadAttribute')) return;
        const values = attr('values');
        check(context, node, literal(attr('id')?.value), values?.value?.expression, values !== undefined);
      },
      CallExpression(node) {
        const callee = node.callee;
        const name =
          callee.type === 'Identifier'
            ? callee.name
            : callee.type === 'MemberExpression'
              ? callee.property.name
              : undefined;
        if (name !== 'formatMessage') return;
        const descriptor = node.arguments[0];
        if (descriptor?.type !== 'ObjectExpression') return;
        const idProp = descriptor.properties.find(
          (p) => p.type === 'Property' && !p.computed && (p.key.name ?? p.key.value) === 'id',
        );
        check(context, node, literal(idProp?.value), node.arguments[1], node.arguments.length > 1);
      },
    };
  },
};

/** ESLint plugin `wfui` part holding the rule `catalogue-placeholders`. */
export const cataloguePlugin = { rules: { 'catalogue-placeholders': rule } };
