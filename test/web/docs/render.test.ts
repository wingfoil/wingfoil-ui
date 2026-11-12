// @vitest-environment jsdom
// task-020 — rendering a document (adr-002 markdown-it + DOMPurify; decisions W3-29, W3-31, W3-32):
// the Markdown structure, the link rewrite from the classification, and the guarantee that nothing
// active reaches the page (raw HTML shown as text, no script, no handler, no javascript:/data: URL).
import { describe, expect, it } from 'vitest';
import { classifyLink, resolveLink, type LinkLookup } from '../../../web/src/docs/links.js';
import {
  commentFreeMarkdown,
  documentLinks,
  finishDocument,
  markdownToSafeHtml,
  type FinishOptions,
} from '../../../web/src/docs/render.js';
import { agrees } from './commonmark-oracle.js';

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
  documentPath: DOC,
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
    expect(region.getAttribute('data-doc-table')).toBe('0');
    expect(region.querySelector('table th')?.className).toBe('align-center');
    expect(region.querySelector('table td:last-child')?.className).toBe('align-right');
    expect(host.querySelector('[style]')).toBeNull();
    expect(host.querySelector('pre code')?.textContent).toBe('code\n');
  });

  it('a table label is text, kept even when it reads like a URL scheme (review F5)', () => {
    const host = document.createElement('div');
    host.innerHTML = finishDocument(markdownToSafeHtml('| A |\n|---|\n| 1 |'), {
      ...OPTIONS,
      tableLabel: (n) => `Tabelle: ${n}`,
    });
    expect(host.querySelector('.doc-table')?.getAttribute('aria-label')).toBe('Tabelle: 1');
  });

  it('heading ids are unique even when a slug equals a suffixed one (review F3)', () => {
    const host = render('# A\n\n# A\n\n# A-1\n\n# A\n');
    expect([...host.querySelectorAll('h1')].map((h) => h.id)).toEqual(['doc-a', 'doc-a-1', 'doc-a-1-1', 'doc-a-2']);
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
    expect(a.querySelector('.visually-hidden')?.textContent).toBe('(opens in a new tab)');
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

  it('a fragment links to the same document with the fragment in its URL (review F2)', () => {
    const a = render('# Top\n\n[up](#top)').querySelector('a')!;
    expect(a.getAttribute('href')).toBe('/p/p_x/docs/docs/guide/a.md#top');
    expect(a.dataset.docNav).toBe('');
  });

  it('every link and its replacement keep a stable key (review F1)', () => {
    const host = render('[a](b.md) [x](missing.md) [y](unknown.md) [z](https://x.test)');
    expect([...host.querySelectorAll('[data-doc-link]')].map((e) => [e.tagName, e.getAttribute('data-doc-link')])).toEqual([
      ['A', '0'],
      ['SPAN', '1'],
      ['SPAN', '2'],
      ['A', '3'],
    ]);
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
    expect(host.querySelector('.doc-link-unresolved')?.textContent).toBe('x');
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

// task-078 — the element document (D78-1, D78-3; the approver's Q2 (b)).
describe('HTML comments left out of an element document (D78-3)', () => {
  const drop = (markdown: string): HTMLElement => {
    const host = document.createElement('div');
    host.innerHTML = finishDocument(markdownToSafeHtml(markdown, { comments: 'drop' }), OPTIONS);
    return host;
  };

  it('drops a comment block, one spanning lines and an inline comment', () => {
    const host = drop(
      '## Context\n\n<!-- The situation. -->\n\nText <!-- inline --> after.\n\n<!-- one\n     two -->\n\n## Decision\n',
    );
    expect(host.textContent).not.toContain('<!--');
    expect(host.textContent).not.toContain('The situation.');
    expect(host.textContent).not.toContain('two');
    expect(host.querySelector('p')?.textContent).toBe('Text  after.');
    expect([...host.querySelectorAll('h2')].map((h) => h.textContent)).toEqual(['Context', 'Decision']);
  });

  it('keeps a comment inside code (a span, a fence, an indented block)', () => {
    const host = drop('Use `<!-- x -->` here.\n\n```\n<!-- fenced -->\n```\n\n    <!-- indented -->\n');
    expect([...host.querySelectorAll('code')].map((c) => c.textContent?.trim())).toEqual([
      '<!-- x -->',
      '<!-- fenced -->',
      '<!-- indented -->',
    ]);
  });

  it('an unclosed comment runs to the end, as the v0.1 summary did', () => {
    const host = drop('First.\n\n<!-- never closed\n\nSecond.\n');
    expect(host.textContent?.trim()).toBe('First.');
  });

  it('other raw HTML stays text, and the default keeps the comments (the Documentation view)', () => {
    expect(drop('<b>bold</b> <!-- c -->').textContent?.trim()).toBe('<b>bold</b>');
    expect(render('<!-- c -->').textContent).toContain('<!-- c -->');
  });

  it.each(['<!-- a --><script>window.__pwned = 1</script>', '<!--> <img src=x onerror=alert(1)> -->'])(
    'dropping a comment never makes markup: %s',
    (payload) => {
      const host = drop(`before\n\n${payload}\n\nafter`);
      for (const el of host.querySelectorAll('*')) {
        expect(['SCRIPT', 'IMG']).not.toContain(el.tagName);
        for (const attr of el.getAttributeNames()) expect(attr.startsWith('on')).toBe(false);
      }
    },
  );
});

describe('link groups (D78-1)', () => {
  it('the mark of a refused link carries the key of its link', () => {
    const host = render('[x](missing.md)');
    expect(host.querySelector('.doc-link-mark')?.getAttribute('data-doc-mark')).toBe('0');
  });

  it('a heading prefix other than doc- (the element document)', () => {
    const host = document.createElement('div');
    host.innerHTML = finishDocument(markdownToSafeHtml('# Context\n\n[top](#context)'), {
      ...OPTIONS,
      headingPrefix: 'eldoc-',
      hrefOf: (_path, fragment) => `#${encodeURIComponent(fragment)}`,
    });
    expect(host.querySelector('h1')?.id).toBe('eldoc-context');
    expect(host.querySelector('a')?.getAttribute('href')).toBe('#context');
  });
});

// task-078 security review round 1: F-1 (only the comment is dropped, the text around it stays) and
// F-4 (the rules are checked before DOMPurify, on markdown-it's own tokens and output).
describe('the comment rules drop only the comment (review round 1, F-1, F-4)', () => {
  const drop = (markdown: string): string =>
    finishDocument(markdownToSafeHtml(markdown, { comments: 'drop' }), OPTIONS).replace(/\s+/g, ' ');
  const text = (markdown: string): string => {
    const host = document.createElement('div');
    host.innerHTML = drop(markdown);
    return (host.textContent ?? '').replace(/\s+/g, ' ').trim();
  };

  it('F-1 — the text after a comment on its line is kept', () => {
    expect(text('<!-- hint --> Decision: we do NOT approve.')).toBe('Decision: we do NOT approve.');
  });

  it('F-1 — the text after an indented comment, and the next line, are kept', () => {
    expect(text('   <!-- hint -->Second line kept?\nmore text')).toBe('Second line kept? more text');
  });

  it('F-1 — an unclosed inline comment opener is text, as CommonMark reads it', () => {
    expect(text('Write <!-- to open a comment.')).toBe('Write <!-- to open a comment.');
  });

  // Each case agrees with the CommonMark oracle (`commonmark-oracle.ts`) since review round 4, R4-2;
  // before it, the table compared each case with the same Markdown without its comment, which
  // R4-2's alignment changes on purpose for the R2-3 and R2-4 cases (a comment line now ends the
  // paragraph it is in, as CommonMark's HTML block does).
  const CASES: string[] = [
    '<!-- a -->\n\nText.\n',
    'Text <!-- a --> after.\n',
    '<!-- one\n two -->\n\n## Heading\n',
    '<!-- hint --> Decision.\n',
    // A comment line ends the paragraph it is in (review round 4, R4-2: CommonMark's HTML block).
    'Line\n<!-- a -->\nNext\n',
    '- item <!-- a --> b\n',
    '<!-- a --><script>x</script>\n',
    // `<!-->` is a whole (empty) comment (CommonMark 0.31, HTML): what follows it is text.
    '<!--> <img src=x onerror=alert(1)> -->\n',
    // Review round 2, R2-3: a comment line with text inside a paragraph, a quote and a lazy line.
    'Line\n<!-- a --> tail',
    '> q\n> <!-- a --> tail',
    '- a\n<!-- c --> lazy',
    // Review round 2, R2-2: a comment over several lines, text after its close — only that text.
    '<!--\n# hidden heading\n--> tail',
    '<!--\n[hidden](http://evil.example)\n\nstill hidden\n--> tail',
    'Intro\n\n<!--\nGuidance: one paragraph.\n\nExample: [ex](http://example.com)\n--> Real text.',
    // Review round 2, R2-4: a comment line before `===` is no setext heading's text; a comment line
    // inside a list item's paragraph leaves a line break between its neighbours.
    '<!-- c -->\n===',
    '- item\n  <!-- c -->\n  more',
    // Review round 3, R3-1: a comment over several lines ends with its container (a list item, a
    // quote's lazy lines), as markdown-it's own HTML block does: what lies outside stays shown.
    '- <!-- a\n\npara outside list\n\n# Heading outside\n',
    '1. <!-- x\n2. second\n3. third -->',
    '- a\n- <!-- b\n- c\n\n-->',
    '- item\n  <!-- a\n\nOutside para\n\n  -->',
    '> <!-- a\nb -->\nvisible',
    '> > <!-- a\n> b\n-->',
    // Review round 4, R4-1: a blank line inside the comment does not end it (only a non-blank line
    // outside the container does).
    '- x\n  <!--\n\n  secret [link](http://e)\n  -->\n',
    '- <!-- a\n\n  hidden\n  b -->\n- c',
    // Review round 4, R4-3: in a tight list the text after the comment does not glue to the next line.
    '- a\n- <!-- x\n  y --> tail\n  next\n',
    // Review round 4, R4-2: a comment line ends its block, so an indented code block may follow.
    'Intro\n<!-- c -->\n    <!-- shown as code -->\n',
    '<!-- n --> Run:\n    npm ci\n',
    // Review round 1, F-1, and the text after the comment on its line.
    '<!-- hint --> Decision: we do NOT approve.',
    '   <!-- hint -->Second line kept?\nmore text',
    'Write <!-- to open a comment.',
    // The text after `-->` loses a later unclosed comment, as the HTML tokenizer hides it.
    '<!-- a --> tail <!-- b\nnext line',
    '<!-- a --> x <!-- b --> y',
    // Blanks before an inline comment at a line end make no hard line break (CommonMark's inline HTML).
    'Text  <!-- c -->\nmore',
    // `--!>` also closes a comment for the browser: the text after it in the block is shown.
    '<!-- a --!> shown\n-->',
  ];

  it.each(CASES)('F-4 — %j agrees with CommonMark with its comments left out', (source) => {
    const tokens = commentFreeMarkdown.parse(source, {});
    const all = tokens.flatMap((t) => [t, ...(t.children ?? [])]);
    expect(all.filter((t) => t.type.startsWith('html_'))).toEqual([]);
    const { text: [gotText, wantText], structure: [got, want] } = agrees(source);
    expect(gotText).toBe(wantText);
    expect(got).toBe(want);
  });
});

// Review round 4, R4-2: a bounded, seeded fuzz of the comment rules against the CommonMark oracle —
// pieces of Markdown structure, comment openers and closers, text and line breaks.
describe('the comment rules agree with CommonMark on generated bodies (review round 4, R4-2)', () => {
  const PIECES = [
    '<!--',
    '-->',
    '<!-- a -->',
    '<!-->',
    '<!--->',
    '--!>',
    // Review round 5, R5-2: line endings, tabs, other list markers, fences, a table, a reference
    // definition and its use, NUL, lazy quotes and a tight list.
    '\r\n',
    '\t',
    '10. ',
    '* ',
    '+ ',
    '```',
    '~~~',
    '\n| a | b |\n|---|---|\n| c | d |\n',
    '\n[r]: http://e.x\n',
    '[r]',
    '\0',
    '> a\nlazy',
    '\n- a\n- b\n',
    '\n- a\n  <!-- c -->\n  b\n- d\n',
    'text',
    'word',
    ' ',
    '\n',
    '\n',
    '\n\n',
    '- ',
    '1. ',
    '> ',
    '    ',
    '  ',
    '# ',
    '===',
    '`x`',
    '[l](u)',
    '*e*',
    '--',
    '-',
  ];
  /** A seeded generator (mulberry32): the same cases on every run. */
  function random(seed: number): () => number {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const next = random(78);
  const bodies = Array.from({ length: 400 }, () =>
    Array.from({ length: 4 + Math.floor(next() * 14) }, () => PIECES[Math.floor(next() * PIECES.length)]!).join(''),
  );

  it('400 bodies: the same text and structure, and no html_* token', () => {
    const differ: string[] = [];
    // Every body is compared: the oracle reads inline comments by CommonMark 0.31 (review round 5,
    // R5-1).
    for (const body of bodies) {
      const tokens = commentFreeMarkdown.parse(body, {});
      if (tokens.flatMap((t) => [t, ...(t.children ?? [])]).some((t) => t.type.startsWith('html_'))) differ.push(body);
      const { text, structure } = agrees(body);
      if (text[0] !== text[1] || structure[0] !== structure[1]) differ.push(body);
    }
    expect(differ).toEqual([]);
  });
});
