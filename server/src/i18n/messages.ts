/**
 * The server message catalogue (spec-008 §5): the launcher's terminal lines, formatted with
 * `@formatjs/intl` in English. Texts shown in the browser never come from here.
 */
import { createIntl, createIntlCache } from '@formatjs/intl';
import { readFileSync } from 'node:fs';

const catalogue = JSON.parse(readFileSync(new URL('../../src/i18n/en.json', import.meta.url), 'utf8')) as Record<
  string,
  string
>;

const intl = createIntl(
  {
    locale: 'en',
    messages: catalogue,
    onError: (error) => {
      throw error;
    },
  },
  createIntlCache(),
);

/**
 * Format the catalogue message `key`. Numbers are passed as text: they are ports and counts,
 * never quantities to group (`54321`, not `54,321`).
 */
export function message(key: string, args: Record<string, string | number> = {}): string {
  if (!(key in catalogue)) throw new Error(`no server message ${key}`);
  const values = Object.fromEntries(Object.entries(args).map(([k, v]) => [k, String(v)]));
  // Terminal text: no rich-text tags, so `<n>` in the synopsis stays literal.
  return intl.formatMessage({ id: key }, values, { ignoreTag: true });
}
