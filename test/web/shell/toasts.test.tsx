// @vitest-environment jsdom
// task-038 — the toasts of the shell (`web/src/shell/toasts.ts`, `Toasts.tsx`; D38-1, D38-2;
// ux-reference §5 *Feedback*): a success is announced politely and an error assertively (X-07.1,
// X-07.2), both regions always present; at most 3 toasts, newest last; one key replaces its previous
// toast; a success goes after 8 s unless hovered or focused; sticky toasts stay until closed.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppIntlProvider } from '../../../web/src/i18n/index.js';
import {
  TOAST_DISMISS_MS,
  TOAST_LIMIT,
  dismissToast,
  getToasts,
  resetToasts,
  showToast,
} from '../../../web/src/shell/toasts.js';
import { Toasts } from '../../../web/src/shell/Toasts.js';

function mount() {
  return render(
    <AppIntlProvider>
      <main id="main" tabIndex={-1} />
      <Toasts />
    </AppIntlProvider>,
  );
}

const polite = () => document.querySelector('.toasts [aria-live="polite"]') as HTMLElement;
const assertive = () => document.querySelector('.toasts [aria-live="assertive"]') as HTMLElement;

beforeEach(() => resetToasts());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('X-07.1, X-07.2 — the polite and the assertive regions are present before any toast', () => {
  mount();
  expect(polite().getAttribute('role')).toBe('status');
  expect(assertive().getAttribute('role')).toBe('alert');
  expect(polite().textContent).toBe('');
  expect(assertive().textContent).toBe('');
});

it('a success goes into the polite region, an error into the assertive one', () => {
  mount();
  act(() => {
    showToast({ tone: 'success', title: 'Approved e-1' });
    showToast({ tone: 'error', title: 'Reject of e-2 not done' });
  });
  expect(within(polite()).getByText('Approved e-1')).toBeTruthy();
  expect(within(assertive()).getByText('Reject of e-2 not done')).toBeTruthy();
  expect(within(polite()).queryByText('Reject of e-2 not done')).toBeNull();
});

it('at most 3 toasts, newest last; the oldest goes', () => {
  mount();
  act(() => {
    for (const n of [1, 2, 3, 4]) showToast({ tone: 'success', title: `t${n}`, sticky: true });
  });
  expect(TOAST_LIMIT).toBe(3);
  expect(getToasts().map((t) => t.title)).toEqual(['t2', 't3', 't4']);
  expect([...polite().querySelectorAll('.toast-title')].map((e) => e.textContent)).toEqual(['t2', 't3', 't4']);
});

it('a new toast with the same key replaces the previous one', () => {
  mount();
  act(() => {
    showToast({ key: 'write:p:e', tone: 'error', title: 'refused' });
    showToast({ key: 'other', tone: 'success', title: 'other' });
    showToast({ key: 'write:p:e', tone: 'success', title: 'done' });
  });
  expect(getToasts().map((t) => t.title)).toEqual(['other', 'done']);
  expect(assertive().textContent).toBe('');
});

it('a success goes after 8 s; not while hovered or focused; a sticky toast stays', () => {
  vi.useFakeTimers();
  mount();
  act(() => {
    showToast({ tone: 'success', title: 'goes' });
    showToast({ tone: 'success', title: 'hovered' });
    showToast({ tone: 'success', title: 'sticky', sticky: true });
  });
  const hovered = screen.getByText('hovered').closest('.toast') as HTMLElement;
  fireEvent.mouseEnter(hovered);
  act(() => void vi.advanceTimersByTime(TOAST_DISMISS_MS + 10));
  expect(getToasts().map((t) => t.title)).toEqual(['hovered', 'sticky']);
  fireEvent.mouseLeave(hovered);
  // Focus inside pauses it too.
  const close = within(hovered).getByRole('button', { name: 'Close notification' });
  act(() => close.focus());
  act(() => void vi.advanceTimersByTime(TOAST_DISMISS_MS + 10));
  expect(getToasts().map((t) => t.title)).toEqual(['hovered', 'sticky']);
  act(() => close.blur());
  act(() => void vi.advanceTimersByTime(TOAST_DISMISS_MS + 10));
  expect(getToasts().map((t) => t.title)).toEqual(['sticky']);
});

it('an error is sticky whatever its input says', () => {
  vi.useFakeTimers();
  mount();
  act(() => void showToast({ tone: 'error', title: 'refused' }));
  act(() => void vi.advanceTimersByTime(TOAST_DISMISS_MS * 3));
  expect(getToasts().map((t) => t.title)).toEqual(['refused']);
});

it('Close removes the toast; the focus it had goes to the main region', () => {
  mount();
  let id = 0;
  act(() => void (id = showToast({ tone: 'error', title: 'refused', body: <p>why</p> })));
  expect(screen.getByText('why')).toBeTruthy();
  const close = screen.getByRole('button', { name: 'Close notification' });
  act(() => close.focus());
  act(() => close.click());
  expect(getToasts()).toEqual([]);
  expect(document.activeElement?.id).toBe('main');
  // Dismissing an id that is gone is a no-op.
  act(() => dismissToast(id));
  expect(getToasts()).toEqual([]);
});
