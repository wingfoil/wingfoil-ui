// dev-loop `refactor` gate `lint.clean`: ESLint reports no error on the repository.
import { ESLint } from 'eslint';
import { expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';

it('lints the repository with no error', async () => {
  const results = await new ESLint({ cwd: REPO_ROOT }).lintFiles(['.']);
  const errors = results.flatMap((r) =>
    r.messages.filter((m) => m.severity === 2).map((m) => `${r.filePath}:${m.line} ${m.message}`),
  );
  expect(errors).toEqual([]);
}, 120_000);
