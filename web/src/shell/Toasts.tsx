/**
 * The toast regions of the shell (task-038, D38-1, D38-2; ux-reference §5 *Feedback*): rendered
 * once by `Shell`, at the bottom centre of the viewport. Two live regions are always present, so a
 * toast added later is announced: successes in an `aria-live="polite"` region (X-07.1), errors in an
 * `aria-live="assertive"` one (X-07.2). They carry no `status` / `alert` role: an always-present
 * empty alert would stand beside every page's own alert (one per view, as the views expect); each
 * toast is `aria-atomic`, read as a whole (review round 1, D38-1 option A).
 *
 * The root is part of React Aria's top layer (`data-react-aria-top-layer`), so a toast raised while
 * a popover hides the rest of the page is still announced (review R3). While the element panel is
 * open the stack stays out of its column (`toastPlacement`, review R1). Each toast has a Close
 * button; a success that is not sticky goes after `TOAST_DISMISS_MS`, its timer paused while it is
 * hovered or holds the focus. The focus is never moved to a toast; a toast removed while it held the
 * focus (closed, evicted or replaced) gives it to the main region (review R5).
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { Cross } from './icons.js';
import {
  TOAST_DISMISS_MS,
  dismissToast,
  toastPlacement,
  useToasts,
  type Toast,
  type ToastPlacement,
} from './toasts.js';
import './toasts.css';

/** Where the stack goes now, followed while toasts are shown (drawer opened, closed, resized). */
function usePlacement(active: boolean): ToastPlacement {
  const [placement, setPlacement] = useState<ToastPlacement>({});
  useLayoutEffect(() => {
    if (!active) return;
    const place = () => {
      const drawer = document.querySelector('.drawer');
      const footer = drawer?.querySelector('.element-footer-slot');
      const next = toastPlacement(
        { width: window.innerWidth, height: window.innerHeight },
        drawer
          ? { left: drawer.getBoundingClientRect().left, footerTop: (footer ?? drawer).getBoundingClientRect().top }
          : undefined,
      );
      setPlacement((prev) =>
        prev.left === next.left && prev.maxWidth === next.maxWidth && prev.bottom === next.bottom ? prev : next,
      );
    };
    place();
    window.addEventListener('resize', place);
    const mutations = new MutationObserver(place);
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener('resize', place);
      mutations.disconnect();
    };
  }, [active]);
  return placement;
}

/** The toasts of the shell. */
export function Toasts(): ReactNode {
  const toasts = useToasts();
  const placement = usePlacement(toasts.length > 0);
  const style: CSSProperties = {
    ...(placement.left !== undefined ? { left: placement.left } : {}),
    ...(placement.maxWidth !== undefined ? { maxWidth: placement.maxWidth } : {}),
    ...(placement.bottom !== undefined ? { bottom: placement.bottom } : {}),
  };
  return (
    <div className="toasts" data-react-aria-top-layer="true" style={style}>
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

  // Removed while it held the focus (closed, evicted, replaced): the focus goes to the main region
  // (a layout cleanup runs while the node is still in the document, before the focus is lost).
  useLayoutEffect(() => {
    const node = root.current;
    return () => {
      if (node?.contains(document.activeElement)) document.getElementById('main')?.focus();
    };
  }, []);

  return (
    <div
      ref={root}
      className={`toast toast-${toast.tone}`}
      aria-atomic="true"
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
        onClick={() => dismissToast(toast.id)}
      >
        <Cross />
      </button>
    </div>
  );
}
