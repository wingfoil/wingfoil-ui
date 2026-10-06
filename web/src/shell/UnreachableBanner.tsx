/**
 * The non-modal banner shown while the console cannot be reached (decision W3-12): the event
 * stream has not been open for 10 s. It disappears by itself when the stream reconnects (which
 * refetches everything).
 */
import type { ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useReachability } from '../api/events.js';

/** The banner, or nothing while the console is reachable. */
export function UnreachableBanner(): ReactNode {
  const intl = useIntl();
  const reachability = useReachability();
  if (reachability === 'reachable') return null;
  return (
    <section className="shell-warnings" aria-label={intl.formatMessage({ id: 'shell.unreachable.label' })}>
      <div className="warning warning-danger" role="alert">
        <p>
          <FormattedMessage id="shell.unreachable.body" />
        </p>
      </div>
    </section>
  );
}
