// spec-006 §2 (REQ-STATE-09, RP-39, D30-2): the UI settings as read from `state.json` — a missing
// key, a wrong type or an out-of-range value reads as its default, an unknown key is ignored —,
// what a write keeps of them, and the action-log cap (RP-38).
import type { ActionLogEntry, UiSettings } from '@wingfoil-ui/contracts';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  readSettings,
  storedSettings,
  trimActionLog,
} from '../../../server/src/state/settings.js';

const DEFAULTS: UiSettings = {
  autoFetch: true,
  fetchIntervalSeconds: 60,
  autoUpdate: false,
  autoPush: false,
  theme: 'system',
  confirmAgentLaunch: true,
  actionLogCap: 5000,
};

const CHANGED: UiSettings = {
  autoFetch: false,
  fetchIntervalSeconds: 15,
  autoUpdate: true,
  autoPush: true,
  theme: 'dark',
  confirmAgentLaunch: false,
  actionLogCap: 100_000,
};

describe('readSettings', () => {
  it('reads the spec-006 §2 defaults from a first start and from a v0.1 file ({})', () => {
    expect(DEFAULT_SETTINGS).toEqual(DEFAULTS);
    expect(readSettings({})).toEqual(DEFAULTS);
  });

  it('reads every valid stored value', () => {
    expect(readSettings({ ...CHANGED })).toEqual(CHANGED);
  });

  it.each([
    ['autoFetch', 'false'],
    ['autoFetch', 0],
    ['autoFetch', null],
    ['fetchIntervalSeconds', 14],
    ['fetchIntervalSeconds', 3601],
    ['fetchIntervalSeconds', 60.5],
    ['fetchIntervalSeconds', '60'],
    ['autoUpdate', 'yes'],
    ['autoPush', 1],
    ['theme', 'blue'],
    ['theme', 'DARK'],
    ['confirmAgentLaunch', []],
    ['actionLogCap', 99],
    ['actionLogCap', 100_001],
    ['actionLogCap', 5000.5],
    ['actionLogCap', { n: 1 }],
  ] as const)('reads %s = %j as its default, the other keys as stored', (key, value) => {
    expect(readSettings({ ...CHANGED, [key]: value })).toEqual({ ...CHANGED, [key]: DEFAULTS[key] });
  });

  it('ignores an unknown key', () => {
    expect(readSettings({ newer: true, autoPush: true })).toEqual({ ...DEFAULTS, autoPush: true });
  });

  it('hands out a copy', () => {
    const settings = readSettings({});
    settings.autoPush = true;
    expect(readSettings({}).autoPush).toBe(false);
    expect(DEFAULT_SETTINGS.autoPush).toBe(false);
  });
});

describe('storedSettings (what a write keeps, D30-2)', () => {
  it('keeps the known keys with valid values, drops unknown and invalid ones, adds no default', () => {
    expect(storedSettings({ autoPush: true, theme: 'blue', newer: 1, fetchIntervalSeconds: 3600 })).toEqual({
      autoPush: true,
      fetchIntervalSeconds: 3600,
    });
    expect(storedSettings({})).toEqual({});
    expect(storedSettings({ ...CHANGED })).toEqual(CHANGED);
  });
});

describe('trimActionLog (RP-38)', () => {
  const log = (n: number): ActionLogEntry[] =>
    Array.from({ length: n }, (_, i) => ({ sha: i.toString(16).padStart(40, '0'), at: '2026-10-12T09:30:02Z' }));

  it('keeps the newest entries, in order, up to the cap', () => {
    const entries = log(150);
    expect(trimActionLog(entries, 100)).toEqual(entries.slice(50));
  });

  it('keeps a log within the cap as it is', () => {
    const entries = log(100);
    expect(trimActionLog(entries, 100)).toEqual(entries);
    expect(trimActionLog([], 100)).toEqual([]);
  });
});
