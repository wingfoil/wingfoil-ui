// @vitest-environment jsdom
// task-038 — the toasts of the shell (`web/src/shell/toasts.ts`, `Toasts.tsx`; D38-1, D38-2;
// ux-reference §5 *Feedback*): a success is announced politely and an error assertively (X-07.1,
// X-07.2), both regions always present; at most 3 toasts, newest last; one key replaces its previous
// toast; a success goes after 8 s unless hovered or focused; sticky toasts stay until closed.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Button, Dialog, DialogTrigger, Popover } from 'react-aria-components';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppIntlProvider } from '../../../web/src/i18n/index.js';
import {
  TOAST_DISMISS_MS,
  TOAST_LIMIT,
  dismissToast,
  toastPlacement,
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
  expect(polite()).not.toBeNull();
  expect(assertive()).not.toBeNull();
  // No status/alert role: a page keeps a single alert of its own.
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByRole('status')).toBeNull();
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
    for (const n of [1, 2, 3, 4]) showToast({ tone: 'success', title: `t${n}` });
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

// Review round 1 (R5): the limit evicts the oldest toast that is not sticky; a sticky one (a refusal,
// a failed push) leaves only by Close or by its key; with only sticky toasts a new one is added.
it('review R5 — the limit never evicts a sticky toast', () => {
  mount();
  act(() => {
    showToast({ tone: 'error', title: 'refused' });
    for (const n of [1, 2, 3]) showToast({ tone: 'success', title: `t${n}` });
  });
  expect(getToasts().map((t) => t.title)).toEqual(['refused', 't2', 't3']);
  act(() => {
    resetToasts();
    for (const n of [1, 2, 3, 4]) showToast({ tone: 'error', title: `e${n}` });
  });
  expect(getToasts().map((t) => t.title)).toEqual(['e1', 'e2', 'e3', 'e4']);
});

it('review R5 — a toast removed or replaced while it held the focus gives it to the main region', async () => {
  mount();
  act(() => void showToast({ key: 'k', tone: 'error', title: 'refused' }));
  act(() => screen.getByRole('button', { name: 'Close notification' }).focus());
  act(() => void showToast({ key: 'k', tone: 'success', title: 'done' }));
  await act(async () => {});
  expect(document.activeElement?.id).toBe('main');
  // Evicted by the limit while focused.
  act(() => {
    resetToasts();
    showToast({ tone: 'success', title: 'first' });
  });
  act(() =>
    (within(screen.getByText('first').closest('.toast') as HTMLElement).getByRole('button') as HTMLElement).focus(),
  );
  act(() => {
    for (const n of [1, 2, 3]) showToast({ tone: 'success', title: `t${n}` });
  });
  await act(async () => {});
  expect(document.activeElement?.id).toBe('main');
});

// Review round 1 (D38-1 option A): each toast is read as a whole; the regions are not atomic.
it('D38-1 — every toast is aria-atomic, the regions are not', () => {
  mount();
  act(() => {
    showToast({ tone: 'success', title: 'ok' });
    showToast({ tone: 'error', title: 'no' });
  });
  for (const t of document.querySelectorAll('.toast')) expect(t.getAttribute('aria-atomic')).toBe('true');
  expect(polite().getAttribute('aria-atomic')).toBeNull();
  expect(assertive().getAttribute('aria-atomic')).toBeNull();
});

// Review round 1 (R3): a React Aria popover hides everything outside it but its top layer.
it('review R3 — a toast raised while a popover is open is not hidden from assistive technology', async () => {
  render(
    <AppIntlProvider>
      <main id="main" tabIndex={-1}>
        <DialogTrigger>
          <Button>Open</Button>
          <Popover>
            <Dialog aria-label="A popover">Inside</Dialog>
          </Popover>
        </DialogTrigger>
      </main>
      <Toasts />
    </AppIntlProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
  await screen.findByRole('dialog', { name: 'A popover' });
  act(() => void showToast({ tone: 'success', title: 'Approved e-1' }));
  const toasts = document.querySelector('.toasts') as HTMLElement;
  expect(toasts.closest('[aria-hidden="true"]')).toBeNull();
  expect(toasts.closest('[inert]')).toBeNull();
  expect(document.querySelector('main')?.getAttribute('aria-hidden')).toBe('true');
});

// Review rounds 1 and 2 (R1, R2-1, R2-2, R2-3): out of the drawer's column — centred in the area
// between the main region's left edge (the sidebar is outside it) and the drawer, or above the
// drawer's footer when that area is too narrow; the default bottom centre without a drawer or
// without a footer yet; never taller than the room between the header and the stack's bottom.
const LAYOUT = { headerBottom: 56, mainLeft: 220 };
it.each([
  ['no drawer', { ...LAYOUT, viewport: { width: 1280, height: 720 } }, { maxHeight: 624 }],
  [
    'a drawer, room between the sidebar and it',
    { ...LAYOUT, viewport: { width: 1280, height: 720 }, drawer: { left: 800, footerTop: 650 } },
    { left: 510, maxWidth: 548, maxHeight: 624 },
  ],
  [
    'a drawer leaving less than 360 px right of the sidebar',
    { ...LAYOUT, viewport: { width: 1000, height: 720 }, drawer: { left: 520, footerTop: 650 } },
    { bottom: 78, maxHeight: 570 },
  ],
  [
    'a drawer, little room on its left (no sidebar)',
    { headerBottom: 56, mainLeft: 0, viewport: { width: 700, height: 720 }, drawer: { left: 220, footerTop: 600 } },
    { bottom: 128, maxHeight: 520 },
  ],
  [
    'a drawer over the whole viewport',
    { headerBottom: 56, mainLeft: 0, viewport: { width: 400, height: 720 }, drawer: { left: 0, footerTop: 560 } },
    { bottom: 168, maxHeight: 480 },
  ],
  [
    'a narrow drawer with no footer yet (loading, read error)',
    { headerBottom: 56, mainLeft: 0, viewport: { width: 400, height: 720 }, drawer: { left: 0 } },
    { maxHeight: 624 },
  ],
] as const)('review R1, R2 — placement with %s', (_name, layout, expected) => {
  expect(toastPlacement(layout)).toEqual(expected);
});

// Review round 2 (R2-3): a stack taller than its room scrolls; only then does it take the pointer.
it('review R2-3 — an overflowing stack becomes a scroll container that takes the pointer', () => {
  const sizes = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(900);
  const client = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
  try {
    mount();
    const stack = document.querySelector('.toasts') as HTMLElement;
    expect(stack.classList.contains('toasts-overflow')).toBe(false);
    act(() => {
      for (const n of [1, 2, 3]) showToast({ tone: 'error', title: `e${n}` });
    });
    expect(stack.classList.contains('toasts-overflow')).toBe(true);
    act(() => resetToasts());
    expect(stack.classList.contains('toasts-overflow')).toBe(false);
  } finally {
    sizes.mockRestore();
    client.mockRestore();
  }
});
