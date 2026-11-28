// @vitest-environment jsdom
// task-085 R3-F2 — the shared completion explanation keeps each returned reference's identity across
// a refresh: replacing or removing references leaves no stale entry and raises no duplicate-key warning.
import type { CompletionFigure } from '@wingfoil-ui/contracts';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AppIntlProvider } from '../../../web/src/i18n/index.js';
import { CompletionExplanation } from '../../../web/src/progress/Completion.js';

afterEach(cleanup);

const shown = (references: { id: string; element: boolean; percent: number }[]): CompletionFigure =>
  ({
    state: 'shown',
    value: 0,
    percent: 0,
    references: references.map((r) => ({ ...r, done: 0, total: 1 })),
    referencesCount: references.length,
    ids: [],
  }) as unknown as CompletionFigure;

const entries = (root: Element): string[] =>
  [...root.querySelectorAll('.progress-reference')].map((e) => e.textContent ?? '');

it('replacement and removal on refresh leave exactly the returned entries, with no duplicate key', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const view = (figure: CompletionFigure): React.JSX.Element => (
    <AppIntlProvider>
      <CompletionExplanation figure={figure} />
    </AppIntlProvider>
  );
  const first = shown([
    { id: 'task-001-shared', element: true, percent: 0 },
    { id: 'US-1', element: false, percent: 50 },
  ]);
  const { container, rerender } = render(view(first));
  expect(entries(container)).toHaveLength(2);
  rerender(
    view(
      shown([
        { id: 'task-004-new', element: true, percent: 10 },
        { id: 'task-005-new', element: false, percent: 20 },
      ]),
    ),
  );
  expect(entries(container).join('|')).toContain('task-004-new');
  expect(entries(container).join('|')).toContain('task-005-new');
  expect(entries(container).join('|')).not.toContain('task-001-shared');
  expect(entries(container)).toHaveLength(2);
  rerender(view(shown([{ id: 'task-005-new', element: false, percent: 20 }])));
  expect(entries(container)).toHaveLength(1);
  const duplicate = error.mock.calls.filter((c) => String(c[0]).includes('same key'));
  expect(duplicate).toEqual([]);
  error.mockRestore();
});
