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
