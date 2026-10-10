// Self-test of the task-021 support (W5-3, W5-12): the X-09.1 check flags a text outside the
// catalogue and accepts keys, project data and its derived forms; the focus ring helper measures a
// poor and a good ring. On static pages, without a console.
import { expect, test } from '@playwright/test';
import { focusRing, tabUntil } from '../support/keyboard.js';
import { isKeyText, textsOutsideCatalogue, type DataRecorder } from '../support/strings.js';

const data = (...strings: string[]): DataRecorder => ({ strings: () => new Set(strings) });

test('X-09.1 check: flags an English text, accepts keys, data and derived data', async ({ page }) => {
  await page.setContent(`<!doctype html><html lang="en"><head><title>t</title></head><body>
    <h1>shell.nav.dna</h1>
    <p>error.folderNotFound /x/y</p>
    <span>Login form</span><span>L</span><code>0123abc</code><span>docs/01_vision</span><span>12</span>
    <button aria-label="Close">×</button>
    <p>Add project</p>
    <article class="doc-article"><p>Some   words of the
      document</p></article>
  </body></html>`);
  const outside = await textsOutsideCatalogue(
    page,
    data(
      'Login form',
      '0123abcdef0123abcdef0123abcdef0123abcdef',
      'docs/01_vision/02_product-vision.md',
      `# Title\n\nSome words of the document, and more text so that the source is long enough to be a content source of a rendered article: ${'x'.repeat(200)}`,
    ),
  );
  expect(outside.sort()).toEqual(['button: ×', 'button@aria-label: Close', 'p: Add project'].sort());
  expect(isKeyText('shell.nav.dna')).toBe(true);
  expect(isKeyText('shell.nav.dnaX')).toBe(false);
  expect(isKeyText('Projects')).toBe(false);
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
