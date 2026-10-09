/**
 * The project switcher of the header (ux-reference §3, decisions W4-1…W4-7): a button opening a
 * popover with the projects of the list in stored order (spec-006 §2) — name and path, the open one
 * marked —, a *Remove* button on each row, then *Add project…* and a footnote.
 *
 * - The rows are a React Aria grid list (W4-1): a row is a link to the project (opaque id only,
 *   X-05.1) and holds its Remove button (Tab moves from the row to it); an ARIA menu could not hold
 *   that button.
 * - A switch keeps the current view (W4-5, `switch-target.ts`); the element panel and every other
 *   page of the previous project are left (S-16.2).
 * - An unavailable entry (W4-3: folder not found, no `.wingfoil/`, no CLI) is not a link: it shows
 *   its reason (and the install command) and keeps Remove (S-19.1, S-10.2).
 * - The list is read again on every opening (W4-4, S-19.2): one request, files only on the server.
 * - Remove asks for a confirmation (W4-2, `RemoveProjectDialog`); removing the open project goes to
 *   the start page. The focus then returns to the trigger.
 * - *Add project…* opens the shell's dialog (`add-project.tsx`, task-014).
 */
import type { ProjectListItem } from '@wingfoil-ui/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter, useRouterState } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Dialog, DialogTrigger, GridList, GridListItem, Popover } from 'react-aria-components';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ApiError } from '../api/client.js';
import { projectsQuery } from '../api/queries.js';
import { navGroups } from '../routes/nav.js';
import { useAddProject } from './add-project.js';
import { ErrorText } from './ErrorText.js';
import { Chevron, Cross } from './icons.js';
import { RemoveProjectDialog } from './RemoveProjectDialog.js';
import { switchTarget } from './switch-target.js';

/** Reason of an unavailable entry, as an argument of `projects.switcher.unavailable`. */
const REASONS: Readonly<Record<Exclude<ProjectListItem['availability'], 'ok'>, string>> = {
  'folder-not-found': 'folderNotFound',
  'not-wingfoil': 'notWingfoil',
  'cli-not-found': 'cliNotFound',
};

const MESSAGES = defineMessages({ label: { id: 'projects.switcher.label' } });

/** A failed list read as an API error (a non-API failure renders as `internal`). */
function asApiError(error: Error): ApiError {
  return error instanceof ApiError ? error : new ApiError(0, 'internal', error.message, undefined);
}

/** The path of the current page and the id of the open project (none on the start page). */
function useLocation(): { pathname: string; pid: string | undefined } {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { pid } = useParams({ strict: false });
  return { pathname, pid };
}

/** The project switcher. */
export function ProjectSwitcher(): ReactNode {
  const intl = useIntl();
  const router = useRouter();
  const queryClient = useQueryClient();
  const addProject = useAddProject();
  const list = useQuery(projectsQuery());
  const { pathname, pid } = useLocation();
  const [expanded, setExpanded] = useState(false);
  // A switch (or any navigation) closes the popover.
  useEffect(() => router.subscribe('onBeforeNavigate', () => setExpanded(false)), [router]);
  const [removing, setRemoving] = useState<ProjectListItem | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const viewPaths = useMemo(
    () => navGroups(Object.values(router.routesById)).flatMap((g) => g.items.map((i) => i.to)),
    [router],
  );
  const open = pid === undefined ? undefined : list.data?.projects.find((p) => p.id === pid);

  const onOpenChange = (next: boolean): void => {
    setExpanded(next);
    // W4-4: the list as it is now (availability included), not only as the last event left it.
    if (next) void queryClient.invalidateQueries({ queryKey: projectsQuery().queryKey });
  };

  const projects = list.data?.projects ?? [];
  return (
    <>
      <DialogTrigger isOpen={expanded} onOpenChange={onOpenChange}>
        <Button
          ref={trigger}
          className="button switcher-trigger"
          {...(open
            ? { 'aria-label': intl.formatMessage({ id: 'projects.switcher.current' }, { name: open.name }) }
            : {})}
        >
          {open ? <span className="switcher-name">{open.name}</span> : <FormattedMessage {...MESSAGES.label} />}
          <Chevron />
        </Button>
        <Popover className="menu-popover switcher-popover" placement="bottom start">
          <Dialog className="switcher" aria-label={intl.formatMessage(MESSAGES.label)}>
            {list.isPending ? (
              <p role="status" className="switcher-note">
                <FormattedMessage id="projects.switcher.loading" />
              </p>
            ) : list.isError && list.data === undefined ? (
              <div role="alert" className="switcher-note">
                <ErrorText error={asApiError(list.error)} />
              </div>
            ) : (
              <GridList
                className="switcher-list"
                aria-label={intl.formatMessage(MESSAGES.label)}
                items={projects}
                keyboardNavigationBehavior="tab"
                escapeKeyBehavior="none"
                autoFocus={projects.length > 0 ? 'first' : false}
                renderEmptyState={() => (
                  <p className="switcher-note">
                    <FormattedMessage id="projects.switcher.empty" />
                  </p>
                )}
              >
                {(p) => (
                  <ProjectRow
                    project={p}
                    current={p.id === pid}
                    href={switchTarget(p.id, pathname, viewPaths)}
                    onRemove={() => {
                      setExpanded(false);
                      setRemoving(p);
                    }}
                  />
                )}
              </GridList>
            )}
            <div className="switcher-separator" role="presentation" />
            <Button
              className="menu-item menu-item-action switcher-add"
              autoFocus={!list.isPending && projects.length === 0}
              onPress={() => {
                setExpanded(false);
                addProject.show();
              }}
            >
              <FormattedMessage id="projects.switcher.add" />
            </Button>
            <p className="switcher-footnote">
              <FormattedMessage id="projects.switcher.footnote" />
            </p>
          </Dialog>
        </Popover>
      </DialogTrigger>
      <RemoveProjectDialog
        project={removing}
        openPid={pid}
        onClose={() => {
          setRemoving(null);
          // The row that opened the dialog is gone with the popover: the focus returns to the
          // trigger (W4-2), once the page under it settled (start page after removing the open one).
          requestAnimationFrame(() => trigger.current?.focus());
        }}
      />
    </>
  );
}

/** Props of {@link ProjectRow}. */
interface ProjectRowProps {
  project: ProjectListItem;
  current: boolean;
  href: string;
  onRemove(): void;
}

/** One project: a link when available, its reason otherwise; and its Remove button. */
function ProjectRow({ project, current, href, onRemove }: ProjectRowProps): ReactNode {
  const intl = useIntl();
  const available = project.availability === 'ok';
  return (
    <GridListItem
      id={project.id}
      textValue={project.name}
      className={`switcher-row${current ? ' switcher-row-current' : ''}${available ? '' : ' switcher-row-unavailable'}`}
      {...(available ? { href } : {})}
    >
      <div className="switcher-row-text">
        <span className="switcher-row-name">{project.name}</span>
        {current && (
          <span className="visually-hidden">
            <FormattedMessage id="projects.switcher.currentMark" />
          </span>
        )}
        <span className="switcher-row-path">{project.path}</span>
        {project.availability !== 'ok' && (
          <span className="switcher-row-reason">
            <FormattedMessage id="projects.switcher.unavailable" values={{ reason: REASONS[project.availability] }} />
          </span>
        )}
        {project.availability === 'cli-not-found' && project.command !== undefined && (
          <span className="switcher-row-reason">
            <FormattedMessage
              id="projects.switcher.install"
              values={{ command: <code key="command">{project.command}</code> }}
            />
          </span>
        )}
      </div>
      <Button
        className="icon-button switcher-remove"
        aria-label={intl.formatMessage({ id: 'projects.switcher.remove' }, { name: project.name })}
        onPress={onRemove}
      >
        <Cross />
      </Button>
    </GridListItem>
  );
}
