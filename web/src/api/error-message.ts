/**
 * Error answers rendered from the catalogue (spec-008 §4): `error.` + the code in lowerCamelCase,
 * with the envelope's `detail` as the arguments; the envelope's `message` is never shown, except
 * the tool output of `cli-refused` and `git-refused`, shown verbatim inside the catalogue frame.
 * The table holds every code of spec-004 §4–§5 and spec-006 §3 (decision W3-5), plus the
 * client-side `unreachable` (no answer, W3-12).
 */
import type { MessageDescriptor } from 'react-intl';
import { defineMessages } from 'react-intl';
import type { ApiError } from './client.js';

const MESSAGES = defineMessages({
  'forbidden-origin': { id: 'error.forbiddenOrigin' },
  unauthenticated: { id: 'error.unauthenticated' },
  'not-found': { id: 'error.notFound' },
  'invalid-request': { id: 'error.invalidRequest' },
  'not-in-team': { id: 'error.notInTeam' },
  'unsupported-version': { id: 'error.unsupportedVersion' },
  'local-changes': { id: 'error.localChanges' },
  'stale-copy': { id: 'error.staleCopy' },
  'element-changed': { id: 'error.elementChanged' },
  'cli-refused': { id: 'error.cliRefused' },
  'cli-output': { id: 'error.cliOutput' },
  'cli-timeout': { id: 'error.cliTimeout' },
  internal: { id: 'error.internal' },
  'git-refused': { id: 'error.gitRefused' },
  'read-error': { id: 'error.readError' },
  'folder-not-found': { id: 'error.folderNotFound' },
  'not-wingfoil': { id: 'error.notWingfoil' },
  'already-listed': { id: 'error.alreadyListed' },
  'directory-not-empty': { id: 'error.directoryNotEmpty' },
  'cli-not-found': { id: 'error.cliNotFound' },
  'state-dir-inside-project': { id: 'error.stateDirInsideProject' },
  'directory-inside-project': { id: 'error.directoryInsideProject' },
  'inside-state-dir': { id: 'error.insideStateDir' },
  // bug-006 (decided by the user 2026-10-10): a clone URL with credentials.
  'credentials-in-url': { id: 'error.credentialsInUrl' },
  // task-033 (spec-010 §5): the transport refusals; remote-not-owned also on a clone (bug-010, D33-1).
  'no-remote': { id: 'error.noRemote' },
  'no-fetch-target': { id: 'error.noFetchTarget' },
  'detached-head': { id: 'error.detachedHead' },
  'no-upstream': { id: 'error.noUpstream' },
  diverged: { id: 'error.diverged' },
  'local-changes-in-the-way': { id: 'error.localChangesInTheWay' },
  'remote-not-owned': { id: 'error.remoteNotOwned' },
  // Review round 2 F9: a local remote or clone source git cannot read.
  'remote-unreadable': { id: 'error.remoteUnreadable' },
  // task-037, D37-11: a governed write that did not finish (W2-1, W2-4, W2-5); `detail.file`,
  // optional `detail.commit`.
  'write-incomplete': { id: 'error.writeIncomplete' },
  // Client-side: no answer at all (W3-12).
  unreachable: { id: 'error.unreachable' },
});

/** An error code the catalogue renders. */
export type ErrorCode = keyof typeof MESSAGES;

/** Every error code the catalogue renders. */
export const ERROR_CODES = Object.keys(MESSAGES) as readonly ErrorCode[];

/** Codes whose `message` is a tool's output, shown verbatim (spec-008 §4). */
const VERBATIM: ReadonlySet<string> = new Set<ErrorCode>(['cli-refused', 'git-refused']);

/** What to render for an error answer. */
export interface ErrorRendering {
  descriptor: MessageDescriptor;
  /** Arguments of the message: the `detail` fields as text (selectors included). */
  values: Record<string, string>;
  /** The tool output to show verbatim after the message, for `cli-refused` and `git-refused`. */
  verbatim?: string;
}

/** Options of {@link errorMessage}. */
export interface ErrorMessageOptions {
  /** Joins a list argument in the locale's conjunction format (default: `Intl.ListFormat` of `en`). */
  formatList?: (items: string[]) => string;
}

const EN_LIST = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

/**
 * The catalogue message for an error answer (an unknown code renders as `internal`). A list of
 * paths in `detail` (`local-changes-in-the-way` `files`, spec-010 §5) becomes one argument: the
 * base names joined by `options.formatList`.
 */
export function errorMessage(
  error: Pick<ApiError, 'code' | 'message' | 'detail'>,
  options: ErrorMessageOptions = {},
): ErrorRendering {
  const code: ErrorCode = Object.hasOwn(MESSAGES, error.code) ? (error.code as ErrorCode) : 'internal';
  const values: Record<string, string> = {};
  if (error.detail !== null && typeof error.detail === 'object') {
    for (const [k, v] of Object.entries(error.detail)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') values[k] = String(v);
      else if (Array.isArray(v) && v.every((item) => typeof item === 'string')) {
        const names = v.map((item) => item.split(/[\\/]/).filter(Boolean).at(-1) ?? item);
        values[k] = options.formatList ? options.formatList(names) : EN_LIST.format(names);
      }
    }
  }
  if (code === 'not-wingfoil') {
    // Two detail shapes (projects.refusal.schema.json): `{path}` for a folder, `{source}` for a clone.
    values['source'] ??= 'local';
    values['path'] ??= '';
  }
  if (code === 'write-incomplete') {
    // `detail.commit` is optional (write.refusal.schema.json): the message selects on `none`.
    values['commit'] ??= 'none';
  }
  return {
    descriptor: MESSAGES[code],
    values,
    ...(VERBATIM.has(code) ? { verbatim: error.message } : {}),
  };
}
