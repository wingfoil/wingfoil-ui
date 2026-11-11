/**
 * Parts of a Today row in v0.3 (task-061; ux-reference §4.1 v0.3): the element's short id (N4,
 * D61-9) and the date it entered its current state (N2, D61-8). Both are data of the API — the
 * `shortId` of spec-011 §1, else the full id; the descriptor's `since` (spec-003 §8) — never derived.
 */
import type { TodayElement } from '@wingfoil-ui/contracts';
import { useId, type ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

/** The element's short id, or its full id when it has none (T-02.7). */
export function RowId({ element }: { element: TodayElement }): ReactNode {
  return <span className="today-id">{element.shortId ?? element.id}</span>;
}

/**
 * "since <date>" when the element entered its state, the full time as its accessible description
 * (T-02.5): a `hidden` element that `aria-describedby` still resolves — not `title`, which would be
 * the `time` element's name and enter the name of a Waiting on others row's link. Nothing without
 * `since` (AC-3). The `time` element is not focusable: the row's link names `descriptionId` in its
 * own `aria-describedby` too (review round 1 F-3), so the full time is the link's description.
 */
export function RowSince({ since, descriptionId }: { since: string | undefined; descriptionId?: string }): ReactNode {
  const intl = useIntl();
  const own = useId();
  const id = descriptionId ?? own;
  if (since === undefined) return null;
  return (
    <>
      <time className="today-since" dateTime={since} aria-describedby={id}>
        <FormattedMessage id="today.since" values={{ date: intl.formatDate(since, { dateStyle: 'medium' }) }} />
      </time>
      <span id={id} hidden>
        {intl.formatDate(since, { dateStyle: 'full', timeStyle: 'long' })}
      </span>
    </>
  );
}
