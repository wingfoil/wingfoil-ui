// @vitest-environment jsdom
// task-020 — rendering a document (adr-002 markdown-it + DOMPurify; decisions W3-29, W3-31, W3-32):
// the Markdown structure, the link rewrite from the classification, and the guarantee that nothing
// active reaches the page (raw HTML shown as text, no script, no handler, no javascript:/data: URL).
import { describe, expect, it } from 'vitest';
import { classifyLink, resolveLink, type LinkLookup } from '../../../web/src/docs/links.js';
import { documentLinks, finishDocument, markdownToSafeHtml, type FinishOptions } from '../../../web/src/docs/render.js';

const DOC = 'docs/guide/a.md';
const LOOKUP: LinkLookup = {
  documents: new Set(['docs/guide/b.md', 'docs/guide/my file.md']),
  elements: new Map([['docs/04_memory/dl-001.md', 'dl-001']]),
  probes: new Map([
    ['docs/guide/missing.md', 'missing'],
    ['src/index.ts', 'hidden'],
  ]),
};

const OPTIONS: FinishOptions = {
  pid: 'p_x',
  classify: (href) => classifyLink(resolveLink(href, DOC), LOOKUP),
  marks: {
    broken: 'broken link',
    outside: 'outside the repository',
    hidden: 'not shown in the UI',
    unsupported: 'link not supported',
  },
  newTab: '(opens in a new tab)',
  imageNotShown: (alt) => `Image not shown: ${alt}`,
  tableLabel: (n) => `Table ${n}`,
};

function render(markdown: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = finishDocument(markdownToSafeHtml(markdown), OPTIONS);
  return host;
}

describe('Markdown structure', () => {
  it('renders headings with prefixed ids, lists, tables and code', () => {
    const host = render(
      '# Title\n\n## Key decisions\n\n## Key decisions\n\n- one\n- two\n\n1. first\n\n| A | B |\n|:-:|--:|\n| 1 | 2 |\n\n```\ncode\n```\n',
    );
    expect(host.querySelector('h1')?.id).toBe('doc-title');
    expect([...host.querySelectorAll('h2')].map((h) => h.id)).toEqual(['doc-key-decisions', 'doc-key-decisions-1']);
    expect(host.querySelectorAll('ul > li')).toHaveLength(2);
    expect(host.querySelectorAll('ol > li')).toHaveLength(1);
    const region = host.querySelector('div.doc-table')!;
    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(region.getAttribute('aria-label')).toBe('Table 1');
    expect(region.querySelector('table th')?.className).toBe('align-center');
    expect(region.querySelector('table td:last-child')?.className).toBe('align-right');
    expect(host.querySelector('[style]')).toBeNull();
    expect(host.querySelector('pre code')?.textContent).toBe('code\n');
  });

  it('a heading id cannot clobber a document property', () => {
    const host = render('# cookie\n\n# getElementById\n');
    expect([...host.querySelectorAll('h1')].map((h) => h.id)).toEqual(['doc-cookie', 'doc-getelementbyid']);
  });
});

describe('nothing active reaches the page (W3-29)', () => {
  const PAYLOADS = [
    '<script>window.__pwned = 1</script>',
    '<img src=x onerror="window.__pwned = 1">',
    '<a href="javascript:window.__pwned=1">x</a>',
    '[x](javascript:window.__pwned=1)',
    '[x](JAVASCRIPT:window.__pwned=1)',
    '[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    '[x](vbscript:msgbox)',
    '![x](javascript:alert(1))',
    '<iframe src="https://example.test"></iframe>',
    '<svg onload="window.__pwned=1"></svg>',
    '<style>body{display:none}</style>',
    '<form action="https://example.test"><input name=a></form>',
    '[x](<https://example.test/" onclick="alert(1)>)',
    '<details open ontoggle="window.__pwned=1">x</details>',
  ];

  it.each(PAYLOADS)('%s', (payload) => {
    const host = render(`before\n\n${payload}\n\nafter`);
    for (const el of host.querySelectorAll('*')) {
      expect(['SCRIPT', 'IFRAME', 'SVG', 'STYLE', 'FORM', 'INPUT', 'IMG', 'DETAILS', 'OBJECT', 'EMBED']).not.toContain(
        el.tagName,
      );
      for (const attr of el.getAttributeNames()) expect(attr.startsWith('on')).toBe(false);
      const href = el.getAttribute('href');
      if (href !== null) expect(href).toMatch(/^(https?:\/\/|\/p\/|#doc-)/);
    }
    expect(host.textContent).toContain('before');
    expect(host.textContent).toContain('after');
  });

  it('raw HTML is shown as written', () => {
    const host = render('Editing · <file> · N changes\n\n<!-- a comment -->\n');
    expect(host.textContent).toContain('Editing · <file> · N changes');
    expect(host.textContent).toContain('<!-- a comment -->');
  });
});

describe('links (W3-30, W3-32)', () => {
  it('an external link opens in a new tab without opener or referrer', () => {
    const a = render('[guide](https://example.test/guide)').querySelector('a')!;
    expect(a.getAttribute('href')).toBe('https://example.test/guide');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a.textContent).toBe('guide (opens in a new tab)');
    expect(a.querySelector('.visually-hidden')?.textContent).toBe(' (opens in a new tab)');
  });

  it('an indexed document is an in-UI link, its path encoded', () => {
    const [a, b] = [...render('[b](b.md#sec) and [f](my%20file.md)').querySelectorAll('a')];
    expect(a!.getAttribute('href')).toBe('/p/p_x/docs/docs/guide/b.md#sec');
    expect(a!.dataset.docNav).toBe('');
    expect(a!.hasAttribute('target')).toBe(false);
    expect(b!.getAttribute('href')).toBe('/p/p_x/docs/docs/guide/my%20file.md');
  });

  it('a Memory file links to its element panel', () => {
    const a = render('[dl](../04_memory/dl-001.md)').querySelector('a')!;
    expect(a.getAttribute('href')).toBe('/p/p_x/e/dl-001');
    expect(a.dataset.docNav).toBe('');
  });

  it('a fragment links to the prefixed heading id of the same document', () => {
    const a = render('# Top\n\n[up](#top)').querySelector('a')!;
    expect(a.getAttribute('href')).toBe('#doc-top');
    expect(a.dataset.docAnchor).toBe('doc-top');
  });

  it.each([
    ['missing.md', 'broken link'],
    ['../../../etc/hosts', 'outside the repository'],
    ['../../src/index.ts', 'not shown in the UI'],
    ['mailto:a@example.test', 'link not supported'],
  ])('%s is marked "%s" and is not a link', (href, mark) => {
    const host = render(`see [the text](${href}) here`);
    expect(host.querySelector('a')).toBeNull();
    const refused = host.querySelector('.doc-link-refused')!;
    expect(refused.textContent).toBe('the text');
    expect(refused.nextElementSibling?.className).toBe('doc-link-mark');
    expect(refused.nextElementSibling?.textContent).toBe(mark);
  });

  it('a link waiting for its classification is plain text', () => {
    const host = render('[x](unknown.md)');
    expect(host.querySelector('a')).toBeNull();
    expect(host.querySelector('.doc-link-pending')?.textContent).toBe('x');
  });

  it('documentLinks lists the hrefs to classify', () => {
    expect(documentLinks(markdownToSafeHtml('[a](b.md) [c](https://x.test) <https://y.test>'))).toEqual([
      'b.md',
      'https://x.test',
      'https://y.test',
    ]);
  });
});

describe('images (W3-31)', () => {
  it('are never loaded: their alternative text is shown, marked', () => {
    const host = render('![Architecture diagram](arch.png) ![remote](https://example.test/t.png)');
    expect(host.querySelector('img')).toBeNull();
    expect([...host.querySelectorAll('.doc-image')].map((e) => e.textContent)).toEqual([
      'Image not shown: Architecture diagram',
      'Image not shown: remote',
    ]);
  });
});
