// task-084 (bug-039, AC-2) — the console works with its Content-Security-Policy in force: the normal
// build served by the real server (not the key-rendering build, whose HTML the harness fulfils
// itself without the header), every screen of `support/screens.ts` in both themes, runtime inline
// styles, and zero `securitypolicyviolation` events. A collector installed before the navigation
// reports each violation to Node, so it survives page loads; a deliberately blocked operation
// proves it is not a disabled check. One test per screen on one console per worker (bug-011).
import type { Page } from '@playwright/test';
import { startConsole, type RunningConsole } from './support/console.js';
import { expect, test as base } from './support/fixtures.js';
import { expectSettled, SCREENS, startScreensConsole } from './support/screens.js';

const test = base.extend<object, { screensConsole: RunningConsole }>({
  screensConsole: [
    async ({ fixtures }, use) => {
      const started: RunningConsole[] = [];
      const c = await startScreensConsole(fixtures, {
        start: async (options) => {
          const running = await startConsole(options);
          started.push(running);
          return running;
        },
      });
      try {
        await use(c);
      } finally {
        await Promise.allSettled(started.map((s) => s.stop()));
      }
    },
    { scope: 'worker', timeout: 300_000 },
  ],
});

test.use({ prebuild: ['kanban', 'custom'] });

interface Violation {
  directive: string;
  blocked: string;
  source: string;
}

interface Collector {
  /** The violations reported so far, from every document the page loaded. */
  violations: Violation[];
  /** The `Content-Security-Policy` header of each HTML document response, in order. */
  documents: (string | undefined)[];
}

/** Install the violation collector and the document-header recorder; call before the first navigation. */
async function collect(page: Page): Promise<Collector> {
  const collector: Collector = { violations: [], documents: [] };
  await page.exposeFunction('wfuiReportViolation', (v: Violation) => collector.violations.push(v));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      void (window as unknown as { wfuiReportViolation(v: unknown): Promise<void> }).wfuiReportViolation({
        directive: e.violatedDirective,
        blocked: e.blockedURI,
        source: `${e.sourceFile}:${e.lineNumber}`,
      });
    });
  });
  page.on('response', (r) => {
    // A 304 revalidation (Firefox sends one for `/`) has no body and no content type: the browser keeps
    // the headers stored with the cached 200, which this recorder checks; the 304 is not a document.
    if (r.request().resourceType() === 'document' && r.status() !== 304)
      collector.documents.push(r.headers()['content-security-policy'] ?? `MISSING ${r.status()} ${r.url()}`);
  });
  return collector;
}

/** Let the queued violation events reach Node: a frame round trip in the page, then the reports. */
async function flush(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 50))));
}

/** The enforced policy: strict scripts (`self` + the hash of the theme script, no inline), no object/frame. */
function expectEnforced(documents: (string | undefined)[]): void {
  expect(documents.length).toBeGreaterThan(0);
  for (const policy of documents) {
    expect(policy).toMatch(/^default-src 'none'; /);
    const directives = new Map((policy ?? '').split('; ').map((d) => [d.split(' ')[0]!, d.slice(d.indexOf(' ') + 1)]));
    expect(directives.get('script-src')).toMatch(/^'self' 'sha256-[A-Za-z0-9+/]+=*'$/);
    expect(directives.get('object-src')).toBe("'none'");
    expect(directives.get('frame-src')).toBe("'none'");
    expect(directives.get('default-src')).toBe("'none'");
  }
}

test.describe('task-084 — Content-Security-Policy in force', () => {
  for (const screen of SCREENS) {
    test(`AC-2 — No CSP violation: ${screen.name}`, async ({ page, screensConsole: c }) => {
      const seen = await collect(page);
      // The token fragment opens the session, as every spec does; then the screen.
      await page.goto(`${c.origin}/#token=${c.token}`);
      await page.getByRole('banner').waitFor();
      await screen.open(page, c);
      await expectSettled(page);
      // Both themes, a change of the system preference without a reload, and runtime inline styles.
      for (const scheme of ['dark', 'light'] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
      }
      await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.setAttribute('style', 'width: 3px; height: 3px');
        document.body.append(probe);
        probe.style.width = '5px';
        probe.remove();
      });
      await flush(page);
      expectEnforced(seen.documents);
      expect(seen.violations).toEqual([]);
    });
  }

  test('AC-2 — The collector detects a deliberately blocked operation', async ({ page, screensConsole: c }) => {
    const seen = await collect(page);
    await page.goto(`${c.origin}/#token=${c.token}`);
    await page.getByRole('banner').waitFor();
    await flush(page);
    expect(seen.violations).toEqual([]);
    await page.evaluate(() => {
      // An inline script without the theme script's hash, and a connection to another origin.
      const script = document.createElement('script');
      script.textContent = 'window.wfuiBlockedRan = true;';
      document.head.append(script);
      void fetch('http://127.0.0.1:9/blocked').catch(() => undefined);
    });
    await expect
      .poll(async () => (await flush(page), seen.violations.map((v) => v.directive).sort()))
      .toEqual(expect.arrayContaining(['connect-src', 'script-src-elem']));
    expect(await page.evaluate(() => (window as unknown as { wfuiBlockedRan?: boolean }).wfuiBlockedRan)).toBe(
      undefined,
    );
  });
});
