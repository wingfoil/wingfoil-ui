/**
 * The web message catalogue (spec-008 §1): English only in the MVP. Every UI string — visible text,
 * accessible names, live announcements, the page title — is a message of `en.json`, referenced by
 * its explicit id; the text is never written in the code (no `defaultMessage`).
 */
import type { ReactNode } from 'react';
import { IntlProvider } from 'react-intl';
import en from './en.json' with { type: 'json' };

/** The English catalogue. */
export const MESSAGES: Readonly<Record<MessageId, string>> = en;

/**
 * Id of a message of the catalogue. Ids written in components are checked by the catalogue check
 * and `wfui/catalogue-placeholders` (react-intl's global id typing would also bind the server's
 * `@formatjs/intl`, whose catalogue is another one).
 */
export type MessageId = keyof typeof en;

/** Props of {@link AppIntlProvider}. */
export interface AppIntlProviderProps {
  /** Another catalogue with the same ids (tests: the key catalogue of spec-008 §6). */
  messages?: Readonly<Record<MessageId, string>>;
  children: ReactNode;
}

/** The locale of the catalogue, also given to React Aria for its own strings (W5-1). */
export const CATALOGUE_LOCALE = 'en';

/** Provides the catalogue to the application (locale {@link CATALOGUE_LOCALE}). */
export function AppIntlProvider({ messages = MESSAGES, children }: AppIntlProviderProps): ReactNode {
  return (
    <IntlProvider locale={CATALOGUE_LOCALE} defaultLocale={CATALOGUE_LOCALE} messages={messages}>
      {children}
    </IntlProvider>
  );
}
