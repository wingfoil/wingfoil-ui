// @vitest-environment jsdom
// task-078 — the summary of an element (D78-2, N6; ux-reference §4.2 v0.3): the body's first
// top-level paragraph rendered as Markdown, HTML comments and headings left out, with the
// document's reference definitions; `undefined` when there is none.
import { describe, expect, it } from 'vitest';
import { summaryHtml } from '../../../web/src/element/summary.js';

function host(html: string | undefined): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html ?? '';
  return el;
}

describe('summaryHtml', () => {
  it('is the first paragraph after the comments and headings', () => {
    const body = '## Context\n\n<!-- The situation. -->\n\nWe need a *fast* server.\n\nSecond paragraph.\n';
    const el = host(summaryHtml(body));
    expect(el.querySelectorAll('p')).toHaveLength(1);
    expect(el.textContent).toBe('We need a fast server.');
    expect(el.querySelector('em')?.textContent).toBe('fast');
  });

  it('skips a list and a quote before it (only a top-level paragraph)', () => {
    const el = host(summaryHtml('- one\n- two\n\n> quoted\n\nThe summary with `code`.\n'));
    expect(el.textContent).toBe('The summary with code.');
    expect(el.querySelector('code')?.textContent).toBe('code');
  });

  it('resolves a reference link with the definitions of the whole body', () => {
    const el = host(summaryHtml('See [the vision][v].\n\n[v]: ../01_vision/a.md\n'));
    expect(el.querySelector('a')?.getAttribute('href')).toBe('../01_vision/a.md');
  });

  it('keeps a comment inside a code span', () => {
    expect(host(summaryHtml('Write `<!-- x -->` there.')).textContent).toBe('Write <!-- x --> there.');
  });

  it('shows raw HTML as text', () => {
    const el = host(summaryHtml('<img src=x onerror="window.__pwned=1"> and <b>b</b>'));
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('b')).toBeNull();
    expect(el.textContent).toBe('<img src=x onerror="window.__pwned=1"> and <b>b</b>');
  });

  it.each(['', '   \n', '## Only a heading\n', '<!-- only a comment -->\n', '- a list\n'])(
    'is undefined for %j',
    (body) => {
      expect(summaryHtml(body)).toBeUndefined();
    },
  );
});
