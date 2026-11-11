// task-063 — a page the console no longer recognises recovers in place (US-X-02 X-02.3, adr-003 D6,
// D7): the console started and started again on one fixed `--port`, two tabs of one browser
// context. The recovery runs through the same-origin channel `wfui-session` on the three engines;
// headless engines report every page visible, so the return-to-the-tab trigger is covered by the
// unit tests (`test/web/session/recovery.test.ts`, design D63-14).
import type { Page, Request } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS, expectFirstLoad } from './support/cold-read.js';
import { expect, test } from './support/fixtures.js';

test.use({ prebuild: ['kanban'] });

const LOST = 'This page is no longer recognised by the console';
const LOST_BODY =
  'The console was stopped and started again, or this page belongs to another console. Open the URL printed in ' +
  'the terminal in any tab of this browser: if the console runs on the same port again, this page reconnects by itself.';
const ELEMENT = 'task-001-login-form';

/** A port free on the loopback interface now (the spec's own helper, design D63-13). */
async function freePort(): Promise<number> {
  const probe = net.createServer();
  await new Promise<void>((r) => probe.listen({ host: '127.0.0.1', port: 0 }, r));
  const port = (probe.address() as net.AddressInfo).port;
  await new Promise((r) => probe.close(r));
  return port;
}

/** What a page sends, from the moment of the call (recorded on send, not on response). */
function recordRequests(page: Page): Request[] {
  const sent: Request[] = [];
  page.on('request', (r) => sent.push(r));
  return sent;
}

/** The console messages of a page. */
function recordConsole(page: Page): string[] {
  const logged: string[] = [];
  page.on('console', (m) => logged.push(m.text()));
  return logged;
}

/** The element page of task-001 shows its title (the side panel or the main region, task-062). */
const elementShown = (page: Page) => page.getByRole('heading', { name: 'Login form' }).first();

/** Open `url` (holding a token) in `page` and wait for its exchange's answer. */
async function openWithToken(page: Page, url: string): Promise<number> {
  const exchange = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/session', {
    timeout: COLD_READ_MS,
  });
  await page.goto(url, { timeout: COLD_READ_MS });
  return (await exchange).status();
}

test.describe('US-X-02 — a page of a restarted console recovers in place (task-063)', () => {
  test('X-02.3 — Recover a page the console no longer recognises, in place', async ({ page, fixtures, consoles }) => {
    // one-console-per-test: kept — the stop and the start again on one fixed port are the behaviour (X-02.3).
    const stateDir = await mkdtemp(path.join(tmpdir(), 'wfui-e2e-state-'));
    try {
      const kanban = await fixtures.get('kanban');
      const port = String(await freePort());
      const first = await consoles.start({ projects: [kanban], stateDir, args: ['--port', port] });
      const address = `${first.origin}/p/${first.pids[0]}/e/${ELEMENT}`;
      const logged = recordConsole(page);
      expect(await openWithToken(page, `${address}#token=${first.token}`)).toBe(204);
      await expectFirstLoad(elementShown(page));
      expect(page.url()).toBe(address);
      const length = await page.evaluate(() => history.length);

      await first.stop();
      const second = await consoles.start({ projects: [kanban], stateDir, args: ['--port', port] });
      expect(second.origin).toBe(first.origin);
      expect(second.pids).toEqual([]);
      // The page's event stream reconnects with the old cookie: 401, the notice.
      await expectFirstLoad(page.getByRole('heading', { level: 1, name: LOST }));
      await expect(page.getByText(LOST_BODY)).toBeVisible();
      expect(await scanThemes(page)).toEqual([]);
      const sent = recordRequests(page);

      // The newly printed URL in another tab of the same browser, then back to the first tab.
      const other = await page.context().newPage();
      const otherLogged = recordConsole(other);
      expect(await openWithToken(other, second.url)).toBe(204);
      await page.bringToFront();
      await expectFirstLoad(elementShown(page));
      await expect(page.getByRole('heading', { level: 1, name: LOST })).toHaveCount(0);

      // The same address; no token in either tab's address, history or referrer (AC-3).
      expect(page.url()).toBe(address);
      expect(await page.evaluate(() => history.length)).toBe(length);
      await expect.poll(() => other.url(), { timeout: COLD_READ_MS }).not.toContain('#');
      for (const [tab, token] of [
        [page, first.token],
        [page, second.token],
        [other, second.token],
      ] as const) {
        expect(tab.url()).not.toContain(token);
        expect(await tab.evaluate(() => document.referrer)).not.toContain(token);
      }
      expect(await other.evaluate(() => history.length)).toBeLessThanOrEqual(2);
      // The lost tab probed with its cookie only and never exchanged a token again.
      const paths = sent.map((r) => `${r.method()} ${new URL(r.url()).pathname}`);
      expect(paths).toContain('GET /api/server');
      expect(paths).not.toContain('POST /api/session');
      for (const r of sent) {
        expect(await r.headerValue('authorization'), r.url()).toBeNull();
        expect(r.url()).not.toMatch(/token|next=/);
      }
      for (const text of [...logged, ...otherLogged]) {
        expect(text).not.toContain(first.token);
        expect(text).not.toContain(second.token);
      }
    } finally {
      await rm(stateDir, { recursive: true, force: true });
    }
  });

  test('X-02.3 — an exchange on another port leaves the page lost', async ({ page, fixtures, consoles }) => {
    // one-console-per-test: kept — a restart on one port and a console on another port are the behaviour (D7).
    const stateDir = await mkdtemp(path.join(tmpdir(), 'wfui-e2e-state-'));
    try {
      const kanban = await fixtures.get('kanban');
      const port = String(await freePort());
      const first = await consoles.start({ projects: [kanban], stateDir, args: ['--port', port] });
      const address = `${first.origin}/p/${first.pids[0]}/e/${ELEMENT}`;
      expect(await openWithToken(page, `${address}#token=${first.token}`)).toBe(204);
      await expectFirstLoad(elementShown(page));
      await first.stop();
      const second = await consoles.start({ projects: [kanban], stateDir, args: ['--port', port] });
      const elsewhere = await consoles.start({ projects: [kanban] });
      expect(elsewhere.port).not.toBe(second.port);
      await expectFirstLoad(page.getByRole('heading', { level: 1, name: LOST }));
      // One ordered log of the events that matter (checker N-2): the lost tab's probes as they are
      // sent, and each other tab's exchange answer as it arrives.
      const order: string[] = [];
      page.on('request', (r) => {
        if (new URL(r.url()).pathname === '/api/server') order.push('probe');
      });
      const exchanges = (tab: Page, name: string) =>
        tab.on('response', (r) => {
          if (new URL(r.url()).pathname === '/api/session' && r.status() === 204) order.push(name);
        });

      // Another origin's session: its message stays on its own origin, the page stays lost.
      const foreign = await page.context().newPage();
      exchanges(foreign, 'foreign 204');
      expect(await openWithToken(foreign, elsewhere.url)).toBe(204);
      await expectFirstLoad(foreign.getByRole('banner'));
      await expect(page.getByRole('heading', { level: 1, name: LOST })).toBeVisible();

      // The same origin's session: the page recovers.
      const same = await page.context().newPage();
      exchanges(same, 'same 204');
      expect(await openWithToken(same, second.url)).toBe(204);
      await page.bringToFront();
      await expectFirstLoad(elementShown(page));
      // No probe between the foreign exchange and the same-origin one: the first comes after it.
      expect(order.indexOf('foreign 204')).toBe(0);
      expect(order.indexOf('same 204')).toBe(1);
      expect(order.indexOf('probe')).toBeGreaterThan(order.indexOf('same 204'));
      expect(page.url()).toBe(address);
    } finally {
      await rm(stateDir, { recursive: true, force: true });
    }
  });
});
