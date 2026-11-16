/**
 * The frame of the Configuration tabs that read `.wingfoil/ui.yaml` (task-064, D64-2, D64-6, D64-7):
 * one read, `GET /config` (`projectConfigQuery`, its `ui` section, spec-012 §2), rendered as
 * served — the web never infers a value or an origin. The tab's section with its heading, the
 * ui.yaml warning at the top, then the tab's content; the read's error, or the `types` error when
 * `memory.yaml` cannot be read (no `ui` section), instead of the values; a loading status first.
 */
import { useQuery } from '@tanstack/react-query';
import type { UiConfig, UiOrigin } from '@wingfoil-ui/contracts';
import { useId, type ReactNode } from 'react';
import { FormattedMessage, type MessageDescriptor } from 'react-intl';
import { ApiError } from '../api/client.js';
import { projectConfigQuery } from '../api/queries.js';
import { ErrorText } from '../shell/ErrorText.js';
import { UiYamlWarning } from '../shell/UiYamlWarning.js';
import './configuration.css';

/** A value's origin as a badge: "declared", "inferred" or "derived" (D64-3). */
export function Origin({ origin }: { origin: UiOrigin }): ReactNode {
  return (
    <span className="config-origin" data-origin={origin}>
      <FormattedMessage id="settings.origin" values={{ origin }} />
    </span>
  );
}

/** Props of {@link UiFrame}. */
export interface UiFrameProps {
  pid: string;
  /** The tab's heading. */
  title: MessageDescriptor;
  /** The tab's content, from the served `ui` section. */
  children(ui: UiConfig): ReactNode;
}

/** The tab: heading, warning and content, or the read's error. */
export function UiFrame({ pid, title, children }: UiFrameProps): ReactNode {
  const headingId = useId();
  const config = useQuery(projectConfigQuery(pid));
  const ui = config.data?.ui;
  const types = config.data?.types;
  let body: ReactNode;
  if (config.error) {
    const error =
      config.error instanceof ApiError ? config.error : new ApiError(0, 'internal', config.error.message, undefined);
    body = (
      <div className="config-error" role="alert">
        <ErrorText error={error} />
      </div>
    );
  } else if (config.data && ui === undefined) {
    body = (
      <div className="config-error" role="alert">
        <p className="config-error-frame">
          <FormattedMessage id="settings.ui.typesError" />
        </p>
        {types && 'error' in types && (
          <ErrorText error={new ApiError(0, types.error.code, types.error.message, types.error.detail)} />
        )}
      </div>
    );
  } else if (ui) {
    body = (
      <>
        <UiYamlWarning status={ui.status} />
        {children(ui)}
      </>
    );
  } else {
    body = (
      <p className="muted" role="status">
        <FormattedMessage id="settings.ui.loading" />
      </p>
    );
  }
  return (
    <section className="config-tab" aria-labelledby={headingId}>
      <h2 id={headingId} className="config-tab-title">
        <FormattedMessage {...title} />
      </h2>
      {body}
    </section>
  );
}
