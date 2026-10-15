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
 *   path built on a data path, the 7-character commit hash; initials only inside an avatar, and
 *   the no-initials glyph `?` only inside the current user's avatar — aria-hidden, not language,
 *   task-035 D35-10); the
 *   `en` Intl rendering of their dates and of relative ages, which follow the catalogue's locale;
 *   and, inside a rendered Markdown article, a piece of the file's content.
 * - React Aria's "Dismiss" is accepted only as the name of a popover's hidden dismiss button
 *   (`button[tabindex="-1"]` in a `.menu-popover`), the one library exception (W5-1).
 * - A CLI command shown as data (spec-008 §6, task-035 D35-3): the text of a
 *   `code.cli-command[translate="no"]` is accepted only when it is exactly the *How to join*
 *   command (`joinCommand` of `web/src/project/join.ts`) rebuilt from a string value the page
 *   read (the email is one) and the key texts of its two placeholders — its words are WingFoil's CLI, never catalogue text.
 * - A frontmatter field name of the element panel's References (task-037 D37-13): the text of a
 *   `dt.field-name` inside `.drawer` is accepted only when it is a key of the `frontmatter` of a
 *   `GET /api/p/:pid/elements/:eid` answer read since `reset()` that the panel lists (`fieldEntries`) —
 *   the project's own field names.
 */
import type { Page, Request } from '@playwright/test';
import { COLD_READ_MS } from './cold-read.js';
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { joinCommand } from '../../../web/src/project/join.js';
import { fieldEntries } from '../../../web/src/element/model.js';
import { NO_INITIALS } from '../../../web/src/project/model.js';

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
  /**
   * Forget what was read: a screen is opened anew (each screen reloads the page). With
   * `untilNavigation`, what is read until the main frame's next navigation is forgotten too — the
   * requests of the page being left (review round 4, R4-2).
   */
  reset(options?: { untilNavigation?: boolean }): void;
  /** The frontmatter keys of the elements read since the last `reset()` (D37-13); none if absent. */
  fieldNames?(): Promise<Set<string>>;
  /**
   * Why answers since the last `reset()` could not be learnt (bug-015), and the reads set aside as
   * the page left's at the navigation (R5-1); none if absent.
   */
  failures?(): Promise<string[]>;
  /** How many answers were learnt (or failed) since the last `reset()`: new data since an attempt. */
  answers?(): number;
}

/** Options of {@link recordApiData}. */
export interface RecordOptions {
  /** How long the data waits for an answer the page asked for (default `COLD_READ_MS`). */
  answerTimeoutMs?: number;
}

/** The path of one element's read (`GET /api/p/:pid/elements/:eid`). */
const ELEMENT_READ = /^\/api\/p\/[^/]+\/elements\/[^/]+$/;

/** The data of the answers read since one `reset()` (one screen opening). */
interface Generation {
  found: Set<string>;
  fields: Set<string>;
  /** Why an answer could not be learnt (bug-015): a failed body read, or no answer in time. */
  failures: string[];
  /** The answers still on their way or being parsed, with their request line. */
  pending: Map<Promise<void>, string>;
  /** Answers learnt or failed. */
  answers: number;
  /** The request lines filed here, in order. */
  lines: string[];
  /**
   * The reads set aside at the navigation that started this generation, as the page left's
   * (R4-2): named as a possible cause of what is flagged (review R5-1) — a `request` event of the
   * new page can reach the test before the navigation's.
   */
  ignored: string[];
}

/**
 * Record the JSON answers of the console's API that `page` reads from now on. A request is followed
 * from the moment the page sends it (bug-015): the data of every answer the page asked for before
 * the check reads it is waited for (`COLD_READ_MS` at most), even when its answer or its `response`
 * event arrives after the page already shows it; a request that fails (aborted by a navigation)
 * brings no data and is no error; a body that cannot be read is recorded as a failure, reported
 * with what the check flags (`textsOutsideCatalogue`), never swallowed.
 */
export function recordApiData(page: Page, options: RecordOptions = {}): DataRecorder {
  const answerTimeoutMs = options.answerTimeoutMs ?? COLD_READ_MS;
  const fresh = (): Generation => ({
    found: new Set(),
    fields: new Set(),
    failures: [],
    pending: new Map(),
    answers: 0,
    lines: [],
    ignored: [],
  });
  let current = fresh();
  let resetAtNavigation = false;
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame() || !resetAtNavigation) return;
    resetAtNavigation = false;
    const left = current;
    current = fresh();
    current.ignored = [...left.lines];
  });
  const settle = new Map<Request, (finished: boolean) => void>();
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
  const learn = (gen: Generation, pathname: string, body: unknown): void => {
    collect(gen.found, body);
    if (pathname.endsWith('/config')) names(gen.found, body);
    if (ELEMENT_READ.test(pathname)) {
      const frontmatter = (body as { frontmatter?: unknown } | null)?.frontmatter;
      if (frontmatter !== null && typeof frontmatter === 'object') {
        // Only the fields the panel lists under References (review F11).
        for (const e of fieldEntries(frontmatter as Record<string, unknown>)) gen.fields.add(e.field);
      }
    }
  };
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/') || url.pathname === '/api/events') return;
    // The data belongs to the opening that asked for it, whenever the answer arrives.
    const gen = current;
    const line = `${request.method()} ${url.pathname}${url.search}`;
    const answered = new Promise<boolean>((resolve) => settle.set(request, resolve));
    const work = answered.then(async (finished) => {
      settle.delete(request);
      if (!finished) return;
      try {
        const response = await request.response();
        if (!response || !(response.headers()['content-type'] ?? '').includes('json')) return;
        learn(gen, url.pathname, await response.json());
        gen.answers += 1;
      } catch (error) {
        gen.answers += 1;
        gen.failures.push(
          `answer not read: ${line} (${error instanceof Error ? error.message.split('\n')[0] : String(error)})`,
        );
      }
    });
    gen.lines.push(line);
    gen.pending.set(work, line);
    void work.finally(() => gen.pending.delete(work));
  });
  page.on('requestfinished', (request) => settle.get(request)?.(true));
  page.on('requestfailed', (request) => settle.get(request)?.(false));
  /** Wait for every answer of `gen` requested so far (and those requested meanwhile), bounded. */
  const settled = async (gen: Generation): Promise<void> => {
    const deadline = Date.now() + answerTimeoutMs;
    while (gen.pending.size > 0) {
      const left = deadline - Date.now();
      if (left <= 0) {
        for (const line of gen.pending.values())
          gen.failures.push(`answer not received in ${answerTimeoutMs} ms: ${line}`);
        gen.pending.clear();
        return;
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        Promise.all([...gen.pending.keys()]),
        new Promise((resolve) => (timer = setTimeout(resolve, left))),
      ]);
      clearTimeout(timer);
    }
  };
  return {
    strings: async () => {
      const gen = current;
      await settled(gen);
      return gen.found;
    },
    reset: (opts) => {
      current = fresh();
      resetAtNavigation = opts?.untilNavigation === true;
    },
    fieldNames: async () => {
      const gen = current;
      await settled(gen);
      return gen.fields;
    },
    failures: async () => {
      const gen = current;
      await settled(gen);
      return [...gen.failures, ...gen.ignored.map((line) => `ignored as a read of the page left: ${line}`)];
    },
    answers: () => current.answers,
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
  /** Inside the current user's avatar (`.current-user-avatar`, aria-hidden; D35-10). */
  userAvatar: boolean;
  /** The name of a popover's hidden dismiss button (React Aria). */
  dismiss: boolean;
  /** Inside a CLI command shown as data (`code.cli-command[translate="no"]`, D35-3). */
  command: boolean;
  /** A field name of the element panel's References (`.drawer dt.field-name`, D37-13). */
  fieldName: boolean;
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
      userAvatar: el?.closest('.current-user-avatar') != null,
      command: el?.closest('code.cli-command[translate="no"]') != null,
      fieldName: el?.closest('.drawer dt.field-name') != null,
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
    out.push({
      text: document.title,
      where: '<title>',
      content: false,
      avatar: false,
      userAvatar: false,
      dismiss: false,
      command: false,
      fieldName: false,
    });
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

/** The *How to join* commands the key build shows for the emails among `data` (D35-3). */
function joinCommands(data: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const email of data) {
    out.add(joinCommand({ name: 'shell.howToJoin.placeholderName', email, roles: 'shell.howToJoin.placeholderRoles' }));
  }
  return out;
}

/** Data strings longer than this are file contents (a document, an element body), not values. */
const LONG_DATA = 200;

/** The texts of the page that are neither a key-catalogue text nor project data. */
export async function textsOutsideCatalogue(page: Page, recorder: DataRecorder): Promise<string[]> {
  const data = await recorder.strings();
  const known = new Set([...data, ...derivedForms(data), ...(await intlRenderings(page, data))]);
  // The words of short data strings only (a name, a title, a date): a whole document or element
  // body would make any word acceptable after a key (review round 2).
  const words = new Set([...known].filter((s) => s.length <= LONG_DATA).flatMap((s) => s.split(/\s+/)));
  const avatars = initials(data);
  const commands = joinCommands(data);
  const fieldNames = (await recorder.fieldNames?.()) ?? new Set<string>();
  // Whitespace compared collapsed: Markdown joins the lines of a paragraph.
  const flat = (t: string) => t.replace(/\s+/g, ' ');
  const sources = flat([...data].filter((s) => s.length > LONG_DATA).join('\u0000'));
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
  for (const { text, where, content, avatar, userAvatar, dismiss, command, fieldName } of await pageTexts(page)) {
    if (isKeyText(text, (w) => words.has(w)) || isData(text, content)) continue;
    if (avatar && avatars.has(text)) continue;
    if (userAvatar && text === NO_INITIALS) continue;
    if (dismiss && text === LIBRARY_DISMISS) continue;
    if (command && commands.has(text)) continue;
    if (fieldName && fieldNames.has(text)) continue;
    bad.add(`${where}: ${text}`);
  }
  // A text flagged may be data of an answer the recorder could not read: say so (bug-015).
  if (bad.size > 0) for (const failure of (await recorder.failures?.()) ?? []) bad.add(failure);
  return [...bad];
}

/**
 * The X-09.1 check of a screen (bug-015, review round 4): {@link textsOutsideCatalogue} once every
 * answer the page asked for is learnt (each waited for within the recorder's bound, a hung one
 * recorded as the cause), repeated only while the recorder learnt new data during the previous
 * attempt (an answer whose request reached the test late), at most `COLD_READ_MS`; a text still
 * flagged with no new data is reported at once — a transient text is not waited away (R4-3).
 */
export async function screenTextsOutsideCatalogue(page: Page, recorder: DataRecorder): Promise<string[]> {
  const deadline = Date.now() + COLD_READ_MS;
  await recorder.strings();
  for (;;) {
    const before = recorder.answers?.() ?? 0;
    const outside = await textsOutsideCatalogue(page, recorder);
    if (outside.length === 0) return outside;
    const learnt = (recorder.answers?.() ?? 0) > before;
    if (!learnt || Date.now() >= deadline) return outside;
  }
}
