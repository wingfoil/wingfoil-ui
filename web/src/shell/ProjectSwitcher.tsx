/**
 * The project switcher of the header (ux-reference §3): a menu button. In task-013 its menu holds
 * the *Add project…* action only; task-015 lists the projects above it (name and path, remove ×),
 * then a separator.
 */
import type { ReactNode } from 'react';
import { Button, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { useAddProject } from './add-project.js';
import { Chevron } from './icons.js';

/** Key of the *Add project…* menu item. */
const ADD_PROJECT = 'add-project';

/** The project switcher. */
export function ProjectSwitcher(): ReactNode {
  const intl = useIntl();
  const addProject = useAddProject();
  return (
    <MenuTrigger>
      <Button className="button">
        <FormattedMessage id="projects.switcher.label" />
        <Chevron />
      </Button>
      <Popover className="menu-popover" placement="bottom start">
        <Menu
          className="menu"
          aria-label={intl.formatMessage({ id: 'projects.switcher.label' })}
          onAction={(key) => {
            if (key === ADD_PROJECT) addProject.show();
          }}
        >
          <MenuItem id={ADD_PROJECT} className="menu-item menu-item-action">
            <FormattedMessage id="projects.switcher.add" />
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
