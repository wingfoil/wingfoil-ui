// @vitest-environment jsdom
// spec-008 §4: an API error rendered from the catalogue, the tool output verbatim.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ApiError } from '../../../web/src/api/client.js';
import { AppIntlProvider } from '../../../web/src/i18n/index.js';
import { ErrorText } from '../../../web/src/shell/ErrorText.js';

afterEach(() => cleanup());

it('renders the code message with the detail', () => {
  render(
    <AppIntlProvider>
      <ErrorText error={new ApiError(422, 'folder-not-found', 'ignored', { path: '/tmp/does-not-exist' })} />
    </AppIntlProvider>,
  );
  expect(screen.getByText('Folder not found: /tmp/does-not-exist')).toBeTruthy();
  expect(screen.queryByText('ignored')).toBeNull();
});

it('renders the CLI refusal inside its frame, verbatim', () => {
  render(
    <AppIntlProvider>
      <ErrorText error={new ApiError(422, 'cli-refused', 'Error: <sard_ref> is required', undefined)} />
    </AppIntlProvider>,
  );
  expect(screen.getByText('WingFoil refused the action:')).toBeTruthy();
  expect(screen.getByText('Error: <sard_ref> is required').tagName).toBe('PRE');
});

// task-040 review round 2 (S2-2, S2-6): a tool's verbatim text is shown in logical order, left to
// right, and clipped to its box — the rule lives in the stylesheet (`web/src/theme/base.css`).
it('the verbatim block is shown left to right with no bidi reordering, clipped', async () => {
  const { readFile } = await import('node:fs/promises');
  const { REPO_ROOT } = await import('../../harness/cli.js');
  const css = await readFile(`${REPO_ROOT}/web/src/theme/base.css`, 'utf8');
  const rule = /\n\.verbatim \{([^}]*)\}/.exec(css)?.[1] ?? '';
  expect(rule).toMatch(/direction: ltr;/);
  expect(rule).toMatch(/unicode-bidi: bidi-override;/);
  expect(rule).toMatch(/overflow: hidden;/);
  // Review round 3 (R3-1): a long token wraps instead of being clipped.
  expect(rule).toMatch(/overflow-wrap: anywhere;/);
});

// task-040 review round 3 (S3-2): a git-derived name a catalogue text quotes (the files in the way)
// is shown in its own left-to-right span, no bidi reordering — the same rule as the verbatim block.
it('the files of local-changes-in-the-way are shown in a git-name span', async () => {
  render(
    <AppIntlProvider>
      <ErrorText error={new ApiError(409, 'local-changes-in-the-way', 'x', { files: ['docs/a\\u202eb.md', 'c.md'] })} />
    </AppIntlProvider>,
  );
  const name = document.querySelector('.git-name');
  expect(name?.textContent).toBe('a\\u202eb.md and c.md');
  const { readFile } = await import('node:fs/promises');
  const { REPO_ROOT } = await import('../../harness/cli.js');
  const css = await readFile(`${REPO_ROOT}/web/src/theme/base.css`, 'utf8');
  const rule = /\n\.git-name \{([^}]*)\}/.exec(css)?.[1] ?? '';
  expect(rule).toMatch(/unicode-bidi: bidi-override;/);
});
