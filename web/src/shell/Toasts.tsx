/**
 * The toast regions of the shell (task-038, D38-1, D38-2; ux-reference §5 *Feedback*): rendered
 * once by `Shell`, at the bottom centre of the viewport. Two live regions are always present, so a
 * toast added later is announced: successes in an `aria-live="polite"` region (X-07.1), errors in an
 * `aria-live="assertive"` one (X-07.2). They carry no `status` / `alert` role: an always-present
 * empty alert would stand beside every page's own alert (one per view, as the views expect). Each toast has a Close button; a success that is not sticky
 * goes after `TOAST_DISMISS_MS`, its timer paused while it is hovered or holds the focus. The focus
 * is never moved to a toast; closing one that held it moves the focus to the main region.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { Cross } from './icons.js';
import { TOAST_DISMISS_MS, dismissToast, useToasts, type Toast } from './toasts.js';
import './toasts.css';

/** The toasts of the shell. */
export function Toasts(): ReactNode {
  const toasts = useToasts();
  return (
    <div className="toasts">
      <div className="toast-list" aria-live="polite">
        {toasts
          .filter((t) => t.tone === 'success')
          .map((t) => (
            <ToastItem key={t.id} toast={t} />
          ))}
      </div>
      <div className="toast-list" aria-live="assertive">
        {toasts
          .filter((t) => t.tone === 'error')
          .map((t) => (
            <ToastItem key={t.id} toast={t} />
          ))}
      </div>
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }): ReactNode {
  const intl = useIntl();
  const root = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;

  useEffect(() => {
    if (toast.sticky || paused) return;
    const timer = setTimeout(() => dismissToast(toast.id), TOAST_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, toast.sticky, paused]);

  const close = () => {
    const hadFocus = root.current?.contains(document.activeElement) ?? false;
    dismissToast(toast.id);
    if (hadFocus) document.getElementById('main')?.focus();
  };

  return (
    <div
      ref={root}
      className={`toast toast-${toast.tone}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="toast-content">
        <p className="toast-title">{toast.title}</p>
        {toast.body}
      </div>
      <button
        type="button"
        className="button button-quiet toast-close"
        aria-label={intl.formatMessage({ id: 'shell.toast.close' })}
        onClick={close}
      >
        <Cross />
      </button>
    </div>
  );
}
