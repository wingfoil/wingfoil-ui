# Changelog

All notable changes to WingFoil UI are recorded in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html); release `v0.1` is the git tag `v0.1.0`.

## [Unreleased]

**Unblock.** Decide gates and submit work from *Today*, keep the copy in sync with its remote.
Supports WingFoil **0.2.2 to 0.2.x** (contract-tested: 0.2.2), as v0.1. Not published on npm.

### Added

- **Today** (US-T-01…US-T-06, US-T-11): the greeting with what requires you in your role view;
  *Requires you* — type, title, reason (time in the state, your rejected work first with the
  reason, *Action required* for an undeclared state), state and one action opening the element
  panel; *Waiting on others* with who must act (a member, the members of a role, or the workflow
  engine). Live-refreshed; read-only for a user not in the team, with *How to join*.
- **Notification bell and all-roles summary** (US-S-21, US-S-23, US-T-07): a bell in the header of
  every project view counts what requires you in your role view and opens *To unblock* (the
  Requires you items) and *Updates* (the last 10 Memory events); Today shows, to a member holding
  several roles, one line per role with its count and first three items, a switch to that role
  view; the explicit *Nothing requires you* state, also after the last action.
- **Gate footer** (US-G-04…US-G-07, US-G-09, US-S-24): the element panel decides a gate — every
  outcome side by side (*Approve → …*, each *Reject → …*), a reason required for every outcome and
  pre-filled for an approval, two clicks from Today; an informational footer for a member without
  the gate's role, a read-only line for a user not in the team, and the *Waiting for the workflow
  engine* and *Final state* notes where no action is possible.
- **Submit and action feedback** (US-G-10, US-G-11, US-G-13, US-G-14, US-X-07, REQ-PERF-02): the
  element panel submits a draft or rejected work with *Submit → <state>*; gate and submit actions
  are disabled, with the reason as their description, while the element has local changes; every
  decision or submit ends with a toast — the result and the `wf(…)` commit with its short hash,
  *pushed* when auto-push pushed it or why it was not pushed — and a refusal with a red toast
  carrying WingFoil's own message, or *This element changed since you opened it* when it moved
  meanwhile; toasts are announced to screen readers (refusals assertively). The commits of these
  actions are recorded in the action log of the local state (hash and time only, at most *Entries
  kept* of them).
- **How to join** (US-C-08, US-C-09): for a user not in the team, the *not in team* badge and the
  header notice open a panel naming the project's tech leads (or saying none, or no member, is
  declared) with the exact `wingfoil dna add team.members …` command for the user's git email and
  a *Copy command* button.
- **Git status in the sidebar** (US-Y-01…US-Y-04, US-S-11): the bottom of the project sidebar
  shows the branch and short hash (or a detached HEAD), the local changes and, when the repository
  has a remote, *In sync with git* or the commits ahead and behind, *Fetch* with *Cancel*, and a
  failed fetch with the time of the last successful one and git's message; without a remote no
  sync control is shown. A governed action on a detached HEAD reads *Blocked: no branch checked
  out*.
- **Update and Push from the sidebar** (US-Y-05…US-Y-08, US-G-12): *Update* while the copy is
  behind (`git pull --ff-only`, never a merge, rebase or stash; refusals name the command to run in
  a terminal), "N commits to push" and *Push* (with *Cancel*) while it is only ahead, whatever
  *Auto-push* says; one transport at a time; a rejected push is a red toast with git's message
  (local folders and URL credentials redacted); governed actions blocked while behind end with an
  *Update* link; *Update* and *Push* read-only for a user who is not one member of the team. The
  update only fast-forwards whatever the configuration says (`branch.<b>.mergeOptions`,
  `pull.twohead`, `--squash` do not apply) and neither it nor *Fetch* prunes a local tag or branch;
  a remote whose fetch refspecs write outside `refs/remotes/`, or that has none, is refused by both
  (*Not fetched or updated: this remote has no fetch refspec, or one writes outside refs/remotes/…*;
  bug-014, found before release).
- **Automatic sync with the remote** (US-Y-02, US-Y-05, US-Y-07, REQ-PERF-07): the console fetches
  every opened project's remote every 60 s (on by default), can fast-forward a copy that is behind
  right after (*Auto-update*, off by default) and push the branch after each decision made in the
  console (*Auto-push*, off by default; the push is the branch's, the user's own unpushed commits
  included). The automatic fetch and update start no repository hook, no fsmonitor and no askpass
  program, and do not run at all when the repository's configuration includes another file; an
  automatic fetch or an auto-push is stopped after 60 s; stopping the console lets a running
  automatic update finish. Declared risk: *Auto-update* does on a timer what `git pull` does —
  incoming commits can run commands your own git configuration points at (filters,
  `core.sshCommand`, credential helpers, aliases) when they read project files; it is off by
  default.
- **UI settings and the theme setting** (US-C-07, X-08.3): *Configuration › UI settings*, pinned at
  the bottom of the sidebar, shows and changes Auto-fetch and its interval, Auto-update (with its
  declared risk next to it), Auto-push, Theme (*System*, *Light*, *Dark* — overrides the system
  preference), Confirm agent launch (takes effect from WingFoil 0.3) and the number of action-log
  entries kept. Settings are kept on this computer for every project, never committed, and apply
  without a restart; other tabs follow.
- **npm publish pipeline** (maintainers; dl-004, RP-54): `.github/workflows/publish.yml` runs for
  a pushed `vX.Y.Z` tag — the repository gates, a staging smoke on a local registry
  (`npm run test:publish-smoke`), then `npm stage publish` through an npm trusted publisher after
  the approver's deployment approval; a version goes live only when the approver approves it on
  npm with 2FA. The registry-side setup is the approver's checklist in `docs/publishing.md`; until
  it is done no version of `wingfoil-ui` is on npm.

### Changed

- **A project opens on Today** (US-T-01): `/p/<id>` lands on Today, the first sidebar entry;
  v0.1 opened the Memory list.
- **Supported browsers verified on three engines** (REQ-INT-08): the end-to-end suite runs on
  Chromium, Firefox and WebKit (Chrome, Edge, Firefox, Safari); v0.1 ran it on Chromium only.
- **The package is publishable** (task-029): the root `package.json` is no longer `private` (the
  workspaces stay private) and names the repository; a plain `npm publish` from a checkout stops
  with a pointer to the publish pipeline (`--ignore-scripts` skips that guard: the control is the
  registry setup in `docs/publishing.md`). The tarball's files are unchanged.

### Fixed

- **A console URL pasted into an open tab is read without a reload** (bug-016): the page reads the
  new `#token=…`, exchanges it and shows the console as a new tab does; a page whose session is
  still valid ignores a token it did not need.
- **No temporary folder left by a killed console** (bug-008): a clone no longer creates the empty
  hooks folder `wfui-no-hooks-*` in the system temporary directory; git runs with its hooks path
  on a regular file of the console's own installation, so no hook runs and nothing is left behind
  when the console is killed (`kill -9`).
- **The focus comes back to the Today action after the element panel closes** (bug-018): a panel
  opened from a *Requires you* action and closed with the gate footer's *Cancel*, with Escape or
  with its *Close* gives the focus back to that action, as the Memory list does for its row; to the
  main region only when the action is no longer listed (e.g. the gate was decided).

### Security

- **Governed changes only through WingFoil** (task-032): submit, approve and reject run the
  project's own `wingfoil memory submit`, `approve` or `reject`, one at a time per repository,
  after checking that the element is still in the state the page showed and has no local changes
  (a residual window is listed under Known limitations); only the action's own `wf(…)` commit is
  reported and logged (a concurrent commit is not); auto-push, when on, pushes the branch (see
  *Automatic sync* above).
- **Git transports** (task-033, task-034): fetch, update and push, like a clone (bug-013 below),
  allow only the `https`, `http`, `ssh`, `git` and `file` transports; they never prompt in a
  terminal (an askpass program the user configured may still open its dialog, except in the
  automatic fetch and update), run ssh in batch mode unless an ssh command is configured, keep only
  the absolute `PATH` entries and turn off git's automatic maintenance; a local remote of another
  user is refused (as a clone source, bug-010 below); git's messages lose the URL credentials and
  the local folders the console knows (`<project>`, `<repository>`, `<remote>`, `~`). Unattended
  runs: see *Automatic sync* above.
- **A clone runs no `ext::` command, whatever the environment** (bug-013): with
  `GIT_ALLOW_PROTOCOL` set in the environment the console was started from, git allowed the
  transports it names (`ext::` runs a command) despite the console's own protocol settings; every
  clone now sets it to `https`, `http`, `ssh`, `git` and `file`.
- **A local repository of another user is not cloned** (bug-010): a `file://` URL or a path whose
  repository folder belongs to another user of the computer is refused (*The repository of this
  remote is a folder of another user…*): cloning such a repository can run that user's code in your
  git. The user guide states what may run during a clone (your own git tools: filter drivers such
  as git-lfs, your ssh command, credential helpers) and the README a minimum git version.
- **No absolute folder of the machine in WingFoil's refusals** (bug-012): the message of a refused
  WingFoil command shows the project's folder as `<project>` (the repository's as `<repository>`,
  the home folder as `~`); a project without a CLI no longer sends its folder with the install
  command.
- **Tool messages are shown safely** (bug-017): a message of git or WingFoil shown by the console
  (a refused push, update, fetch, add or clone, a refused action) has its control characters, its
  invisible format characters (those reversing text direction, zero-width ones) and line separators
  written as visible escapes (`\x1b`, `\u202e`) and a backslash as `\\`; it is shown left to right
  in the order it was printed, and a very long one keeps its beginning and its end, where git's
  own reason is (a hook printing megabytes is bounded before anything else). The CLI's warnings
  and the file names a refused update quotes follow the same rule.

### Known limitations

- *Auto-update* (off by default) is a declared risk: on a timer it does what `git pull` does, so
  incoming commits can run commands the user's own git configuration points at.
- *Push* and Auto-push go to the upstream's remote only, never to a `pushRemote`; a cancelled
  Fetch or Push is not recorded in the git status.
- A mouse click into the untouched default reason places the caret instead of selecting it.
- Messages of git and WingFoil: absolute paths outside the known folders, and scheme-less
  credentials not after a space, quote or bracket, are shown as printed; names and reasons read
  from commits and Memory files (event authors, rejection reasons) are not escaped like them.
- While the operating system reports no network, the page holds its requests to the console.
- Between the console's check and the WingFoil process an edit by another program is not caught
  (WingFoil's approve and reject refuse one `git status` shows; submit commits it); a concurrent
  commit from another console or a terminal makes one of the two fail on git's `index.lock`.
- Two projects of one repository keep their own fetch status: a manual Fetch in one does not move
  the other's *last fetched* time.
- The refusal of another user's local repository is POSIX only and has residual cases (a parent
  folder another user can write, a linked worktree's `commondir`, `~user` from `/etc/passwd`).
- Still from v0.1: the two clone-URL edge cases, a killed clone leaving its folder, the paths typed
  in *Add project* echoed as typed in its refusals, the role-view refusal, Windows tested only with
  simulated platforms, no limit on event streams, the history re-read in full after each commit,
  React Aria's "Dismiss" outside the catalogue.

Details: [user guide — Known limitations](docs/user-guide.md#known-limitations).

## [0.1.0] - 2026-10-11

**Read-only console.** Open any WingFoil project and read it safely. Supports WingFoil **0.2.2 to
0.2.x** (contract-tested: 0.2.2). Run from a checkout: `npm ci && npm run build && node
bin/wingfoil-ui.cjs` ([README](README.md#install-and-run)), or `npm pack` it and install the tarball
([README](README.md#install-from-a-package)); not published on npm.

### Added

- **Launcher** `wingfoil-ui` with `--port`, `--no-open`, `--version`, `--help`: refuses Node.js
  below 22.12, prints the console URL with a per-start session token, opens the default browser
  (or prints the URL to open), stops cleanly on Ctrl-C / `SIGTERM` / `SIGHUP` with documented exit
  statuses ([CLI reference](docs/cli-reference.md)). (S1)
- **Local server and CLI adapter:** runs each project's own `wingfoil` (pinned in its
  `node_modules`, else on the `PATH`) with JSON output and a 30 s timeout, reads git, serves the
  browser application and an HTTP API with one event stream per page. (S1)
- **Project list:** add a local folder or clone a remote repository into a new folder (default
  `~/projects/<repo>`, cancellable); the same folder or remote cannot be added twice; project
  switcher keeping the current view; remove a project without touching its files; unavailable
  projects (folder missing, no `.wingfoil/`, CLI missing) marked with the reason and the install
  command; the list persists outside every repository and is shared by consoles running at once.
  (S2)
- **WingFoil version and capabilities:** the project's CLI version against the supported range;
  outside the range, or with an unreadable version, the project opens read-only with the range in
  the reason; capabilities a version lacks are listed with their minimum version. (S3)
- **Identity and role views:** the user from `git config user.email` matched to the DNA team
  (letter case ignored); read-only notices for "not in team", "no identity", an ambiguous email and
  an unreadable DNA; a *Role view* select for members with several roles, remembered per project.
  (S4)
- **Live refresh and snapshot:** the project as the CLI reads it, cached per repository state
  (HEAD and working-tree status); *local changes* markers for uncommitted elements; open views
  update by themselves when the repository or the git email changes. (S8)
- **Action descriptor** computed for every element from `memory.yaml` and the CLI version (state
  buckets, tones, pending gates); no action is offered in this release. (S9)
- **Memory list:** type filters with counts, state buckets across types or a type's own states,
  unknown types and states shown under their own names, filters kept in the URL. (M1)
- **Element panel** (non-modal, read-only, addressable by URL): state machine chips, rejection
  banner, summary, references with missing required fields flagged, applicable directives, history
  with commits. (G1)
- **DNA view** (R1), **Directives view** with "only mine / all" and rendered bodies (R2), **Team
  view** with roles, pending gates and agents that never approve (R3).
- **Documentation:** index of the DNA's `paths.docs` without Memory and plan files; Markdown
  rendered inside the UI; links between documents and to Memory files stay in the UI, broken or
  outside links marked, external links in a new tab, images not loaded. (R4)
- **Accessibility:** keyboard access to every screen, skip link, visible focus, polite
  announcements, tab titles naming project and view; axe scans with no serious or critical
  violation on every screen in both themes. (X1)
- **Externalised strings:** every UI and launcher string from an English message catalogue,
  except one screen-reader-only library string (React Aria's "Dismiss"); the web catalogue is
  checked by `npm run lint`. (X2)
- **Light and dark themes** following the system preference, AA contrast in both. (X3)
- `README` section *Supported WingFoil versions* with the support matrix and capability table.

### Security

- Listens on the loopback addresses (`127.0.0.1`, `::1`) only. (X4)
- Per-start session token in the URL fragment, exchanged for an `HttpOnly`, `SameSite=Strict`
  cookie; every API request and the event stream need it; token and session id never logged or
  stored. (X4)
- `Host` and `Origin` checks on every request, `Sec-Fetch-Site` on every API request (cross-site
  requests, DNS rebinding). (X4)
- Opaque project ids in URLs; file reads confined to the project's repository. (X4)
- `wingfoil` and `git` run without a shell; inherited `GIT_*` variables that redirect git are
  dropped (bug-002); a confined read no longer blocks or exhausts memory when the file is swapped
  after the check (bug-003).
- Clones: only the `https`, `http`, `ssh`, `git` and `file` transports; no hook and no CLI of the
  cloned repository runs; git never prompts. Clone URLs carrying credentials are refused before
  anything runs, so no password lands in the clone's `.git/config` or on a command line
  (bug-006; except the unknown-scheme case under Known limitations).
- The local state holds no token, credential or project content; remote URLs are stored without
  user info.

### Known limitations

- An scp-like clone address with an `@` in its path (after the host's `:`) and no `/`, e.g.
  `git@host:repo@v2.git`, is refused as if it held credentials; a URL with an unknown scheme and
  credentials reaches `git clone`, which refuses the transport (nothing connects or is stored).
- A clone interrupted by killing the console leaves its folder behind.
- If a *Role view* change is refused and the following header re-read never completes, the
  refusal is not shown and the select stays disabled; reload the page.
- Windows behaviour (browser opener, CLI discovery, child-process stop) is tested only with
  simulated platforms.
- End-to-end tests run on Chromium only.
- No limit on the number of open event streams.
- Memory history is re-read by walking the whole git log after each new commit (not incremental).
- One screen-reader-only library string (React Aria's "Dismiss", in popovers) is outside the
  message catalogue.
- A console killed by a signal it does not handle (e.g. `kill -9`) after a clone leaves an empty
  temporary folder `wfui-no-hooks-*` in the system temporary directory (bug-008, fix planned for
  v0.2).

Details: [user guide — Known limitations](docs/user-guide.md#known-limitations).

[Unreleased]: https://github.com/wingfoil/wingfoil-ui/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/wingfoil/wingfoil-ui/releases/tag/v0.1.0
