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
