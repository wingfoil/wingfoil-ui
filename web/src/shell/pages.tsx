/** Full pages of the shell: the lost session (decision W3-7) and the unknown path. */
import type { ReactNode } from 'react';
import { Link } from 'react-aria-components';
import { FormattedMessage } from 'react-intl';
import { TITLES, usePageTitle } from './page-title.js';

/** The page's session is gone (console stopped or restarted): open the terminal's URL again. */
export function SessionLostPage(): ReactNode {
  usePageTitle(TITLES.sessionLost);
  return (
    <main id="main" className="shell-main" tabIndex={-1}>
      <div className="page">
        <h1>
          <FormattedMessage id="shell.session.lost.title" />
        </h1>
        <p className="page-intro">
          <FormattedMessage id="shell.session.lost.body" />
        </p>
      </div>
    </main>
  );
}

/** A path no route knows. */
export function NotFoundPage(): ReactNode {
  usePageTitle(TITLES.notFound);
  return (
    <main id="main" className="shell-main" tabIndex={-1}>
      <div className="page">
        <h1>
          <FormattedMessage id="shell.notFound.title" />
        </h1>
        <p>
          <Link href="/">
            <FormattedMessage id="shell.notFound.back" />
          </Link>
        </p>
      </div>
    </main>
  );
}
