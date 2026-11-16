/**
 * The badge "missing refs" of an element the server flags (`missingCategories`, spec-012 §5;
 * task-066 D66-5, M-03.1) and its description naming the missing categories as the `ui.yaml` codes
 * (data, as written). The element's link points `aria-describedby` at {@link MissingRefsBadge}'s
 * `descriptionId`; the description is `hidden` (not part of the link's name), and the badge's
 * tooltip says the same.
 */
import type { UiCategory } from '@wingfoil-ui/contracts';
import type { ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

/** Props of {@link MissingRefsBadge}. */
export interface MissingRefsBadgeProps {
  categories: readonly UiCategory[];
  /** The id the element's link names in `aria-describedby`. */
  descriptionId: string;
}

/** The badge and its hidden description. */
export function MissingRefsBadge({ categories, descriptionId }: MissingRefsBadgeProps): ReactNode {
  const intl = useIntl();
  const description = intl.formatMessage(
    { id: 'memory.missingRefs.description' },
    { categories: intl.formatList(categories, { type: 'conjunction' }) },
  );
  return (
    <>
      <span className="memory-badge memory-badge-missing" title={description}>
        <FormattedMessage id="memory.missingRefs.badge" />
      </span>
      <span id={descriptionId} hidden>
        {description}
      </span>
    </>
  );
}
