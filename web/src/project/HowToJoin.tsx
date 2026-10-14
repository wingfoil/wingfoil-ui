/**
 * The *How to join* panel (task-035; US-C-08, US-C-09; C2; decisions D35-1…D35-9) and the action
 * that opens it. A modal dialog (ux-reference §3 *Current user*, §5: title and Close, closed by
 * Close or Escape only, the focus trapped inside and given back to the control that opened it)
 * for a user not in the team (D35-8): the intro with the user's email; the tech leads of the DNA
 * (`Name <email>`, DNA order), or that the DNA declares no tech lead (C-09.1) or no member at all
 * (C-09.2); the exact `wingfoil dna add team.members …` command for the email with *Copy command*
 * (a polite "Command copied", or a text asking to copy by hand when the clipboard refuses); the
 * roles the DNA declares (D35-6).
 *
 * The action — {@link useHowToJoin}`().show()` — is shared: the project header's badge and notice
 * call it here (D35-2), Today (task-036) and the element panel (task-037) later. The provider
 * lives in the project layout and is bound to its project: switching project closes the panel.
 *
 * Data: `GET /api/p/:pid` (who the user is) and `GET /api/p/:pid/config` (the team), the shared
 * queries; the configuration is read when the panel opens. Both refresh on the `repo` event, and
 * the panel follows them (D35-9, review F1/F2): a user who became a member — or whose email now
 * matches several members — is told so, any other identity that has no panel (D35-8) is told that
 * How to join no longer applies, in a status region so that the change is announced. Closing the
 * panel gives the focus back to its opener, or to the main region when the opener is gone (F3).
 */
import type { ApiError as ApiErrorBody } from '@wingfoil-ui/contracts';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ApiError } from '../api/client.js';
import { projectConfigQuery, projectHeaderQuery } from '../api/queries.js';
import { RoleChips } from '../dna/DnaView.js';
import '../dna/rules.css';
import { ErrorText } from '../shell/ErrorText.js';
import { joinCommand, joinEmail, joinTeam, type JoinTeam } from './join.js';
import './how-to-join.css';

const MESSAGES = defineMessages({
  leadsLabel: { id: 'shell.howToJoin.leadsLabel' },
  placeholderName: { id: 'shell.howToJoin.placeholderName' },
  placeholderRoles: { id: 'shell.howToJoin.placeholderRoles' },
});

/** The action opening the *How to join* panel of the current project. */
export interface HowToJoinAction {
  /** Opens the panel. */
  show(): void;
}

const HowToJoinContext = createContext<HowToJoinAction | null>(null);

/** The action opening the *How to join* panel (inside {@link HowToJoinProvider}). */
export function useHowToJoin(): HowToJoinAction {
  const action = useContext(HowToJoinContext);
  if (!action) throw new Error('useHowToJoin outside HowToJoinProvider');
  return action;
}

/** Props of {@link HowToJoinProvider}. */
export interface HowToJoinProviderProps {
  /** The project of the layout. */
  pid: string;
  children: ReactNode;
}

/**
 * Holds the panel's state for project `pid` and renders the panel next to `children`. The state
 * names the project it was opened for, so a project switch (the layout is not remounted on a
 * `$pid` change) closes it; the dialog is keyed by the project (task-016 R1).
 */
export function HowToJoinProvider({ pid, children }: HowToJoinProviderProps): ReactNode {
  const [shownFor, setShownFor] = useState<string | null>(null);
  const opener = useRef<Element | null>(null);
  const introId = useId();
  const action = useMemo<HowToJoinAction>(
    () => ({
      show: () => {
        opener.current = document.activeElement;
        setShownFor(pid);
      },
    }),
    [pid],
  );
  const shown = shownFor === pid;
  // React Aria gives the focus back to the opener; when the opener has gone (e.g. the badge of a
  // user who became a member), the focus would fall to the page: the main region takes it (F3).
  useEffect(() => {
    if (shown || opener.current === null) return;
    const gone = opener.current;
    opener.current = null;
    const frame = requestAnimationFrame(() => {
      if (!gone.isConnected) document.getElementById('main')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [shown]);
  return (
    <HowToJoinContext.Provider value={action}>
      {children}
      <ModalOverlay
        key={pid}
        className="modal-overlay"
        isOpen={shown}
        onOpenChange={(next) => {
          if (!next) setShownFor(null);
        }}
      >
        <Modal className="modal">
          <Dialog className="dialog how-to-join" aria-describedby={introId}>
            {({ close }) => <HowToJoinPanel pid={pid} introId={introId} close={close} />}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </HowToJoinContext.Provider>
  );
}

/** A failed read, or a section's error of `GET /config`, as an API error (other failures: `internal`). */
function asApiError(error: Error | ApiErrorBody): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof Error) return new ApiError(0, 'internal', error.message, undefined);
  return new ApiError(0, error.code, error.message, error.detail);
}

/** The panel's content. */
function HowToJoinPanel({ pid, introId, close }: { pid: string; introId: string; close(): void }): ReactNode {
  const header = useQuery(projectHeaderQuery(pid));
  const config = useQuery(projectConfigQuery(pid));
  const identity = header.data?.identity;
  const email = header.data ? joinEmail(header.data) : undefined;
  // Read, but no panel any more (D35-8): already a member, or another reason (F1).
  let change: ReactNode;
  if (identity?.kind === 'member' || identity?.kind === 'ambiguous') {
    change = <FormattedMessage id="shell.howToJoin.nowMember" />;
  } else if (identity && email === undefined) {
    change = <FormattedMessage id="shell.howToJoin.notApplicable" />;
  }
  let body: ReactNode;
  if (email !== undefined) {
    body = (
      <>
        <p id={introId}>
          <FormattedMessage id="shell.howToJoin.intro" values={{ email }} />
        </p>
        <Command email={email} />
        {config.error ? (
          <div role="alert" className="dialog-error">
            <ErrorText error={asApiError(config.error)} />
          </div>
        ) : config.data ? (
          'error' in config.data.dna ? (
            <div role="alert" className="dialog-error">
              <ErrorText error={asApiError(config.data.dna.error)} />
            </div>
          ) : (
            <Team team={joinTeam(config.data.dna.data.team)} />
          )
        ) : (
          <p role="status" className="muted">
            <FormattedMessage id="shell.howToJoin.loading" />
          </p>
        )}
      </>
    );
  } else if (header.error) {
    body = (
      <div role="alert" className="dialog-error">
        <ErrorText error={asApiError(header.error)} />
      </div>
    );
  } else if (!identity) {
    body = (
      <p role="status" className="muted">
        <FormattedMessage id="shell.howToJoin.loading" />
      </p>
    );
  }
  return (
    <>
      <div className="dialog-header">
        <Heading slot="title" className="dialog-title">
          <FormattedMessage id="shell.howToJoin.title" />
        </Heading>
        <Button className="button button-quiet" onPress={close}>
          <FormattedMessage id="common.action.close" />
        </Button>
      </div>
      {/* Always present, so that a change of identity while the panel is open is announced (F2). */}
      <div role="status" className="how-to-join-change">
        {change !== undefined && <p>{change}</p>}
      </div>
      {body}
    </>
  );
}

/** The command for `email` and *Copy command* (C-08.1, C-08.2). */
function Command({ email }: { email: string }): ReactNode {
  const intl = useIntl();
  const [copy, setCopy] = useState<'none' | 'copied' | 'failed'>('none');
  const command = joinCommand({
    name: intl.formatMessage(MESSAGES.placeholderName),
    email,
    roles: intl.formatMessage(MESSAGES.placeholderRoles),
  });
  const onCopy = (): void => {
    setCopy('none');
    // `navigator.clipboard` is absent outside a secure context: that is a refusal too.
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(command))
      .then(
        () => setCopy('copied'),
        () => setCopy('failed'),
      );
  };
  return (
    <div className="how-to-join-command">
      <pre>
        {/* The command is data (spec-008 §6, D35-3): never translated, by people or by tools. */}
        <code className="cli-command" translate="no">
          {command}
        </code>
      </pre>
      <div className="how-to-join-copy">
        <Button className="button" onPress={onCopy}>
          <FormattedMessage id="shell.howToJoin.copy" />
        </Button>
        <p role="status" className="how-to-join-copied">
          {copy === 'copied' && <FormattedMessage id="shell.howToJoin.copied" />}
        </p>
      </div>
      {copy === 'failed' && (
        <p role="alert" className="dialog-error">
          <FormattedMessage id="shell.howToJoin.copyFailed" />
        </p>
      )}
    </div>
  );
}

/** Who to ask: the tech leads, or why there is none (C-08.1, C-09.1, C-09.2), and the roles (D35-6). */
function Team({ team }: { team: JoinTeam }): ReactNode {
  const intl = useIntl();
  return (
    <>
      {team.kind === 'leads' && (
        <div>
          <p>
            <FormattedMessage id="shell.howToJoin.leads" />
          </p>
          <ul className="how-to-join-leads" aria-label={intl.formatMessage(MESSAGES.leadsLabel)}>
            {team.leads.map((lead, i) => (
              <li key={`${i}-${lead.name}`}>
                {lead.email !== undefined ? (
                  <FormattedMessage id="shell.howToJoin.lead" values={{ name: lead.name, email: lead.email }} />
                ) : (
                  <FormattedMessage id="shell.howToJoin.leadNoEmail" values={{ name: lead.name }} />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {team.kind === 'noLead' && (
        <p>
          <FormattedMessage id="shell.howToJoin.noLead" />
        </p>
      )}
      {team.kind === 'noMember' && (
        <p>
          <FormattedMessage id="shell.howToJoin.noMember" />
        </p>
      )}
      {team.kind !== 'noMember' && team.roles.length > 0 && (
        <div className="how-to-join-roles">
          <p>
            <FormattedMessage id="shell.howToJoin.roles" />
          </p>
          {/* One chip per role, as the DNA and Team views show them: each role is data. */}
          <RoleChips roles={team.roles} />
        </div>
      )}
    </>
  );
}
