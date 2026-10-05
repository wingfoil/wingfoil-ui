// ESLint flat configuration (adr-002: typescript-eslint, Prettier for formatting).
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

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
    files: ['**/*.jsx'],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  },
  {
    // REQ-SEC-05 — no shell in the server (TT-SEC-05). Processes are started only with execFile,
    // execFileSync, spawn or spawnSync, imported by name, with an argument array and no `shell`.
    // Residual risk left to review: options objects built elsewhere and passed by variable,
    // aliased imports of the allowed functions running an interpreter.
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
  prettier,
);
