/**
 * The global shell (ux-reference §2–§3): skip link, header (home link and project switcher), the
 * unreachable-console banner (W3-12) and the shell warnings, then the page of the current route.
 * The header's other parts — context crumb, ⌘K, role view, notifications, user — arrive with their
 * tasks (task-016 for identity and role view). A lost session replaces the page with the
 * lost-session notice and unmounts everything else, the Add project dialog included (W3-7).
 */
import { Link, Outlet } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { FormattedMessage } from 'react-intl';
import { useSessionStatus } from '../session/session.js';
import { AddProjectProvider } from './add-project.js';
import { SessionLostPage } from './pages.js';
import { ProjectSwitcher } from './ProjectSwitcher.js';
import { ShellWarnings } from './ShellWarnings.js';
import { UnreachableBanner } from './UnreachableBanner.js';

function Header({ children }: { children?: ReactNode }): ReactNode {
  return (
    <>
      <a className="skip-link" href="#main">
        <FormattedMessage id="a11y.skipToContent" />
      </a>
      <header className="shell-header">
        <Link to="/" className="shell-home">
          <img src="/wingfoil-mark.svg" alt="" />
          <FormattedMessage id="shell.productName" />
        </Link>
        {children}
      </header>
    </>
  );
}

/** The shell around every page. */
export function Shell(): ReactNode {
  if (useSessionStatus() === 'lost') {
    return (
      <div className="shell">
        <Header />
        <SessionLostPage />
      </div>
    );
  }
  return (
    <AddProjectProvider>
      <div className="shell">
        <Header>
          <ProjectSwitcher />
        </Header>
        <UnreachableBanner />
        <ShellWarnings />
        <div className="shell-body">
          <Outlet />
        </div>
      </div>
    </AddProjectProvider>
  );
}
