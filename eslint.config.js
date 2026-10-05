// ESLint flat configuration (adr-002: typescript-eslint, Prettier for formatting).
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const CHILD_PROCESS = '/^(node:)?child_process$/';
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
    // REQ-SEC-05 — no shell in the server (TT-SEC-05).
    files: ['server/**/*.{ts,tsx,js,mjs,cjs}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['child_process', 'node:child_process'].map((name) => ({
            name,
            importNames: ['exec', 'execSync'],
            message: SEC05,
          })),
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: `ImportDeclaration[source.value=${CHILD_PROCESS}] > ImportNamespaceSpecifier`,
          message: `${SEC05} (import execFile/spawn by name)`,
        },
        {
          selector: `ImportDeclaration[source.value=${CHILD_PROCESS}] > ImportDefaultSpecifier`,
          message: `${SEC05} (import execFile/spawn by name)`,
        },
        {
          selector: `ImportExpression[source.value=${CHILD_PROCESS}]`,
          message: `${SEC05} (import execFile/spawn by name)`,
        },
        {
          selector: `CallExpression[callee.name='require'][arguments.0.value=${CHILD_PROCESS}]`,
          message: `${SEC05} (import execFile/spawn by name)`,
        },
        {
          selector: "Property[key.name='shell']:not([value.value=false])",
          message: `${SEC05} (shell must be false or absent)`,
        },
        {
          selector: "Property[key.value='shell']:not([value.value=false])",
          message: `${SEC05} (shell must be false or absent)`,
        },
      ],
    },
  },
  prettier,
);
