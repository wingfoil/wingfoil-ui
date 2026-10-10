/**
 * The X-09.1 check on the key-rendering build (spec-008 §6, TT-ARC-09; W5-1, W5-3, decided by the
 * user 2026-10-10): every text of the page — its text nodes, and the accessible names and
 * descriptions written in attributes — is a key-catalogue text (its arguments filled by anything)
 * or project data. Project data is recognised from the API answers the page read: any string of
 * their JSON bodies, and the English (`en`) rendering of their dates (the element history's
 * `FormattedDate`) and relative ages (the Memory list's `formatRelativeTime`), which follow the
 * catalogue's locale. React Aria's own "Dismiss" label of a popover's hidden button is the one
 * documented library exception (W5-1).
 */
import type { Page } from '@playwright/test';
import { keyCatalogue } from '../../../web/scripts/catalogue.mjs';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };

/** React Aria's strings the catalogue does not hold (spec-008 §6 exception, W5-1). */
export const LIBRARY_STRINGS: ReadonlySet<string> = new Set(['Dismiss']);

/**
 * One pattern per key-catalogue text: the key alone, or the key followed by its arguments' values
 * (filled by anything, an empty argument included — a select's branches may use only some).
 */
const PATTERNS = Object.entries(keyCatalogue(en)).map(([id, text]) => {
  const key = id.replace(/\./g, '\\.');
  return new RegExp(text === id ? `^${key}$` : `^${key}( .*)?$`, 's');
});

/** Whether `text` is a key-catalogue text with its arguments filled. */
export function isKeyText(text: string): boolean {
  return PATTERNS.some((p) => p.test(text));
}

/** The project data the page read (recorded from the API answers). */
export interface DataRecorder {
  /** Every string, number and object key of the answers read so far. */
  strings(): Set<string>;
}

/** Record the JSON answers of the console's API that `page` reads from now on. */
export function recordApiData(page: Page): DataRecorder {
  const found = new Set<string>();
  const collect = (v: unknown): void => {
    if (typeof v === 'string') found.add(v.trim());
    else if (typeof v === 'number') found.add(String(v));
    else if (Array.isArray(v)) v.forEach(collect);
    else if (v !== null && typeof v === 'object') {
      for (const [k, value] of Object.entries(v)) {
        found.add(k);
        collect(value);
      }
    }
  };
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith('/api/') || url.pathname === '/api/events') return;
    if (!(response.headers()['content-type'] ?? '').includes('json')) return;
    response.json().then(collect, () => {});
  });
  return { strings: () => found };
}

/** A text of the page and where it is. */
interface PageText {
  text: string;
  where: string;
  /** Inside a rendered Markdown article (a document or a directive body: project content). */
  content: boolean;
}

/** The texts of the page: text nodes and the name/description attributes of every element. */
async function pageTexts(page: Page): Promise<PageText[]> {
  return page.evaluate(() => {
    const out: PageText[] = [];
    const where = (el: Element | null) =>
      el
        ? `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : ''}`
        : '?';
    const content = (el: Element | null) => el?.closest('.doc-article') != null;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent?.trim();
      if (t && !n.parentElement?.closest('script, style, template, noscript')) {
        out.push({ text: t, where: where(n.parentElement), content: content(n.parentElement) });
      }
    }
    const ATTRS = [
      'aria-label',
      'aria-description',
      'aria-roledescription',
      'aria-valuetext',
      'title',
      'alt',
      'placeholder',
    ];
    for (const el of document.body.querySelectorAll('*')) {
      for (const a of ATTRS) {
        const v = el.getAttribute(a)?.trim();
        if (v) out.push({ text: v, where: `${where(el)}@${a}`, content: content(el) });
      }
    }
    return out;
  });
}

/**
 * The forms the UI derives from project data and shows as data: path segments and folders, the
 * short (7-character) commit hash, a name's initials.
 */
function derivedForms(data: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const s of data) {
    const segments = s.split('/');
    for (let i = 0; i < segments.length; i++) {
      out.add(segments[i]!);
      out.add(segments.slice(0, i + 1).join('/'));
    }
    if (/^[0-9a-f]{40}$/.test(s)) out.add(s.slice(0, 7));
    const words = s.split(/\s+/).filter(Boolean);
    if (words.length > 0 && words.length <= 4) {
      out.add(words[0]!.charAt(0).toUpperCase());
      out.add(words.map((w) => w.charAt(0).toUpperCase()).join(''));
    }
  }
  return out;
}

/** The English renderings of the dates and ages among `data` (as the page formats them). */
async function intlRenderings(page: Page, data: Set<string>): Promise<Set<string>> {
  const dates = [...data].filter((s) => /^\d{4}-\d{2}-\d{2}T/.test(s));
  const rendered = await page.evaluate((iso) => {
    const out: string[] = [];
    const date = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
    for (const d of iso) out.push(date.format(new Date(d)));
    const rel = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    for (const unit of ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'] as const) {
      for (let v = -400; v <= 0; v++) out.push(rel.format(v, unit));
    }
    return out;
  }, dates);
  return new Set(rendered);
}

/** A number as the page formats it (a count, a position such as "1.2"). */
const NUMERAL = /^\d+([.,]\d+)*$/;

/** The texts of the page that are neither a key-catalogue text nor project data. */
export async function textsOutsideCatalogue(page: Page, recorder: DataRecorder): Promise<string[]> {
  const data = recorder.strings();
  const known = new Set([...data, ...derivedForms(data), ...(await intlRenderings(page, data))]);
  // Rendered Markdown (a document, a directive): each text is a piece of the file's content.
  // Whitespace compared collapsed: Markdown joins the lines of a paragraph.
  const flat = (t: string) => t.replace(/\s+/g, ' ');
  const sources = flat([...data].filter((s) => s.length > 200).join('\u0000'));
  // A repository path the UI builds from a data path (e.g. `.wingfoil/` + a directive's path).
  const isPathOfData = (t: string) => {
    const segments = t.split('/');
    return segments.length > 1 && segments.some((_, i) => i > 0 && known.has(segments.slice(i).join('/')));
  };
  const isData = (t: string, content: boolean) =>
    known.has(t) ||
    NUMERAL.test(t) ||
    t.split(/, | and /).every((part) => known.has(part.trim())) ||
    isPathOfData(t) ||
    (content && sources.includes(flat(t)));
  const bad = new Set<string>();
  for (const { text, where, content } of await pageTexts(page)) {
    if (isKeyText(text) || LIBRARY_STRINGS.has(text) || isData(text, content)) continue;
    bad.add(`${where}: ${text}`);
  }
  return [...bad];
}
