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
 * the panel follows them (D35-9): a user who became a member is told so.
 */
import type { ApiError as ApiErrorBody } from '@wingfoil-ui/contracts';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ApiError } from '../api/client.js';
import { projectConfigQuery, projectHeaderQuery } from '../api/queries.js';
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
  const action = useMemo<HowToJoinAction>(() => ({ show: () => setShownFor(pid) }), [pid]);
  return (
    <HowToJoinContext.Provider value={action}>
      {children}
      <ModalOverlay
        key={pid}
        className="modal-overlay"
        isOpen={shownFor === pid}
        onOpenChange={(next) => {
          if (!next) setShownFor(null);
        }}
      >
        <Modal className="modal">
          <Dialog className="dialog how-to-join">{({ close }) => <HowToJoinPanel pid={pid} close={close} />}</Dialog>
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
function HowToJoinPanel({ pid, close }: { pid: string; close(): void }): ReactNode {
  const header = useQuery(projectHeaderQuery(pid));
  const config = useQuery(projectConfigQuery(pid));
  const identity = header.data?.identity;
  const email = header.data ? joinEmail(header.data) : undefined;
  let body: ReactNode;
  if (identity?.kind === 'member') {
    body = (
      <p>
        <FormattedMessage id="shell.howToJoin.nowMember" />
      </p>
    );
  } else if (email !== undefined) {
    body = (
      <>
        <p>
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
  } else if (!header.data) {
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
        <p className="how-to-join-roles">
          <FormattedMessage
            id="shell.howToJoin.roles"
            values={{ roles: intl.formatList(team.roles, { type: 'unit', style: 'short' }) }}
          />
        </p>
      )}
    </>
  );
}
