/**
 * The toasts of the preset write (task-079, D79-7; ux-reference §5 *Feedback*): "{name} preset applied"
 * with the commit line and the push result (`WriteResultBody`, as the element writes'), or the red,
 * sticky "{name} preset not applied" with the code's text — the preset write's own `write-incomplete`
 * text (D79-8). One toast per project: a new result replaces the previous one.
 */
import type { UiPresetId, WriteResponse } from '@wingfoil-ui/contracts';
import type { ReactNode } from 'react';
import { FormattedMessage } from 'react-intl';
import type { ApiError } from '../api/client.js';
import { WriteResultBody } from '../element/write-toast.js';
import { ErrorText } from '../shell/ErrorText.js';
import type { ToastInput } from '../shell/toasts.js';
import { selectorOf } from './selector.js';

/** The toast key of a project's preset write. */
export function presetToastKey(pid: string): string {
  return `preset:${pid}`;
}

/** A preset's name (`settings.preset.name`), for the messages that take `{name}`. */
export function PresetName({ preset }: { preset: UiPresetId }): ReactNode {
  return <FormattedMessage id="settings.preset.name" values={{ preset: selectorOf(preset) }} />;
}

/** The toast of an applied preset. */
export function presetSuccessToast(pid: string, preset: UiPresetId, data: WriteResponse): ToastInput {
  return {
    key: presetToastKey(pid),
    tone: 'success',
    ...(data.push.status === 'failed' ? { sticky: true } : {}),
    title: <FormattedMessage id="settings.preset.applied" values={{ name: <PresetName preset={preset} /> }} />,
    body: <WriteResultBody data={data} />,
  };
}

/** The toast of a refused preset write. */
export function presetRefusalToast(pid: string, preset: UiPresetId, error: ApiError): ToastInput {
  return {
    key: presetToastKey(pid),
    tone: 'error',
    title: <FormattedMessage id="settings.preset.refused" values={{ name: <PresetName preset={preset} /> }} />,
    body: <ErrorText error={error} variant="preset" />,
  };
}
