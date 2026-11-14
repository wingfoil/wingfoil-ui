// @vitest-environment jsdom
// task-064 (D64-6, Q4 (a)): the shared ui.yaml warning — "ui.yaml ignored: {failure}" as a static
// note when the server ignored the file, nothing for a valid file or none; the failure as served.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { AppIntlProvider } from '../../../web/src/i18n/index.js';
import { UiYamlWarning } from '../../../web/src/shell/UiYamlWarning.js';

/** The ui.yaml warning (a static paragraph, D64-6). */
function warning(): HTMLElement {
  const el = document.querySelector<HTMLElement>('.ui-yaml-warning');
  if (!el) throw new Error('no ui.yaml warning');
  return el;
}

afterEach(() => cleanup());

it('an ignored file: the note with the failure as served', () => {
  render(
    <AppIntlProvider>
      <UiYamlWarning
        status={{
          source: 'ignored',
          warning: {
            code: 'ui-config-ignored',
            failure: 'progress.mode must be sequence or flow (found \\u202espiral)',
          },
        }}
      />
    </AppIntlProvider>,
  );
  expect(warning().textContent).toBe('ui.yaml ignored: progress.mode must be sequence or flow (found \\u202espiral)');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(warning().getAttribute('role')).toBeNull();
});

it.each([[{ source: 'file' as const }], [{ source: 'none' as const }], [undefined]])('nothing for %j', (status) => {
  const { container } = render(
    <AppIntlProvider>
      <UiYamlWarning status={status} />
    </AppIntlProvider>,
  );
  expect(container.textContent).toBe('');
});
