// Self-test of the task-021 support (W5-3, W5-12): the X-09.1 check flags a text outside the
// catalogue and accepts keys, project data and its derived forms; the focus ring helper measures a
// poor and a good ring. On static pages, without a console.
import { expect, test } from '@playwright/test';
import { focusRing, tabUntil } from '../support/keyboard.js';
import { isKeyText, recordApiData, textsOutsideCatalogue, type DataRecorder } from '../support/strings.js';

const data = (...strings: string[]): DataRecorder => ({ strings: async () => new Set(strings), reset: () => {} });

test('X-09.1 check: flags English texts, accepts keys, data and derived data', async ({ page }) => {
  await page.setContent(`<!doctype html><html lang="en"><head><title>title.projects</title></head><body>
    <h1>shell.nav.dna</h1>
    <p>error.folderNotFound /x/y</p>
    <span>Login form</span><code>0123abc</code><span>docs/01_vision</span><span>12</span>
    <span class="current-user-avatar">L</span><span class="loose">L</span>
    <span class="current-user-avatar">?</span><span class="loose-glyph">?</span>
    <span class="member-initials">?</span><span class="current-user-avatar">Zz</span>
    <button aria-label="Close">×</button>
    <p>Add project</p><p>OK</p><p>ID</p>
    <p class="extra">shell.nav.dna Hard-coded</p>
    <p class="arg">error.folderNotFound Hard-coded</p>
    <p class="doc-word">error.folderNotFound the</p>
    <button aria-label="Dismiss" class="stray"></button>
    <div class="menu-popover"><button tabindex="-1" aria-label="Dismiss"></button></div>
    <article class="doc-article"><p>Some   words of the
      document</p></article>
    <pre><code class="cli-command" translate="no">wingfoil dna add team.members --value "shell.howToJoin.placeholderName" --entry-email riley@x.test --entry-roles shell.howToJoin.placeholderRoles</code></pre>
    <pre><code class="cli-command" translate="no">wingfoil dna add team.members --value "Your Name" --entry-email riley@x.test --entry-roles shell.howToJoin.placeholderRoles</code></pre>
    <pre><code class="cli-command" translate="no">wingfoil dna add team.members --value "shell.howToJoin.placeholderName" --entry-email other@x.test --entry-roles shell.howToJoin.placeholderRoles</code></pre>
    <pre><code class="not-marked">wingfoil dna add team.members --value "shell.howToJoin.placeholderName" --entry-email riley@x.test --entry-roles shell.howToJoin.placeholderRoles</code></pre>
  </body></html>`);
  const outside = await textsOutsideCatalogue(
    page,
    data(
      'Login form',
      '/x/y',
      '0123abcdef0123abcdef0123abcdef0123abcdef',
      'docs/01_vision/02_product-vision.md',
      'riley@x.test',
      `# Title\n\nSome words of the document, and more text so that the source is long enough to be a content source of a rendered article: ${'x'.repeat(200)}`,
    ),
  );
  expect(outside.sort()).toEqual(
    [
      'button: ×',
      'button@aria-label: Close',
      'p: Add project',
      'p: OK',
      'p: ID',
      'span.loose: L',
      // The no-initials glyph only in the current user's avatar (D35-10): elsewhere, in a member
      // card's initials, and another text in the avatar are flagged.
      'span.loose-glyph: ?',
      'span.member-initials: ?',
      'span.current-user-avatar: Zz',
      'p.extra: shell.nav.dna Hard-coded',
      'p.arg: error.folderNotFound Hard-coded',
      // A word of a long data string (a document) is not an argument value (review round 2).
      'p.doc-word: error.folderNotFound the',
      'button.stray@aria-label: Dismiss',
      // A command shown as data (D35-3): only the exact command with the key placeholders and an
      // email read; an English placeholder, an email not read, or an unmarked element are flagged.
      'code.cli-command: wingfoil dna add team.members --value "Your Name" --entry-email riley@x.test --entry-roles shell.howToJoin.placeholderRoles',
      'code.cli-command: wingfoil dna add team.members --value "shell.howToJoin.placeholderName" --entry-email other@x.test --entry-roles shell.howToJoin.placeholderRoles',
      'code.not-marked: wingfoil dna add team.members --value "shell.howToJoin.placeholderName" --entry-email riley@x.test --entry-roles shell.howToJoin.placeholderRoles',
    ].sort(),
  );
  expect(isKeyText('shell.nav.dna')).toBe(true);
  expect(isKeyText('shell.nav.dnaX')).toBe(false);
  expect(isKeyText('Projects')).toBe(false);
  // A select's own option after its key; another word is not.
  expect(isKeyText('shell.user.label member')).toBe(true);
  expect(isKeyText('shell.user.label anything')).toBe(false);
});

test('X-09.1 recorder: values are data, object keys are not, reset forgets', async ({ page }) => {
  await page.route('http://wfui.test/**', (route) =>
    new URL(route.request().url()).pathname === '/api/a'
      ? route.fulfill({ contentType: 'application/json', body: JSON.stringify({ name: 'kanban', count: 3 }) })
      : route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><title>title.projects</title><p>kanban</p><p>name</p>',
        }),
  );
  await page.goto('http://wfui.test/');
  const recorder = recordApiData(page);
  await page.evaluate(() => fetch('/api/a').then((r) => r.text()));
  // The parse is awaited before the check reads the data.
  expect(await textsOutsideCatalogue(page, recorder)).toEqual(['p: name']);
  recorder.reset();
  expect((await textsOutsideCatalogue(page, recorder)).sort()).toEqual(['p: kanban', 'p: name']);
});

test('X-09.1 check: a References field name only when an element read holds that key (D37-13)', async ({ page }) => {
  await page.route('http://wfui.test/**', (route) =>
    new URL(route.request().url()).pathname === '/api/p/p_1/elements/e-1'
      ? route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ frontmatter: { id: 'e-1', depends_on: [], priority: 'high' } }),
        })
      : route.fulfill({
          contentType: 'text/html',
          body: `<!doctype html><title>title.projects</title>
            <div class="drawer"><dl><dt class="field-name">depends_on</dt><dt class="field-name">module</dt>
            <dt class="field-name">Hard-coded</dt><dt class="field-name">id</dt></dl></div>
            <dl><dt class="field-name">priority</dt></dl>`,
        }),
  );
  await page.goto('http://wfui.test/');
  const recorder = recordApiData(page);
  await page.evaluate(() => fetch('/api/p/p_1/elements/e-1').then((r) => r.text()));
  // A key read passes inside the drawer; a key not read, English text, a key the panel never lists
  // under References (`id`, review F11) and a field name outside the drawer are flagged.
  expect((await textsOutsideCatalogue(page, recorder)).sort()).toEqual(
    ['dt.field-name: module', 'dt.field-name: Hard-coded', 'dt.field-name: id', 'dt.field-name: priority'].sort(),
  );
  recorder.reset();
  expect(await textsOutsideCatalogue(page, recorder)).toContain('dt.field-name: depends_on');
});

test('focus ring: a poor and a good ring, measured against the backdrop', async ({ page }) => {
  await page.setContent(`<!doctype html><html lang="en"><head><title>t</title><style>
    body { background: #ffffff; }
    button { outline-offset: 2px; }
    #poor:focus { outline: 2px solid #dddddd; }
    #good:focus { outline: 2px solid #0645ad; }
    #inset:focus { outline: 2px solid #ffffff; outline-offset: -2px; }
    #inset { background: #000000; color: #fff; }
  </style></head><body><button id="poor">a</button><button id="good">b</button><button id="inset">c</button></body></html>`);
  const rings: number[] = [];
  await tabUntil(page, page.locator('#inset'), (r) => rings.push(r.contrast));
  expect(rings).toHaveLength(3);
  expect(rings[0]).toBeLessThan(3);
  expect(rings[1]).toBeGreaterThan(3);
  expect(rings[2]).toBeCloseTo(21, 0);
  expect((await focusRing(page))?.style).toBe('solid');
});

// bug-015 (absorbed into task-042): the recorder must not miss an answer the page already shows,
// and must not lose a failed body read silently.
test('X-09.1 recorder: waits for an API answer requested before the check, even a late one (bug-015)', async ({
  page,
}) => {
  let release: () => void = () => {};
  const held = new Promise<void>((r) => (release = r));
  await page.route('http://wfui.test/**', async (route) => {
    if (new URL(route.request().url()).pathname === '/api/late') {
      await held;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ name: 'kanban' }) });
    } else {
      await route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>title.projects</title><p>kanban</p><p>name</p>',
      });
    }
  });
  await page.goto('http://wfui.test/');
  const recorder = recordApiData(page);
  const sent = page.waitForEvent('request', (r) => new URL(r.url()).pathname === '/api/late');
  await page.evaluate(() => {
    void fetch('/api/late').then((r) => r.text());
  });
  await sent;
  // The check starts while the answer is still on its way; it arrives meanwhile.
  const check = textsOutsideCatalogue(page, recorder);
  setTimeout(release, 500);
  expect(await check).toEqual(['p: name']);
});

test('X-09.1 recorder: a failed body read is reported as the cause of what is flagged (bug-015)', async ({ page }) => {
  await page.route('http://wfui.test/**', (route) =>
    new URL(route.request().url()).pathname === '/api/broken'
      ? route.fulfill({ contentType: 'application/json', body: '{"name": "kanban"' })
      : route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>title.projects</title><p>kanban</p>' }),
  );
  await page.goto('http://wfui.test/');
  const recorder = recordApiData(page);
  await page.evaluate(() => fetch('/api/broken').then((r) => r.text()));
  const outside = await textsOutsideCatalogue(page, recorder);
  expect(outside).toContain('p: kanban');
  expect(outside.some((t) => t.startsWith('answer not read: GET /api/broken'))).toBe(true);
});
