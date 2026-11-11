/**
 * The preset write's two git commands (task-060 D60-7, spec-005 §5, REQ-INT-06): `git add` of the
 * one file, then `git commit --only` of it — WingFoil 0.3.1's own commit form
 * (`dist/storage/commit.js` `commitPathsNow`): `--quiet`, `--cleanup=whitespace` (pins
 * `commit.cleanup`), `-m` (no editor, no `commit.template`), the path after `--` and read literally.
 * Other staged changes stay staged (C-02.2). `GitReads.indexWrite` runs them, with the CLI's
 * variables and {@link INDEX_WRITE_GIT_CONFIG}; the repository's hooks run, as for a CLI write.
 */
export { INDEX_WRITE_GIT_CONFIG, INDEX_WRITE_SUBCOMMANDS } from './git.js';

/** `git add` of `file` (relative to the project root). */
export function presetAddArgs(file: string): string[] {
  return ['--literal-pathspecs', 'add', '--', file];
}

/** `git commit --only` of `file` with the one-line `subject`. */
export function presetCommitArgs(file: string, subject: string): string[] {
  return ['--literal-pathspecs', 'commit', '--only', '--quiet', '--cleanup=whitespace', '-m', subject, '--', file];
}
