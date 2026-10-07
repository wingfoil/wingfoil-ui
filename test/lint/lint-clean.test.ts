// dev-loop `refactor` gate `lint.clean`: ESLint reports no error on the repository.
import { ESLint } from 'eslint';
import { expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { HEAVY_MS } from '../harness/load.js';

// The whole repository in one test: sized for the worst measured external load (bug-004).
it(
  'lints the repository with no error',
  async () => {
    const results = await new ESLint({ cwd: REPO_ROOT }).lintFiles(['.']);
    const errors = results.flatMap((r) =>
      r.messages.filter((m) => m.severity === 2).map((m) => `${r.filePath}:${m.line} ${m.message}`),
    );
    expect(errors).toEqual([]);
  },
  HEAVY_MS,
);
