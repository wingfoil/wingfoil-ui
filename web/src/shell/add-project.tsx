/**
 * The *Add project* dialog (ux-reference §3, spec-006 §3) and the shell action that opens it, from
 * the project switcher and the start page. The frame (task-013, W3-2): a modal dialog with its title
 * and Close, focus trapped inside and given back to the control that opened it, closed by Close or
 * Escape only — no click outside (ux-reference §5). The form (task-014, decisions W4-9…W4-15):
 *
 * - the source, *Local folder* or *Remote git repository* (a radio group drawn as the prototype's
 *   segmented control); a folder path, or a URL and a working directory that follows the URL
 *   (`~/projects/<repo>`, {@link defaultWorkingDirectory}) until the user types in it (S-04.1,
 *   S-04.2); field checks before any request (W4-13);
 * - while the request runs: the fields and the primary button disabled, a status line with an
 *   indeterminate progress bar; Cancel, Close and Escape abort the request — for a clone the server
 *   then kills git and removes what it created — and close the dialog (W4-11);
 * - a refusal from the catalogue inside the dialog (spec-008 §4, git's output verbatim), with a
 *   link to the entry already listed for `already-listed` (W4-10); the form stays for a correction;
 * - a new project that is available: the dialog closes, the page opens it by its opaque id (the
 *   Memory list, US-S-03) and a polite live region says it was added (no toast in v0.1, W4-15); one
 *   that is not (a fresh clone without its CLI, decision 21): the dialog stays with the reason and
 *   Close only (W4-12).
 *
 * The dialog closes on any navigation of the page (the link of W4-10, the browser's back).
 */
import type { ProjectListItem } from '@wingfoil-ui/contracts';
import { useRouter } from '@tanstack/react-router';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  Button,
  Dialog,
  FieldError,
  Form,
  Heading,
  Input,
  Label,
  Link,
  Modal,
  ModalOverlay,
  ProgressBar,
  Radio,
  RadioGroup,
  Text,
  TextField,
} from 'react-aria-components';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import type { ApiError } from '../api/client.js';
import { useAddLocalProject, useCloneProject } from '../api/projects.js';
import { directoryProblem, pathProblem, urlProblem, type FieldProblem } from './add-project-fields.js';
import { AVAILABILITY_REASONS } from './availability.js';
import { ErrorText } from './ErrorText.js';
import { defaultWorkingDirectory } from './working-directory.js';

/** The shell action opening the dialog. */
export interface AddProjectAction {
  /** Opens the *Add project* dialog. */
  show(): void;
}

const AddProjectContext = createContext<AddProjectAction | null>(null);

/** The action opening the *Add project* dialog (inside {@link AddProjectProvider}). */
export function useAddProject(): AddProjectAction {
  const action = useContext(AddProjectContext);
  if (!action) throw new Error('useAddProject outside AddProjectProvider');
  return action;
}

/**
 * Holds the dialog's state and renders the dialog next to `children`, with the live region that
 * announces an added project once the dialog has closed.
 */
export function AddProjectProvider({ children }: { children: ReactNode }): ReactNode {
  const intl = useIntl();
  const router = useRouter();
  const [shown, setShown] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const action = useMemo<AddProjectAction>(
    () => ({
      show: () => {
        setAnnouncement('');
        setShown(true);
      },
    }),
    [],
  );
  useEffect(() => router.subscribe('onBeforeNavigate', () => setShown(false)), [router]);
  const onAdded = (item: ProjectListItem): void => {
    setShown(false);
    setAnnouncement(intl.formatMessage({ id: 'projects.add.added' }, { name: item.name }));
    void router.navigate({ to: '/p/$pid', params: { pid: item.id } });
  };
  return (
    <AddProjectContext.Provider value={action}>
      {children}
      <AddProjectDialog isOpen={shown} onOpenChange={setShown} onAdded={onAdded} />
      <div role="status" className="visually-hidden">
        {announcement}
      </div>
    </AddProjectContext.Provider>
  );
}

/** Props of {@link AddProjectDialog}. */
export interface AddProjectDialogProps {
  isOpen: boolean;
  onOpenChange(isOpen: boolean): void;
  /** Called with a new project that is available; the dialog is closed by the caller. */
  onAdded?(item: ProjectListItem): void;
}

/**
 * The modal dialog; Escape closes it too. Not dismissed by a click outside: React Aria would add
 * its own "Dismiss" button, a text outside the catalogue (X-09.1). The form is mounted only while
 * the dialog is open: it starts empty at every opening and its unmount aborts a running request.
 */
export function AddProjectDialog({ isOpen, onOpenChange, onAdded }: AddProjectDialogProps): ReactNode {
  return (
    <ModalOverlay className="modal-overlay" isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal className="modal">
        <Dialog className="dialog">{({ close }) => <AddProjectForm close={close} onAdded={onAdded ?? close} />}</Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Where the project comes from (values of the radio group). */
type Source = 'folder' | 'repository';

const PROBLEMS = {
  path: defineMessages({
    required: { id: 'projects.add.error.pathRequired' },
    relative: { id: 'projects.add.error.pathRelative' },
  }),
  url: defineMessages({
    required: { id: 'projects.add.error.urlRequired' },
    option: { id: 'projects.add.error.urlOption' },
  }),
  directory: defineMessages({
    required: { id: 'projects.add.error.directoryRequired' },
    relative: { id: 'projects.add.error.directoryRelative' },
  }),
} satisfies Record<string, Partial<Record<FieldProblem, MessageDescriptor>>>;

/** `true` for the error of an aborted request (the dialog closed while it ran). */
function aborted(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** The `already-listed` detail, when `error` is that refusal. */
function listedEntry(error: ApiError): { pid: string; name: string } | undefined {
  if (error.code !== 'already-listed') return undefined;
  const detail = error.detail as { pid?: unknown; name?: unknown } | null | undefined;
  return typeof detail?.pid === 'string' && typeof detail.name === 'string'
    ? { pid: detail.pid, name: detail.name }
    : undefined;
}

function AddProjectForm({ close, onAdded }: { close(): void; onAdded(item: ProjectListItem): void }): ReactNode {
  const intl = useIntl();
  const [source, setSource] = useState<Source>('folder');
  const [path, setPath] = useState('');
  const [url, setUrl] = useState('');
  const [directory, setDirectory] = useState('');
  const [directoryTyped, setDirectoryTyped] = useState(false);
  const [unavailable, setUnavailable] = useState<ProjectListItem | null>(null);
  const local = useAddLocalProject();
  const clone = useCloneProject();
  const request = useRef<AbortController | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);

  // Closing the dialog in any way (Cancel, Close, Escape, a navigation) aborts a running request.
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (unavailable) closeButton.current?.focus();
  }, [unavailable]);

  const busy = local.isPending || clone.isPending;
  const current = source === 'folder' ? local : clone;
  const error = current.error && !aborted(current.error) ? current.error : null;
  const listed = error ? listedEntry(error) : undefined;
  const problem = (messages: Partial<Record<FieldProblem, MessageDescriptor>>, p: FieldProblem | undefined) => {
    const descriptor = p ? messages[p] : undefined;
    return descriptor ? intl.formatMessage(descriptor) : null;
  };

  const done = (item: ProjectListItem): void => {
    if (item.availability === 'ok') onAdded(item);
    else setUnavailable(item);
  };
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (busy) return;
    const controller = new AbortController();
    // While the request runs the fields are disabled, the focused one included: the focus moves to
    // Cancel, the action left, so that it stays inside the dialog (Escape, Tab).
    const keepFocus = (): void => cancelButton.current?.focus();
    if (source === 'folder') {
      if (pathProblem(path)) return;
      request.current = controller;
      local.mutate({ path: path.trim(), signal: controller.signal }, { onSuccess: done });
      keepFocus();
    } else {
      if (urlProblem(url) || directoryProblem(directory)) return;
      request.current = controller;
      clone.mutate({ url: url.trim(), directory: directory.trim(), signal: controller.signal }, { onSuccess: done });
      keepFocus();
    }
  };

  const header = (
    <div className="dialog-header">
      <div className="dialog-heading">
        <Heading slot="title" className="dialog-title">
          <FormattedMessage id="projects.add.title" />
        </Heading>
        <p className="dialog-subtitle">
          <FormattedMessage id="projects.add.subtitle" />
        </p>
      </div>
      <Button ref={closeButton} className="button button-quiet" onPress={close}>
        <FormattedMessage id="common.action.close" />
      </Button>
    </div>
  );

  if (unavailable) {
    // W4-12: added, but not available — the switcher lists it as unavailable; nothing to open.
    const reason = unavailable.availability === 'ok' ? 'other' : AVAILABILITY_REASONS[unavailable.availability];
    return (
      <>
        {header}
        <div role="status" className="add-project-status">
          <p>
            <FormattedMessage id="projects.add.addedUnavailable" values={{ name: unavailable.name, reason }} />
          </p>
          {unavailable.availability === 'cli-not-found' && unavailable.command !== undefined && (
            <p>
              <FormattedMessage
                id="projects.switcher.install"
                values={{ command: <code key="command">{unavailable.command}</code> }}
              />
            </p>
          )}
        </div>
      </>
    );
  }

  const progress =
    source === 'folder'
      ? intl.formatMessage({ id: 'projects.add.adding' })
      : intl.formatMessage({ id: 'projects.add.cloning' }, { url: url.trim(), directory: directory.trim() });

  return (
    <>
      {header}
      <Form className="add-project-form" onSubmit={submit}>
        <RadioGroup
          className="segmented"
          orientation="horizontal"
          aria-label={intl.formatMessage({ id: 'projects.add.source' })}
          value={source}
          isDisabled={busy}
          onChange={(value) => {
            setSource(value as Source);
            local.reset();
            clone.reset();
          }}
        >
          <Radio className="segmented-option" value="folder">
            <FormattedMessage id="projects.add.sourceLocal" />
          </Radio>
          <Radio className="segmented-option" value="repository">
            <FormattedMessage id="projects.add.sourceRemote" />
          </Radio>
        </RadioGroup>
        {source === 'folder' ? (
          <TextField
            className="field"
            name="path"
            value={path}
            onChange={setPath}
            isDisabled={busy}
            validate={(v) => problem(PROBLEMS.path, pathProblem(v))}
          >
            <Label className="field-label">
              <FormattedMessage id="projects.add.path" />
            </Label>
            <Input
              className="field-input"
              spellCheck={false}
              autoComplete="off"
              placeholder={intl.formatMessage({ id: 'projects.add.pathPlaceholder' })}
            />
            <FieldError className="field-error" />
          </TextField>
        ) : (
          <>
            <TextField
              className="field"
              name="url"
              value={url}
              onChange={(value) => {
                setUrl(value);
                if (!directoryTyped) setDirectory(defaultWorkingDirectory(value));
              }}
              isDisabled={busy}
              validate={(v) => problem(PROBLEMS.url, urlProblem(v))}
            >
              <Label className="field-label">
                <FormattedMessage id="projects.add.url" />
              </Label>
              <Input
                className="field-input"
                spellCheck={false}
                autoComplete="off"
                placeholder={intl.formatMessage({ id: 'projects.add.urlPlaceholder' })}
              />
              <FieldError className="field-error" />
            </TextField>
            <TextField
              className="field"
              name="directory"
              value={directory}
              onChange={(value) => {
                setDirectory(value);
                setDirectoryTyped(true);
              }}
              isDisabled={busy}
              validate={(v) => problem(PROBLEMS.directory, directoryProblem(v))}
            >
              <Label className="field-label">
                <FormattedMessage id="projects.add.directory" />
              </Label>
              <Input
                className="field-input"
                spellCheck={false}
                autoComplete="off"
                placeholder={intl.formatMessage({ id: 'projects.add.directoryPlaceholder' })}
              />
              <Text slot="description" className="field-hint">
                <FormattedMessage id="projects.add.directoryHint" />
              </Text>
              <FieldError className="field-error" />
            </TextField>
          </>
        )}
        <div role="status" className="add-project-status">
          {busy && (
            <ProgressBar className="progress" isIndeterminate>
              <Label className="progress-label">{progress}</Label>
              <div className="progress-track" aria-hidden="true">
                <div className="progress-fill" />
              </div>
            </ProgressBar>
          )}
        </div>
        {error && (
          <div role="alert" className="dialog-error">
            <ErrorText error={error} />
            {listed && (
              <p>
                <Link className="link" href={`/p/${listed.pid}`}>
                  <FormattedMessage id="projects.add.openExisting" values={{ name: listed.name }} />
                </Link>
              </p>
            )}
          </div>
        )}
        <div className="dialog-actions">
          <Button ref={cancelButton} className="button" onPress={close}>
            <FormattedMessage id="projects.add.cancel" />
          </Button>
          <Button type="submit" className="button button-primary" isDisabled={busy}>
            {source === 'folder' ? (
              <FormattedMessage id="projects.add.submitLocal" />
            ) : (
              <FormattedMessage id="projects.add.submitClone" />
            )}
          </Button>
        </div>
      </Form>
    </>
  );
}
