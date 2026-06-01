/**
 * Toast singleton — call `toast.show(...)` from anywhere; the `<ToastHost />`
 * mounted once at the app root renders + animates each entry.
 *
 * Why a module-level singleton instead of React Context: toasts are fire-and-forget
 * UI notifications, not application state. They don't need to participate in
 * React re-render cycles for their callers; we just want a side-effect API
 * that any function (sync or async) can call. The host subscribes to the
 * notifier and rerenders only itself.
 */

export type ToastType = 'success' | 'error' | 'info' | 'warn';

export interface ToastEntry {
  id: number;
  message: string;
  type: ToastType;
  /** ms — how long to show before auto-dismissing. */
  duration: number;
}

type Listener = (entries: ToastEntry[]) => void;

let entries: ToastEntry[] = [];
const listeners: Set<Listener> = new Set();
let counter = 0;

function notify() {
  for (const l of listeners) l(entries);
}

function add(message: string, type: ToastType, duration: number): number {
  const id = ++counter;
  entries = [...entries, { id, message, type, duration }];
  notify();
  setTimeout(() => dismiss(id), duration);
  return id;
}

function dismiss(id: number) {
  const before = entries.length;
  entries = entries.filter((e) => e.id !== id);
  if (entries.length !== before) notify();
}

export const toast = {
  show:    (message: string, type: ToastType = 'info', duration = 2400) =>
    add(message, type, duration),
  success: (message: string, duration = 2200) => add(message, 'success', duration),
  error:   (message: string, duration = 3200) => add(message, 'error', duration),
  warn:    (message: string, duration = 2800) => add(message, 'warn', duration),
  info:    (message: string, duration = 2400) => add(message, 'info', duration),
  dismiss,
};

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  // Push current state immediately so a fresh subscriber sees in-flight toasts.
  l(entries);
  return () => listeners.delete(l);
}
