/**
 * Field checks of the *Add project* dialog (decision W4-13), run before any request: what the
 * server would refuse with a bare 400 `invalid-request` is said next to the field instead. There is
 * no check of the URL's scheme: git and the server judge the URL (the scenarios clone `file://`).
 */
import { repoName } from './working-directory.js';

/** What is wrong with a field's value. */
export type FieldProblem = 'required' | 'relative' | 'option';

/** An absolute path as the server reads it: `/…`, `~`, `~/…` (home), a drive letter or UNC. */
const ABSOLUTE = /^(\/|~$|~[\\/]|[A-Za-z]:[\\/]|\\\\)/;

function pathLike(value: string): FieldProblem | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return 'required';
  return ABSOLUTE.test(trimmed) ? undefined : 'relative';
}

/** The local folder's path: filled and absolute. */
export function pathProblem(value: string): FieldProblem | undefined {
  return pathLike(value);
}

/** The repository URL: filled, and not read as an option by git. */
export function urlProblem(value: string): FieldProblem | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return 'required';
  return trimmed.startsWith('-') ? 'option' : undefined;
}

/**
 * The working directory of a clone: absolute when filled; required only when `url` gives no folder
 * name (decision W4-13) — an empty field with a derivable name sends no directory and the server
 * clones into its default `~/projects/<repo>`.
 */
export function directoryProblem(value: string, url: string): FieldProblem | undefined {
  if (value.trim() === '') return repoName(url) === undefined ? 'required' : undefined;
  return pathLike(value);
}
