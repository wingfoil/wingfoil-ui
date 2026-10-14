/**
 * The project header (task-016; ux-reference §3; decisions W4-16…W4-22), rendered by the project
 * layout above the view:
 *
 * - a *Project header* strip: the WingFoil version ("(from PATH)" when the CLI is not the
 *   project's), the version notice (every capability available, or what the version lacks), out of
 *   range "— read-only: supported <min> to <max>" (W4-18), and one read-only notice per identity
 *   reason (W4-19) in a polite live region, so that a change seen by the watcher is announced;
 * - at the right end of the global header (a portal, W4-16): the current user (W4-17, W4-22) and,
 *   for a member holding several roles, the role view selector (W4-20).
 *
 * The data is `GET /api/p/:pid` (`projectHeaderQuery`, shared with the views that depend on who the
 * user is), refreshed by the `repo` event; the project name is in the switcher's trigger.
 *
 * For a user not in the team (task-035, D35-2, D35-8) the *not in team* badge is a button and the
 * notice ends with *How to join*: both open the *How to join* panel (`HowToJoin.tsx`).
 */
import type { ProjectHeader as HeaderData } from '@wingfoil-ui/contracts';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, type ReactNode } from 'react';
import { Button, Label, ListBox, ListBoxItem, Popover, Select, SelectValue } from 'react-aria-components';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import { ApiError } from '../api/client.js';
import { useSetRoleView } from '../api/projects.js';
import { projectHeaderQuery, serverQuery } from '../api/queries.js';
import { HeaderEnd } from '../shell/header-slot.js';
import { ErrorText } from '../shell/ErrorText.js';
import { Chevron, WarningSign } from '../shell/icons.js';
import { useHowToJoin } from './HowToJoin.js';
import { readOnlyNotices, supportedRange, userView, versionOf, type ReadOnlyNotice } from './model.js';
import './project-header.css';

const MESSAGES = defineMessages({
  label: { id: 'shell.header.label' },
  unknownVersion: { id: 'shell.header.unknownVersion' },
  missingLabel: { id: 'shell.header.missingLabel' },
  roleView: { id: 'shell.roleView.label' },
  joinBadge: { id: 'shell.howToJoin.badgeLabel' },
});

/** Names of the capabilities (`contracts/capabilities.json`); an id not listed is shown as written. */
const CAPABILITIES: Readonly<Record<string, MessageDescriptor>> = defineMessages({
  'type-definitions': { id: 'shell.capability.typeDefinitions' },
  'element-content': { id: 'shell.capability.elementContent' },
  'directive-body': { id: 'shell.capability.directiveBody' },
  'gate-decision': { id: 'shell.capability.gateDecision' },
  'workflow-position': { id: 'shell.capability.workflowPosition' },
  'workflow-next-step': { id: 'shell.capability.workflowNextStep' },
  'workflow-start': { id: 'shell.capability.workflowStart' },
  'agent-launch': { id: 'shell.capability.agentLaunch' },
  'field-editing': { id: 'shell.capability.fieldEditing' },
});

/** A failed read as an API error (a non-API failure renders as `internal`). */
function asApiError(error: Error): ApiError {
  return error instanceof ApiError ? error : new ApiError(0, 'internal', error.message, undefined);
}

/** Props of {@link ProjectHeader}. */
export interface ProjectHeaderProps {
  pid: string;
}

/**
 * The header of project `pid`. Not keyed by the project: its notices region (a polite live region)
 * stays the same element across a project switch, so that the next project's notices are announced
 * (W5-13). What belongs to one project only — the role view change and its refusal — is the keyed
 * {@link ProjectRoleView}, so nothing of it reaches another project (task-016 R1). A failed read
 * shows its error; with a header already read, above that header, kept until a read succeeds
 * (W5-16).
 */
export function ProjectHeader({ pid }: ProjectHeaderProps): ReactNode {
  const intl = useIntl();
  const header = useQuery(projectHeaderQuery(pid));
  const data = header.data;
  return (
    <section className="project-header" aria-label={intl.formatMessage(MESSAGES.label)}>
      {header.error && (
        <div role="alert" className="warning warning-danger">
          <ErrorText error={asApiError(header.error)} />
        </div>
      )}
      {data ? (
        <VersionLine header={data} />
      ) : (
        !header.error && (
          <p role="status" className="muted">
            <FormattedMessage id="shell.header.loading" />
          </p>
        )
      )}
      <div aria-live="polite" className="project-notices">
        {data && readOnlyNotices(data).map((n) => <Notice key={n.kind} notice={n} />)}
      </div>
      <ProjectRoleView key={pid} pid={pid} />
    </section>
  );
}

/**
 * The role view of project `pid` (keyed by the project in {@link ProjectHeader}): the refusal of a
 * change, in the strip, and at the right end of the global header the selector and the current user.
 */
function ProjectRoleView({ pid }: ProjectHeaderProps): ReactNode {
  const header = useQuery(projectHeaderQuery(pid));
  const roleView = useSetRoleView();
  const data = header.data;
  // A refusal is reported once the header was read again (`onError` awaits it); it stays until the
  // header is read once more — a later change, e.g. a `repo` event — or another role is picked (R5).
  const refusedAt = useRef(0);
  const { isError, reset } = roleView;
  useEffect(() => {
    if (isError) refusedAt.current = header.dataUpdatedAt;
    // Only when the refusal arrives: the header read that follows it is the baseline.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dataUpdatedAt is read, not watched
  }, [isError]);
  useEffect(() => {
    if (isError && header.dataUpdatedAt > refusedAt.current) reset();
  }, [header.dataUpdatedAt, isError, reset]);
  return (
    <>
      {roleView.error && (
        <div role="alert" className="warning warning-danger">
          <ErrorText error={roleView.error} />
        </div>
      )}
      {data && (
        <HeaderEnd>
          {data.roleViews.length > 1 && (
            <RoleViewSelect
              roles={data.roleViews}
              current={data.roleView ?? data.roleViews[0]!}
              busy={roleView.isPending}
              onChange={(role) => roleView.mutate({ pid, role })}
            />
          )}
          <CurrentUser header={data} />
        </HeaderEnd>
      )}
    </>
  );
}

/** The version line and its notice (W4-18). */
function VersionLine({ header }: { header: HeaderData }): ReactNode {
  const intl = useIntl();
  const server = useQuery({ ...serverQuery(), enabled: !header.wingfoil.inRange });
  const { wingfoil, capabilities } = header;
  const version = versionOf(wingfoil) ?? intl.formatMessage(MESSAGES.unknownVersion);
  const values = { version, source: wingfoil.source };
  if (!wingfoil.inRange) {
    const range = supportedRange(header) ?? server.data?.range;
    return (
      <p className="project-version project-version-unsupported">
        <WarningSign />
        {range ? (
          <FormattedMessage
            id="shell.header.versionReadOnly"
            values={{
              ...values,
              reason: (
                <FormattedMessage id="shell.reason.unsupportedVersion" values={{ min: range.min, max: range.max }} />
              ),
            }}
          />
        ) : (
          <FormattedMessage id="shell.header.versionUnsupported" values={values} />
        )}
      </p>
    );
  }
  return (
    <div className="project-version-block">
      <p className="project-version">
        <FormattedMessage id="shell.header.version" values={values} />
      </p>
      {capabilities.missing.length === 0 ? (
        <p className="project-capabilities">
          <FormattedMessage id="shell.header.allCapabilities" />
        </p>
      ) : (
        <ul className="project-capabilities" aria-label={intl.formatMessage(MESSAGES.missingLabel)}>
          {capabilities.missing.map((m) => {
            const name = CAPABILITIES[m.id];
            return (
              <li key={m.id}>
                <FormattedMessage
                  id="shell.header.missing"
                  values={{
                    capability: name ? intl.formatMessage(name) : m.id,
                    reason: <FormattedMessage id="shell.reason.needsVersion" values={{ minVersion: m.minVersion }} />,
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** One read-only notice of the identity (W4-19, W4-22). */
function Notice({ notice }: { notice: ReadOnlyNotice }): ReactNode {
  const intl = useIntl();
  const howToJoin = useHowToJoin();
  let text: ReactNode;
  switch (notice.kind) {
    case 'notInTeam':
      text = <FormattedMessage id="shell.header.notice.notInTeam" values={{ email: notice.email }} />;
      break;
    case 'teamUnknown':
      text = <FormattedMessage id="shell.header.notice.teamUnknown" />;
      break;
    case 'noIdentity':
      text = (
        <FormattedMessage
          id="shell.header.notice.noIdentity"
          description="'<your email>' is quoted with ICU apostrophes so that it is text, not a tag: keep the quotes when translating the placeholder"
          values={{ code: (chunks: ReactNode[]) => <code>{chunks}</code> }}
        />
      );
      break;
    case 'ambiguous':
      text = (
        <FormattedMessage
          id="shell.header.notice.ambiguous"
          values={{
            email: notice.email,
            count: notice.members.length,
            members: intl.formatList(notice.members, { type: 'unit', style: 'short' }),
          }}
        />
      );
      break;
  }
  return (
    <div className="warning project-notice">
      <WarningSign />
      <p>{text}</p>
      {notice.kind === 'notInTeam' && (
        <Button className="button project-notice-join" onPress={howToJoin.show}>
          <FormattedMessage id="shell.howToJoin.open" />
        </Button>
      )}
    </div>
  );
}

/** The current user of the global header (W4-17). */
function CurrentUser({ header }: { header: HeaderData }): ReactNode {
  const intl = useIntl();
  const howToJoin = useHowToJoin();
  const user = userView(header);
  const name = 'name' in user ? user.name : undefined;
  const email = 'email' in user ? user.email : undefined;
  const role = user.kind === 'memberRole' ? user.role : undefined;
  const label = intl.formatMessage(
    { id: 'shell.user.label' },
    { kind: user.kind, name: name ?? '', role: role ?? '', email: email ?? '' },
  );
  let main: ReactNode;
  let sub: ReactNode = role;
  let badge: ReactNode;
  switch (user.kind) {
    case 'memberRole':
    case 'member':
      main = name;
      break;
    case 'notInTeam':
      main = email;
      badge = (
        <Button
          className="current-user-badge"
          aria-label={intl.formatMessage(MESSAGES.joinBadge)}
          onPress={howToJoin.show}
        >
          <FormattedMessage id="shell.user.badge.notInTeam" />
        </Button>
      );
      break;
    case 'teamUnknown':
      main = email;
      badge = (
        <span className="current-user-badge">
          <FormattedMessage id="shell.user.badge.teamUnknown" />
        </span>
      );
      break;
    case 'ambiguous':
      main = <FormattedMessage id="shell.user.ambiguous" />;
      sub = email;
      break;
    case 'noIdentity':
      main = <FormattedMessage id="shell.user.noIdentity" />;
      break;
  }
  return (
    <div className="current-user" role="group" aria-label={label}>
      <span className="current-user-avatar" aria-hidden="true">
        {user.initials}
      </span>
      <span className="current-user-text">
        <span className="current-user-name">{main}</span>
        {sub && <span className="current-user-sub">{sub}</span>}
      </span>
      {badge}
    </div>
  );
}

/** Props of {@link RoleViewSelect}. */
interface RoleViewSelectProps {
  roles: string[];
  current: string;
  busy: boolean;
  onChange(role: string): void;
}

/** The role view selector (W4-20): the member's roles in DNA order, as WingFoil names them. */
function RoleViewSelect({ roles, current, busy, onChange }: RoleViewSelectProps): ReactNode {
  return (
    <Select
      className="role-view"
      value={current}
      isDisabled={busy}
      onChange={(key) => {
        if (key !== null && String(key) !== current) onChange(String(key));
      }}
    >
      <Label className="role-view-label">
        <FormattedMessage {...MESSAGES.roleView} />
      </Label>
      <Button className="button role-view-button">
        <SelectValue />
        <Chevron />
      </Button>
      <Popover className="menu-popover role-view-popover" placement="bottom end">
        <p className="role-view-hint">
          <FormattedMessage id="shell.roleView.hint" />
        </p>
        <ListBox className="menu" items={roles.map((r) => ({ id: r }))}>
          {(item) => (
            <ListBoxItem id={item.id} className="menu-item" textValue={item.id}>
              {item.id}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
}
