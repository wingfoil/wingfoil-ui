/**
 * Waiting for the console's live updates without fixed sleeps (spec-004 §6): the page's
 * `EventSource` is wrapped by an init script (test side only, nothing in the production code) that
 * records every event it receives; a test mutates a fixture with git or the CLI and waits until
 * the matching event reached the page, then asserts what the user sees with Playwright's
 * auto-waiting `expect`.
 */
import type { Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ServerEventName } from '../../../contracts/src/index.js';
import { pinnedCli } from '../../harness/cli.js';
import type { Fixture } from '../../harness/fixtures/index.js';
import { git, run } from '../../harness/run.js';

/** An event recorded in the page. */
export interface RecordedEvent {
  event: ServerEventName;
  data: Record<string, unknown>;
}

declare global {
  interface Window {
    __wfuiEvents?: RecordedEvent[];
  }
}

/** Record the events of the page's stream; call before `openConsole`. */
export async function recordServerEvents(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const Native = window.EventSource;
    const events: { event: string; data: unknown }[] = [];
    (window as unknown as { __wfuiEvents: unknown[] }).__wfuiEvents = events;
    window.EventSource = class extends Native {
      constructor(url: string | URL, init?: EventSourceInit) {
        super(url, init);
        for (const name of ['repo', 'projects', 'settings', 'write', 'agent']) {
          this.addEventListener(name, (e) => {
            try {
              events.push({ event: name, data: JSON.parse(String((e as MessageEvent).data)) });
            } catch {
              events.push({ event: name, data: null });
            }
          });
        }
      }
    };
  });
}

/** Number of events recorded so far. */
export async function eventCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__wfuiEvents?.length ?? 0);
}

/** What to wait for. */
export interface EventMatch {
  event: ServerEventName;
  /** Only an event of this project (`repo`, `write`). */
  pid?: string;
}

/** Wait until an event matching `match` was recorded after the first `since` events. */
export async function waitForServerEvent(
  page: Page,
  match: EventMatch,
  since = 0,
  timeout = 15_000,
): Promise<RecordedEvent> {
  const handle = await page.waitForFunction(
    ([m, from]) =>
      (window.__wfuiEvents ?? [])
        .slice(from)
        .find((e) => e.event === m.event && (m.pid === undefined || e.data?.['pid'] === m.pid)),
    [match, since] as const,
    { timeout },
  );
  return (await handle.jsonValue()) as RecordedEvent;
}

/** Run `mutation` (git or CLI on a fixture), then wait for the event it causes to reach the page. */
export async function mutateAndWait(
  page: Page,
  mutation: () => Promise<unknown>,
  match: EventMatch,
  timeout = 15_000,
): Promise<RecordedEvent> {
  const since = await eventCount(page);
  await mutation();
  return waitForServerEvent(page, match, since, timeout);
}

/** Write `content` to `file` (relative to the fixture) and commit it with `message`. */
export async function commitFile(fixture: Fixture, file: string, content: string, message: string): Promise<void> {
  await writeFile(path.join(fixture.dir, file), content);
  await git(fixture.dir, ['add', '--', file], fixture.env);
  await git(fixture.dir, ['commit', '--quiet', '-m', message], fixture.env);
}

/** Run the pinned WingFoil CLI in the fixture (`--format json` is the caller's choice). */
export async function cli(fixture: Fixture, args: readonly string[]): Promise<string> {
  const { stdout } = await run(process.execPath, [pinnedCli().script, ...args], { cwd: fixture.dir, env: fixture.env });
  return stdout;
}
