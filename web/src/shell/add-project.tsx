/**
 * The *Add project* dialog (ux-reference §3) and the shell action that opens it, from the project
 * switcher and the start page. Task-013 builds the frame — a modal dialog with its title and Close,
 * focus trapped inside and given back to the control that opened it (directive `accessibility`) —
 * and task-014 fills it with the local-folder and remote-repository form (decision W3-2).
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { FormattedMessage } from 'react-intl';

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

/** Holds the dialog's state and renders the dialog next to `children`. */
export function AddProjectProvider({ children }: { children: ReactNode }): ReactNode {
  const [shown, setShown] = useState(false);
  const action = useMemo<AddProjectAction>(() => ({ show: () => setShown(true) }), []);
  return (
    <AddProjectContext.Provider value={action}>
      {children}
      <AddProjectDialog isOpen={shown} onOpenChange={setShown} />
    </AddProjectContext.Provider>
  );
}

/** Props of {@link AddProjectDialog}. */
export interface AddProjectDialogProps {
  isOpen: boolean;
  onOpenChange(isOpen: boolean): void;
}

/**
 * The modal dialog frame (title, Close); Escape closes it too. Not dismissed by a click outside:
 * React Aria would add its own "Dismiss" button, a text outside the catalogue (X-09.1).
 */
export function AddProjectDialog({ isOpen, onOpenChange }: AddProjectDialogProps): ReactNode {
  return (
    <ModalOverlay className="modal-overlay" isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal className="modal">
        <Dialog className="dialog">
          {({ close }) => (
            <div className="dialog-header">
              <Heading slot="title" className="dialog-title">
                <FormattedMessage id="projects.add.title" />
              </Heading>
              <Button className="button button-quiet" onPress={close}>
                <FormattedMessage id="common.action.close" />
              </Button>
              {/* task-014: the local folder / remote git repository form goes below the header. */}
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
