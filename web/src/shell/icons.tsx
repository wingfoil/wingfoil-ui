/** Decorative icons of the shell: hidden from assistive technology, coloured by `currentColor`. */
import type { ReactNode } from 'react';

/** The ▾ of a menu button. */
export function Chevron(): ReactNode {
  return (
    <svg className="chevron" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** The × of a dismiss or close button. */
export function Cross(): ReactNode {
  return (
    <svg className="chevron" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      <path d="M2 2 8 8M8 2 2 8" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** The warning sign of a read-only notice (the text says it all: the icon is not the only signal). */
export function WarningSign(): ReactNode {
  return (
    <svg className="notice-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 6v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="12" r="0.9" fill="currentColor" />
    </svg>
  );
}
