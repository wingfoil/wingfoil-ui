/**
 * The paths outside the repository that tracked text may name (task-028 AC-1): fictitious
 * examples and generic system paths, never a real person's or session's folder. Each entry is
 * anchored at the start of the path and ends on a segment boundary; none allows a whole root
 * directory (`public-text.test.ts` checks both, and fails on an entry that no tracked path uses
 * any more — delete such an entry). Windows paths are matched with single backslashes.
 */

/** A pattern of allowed paths and why none of them is a real private path. */
export interface AllowEntry {
  pattern: RegExp;
  reason: string;
}

/** The end of a path segment: the path may go on below it. */
const BELOW = String.raw`(?=[/\\]|$)`;
/** The end of the path (a trailing separator aside): nothing below it is allowed. */
const EXACT = String.raw`[/\\]?$`;

/** An entry allowing `source` and every path below it. */
function entry(source: string, reason: string, flags = ''): AllowEntry {
  return { pattern: new RegExp(`^(?:${source})${BELOW}`, flags), reason };
}

/** An entry allowing exactly the paths of `source`. */
function exact(source: string, reason: string): AllowEntry {
  return { pattern: new RegExp(`^(?:${source})${EXACT}`), reason };
}

/** The allow-list, grouped by kind. */
export const ALLOWED: readonly AllowEntry[] = [
  // Fictitious users: Alex of the BDD conventions and spec-006, the scenario's "test" user, and
  // the one-letter or "secret" homes of unit tests; `/home/…` elides a fixture folder.
  entry(String.raw`/home/(?:alex|test|a|secret|…)`, 'fictitious users of the BDD conventions, specs and unit tests'),
  entry(String.raw`/Users/alex`, 'the fictitious BDD user Alex on macOS (state location tests)', 'i'),
  entry(String.raw`[A-Z]:\\Users\\alex`, 'the fictitious BDD user Alex on Windows (state location tests)', 'i'),

  // The product's own default folders: the clone folder `~/projects/<repo>` (spec-006, the Add
  // project dialog), the BDD scenarios' `~/work/…`, the state directory and git's
  // user configuration files (spec-006 §1, the watcher), the README's install folder.
  entry(String.raw`~/projects`, 'the default clone folder of the product and its BDD scenarios'),
  entry(String.raw`~/work`, 'the working directories typed in the BDD scenarios (S-04.2)'),
  entry(String.raw`~/\.config/(?:wingfoil-ui|git/config)`, 'the documented state directory and git user configuration on Linux'),
  entry(String.raw`~/Library/Application`, 'the documented state directory on macOS ("Application Support")'),
  entry(String.raw`~/\.gitconfig|~/\.dotfiles`, "git's user configuration file and a generic dotfiles example (bug-002)"),
  entry(String.raw`~/wingfoil-ui`, 'the example install folder of the README'),
  entry(String.raw`~/(?:x|kanban|k|…)`, 'one-segment fictitious folders of the clone tests and the task notes'),

  // Generic system files and directories, the same on every machine.
  // `$` is where a template placeholder (`/proc/${pid}`) starts.
  exact(String.raw`/dev/(?:null|zero)`, 'standard device files'),
  exact(String.raw`/etc(?:/hosts|/passwd)?`, 'standard system files, read-outside-the-repository probes'),
  exact(String.raw`/proc(?:/loadavg|/net|/…)?(?:/\$)?`, 'the process filesystem (load average, sockets, process tables)'),
  exact(String.raw`/usr/(?:bin/(?:env|git|wingfoil)|local/bin)|/bin(?:/sh)?`, 'standard program locations'),
  entry(String.raw`[A-Z]:\\Windows\\win\.ini`, 'a standard Windows file, a read-outside-the-repository probe', 'i'),

  // Fictitious remotes and project folders of the remote, clone and state tests.
  entry(String.raw`/srv/(?:…|remotes|git|x\.git|x|a|a:b@c:x|a:b@c|user@host)`, 'fictitious remotes of the BDD scenarios and the remote tests'),
  entry(String.raw`[A-Z]:[\\/](?:remotes|work|state|A)`, 'fictitious Windows remotes and folders of the remote and state tests', 'i'),

  // Named fictitious temporary folders, and the test suites' own `wfui-` prefix; any other
  // temporary path (a session's scratch folder, for instance) is reported.
  entry(String.raw`/tmp/wfui-[\w*…-]*`, "the test suites' temporary folders (the wfui- prefix)"),
  entry(
    String.raw`/tmp/(?:pwned|does-not-exist|plain-repo|plain|kanban-second|kanban|x|p|state)`,
    'fictitious temporary folders of the BDD scenarios, security probes and unit tests',
  ),

  // A top-level directory alone (`/home/`, `/tmp`) names no folder of anyone.
  exact(String.raw`/[^/\\]+`, 'a top-level directory named without a sub-folder'),
];
