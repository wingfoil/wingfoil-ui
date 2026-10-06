/**
 * Warnings about the local state for the shell (spec-006 §4): `GET /api/server` sends web-catalogue
 * keys with their arguments (spec-008 §5). Each is dismissible for the life of the page; an
 * unknown key is not shown (the server is never trusted with browser text).
 */
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Button } from 'react-aria-components';
import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { serverQuery } from '../api/queries.js';
import { Cross } from './icons.js';

/** The warning keys the server may send (contracts `StateWarning`). */
const STATE_WARNINGS: Readonly<Record<string, MessageDescriptor>> = defineMessages({
  'state.corruptKept': { id: 'state.corruptKept' },
  'state.newerVersion': { id: 'state.newerVersion' },
});

/** Identity of a warning: its key and arguments (a new warning is shown even after a dismissal). */
function warningId(warning: { key: string; args: Record<string, string> }): string {
  return `${warning.key} ${JSON.stringify(warning.args)}`;
}

/** The shell's warnings region, absent when there is nothing to show. */
export function ShellWarnings(): ReactNode {
  const intl = useIntl();
  const { data } = useQuery(serverQuery());
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const shown = (data?.warnings ?? []).flatMap((warning) =>
    Object.hasOwn(STATE_WARNINGS, warning.key) && !dismissed.has(warningId(warning))
      ? [{ id: warningId(warning), descriptor: STATE_WARNINGS[warning.key]!, args: warning.args }]
      : [],
  );
  if (shown.length === 0) return null;
  return (
    <section className="shell-warnings" aria-label={intl.formatMessage({ id: 'shell.warnings.label' })}>
      {shown.map(({ id, descriptor, args }) => (
        <div key={id} className="warning" role="status">
          <p>{intl.formatMessage(descriptor, args)}</p>
          <Button
            className="button"
            aria-label={intl.formatMessage({ id: 'shell.warnings.dismiss' })}
            onPress={() => setDismissed(new Set([...dismissed, id]))}
          >
            <Cross />
          </Button>
        </div>
      ))}
    </section>
  );
}
