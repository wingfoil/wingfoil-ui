/**
 * The toasts of the shell (task-038, D38-1, D38-2; ux-reference §5 *Feedback*): the result of an
 * action — a success announced politely, a refusal assertively (X-07.1, X-07.2) — rendered by one
 * `<Toasts />` in the shell (`Toasts.tsx`). A module store, so that a mutation's own callbacks can
 * raise a toast after the component that started it is gone (D38-11), with no provider around the
 * shell (RP-55). Reused by task-040 (push refusals).
 *
 * At most {@link TOAST_LIMIT} toasts, newest last (the oldest goes); a toast with the `key` of one
 * already shown replaces it (one result per element); a success goes after {@link TOAST_DISMISS_MS}
 * unless `sticky` (the timer is paused while it is hovered or focused, `Toasts.tsx`); an error is
 * always sticky. The content is React nodes, rendered inside the application's providers.
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
  const kept = input.key === undefined ? toasts : toasts.filter((t) => t.key !== input.key);
  set([...kept, toast].slice(-TOAST_LIMIT));
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

/** Remove every toast (tests). */
export function resetToasts(): void {
  set([]);
}
