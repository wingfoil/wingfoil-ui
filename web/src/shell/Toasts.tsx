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
 * open the stack stays out of its column and off the sidebar (`toastPlacement`, reviews R1, R2-2);
 * it never grows taller than its room and scrolls when sticky toasts outgrow it (R2-3). Each toast has a Close
 * button; a success that is not sticky goes after `TOAST_DISMISS_MS`, its timer paused while it is
 * hovered or holds the focus. The focus is never moved to a toast; a toast removed while it held the
 * focus (closed, evicted or replaced) gives it to the main region (review R5).
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
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

/**
 * Where the stack goes now (`toastPlacement`), followed while toasts are shown (review R2-4): the
 * drawer and its footer slot are watched with a `ResizeObserver` (a footer that grows, a resized
 * reason field), the shell root with a `childList` observer (a drawer or a footer that appears or
 * goes); the window's resize too. All are disconnected when no toast is left.
 */
function usePlacement(active: boolean, stack: RefObject<HTMLDivElement | null>): ToastPlacement | undefined {
  const [placement, setPlacement] = useState<ToastPlacement>();
  useLayoutEffect(() => {
    if (!active) return;
    const shell = stack.current?.parentElement ?? document.body;
    let watched: Element[] = [];
    const sizes = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => place());
    function place(): void {
      const drawer = shell.querySelector('.drawer') ?? undefined;
      const footer = drawer?.querySelector('.element-footer-slot') ?? undefined;
      const drawerHeader = drawer?.querySelector('.drawer-header') ?? undefined;
      const targets = [drawer, footer].filter((e): e is Element => e !== undefined);
      if (sizes && (targets.length !== watched.length || targets.some((t, k) => t !== watched[k]))) {
        sizes.disconnect();
        for (const t of targets) sizes.observe(t);
        watched = targets;
      }
      const next = toastPlacement({
        viewport: { width: window.innerWidth, height: window.innerHeight },
        headerBottom: document.querySelector('.shell-header')?.getBoundingClientRect().bottom ?? 0,
        mainLeft: document.getElementById('main')?.getBoundingClientRect().left ?? 0,
        ...(drawer
          ? {
              drawer: {
                left: drawer.getBoundingClientRect().left,
                ...(drawerHeader ? { headerBottom: drawerHeader.getBoundingClientRect().bottom } : {}),
                ...(footer ? { footerTop: footer.getBoundingClientRect().top } : {}),
              },
            }
          : {}),
      });
      setPlacement((prev) =>
        prev &&
        prev.left === next.left &&
        prev.maxWidth === next.maxWidth &&
        prev.bottom === next.bottom &&
        prev.maxHeight === next.maxHeight
          ? prev
          : next,
      );
    }
    place();
    window.addEventListener('resize', place);
    const children = new MutationObserver(() => place());
    children.observe(shell, { childList: true, subtree: true });
    return () => {
      window.removeEventListener('resize', place);
      children.disconnect();
      sizes?.disconnect();
    };
  }, [active, stack]);
  return active ? placement : undefined;
}

/** The toasts of the shell. */
export function Toasts(): ReactNode {
  const toasts = useToasts();
  const stack = useRef<HTMLDivElement>(null);
  const placement = usePlacement(toasts.length > 0, stack);
  // Taller than its room (only sticky refusals left, R2-3): the stack scrolls, takes the pointer
  // (`toasts-overflow`) and shows its newest toast, the last one. A DOM measure, applied to the DOM.
  useLayoutEffect(() => {
    const el = stack.current;
    if (!el) return;
    const over = toasts.length > 0 && el.scrollHeight > el.clientHeight;
    el.classList.toggle('toasts-overflow', over);
    if (over) el.scrollTop = el.scrollHeight;
  }, [toasts, placement]);
  const style: CSSProperties = {
    ...(placement?.left !== undefined ? { left: placement.left } : {}),
    ...(placement?.maxWidth !== undefined ? { maxWidth: placement.maxWidth } : {}),
    ...(placement?.bottom !== undefined ? { bottom: placement.bottom } : {}),
    ...(placement !== undefined ? { maxHeight: placement.maxHeight } : {}),
  };
  return (
    <div ref={stack} className="toasts" data-react-aria-top-layer="true" style={style}>
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
