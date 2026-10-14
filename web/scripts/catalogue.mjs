// @ts-check
/**
 * The web message catalogue's build-time tools (spec-008 §6): the arguments of an ICU message, the
 * key-rendering catalogue, and the catalogue check (ids used in the code against `en.json`, sorted
 * file, id pattern and areas). Plain JavaScript so that `vite.config.ts`, the ESLint rule
 * `wfui/catalogue-placeholders` and `npm run lint` share one implementation.
 */
import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { parse, TYPE } from '@formatjs/icu-messageformat-parser';

/** The `web/` folder. */
export const WEB_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** The English catalogue (spec-008 §1). */
export const CATALOGUE_FILE = path.join(WEB_DIR, 'src', 'i18n', 'en.json');

/** Form of every message id (spec-008 §6). */
export const ID_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/;

/** The `<area>` segments of spec-008 §2 used by the web catalogue (`launcher` is the server's). */
export const AREAS = [
  'shell',
  'projects',
  'memory',
  'element',
  'dna',
  'directives',
  'team',
  'docs',
  'today',
  'title',
  'error',
  'state',
  'a11y',
  'common',
];

/**
 * The argument names of an ICU message in order of first appearance: simple, number, date, plural
 * and select arguments, also nested in plural/select options and rich-text tags. Rich-text tag
 * names are listed separately (`tags`): they are values too, but no key-build placeholder.
 * @param {string} message
 * @returns {{ args: string[], tags: string[] }}
 */
export function messageArguments(message) {
  /** @type {Set<string>} */
  const args = new Set();
  /** @type {Set<string>} */
  const tags = new Set();
  /** @param {import('@formatjs/icu-messageformat-parser').MessageFormatElement[]} elements */
  const walk = (elements) => {
    for (const el of elements) {
      if (el.type === TYPE.literal || el.type === TYPE.pound) continue;
      if (el.type === TYPE.tag) {
        tags.add(el.value);
        walk(el.children);
        continue;
      }
      args.add(el.value);
      if (el.type === TYPE.plural || el.type === TYPE.select) {
        for (const option of Object.values(el.options)) walk(option.value);
      }
    }
  };
  walk(parse(message));
  return { args: [...args], tags: [...tags] };
}

/**
 * The key-rendering catalogue of spec-008 §6: every message replaced by its key followed by a
 * ` {argument}` placeholder per argument (a plural or select argument too), so that project data
 * passed as an argument is still rendered (X-09.2).
 * @param {Record<string, string>} catalogue
 * @returns {Record<string, string>}
 */
export function keyCatalogue(catalogue) {
  /** @type {Record<string, string>} */
  const keys = {};
  for (const [id, message] of Object.entries(catalogue)) {
    keys[id] = [id, ...messageArguments(message).args.map((a) => `{${a}}`)].join(' ');
  }
  return keys;
}

/**
 * `html` (`index.html`) with its static `<title>` set to the catalogue's `title.app` (W5-2): the tab
 * title before the application sets one, from the catalogue like every UI string (the key build:
 * the key).
 * @param {string} html
 * @param {Record<string, string>} catalogue
 * @returns {string}
 */
export function withAppTitle(html, catalogue) {
  const title = /<title>[^<]*<\/title>/;
  if (!title.test(html)) throw new Error('index.html has no <title> element');
  const text = String(catalogue['title.app'] ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  return html.replace(title, `<title>${text}</title>`);
}

/** @param {string} dir @returns {Promise<string[]>} */
async function sourceFiles(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && /\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts'))
    .map((e) => path.join(e.parentPath, e.name))
    .sort();
}

/**
 * The message descriptors used in `files` (`@formatjs/cli extract`): `FormattedMessage`,
 * `formatMessage`, `defineMessage(s)`.
 * @param {string[]} files
 * @returns {Promise<Record<string, { defaultMessage?: string }>>}
 */
export async function extractIds(files) {
  if (files.length === 0) return {};
  const bin = path.join(
    WEB_DIR,
    '..',
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'formatjs.cmd' : 'formatjs',
  );
  const { stdout } = await promisify(execFile)(bin, ['extract', '--throws', ...files], { maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(stdout);
}

/**
 * Problems of the catalogue against the code (spec-008 §6): unsorted keys, an id off the pattern or
 * of an unknown area, a message that is not valid ICU, an id used in the code but missing from the
 * catalogue, a catalogue id no code uses, a `defaultMessage` written in the code.
 * @param {{ catalogue?: Record<string, string>, srcDir?: string }} [options]
 * @returns {Promise<string[]>}
 */
export async function checkCatalogue(options = {}) {
  const catalogue = options.catalogue ?? JSON.parse(await readFile(CATALOGUE_FILE, 'utf8'));
  const problems = [];
  const ids = Object.keys(catalogue);
  const sorted = [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (ids.some((id, i) => id !== sorted[i])) problems.push('the catalogue is not sorted by key');
  for (const id of ids) {
    if (!ID_PATTERN.test(id)) problems.push(`id off the pattern: ${id}`);
    else if (!AREAS.includes(id.split('.')[0] ?? '')) problems.push(`id of an unknown area: ${id}`);
    try {
      messageArguments(String(catalogue[id]));
    } catch {
      problems.push(`not a valid ICU message: ${id}`);
    }
  }
  const used = await extractIds(await sourceFiles(options.srcDir ?? path.join(WEB_DIR, 'src')));
  for (const [id, descriptor] of Object.entries(used)) {
    if (!(id in catalogue)) problems.push(`missing from the catalogue: ${id}`);
    if (descriptor.defaultMessage !== undefined) problems.push(`defaultMessage in the code: ${id}`);
  }
  for (const id of ids) if (!(id in used)) problems.push(`unused by the code: ${id}`);
  return problems;
}
