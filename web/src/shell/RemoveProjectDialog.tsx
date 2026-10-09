/**
 * The confirmation of a removal from the project list (decision W4-2, S-18.1, S-18.2): a modal
 * alert dialog naming the project and saying that its files are not touched, with *Remove* and
 * *Cancel* (Escape cancels too, ux-reference §5; the focus starts on Cancel). A refusal or an
 * unanswered request is shown inside the dialog from the catalogue. Removing the open project
 * leaves its pages for the start page before its queries are forgotten.
 */
import type { ProjectListItem } from '@wingfoil-ui/contracts';
import { useRouter } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { FormattedMessage } from 'react-intl';
import { useRemoveProject } from '../api/projects.js';
import { ErrorText } from './ErrorText.js';

/** Props of {@link RemoveProjectDialog}. */
export interface RemoveProjectDialogProps {
  /** The project to remove; `null` keeps the dialog closed. */
  project: ProjectListItem | null;
  /** The project open in the page, if any. */
  openPid: string | undefined;
  /** Called when the dialog closes (removed or cancelled). */
  onClose(): void;
}

/** The removal confirmation. */
export function RemoveProjectDialog({ project, openPid, onClose }: RemoveProjectDialogProps): ReactNode {
  const router = useRouter();
  const removal = useRemoveProject({
    onRemoved: async (pid) => {
      if (pid === openPid) await router.navigate({ to: '/' });
    },
  });
  const close = (): void => {
    removal.reset();
    onClose();
  };
  return (
    <ModalOverlay
      className="modal-overlay"
      isOpen={project !== null}
      onOpenChange={(next) => {
        if (!next && !removal.isPending) close();
      }}
    >
      <Modal className="modal">
        <Dialog role="alertdialog" className="dialog">
          {project && (
            <>
              <Heading slot="title" className="dialog-title">
                <FormattedMessage id="projects.remove.title" values={{ name: project.name }} />
              </Heading>
              <p>
                <FormattedMessage id="projects.remove.body" />
              </p>
              {removal.error && (
                <div role="alert" className="dialog-error">
                  <ErrorText error={removal.error} />
                </div>
              )}
              <div className="dialog-actions">
                <Button className="button" autoFocus isDisabled={removal.isPending} onPress={close}>
                  <FormattedMessage id="projects.remove.cancel" />
                </Button>
                <Button
                  className="button button-danger"
                  isDisabled={removal.isPending}
                  onPress={() => removal.mutate(project.id, { onSuccess: close })}
                >
                  <FormattedMessage id="projects.remove.confirm" />
                </Button>
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
