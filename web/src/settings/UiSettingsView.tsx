/**
 * Configuration › UI settings (US-C-07, C-07.1; ux-reference §4.11; task-041): the seven settings of
 * spec-006 §2, kept in the local state for every project and never committed, grouped by purpose.
 * Every control saves on its own (D41-3): a switch or the theme on change, a number when its field
 * is left or Enter is pressed, once it is a whole number in its range (D41-4). The page says
 * "Settings saved" in a polite status, and a failed save in an alert naming the setting, outside
 * the cards, until the next save succeeds (D41-9). The declared residual of Auto-update (W4-16,
 * D41-8) and the WingFoil 0.3 note of Confirm agent launch (RP-15, D41-13) are the descriptions of
 * their switches.
 */
import type { UiSettings, UiTheme } from '@wingfoil-ui/contracts';
import { useQuery } from '@tanstack/react-query';
import { useId, useState, type ReactNode } from 'react';
import { FieldError, Input, Label, Radio, RadioGroup, Switch, Text, TextField } from 'react-aria-components';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import { ApiError } from '../api/client.js';
import { settingsQuery } from '../api/queries.js';
import { useSaveSettings } from '../api/settings.js';
import { ErrorText } from '../shell/ErrorText.js';
import { NUMBER_RANGES, parseWholeNumber, type NumberSettingKey } from './model.js';
import './settings.css';

/** The label of each setting (also the name in a failed-save alert). */
const LABELS = defineMessages({
  autoFetch: { id: 'settings.autoFetch.label' },
  fetchIntervalSeconds: { id: 'settings.fetchInterval.label' },
  autoUpdate: { id: 'settings.autoUpdate.label' },
  autoPush: { id: 'settings.autoPush.label' },
  theme: { id: 'settings.theme.label' },
  confirmAgentLaunch: { id: 'settings.confirmAgentLaunch.label' },
  actionLogCap: { id: 'settings.actionLogCap.label' },
}) satisfies Record<keyof UiSettings, MessageDescriptor>;

const THEMES = defineMessages({
  system: { id: 'settings.theme.system' },
  light: { id: 'settings.theme.light' },
  dark: { id: 'settings.theme.dark' },
}) satisfies Record<UiTheme, MessageDescriptor>;

const NUMBERS = defineMessages({
  fetchIntervalSecondsDescription: { id: 'settings.fetchInterval.description' },
  fetchIntervalSecondsInvalid: { id: 'settings.fetchInterval.invalid' },
  actionLogCapDescription: { id: 'settings.actionLogCap.description' },
  actionLogCapInvalid: { id: 'settings.actionLogCap.invalid' },
});

const GROUPS = defineMessages({
  sync: { id: 'settings.group.sync' },
  appearance: { id: 'settings.group.appearance' },
  agents: { id: 'settings.group.agents' },
  actionLog: { id: 'settings.group.actionLog' },
});

const code = (chunks: ReactNode[]) => <code>{chunks}</code>;
const em = (chunks: ReactNode[]) => <em>{chunks}</em>;

/** A card of settings with its heading. */
function Group({ title, children }: { title: MessageDescriptor; children: ReactNode }): ReactNode {
  const id = useId();
  return (
    <section className="settings-card" aria-labelledby={id}>
      <h2 className="settings-card-title" id={id}>
        <FormattedMessage {...title} />
      </h2>
      {children}
    </section>
  );
}

/** Props of {@link SwitchSetting}. */
interface SwitchSettingProps {
  label: MessageDescriptor;
  value: boolean;
  onChange(value: boolean): void;
  /** Paragraphs describing the setting: the switch's accessible description. */
  description: ReactNode[];
}

/** One on/off setting: the label and the switch, the description below. */
function SwitchSetting({ label, value, onChange, description }: SwitchSettingProps): ReactNode {
  const base = useId();
  const ids = description.map((_, i) => `${base}-${i}`);
  return (
    <div className="setting-row">
      <Switch className="setting-switch" isSelected={value} onChange={onChange} aria-describedby={ids.join(' ')}>
        <span className="setting-label">
          <FormattedMessage {...label} />
        </span>
        <span className="switch-track" aria-hidden="true">
          <span className="switch-knob" />
        </span>
      </Switch>
      {description.map((d, i) => (
        <p key={ids[i]} id={ids[i]} className="setting-description">
          {d}
        </p>
      ))}
    </div>
  );
}

/** Props of {@link NumberSetting}. */
interface NumberSettingProps {
  name: NumberSettingKey;
  stored: number;
  onSave(value: number): void;
}

/** One number setting: saved on leaving the field or on Enter when valid; Escape shows the stored value. */
function NumberSetting({ name, stored, onSave }: NumberSettingProps): ReactNode {
  // `undefined`: the field shows the stored value (also after another tab changed it).
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const [invalid, setInvalid] = useState(false);
  const commit = (): void => {
    if (draft === undefined) return;
    const value = parseWholeNumber(draft, NUMBER_RANGES[name]);
    if (value === undefined) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(undefined);
    if (value !== stored) onSave(value);
  };
  return (
    <div className="setting-row">
      <TextField
        className="field setting-field"
        value={draft ?? String(stored)}
        onChange={(v) => setDraft(v)}
        isInvalid={invalid}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') {
            setDraft(undefined);
            setInvalid(false);
          } else e.continuePropagation();
        }}
      >
        <Label className="setting-label">
          <FormattedMessage {...LABELS[name]} />
        </Label>
        <Input className="field-input setting-number" inputMode="numeric" autoComplete="off" />
        <Text slot="description" className="setting-description">
          <FormattedMessage {...NUMBERS[`${name}Description`]} />
        </Text>
        <FieldError className="field-error">
          <FormattedMessage {...NUMBERS[`${name}Invalid`]} />
        </FieldError>
      </TextField>
    </div>
  );
}

/** The settings, once read. */
function SettingsForm({
  settings,
  save,
}: {
  settings: UiSettings;
  save(change: Partial<UiSettings>): void;
}): ReactNode {
  const intl = useIntl();
  return (
    <div className="settings-cards">
      <Group title={GROUPS.sync}>
        <SwitchSetting
          label={LABELS.autoFetch}
          value={settings.autoFetch}
          onChange={(autoFetch) => save({ autoFetch })}
          description={[<FormattedMessage key="d" id="settings.autoFetch.description" />]}
        />
        <NumberSetting
          name="fetchIntervalSeconds"
          stored={settings.fetchIntervalSeconds}
          onSave={(fetchIntervalSeconds) => save({ fetchIntervalSeconds })}
        />
        <SwitchSetting
          label={LABELS.autoUpdate}
          value={settings.autoUpdate}
          onChange={(autoUpdate) => save({ autoUpdate })}
          description={[
            <FormattedMessage key="r" id="settings.autoUpdate.residual" values={{ code }} />,
            <FormattedMessage key="g" id="settings.autoUpdate.guide" values={{ em }} />,
          ]}
        />
        <SwitchSetting
          label={LABELS.autoPush}
          value={settings.autoPush}
          onChange={(autoPush) => save({ autoPush })}
          description={[<FormattedMessage key="d" id="settings.autoPush.description" />]}
        />
      </Group>
      <Group title={GROUPS.appearance}>
        <div className="setting-row">
          <RadioGroup
            className="setting-radio"
            orientation="horizontal"
            value={settings.theme}
            onChange={(value) => save({ theme: value as UiTheme })}
          >
            <Label className="setting-label">
              <FormattedMessage {...LABELS.theme} />
            </Label>
            <div className="segmented">
              {(Object.keys(THEMES) as UiTheme[]).map((t) => (
                <Radio key={t} className="segmented-option" value={t}>
                  {intl.formatMessage(THEMES[t])}
                </Radio>
              ))}
            </div>
            <Text slot="description" className="setting-description">
              <FormattedMessage id="settings.theme.description" />
            </Text>
          </RadioGroup>
        </div>
      </Group>
      <Group title={GROUPS.agents}>
        <SwitchSetting
          label={LABELS.confirmAgentLaunch}
          value={settings.confirmAgentLaunch}
          onChange={(confirmAgentLaunch) => save({ confirmAgentLaunch })}
          description={[<FormattedMessage key="d" id="settings.confirmAgentLaunch.description" />]}
        />
      </Group>
      <Group title={GROUPS.actionLog}>
        <NumberSetting
          name="actionLogCap"
          stored={settings.actionLogCap}
          onSave={(actionLogCap) => save({ actionLogCap })}
        />
      </Group>
    </div>
  );
}

/** A failed save: the setting it was for and the error. */
interface Failure {
  setting: keyof UiSettings;
  error: ApiError;
}

/** The UI settings tab. */
export function UiSettingsView(): ReactNode {
  const query = useQuery(settingsQuery());
  const [saved, setSaved] = useState(0);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const save = useSaveSettings({
    onSaved: () => {
      setFailure(undefined);
      setSaved((n) => n + 1);
    },
    onFailed: (error, change) => {
      setSaved(0);
      setFailure({ setting: Object.keys(change)[0] as keyof UiSettings, error });
    },
  });
  return (
    <div className="settings">
      <p className="page-intro">
        <FormattedMessage id="settings.intro" />
      </p>
      <p className="settings-status" role="status">
        {saved > 0 && <FormattedMessage id="settings.saved" />}
      </p>
      <div className="settings-alert-region">
        {failure && (
          <div className="settings-alert" role="alert">
            <p>
              <FormattedMessage
                id="settings.saveFailed"
                values={{ setting: <FormattedMessage {...LABELS[failure.setting]} /> }}
              />
            </p>
            <ErrorText error={failure.error} />
          </div>
        )}
      </div>
      {query.error ? (
        <div className="settings-alert" role="alert">
          <p>
            <FormattedMessage id="settings.error" />
          </p>
          <ErrorText
            error={
              query.error instanceof ApiError
                ? query.error
                : new ApiError(0, 'internal', query.error.message, undefined)
            }
          />
        </div>
      ) : query.data ? (
        <SettingsForm settings={query.data} save={(change) => save.mutate(change)} />
      ) : (
        <p className="muted" role="status">
          <FormattedMessage id="settings.loading" />
        </p>
      )}
    </div>
  );
}
