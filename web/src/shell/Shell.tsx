/**
 * The global shell (ux-reference §2–§3): skip link, header (home link and project switcher), the
 * unreachable-console banner (W3-12) and the shell warnings, then the page of the current route.
 * The header's right end is a slot (`header-slot.tsx`) that the project layout fills with the current
 * user and the role view (task-016, W4-16); the context crumb, ⌘K and notifications arrive with
 * their tasks. A lost session replaces the page with the
 * lost-session notice and unmounts everything else, the Add project dialog included (W3-7).
 */
import { Link, Outlet } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { FormattedMessage } from 'react-intl';
import { useSessionStatus } from '../session/session.js';
import { AddProjectProvider } from './add-project.js';
import { HeaderSlotProvider, HeaderSlotTarget } from './header-slot.js';
import { SessionLostPage } from './pages.js';
import { ProjectSwitcher } from './ProjectSwitcher.js';
import { ShellWarnings } from './ShellWarnings.js';
import { Toasts } from './Toasts.js';
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
      <HeaderSlotProvider>
        <div className="shell">
          <Header>
            <ProjectSwitcher />
            <HeaderSlotTarget />
          </Header>
          <UnreachableBanner />
          <ShellWarnings />
          <div className="shell-body">
            <Outlet />
          </div>
          <Toasts />
        </div>
      </HeaderSlotProvider>
    </AddProjectProvider>
  );
}
