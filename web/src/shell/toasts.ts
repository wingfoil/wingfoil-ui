/**
 * The toasts of the shell (task-038, D38-1, D38-2; ux-reference §5 *Feedback*): the result of an
 * action — a success announced politely, a refusal assertively (X-07.1, X-07.2) — rendered by one
 * `<Toasts />` in the shell (`Toasts.tsx`). A module store, so that a mutation's own callbacks can
 * raise a toast after the component that started it is gone (D38-11), with no provider around the
 * shell (RP-55). Reused by task-040 (push refusals).
 *
 * At most {@link TOAST_LIMIT} toasts, newest last: a new one evicts the oldest toast that is not
 * sticky; a sticky one (a refusal, a failed push) leaves only by Close or by its key, so with only
 * sticky toasts shown a new one is added anyway (review R5). A toast with the `key` of one already
 * shown replaces it (one result per element); a success goes after {@link TOAST_DISMISS_MS} unless
 * `sticky` (the timer is paused while it is hovered or focused, `Toasts.tsx`); an error is always
 * sticky. The content is React nodes, rendered inside the application's providers.
 */
import { useSyncExternalStore, type ReactNode } from 'react';

/** The tone of a toast: its live region and its colour. */
export type ToastTone = 'success' | 'error';

/** What {@link showToast} takes. */
export interface ToastInput {
  /** A toast shown with the same key is replaced (e.g. `write:<pid>:<eid>`). */
  key?: string;
  tone: ToastTone;
  title: ReactNode;
  body?: ReactNode;
  /** Stays until closed (an error always does). */
  sticky?: boolean;
}

/** A toast shown. */
export interface Toast extends ToastInput {
  id: number;
}

/** Most toasts shown at once. */
export const TOAST_LIMIT = 3;

/** Time a success toast stays (not hovered, not focused). */
export const TOAST_DISMISS_MS = 8_000;

let toasts: readonly Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function set(next: readonly Toast[]): void {
  toasts = next;
  for (const l of listeners) l();
}

/** Show a toast; returns its id. */
export function showToast(input: ToastInput): number {
  const id = nextId++;
  const toast: Toast = { ...input, ...(input.tone === 'error' ? { sticky: true } : {}), id };
  const next = [...(input.key === undefined ? toasts : toasts.filter((t) => t.key !== input.key)), toast];
  while (next.length > TOAST_LIMIT) {
    const oldest = next.findIndex((t) => !t.sticky);
    if (oldest < 0) break;
    next.splice(oldest, 1);
  }
  set(next);
  return id;
}

/** Remove the toast `id` (nothing when it is gone). */
export function dismissToast(id: number): void {
  if (toasts.some((t) => t.id === id)) set(toasts.filter((t) => t.id !== id));
}

/** The toasts shown, oldest first. */
export function getToasts(): readonly Toast[] {
  return toasts;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The toasts shown, as React state. */
export function useToasts(): readonly Toast[] {
  return useSyncExternalStore(subscribe, getToasts, getToasts);
}

/** The placement of the stack, inline (reviews R1, R2): out of the drawer's column. */
export interface ToastPlacement {
  /** Centre of the stack (px from the left of the viewport). */
  left?: number;
  maxWidth?: number;
  /** Distance of the stack from the bottom of the viewport (px). */
  bottom?: number;
  /** Most height of the stack (px): it scrolls beyond (R2-3). */
  maxHeight: number;
}

/** What the placement is computed from (px, viewport coordinates). */
export interface ToastLayout {
  viewport: { width: number; height: number };
  /** Bottom edge of the shell header: the stack never goes above it. */
  headerBottom: number;
  /** Left edge of the main region (`#main`; the sidebar is left of it), 0 without one. */
  mainLeft: number;
  /** The element panel, when open: its left edge and, once rendered, its footer's top edge. */
  drawer?: { left: number; footerTop?: number };
}

/** The narrowest area between the main region's left edge and the drawer for the stack (px). */
export const TOAST_MIN_ROOM = 360;

/** The stylesheet's distance of the stack from the bottom (`--space-6`), and its top margin. */
const DEFAULT_BOTTOM = 24;
const TOP_MARGIN = 16;

/**
 * Where the stack goes (reviews R1, R2): without a drawer, or with a drawer that has no footer yet
 * (loading, a read error), the stylesheet's bottom centre; with one, centred between the main
 * region's left edge and the drawer when that area is at least {@link TOAST_MIN_ROOM} wide (the
 * sidebar, with the Git status at its foot, stays clear), otherwise just above the drawer's footer
 * (never over its actions). Never taller than the room between the header and its bottom.
 */
export function toastPlacement(layout: ToastLayout): ToastPlacement {
  const { viewport, headerBottom, mainLeft, drawer } = layout;
  const maxHeight = (bottom: number) => viewport.height - bottom - headerBottom - TOP_MARGIN;
  if (drawer === undefined) return { maxHeight: maxHeight(DEFAULT_BOTTOM) };
  const room = drawer.left - mainLeft;
  if (room >= TOAST_MIN_ROOM) {
    return { left: (mainLeft + drawer.left) / 2, maxWidth: room - 32, maxHeight: maxHeight(DEFAULT_BOTTOM) };
  }
  if (drawer.footerTop === undefined) return { maxHeight: maxHeight(DEFAULT_BOTTOM) };
  const bottom = viewport.height - drawer.footerTop + 8;
  return { bottom, maxHeight: maxHeight(bottom) };
}

/** Remove every toast (tests). */
export function resetToasts(): void {
  set([]);
}
