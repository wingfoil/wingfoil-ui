// spec-008 §6 (TT-ARC-09 support): the catalogue check — ids used in web/src against en.json, sorted
// file, id pattern and areas, no defaultMessage in the code. Clean on the repository, and each
// planted defect found.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { checkCatalogue } from '../../../web/scripts/catalogue.mjs';

let src: string;

beforeAll(async () => {
  src = await mkdtemp(path.join(tmpdir(), 'wfui-catalogue-'));
  await writeFile(
    path.join(src, 'a.tsx'),
    `import { FormattedMessage, useIntl } from 'react-intl';
export function A() {
  const intl = useIntl();
  return <p title={intl.formatMessage({ id: 'shell.used' })}><FormattedMessage id="shell.missing" /></p>;
}
export function B() {
  return <FormattedMessage id="shell.withDefault" defaultMessage="Text in the code" />;
}
`,
  );
}, 60_000);

afterAll(() => rm(src, { recursive: true, force: true }));

it('finds no problem on the repository', async () => {
  expect(await checkCatalogue()).toEqual([]);
}, 60_000);

it('reports every planted defect', async () => {
  const problems = await checkCatalogue({
    srcDir: src,
    catalogue: {
      'shell.withDefault': 'x',
      'shell.used': 'Used',
      'shell.unused': 'Unused',
      'Shell.bad': 'x',
      'nowhere.thing': 'x',
      'shell.broken': 'A {broken',
    },
  });
  expect(problems.sort()).toEqual(
    [
      'the catalogue is not sorted by key',
      'id off the pattern: Shell.bad',
      'id of an unknown area: nowhere.thing',
      'not a valid ICU message: shell.broken',
      'missing from the catalogue: shell.missing',
      'defaultMessage in the code: shell.withDefault',
      'unused by the code: shell.unused',
      'unused by the code: Shell.bad',
      'unused by the code: nowhere.thing',
      'unused by the code: shell.broken',
    ].sort(),
  );
}, 60_000);
