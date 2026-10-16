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

/** The bell of the notifications button (its accessible name says what it is). */
export function Bell(): ReactNode {
  return (
    <svg className="bell-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M4 11.5V7a4 4 0 0 1 8 0v4.5l1.2 1.2H2.8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M6.5 14a1.6 1.6 0 0 0 3 0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** The ⓘ of a button that shows more about a line (its accessible name says what it shows). */
export function InfoSign(): ReactNode {
  return (
    <svg className="info-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 7.2v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="4.9" r="0.9" fill="currentColor" />
    </svg>
  );
}
