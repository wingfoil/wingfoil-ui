// spec-008 §6, decision W3-3: `wfui/catalogue-placeholders` checks the `values` of a message against
// the arguments of its en.json text, and the id against the catalogue.
import { ESLint } from 'eslint';
import { expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';

const eslint = new ESLint({ cwd: REPO_ROOT });

async function problems(code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: 'web/src/sample.tsx' });
  return result!.messages.filter((m) => m.ruleId === 'wfui/catalogue-placeholders').map((m) => m.message);
}

const HEAD = `import { FormattedMessage, useIntl } from 'react-intl';\n`;

it('accepts a message with exactly its arguments', async () => {
  expect(
    await problems(
      `${HEAD}export const A = () => <FormattedMessage id="error.folderNotFound" values={{ path: '/x' }} />;`,
    ),
  ).toEqual([]);
  expect(await problems(`${HEAD}export const B = () => <FormattedMessage id="projects.start.title" />;`)).toEqual([]);
  expect(
    await problems(
      `${HEAD}export function C() { const intl = useIntl(); return intl.formatMessage({ id: 'state.corruptKept' }, { file: 'f' }); }`,
    ),
  ).toEqual([]);
});

it('reports a missing value, an extra value and an unknown id', async () => {
  expect(await problems(`${HEAD}export const A = () => <FormattedMessage id="error.folderNotFound" />;`)).toEqual([
    'spec-008: no value for {path} of error.folderNotFound',
  ]);
  expect(
    await problems(
      `${HEAD}export function C() { const intl = useIntl(); return intl.formatMessage({ id: 'projects.start.title' }, { extra: 1 }); }`,
    ),
  ).toEqual(['spec-008: projects.start.title has no argument {extra}']);
  expect(await problems(`${HEAD}export const A = () => <FormattedMessage id="shell.noSuchKey" />;`)).toEqual([
    'spec-008: message id missing from the catalogue: shell.noSuchKey',
  ]);
});

it('does not judge values given by a variable', async () => {
  expect(
    await problems(
      `${HEAD}export const A = (v: Record<string, string>) => <FormattedMessage id="error.folderNotFound" values={v} />;`,
    ),
  ).toEqual([]);
});

it('forbids literal text in JSX children and accessible-name attributes', async () => {
  const [result] = await eslint.lintText(`export const A = () => <button aria-label="Close">Close</button>;`, {
    filePath: 'web/src/sample.tsx',
  });
  expect(result!.messages.filter((m) => m.ruleId === 'formatjs/no-literal-string-in-jsx')).toHaveLength(2);
});
