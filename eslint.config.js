// ESLint flat configuration (adr-002: typescript-eslint, Prettier for formatting).
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { methodologyPlugin } from './lint/methodology-literals.js';

const CHILD_PROCESS = '/^(node:)?child_process$/';
const PROCESS_CALL = 'CallExpression[callee.name=/^(execFile|execFileSync|spawn|spawnSync)$/]';
const INTERPRETER =
  '/^(.*[\\\\/])?(sh|bash|zsh|dash|ksh|fish|cmd|cmd\\.exe|powershell|powershell\\.exe|pwsh|pwsh\\.exe)$/i';
const SEC05 = 'REQ-SEC-05: start processes with execFile/spawn and an argument array, never through a shell';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'coverage/**',
      'docs-api/**',
      'test-results/**',
      'playwright-report/**',
      '.worktrees/**',
      'export/**',
      'export1/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // CommonJS files (the package bin): `require` is the module system there.
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['**/*.jsx'],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  },
  {
    // REQ-SEC-05 — no shell in the server (TT-SEC-05). Processes are started only with execFile,
    // execFileSync, spawn or spawnSync, imported by name, with an argument array and no `shell`.
    // Residual risk left to review: options objects built elsewhere and passed by variable;
    // aliased imports of the allowed functions running an interpreter; an interpreter given as a
    // template literal or a variable (`process.env.SHELL`); `shell` set through `Reflect.set` or
    // `Object.defineProperty`. `fork` is not allowed: it is not needed and runs a module, not a
    // program with arguments.
    files: ['server/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            ...['child_process', 'node:child_process'].map((name) => ({
              name,
              allowImportNames: ['execFile', 'execFileSync', 'spawn', 'spawnSync'],
              allowTypeImports: true,
              message: SEC05,
            })),
            ...['module', 'node:module'].map((name) => ({ name, importNames: ['createRequire'], message: SEC05 })),
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        ...[
          `ImportDeclaration[importKind!='type'][source.value=${CHILD_PROCESS}] > ImportNamespaceSpecifier`,
          `ImportDeclaration[importKind!='type'][source.value=${CHILD_PROCESS}] > ImportDefaultSpecifier`,
          `ImportExpression[source.value=${CHILD_PROCESS}]`,
          "ImportExpression:not([source.type='Literal'])",
          "CallExpression[callee.name='require']",
          "CallExpression[callee.property.name='require']",
          "CallExpression[callee.property.name='getBuiltinModule']",
        ].map((selector) => ({ selector, message: `${SEC05} (import execFile/spawn by name, statically)` })),
        ...[
          "ObjectExpression > Property[key.name='shell']:not([value.value=false])",
          "ObjectExpression > Property[key.value='shell']:not([value.value=false])",
          "AssignmentExpression > MemberExpression.left[property.name='shell']",
          "AssignmentExpression > MemberExpression.left[property.value='shell']",
          `${PROCESS_CALL} > ObjectExpression > Property[computed=true]`,
          `${PROCESS_CALL} > ObjectExpression > SpreadElement`,
        ].map((selector) => ({ selector, message: `${SEC05} (shell must be false or absent)` })),
        {
          selector: `${PROCESS_CALL}[arguments.0.value=${INTERPRETER}]`,
          message: `${SEC05} (no shell interpreter as the program)`,
        },
      ],
    },
  },
  {
    // REQ-ARC-05 — methodology independence (TT-ARC-05): no type or state name of the three
    // fixtures in server/ and web/ outside server/src/presets/ (tests live in test/). Reported: string
    // literals, expression-free template literals, literal types, keys written as bare identifiers
    // (object-literal data properties, interface/type property signatures, class fields, enum
    // members) and the standalone
    // words of a regular expression (`/^(draft|pending)$/`, `/\bdone\b/`, also an unanchored
    // `/done/`). Residual risk left to review: names built by concatenation (`'dr' + 'aft'`) or
    // with an expression (`${''}done`), other cases (`'DONE'`, `Draft`), names in JSX text or JSX
    // attribute names, in a regex beyond those boundaries or built from a string (`new
    // RegExp('^done$')` — its string argument is checked only as a whole literal), shorthand properties and
    // destructuring (`{ task }`, which are variables), and identifiers (`note`, `task` are
    // legitimate names of variables). Exempt by design: method, getter and setter names of
    // classes, interfaces and object literals (`open()`, `get resolved()`) — behaviour, not data.
    files: ['server/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}', 'web/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
    ignores: ['server/src/presets/**'],
    plugins: { wfui: methodologyPlugin },
    rules: { 'wfui/no-methodology-literal': 'error' },
  },
  prettier,
);
