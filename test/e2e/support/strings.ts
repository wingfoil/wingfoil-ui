/**
 * The X-09.1 check on the key-rendering build (spec-008 §6, TT-ARC-09; W5-1, W5-3, decided by the
 * user 2026-10-10; tightened in review round 1): every text of the page — its text nodes, and the
 * accessible names and descriptions written in attributes, and the tab title — is a key-catalogue
 * text or project data.
 *
 * - A key text is a catalogue key alone, or a key taking arguments followed by their values: each
 *   word after the key is project data, a numeral, another key (a nested message), or one of the
 *   message's own `select` options (the key build renders a select's value as given). A key
 *   without arguments must stand alone.
 * - Project data is recognised from the API answers read since the screen was opened (`reset()`):
 *   the string and number values of their JSON bodies — not their object keys, except the names
 *   of the project's memory types and DNA path categories, which the Memory list and the DNA view
 *   show (data by spec-008 §3); the forms the UI derives from data (path segments and folders, a
 *   path built on a data path, the 7-character commit hash; initials only inside an avatar); the
 *   `en` Intl rendering of their dates and of relative ages, which follow the catalogue's locale;
 *   and, inside a rendered Markdown article, a piece of the file's content.
 * - React Aria's "Dismiss" is accepted only as the name of a popover's hidden dismiss button
 *   (`button[tabindex="-1"]` in a `.menu-popover`), the one library exception (W5-1).
 */
import type { Page } from '@playwright/test';
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };

/** React Aria's own string (spec-008 §6 exception, W5-1). */
export const LIBRARY_DISMISS = 'Dismiss';

const CATALOGUE: Readonly<Record<string, string>> = en;

/** The select options of a message (its values the key build renders as given). */
function selectOptions(elements: MessageFormatElement[], out = new Set<string>()): Set<string> {
  for (const el of elements) {
    if (el.type === TYPE.select || el.type === TYPE.plural) {
      if (el.type === TYPE.select) for (const k of Object.keys(el.options)) out.add(k);
      for (const option of Object.values(el.options)) selectOptions(option.value, out);
    } else if (el.type === TYPE.tag) selectOptions(el.children, out);
  }
  return out;
}

/** Per key: whether it takes arguments, and its select options. */
const KEYS = new Map(
  Object.entries(CATALOGUE).map(([id, message]) => {
    const ast = parse(message);
    return [id, { args: ast.some((el) => el.type !== TYPE.literal), options: selectOptions(ast) }] as const;
  }),
);

/** A number as the page formats it (a count, a position such as "1.2"). */
const NUMERAL = /^\d+([.,]\d+)*$/;

/**
 * Whether `text` is a key-catalogue text: a key alone, or a key taking arguments followed by words
 * each of which `isData` accepts, is a numeral, a key, or one of the message's select options.
 */
export function isKeyText(text: string, isData: (word: string) => boolean = () => false): boolean {
  const [key, ...rest] = text.split(/\s+/);
  const entry = KEYS.get(key ?? '');
  if (!entry) return false;
  if (rest.length === 0) return true;
  if (!entry.args) return false;
  return rest.every((w) => isData(w) || NUMERAL.test(w) || KEYS.has(w) || entry.options.has(w));
}

/** The project data the page read (recorded from the API answers). */
export interface DataRecorder {
  /** Every string and number value read since the last `reset()`, once every answer is parsed. */
  strings(): Promise<Set<string>>;
  /** Forget what was read: a screen is opened anew (each screen reloads the page). */
  reset(): void;
}

/** Record the JSON answers of the console's API that `page` reads from now on. */
export function recordApiData(page: Page): DataRecorder {
  let found = new Set<string>();
  const pending = new Set<Promise<void>>();
  const collect = (into: Set<string>, v: unknown): void => {
    if (typeof v === 'string') into.add(v.trim());
    else if (typeof v === 'number') into.add(String(v));
    else if (Array.isArray(v)) v.forEach((x) => collect(into, x));
    else if (v !== null && typeof v === 'object') Object.values(v).forEach((x) => collect(into, x));
  };
  /** The names of the project's memory types and DNA path categories (map keys that are data). */
  const names = (into: Set<string>, body: unknown): void => {
    const config = body as { types?: { data?: { types?: object } }; paths?: { data?: object } };
    for (const k of Object.keys(config.types?.data?.types ?? {})) into.add(k);
    for (const k of Object.keys(config.paths?.data ?? {})) into.add(k);
  };
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith('/api/') || url.pathname === '/api/events') return;
    if (!(response.headers()['content-type'] ?? '').includes('json')) return;
    const into = found;
    const parsing = response.json().then(
      (body: unknown) => {
        collect(into, body);
        if (url.pathname.endsWith('/config')) names(into, body);
      },
      () => {},
    );
    pending.add(parsing);
    void parsing.finally(() => pending.delete(parsing));
  });
  return {
    strings: async () => {
      await Promise.all([...pending]);
      return found;
    },
    reset: () => {
      found = new Set();
    },
  };
}

/** A text of the page and where it is. */
interface PageText {
  text: string;
  where: string;
  /** Inside a rendered Markdown article (a document or a directive body: project content). */
  content: boolean;
  /** An avatar's initials. */
  avatar: boolean;
  /** The name of a popover's hidden dismiss button (React Aria). */
  dismiss: boolean;
}

/** The texts of the page: text nodes and the name/description attributes of every element. */
async function pageTexts(page: Page): Promise<PageText[]> {
  return page.evaluate(() => {
    const out: PageText[] = [];
    const where = (el: Element | null) =>
      el
        ? `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : ''}`
        : '?';
    const flags = (el: Element | null) => ({
      content: el?.closest('.doc-article') != null,
      avatar: el?.closest('.current-user-avatar, .member-initials') != null,
    });
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent?.trim();
      if (t && !n.parentElement?.closest('script, style, template, noscript')) {
        out.push({ text: t, where: where(n.parentElement), dismiss: false, ...flags(n.parentElement) });
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
        if (!v) continue;
        const dismiss =
          a === 'aria-label' && el.matches('button[tabindex="-1"]') && el.closest('.menu-popover') !== null;
        out.push({ text: v, where: `${where(el)}@${a}`, dismiss, ...flags(el) });
      }
    }
    out.push({ text: document.title, where: '<title>', content: false, avatar: false, dismiss: false });
    return out;
  });
}

/** The forms the UI derives from project data: path segments and folders, the short commit hash. */
function derivedForms(data: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const s of data) {
    const segments = s.split('/');
    for (let i = 0; i < segments.length; i++) {
      out.add(segments[i]!);
      out.add(segments.slice(0, i + 1).join('/'));
    }
    if (/^[0-9a-f]{40}$/.test(s)) out.add(s.slice(0, 7));
  }
  return out;
}

/** A name's initials as an avatar shows them (the first letter, or of the first two words). */
function initials(data: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const s of data) {
    const words = s.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 4) continue;
    out.add(words[0]!.charAt(0).toUpperCase());
    out.add(
      words
        .slice(0, 2)
        .map((w) => w.charAt(0).toUpperCase())
        .join(''),
    );
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

/** The texts of the page that are neither a key-catalogue text nor project data. */
export async function textsOutsideCatalogue(page: Page, recorder: DataRecorder): Promise<string[]> {
  const data = await recorder.strings();
  const known = new Set([...data, ...derivedForms(data), ...(await intlRenderings(page, data))]);
  const words = new Set([...known].flatMap((s) => s.split(/\s+/)));
  const avatars = initials(data);
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
  for (const { text, where, content, avatar, dismiss } of await pageTexts(page)) {
    if (isKeyText(text, (w) => words.has(w)) || isData(text, content)) continue;
    if (avatar && avatars.has(text)) continue;
    if (dismiss && text === LIBRARY_DISMISS) continue;
    bad.add(`${where}: ${text}`);
  }
  return [...bad];
}
