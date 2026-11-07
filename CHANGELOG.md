# Changelog

All notable changes to WingFoil UI are recorded in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html); release `v0.1` is the git tag `v0.1.0`,
release `v0.2` the git tag `v0.2.0` and the npm version `wingfoil-ui@0.2.0`.

## [Unreleased]

### Added

- **A draft GitHub Release for every tagged version** (task-052): the publish workflow's `release`
  job creates it after `promote`, with the version's CHANGELOG section as notes and, as assets, the
  tarball staged on npm, the coverage totals (`coverage-totals.json`) and the test counts per suite
  (`test-results.md`) of the tag's run — no file holding a path. The approver makes it public once
  the version is live on npm (`docs/publishing.md`, *Every release*).
- **Short ids in the API** (task-057, spec-011): the element read, the Memory list rows and the
  Today rows carry each element's short id (`task-046` for `task-046-wingfoil-0.3-support`,
  derived from its type's `id_pattern`; none for an id without a number), and the element read
  accepts a short id as well as the full id — an address such as `/p/<project>/e/task-046` can
  now reach its element once the page uses it (task-062). A short id that names several elements
  answers their list (409 `ambiguous-id`, at most 20) instead of *not found*. History and the
  actions still take the full id.
- **A console address file for scripts and agents** (task-058): each running console keeps
  `consoles/<port>.json` in the state directory (folder `0700`, file `0600`) with its URL, port,
  whether the port came from `--port`, process id, host, start time and version — never the
  token, a session or a project path — written before the URL line, refreshed every 10 s and
  removed at stop; a file left by a killed console is removed at the next start. An agent can
  build a link to an element from it and from `state.json` (`docs/cli-reference.md`, *Address
  file for scripts and agents*).
- **The project's `ui.yaml` configuration in the API** (task-054, task-068; spec-005, spec-012
  §2): `GET /api/p/:pid/config` carries a `ui` section with the effective configuration of
  `.wingfoil/ui.yaml` — categories, reference patterns and required references, the progress
  settings, held gates and artifacts, each value marked `declared` or `inferred` — and, when the
  file is not used, its first failure as `failure` (`progress.mode must be sequence or flow
  (found spiral)`); without a file, the values inferred from the project's types. Every text echoed from
  the file comes back with control and bidi characters escaped. An edit of `ui.yaml`, tracked,
  untracked or ignored by git, refreshes open pages. No screen shows it yet: the Configuration
  tabs are task-064's.
- **The reference index** (task-055, spec-012 §1, §8): the server's one index of every element's
  frontmatter values and the references they make — another element's full id, or a value matching
  a `taxonomy.patterns` entry of `.wingfoil/ui.yaml` — shared by the progress, traceability and
  held-gate features of later tasks. It keeps values only (at most 200 per element), reads at most
  16 element files at a time, reuses a file's values on the next repository state when the file
  is unchanged at HEAD (one `git ls-tree` per commit, no WingFoil process), spends at most 500 ms
  per state testing patterns, and works in slices of about 20 ms between which the console answers
  other requests (measured: never more than about 26 ms without an answer, on 500 elements of 200
  values with costly patterns); an element it
  could not read or index fully is named, never failing the whole. Nothing shows it yet.

### Changed

- **WingFoil 0.3 support** (task-046): a project on WingFoil 0.2.2 to 0.3.x is supported
  (contract-tested: 0.2.2 and 0.3.1); this repository pins `wingfoil@0.3.1`. The `--version` text
  of WingFoil 0.3, which carries its build (`0.3.1 (870bd44…)`), is read as its version; the
  configuration read answers the workflows in the shape of the project's WingFoil version, WingFoil
  0.3's configuration diagnostics sanitised; its warnings, written as JSON lines, are shown as
  their text. The workflow capabilities and the agent launch of WingFoil 0.3 are not used by this
  release: never shown as available, nor as missing. Every WingFoil process the console runs works
  without optional git locks and without a repository's fsmonitor program, and it and the console's
  own git reads run with no transport protocol allowed (`GIT_ALLOW_PROTOCOL=none`), so a partial
  clone's lazy fetch is refused before it starts any program and a read leaves `.git/index` as it was;
  a filter driver the configuration names still runs in status reads, as in the user's own `git
  status` (spec-010 §6). A git read that fails is logged without git's message, on every route.
  Every process the console's process runner starts (the CLI, git and what they start) gets the
  absolute `PATH` entries only, so a program a repository ships is never found through an empty or
  relative entry.

### Fixed

- **The identity is the author WingFoil authorises** (bug-029): the console reads who you are as
  the WingFoil CLI does — `GIT_AUTHOR_EMAIL` of its environment, else `author.email`, else
  `user.email` — so a console started with another author identity no longer offers *Approve* or
  *Reject* that the CLI then refuses; the header names that identity.
- **A large frontmatter no longer blocks the console** (bug-032): an element whose frontmatter
  holds many keys is parsed in time linear in its size (1 MiB of keys took about 99 s, now about
  2 s), a duplicate key still refused with its line; the reference index refuses a frontmatter
  above 64 KiB as unreadable.
- **An element whose id is longer than 100 characters can be opened and decided** (bug-019,
  task-057): the server refused a path parameter over 100 characters, so such an element was
  listed but its panel showed *not found* and its gate could not be decided. A path parameter of
  up to 255 UTF-16 code units now works on every route — every id WingFoil writes, at most 252
  characters — and a longer one answers *not found* on every route.
- **The element history and the Memory events read WingFoil 0.3's operations** (bug-026,
  task-048): on a project on WingFoil 0.3.x the element panel's history failed for every element
  with a `finalize`, `park`, `amend`, `start`, `sync` or `assign` commit — every phase plan closed
  by hand among them. The history now shows each with a line of its own ("closed by", "parked by",
  "amended by", "started by", "moved with a linked element by", "assigned to a release by"); the
  bell's *Updates* list them too, except an `assign`, which changes no state; the time in the
  current state and who must act follow a park, a start, a sync or a closing, never an amend.
- **A directive overriding a built-in one is listed once** (bug-025, task-047): when a project's
  custom directive has the id of a built-in one, the Directives view and the element panel's
  *Directives* section listed both files — extra rows, the bound roles repeated, the order wrong
  after switching "only mine / all". They now list one row per directive, the one WingFoil uses
  (the custom file), and show WingFoil's warning naming both files.
- **A project folder replaced by a symbolic link is no longer read through** (bug-033, task-068):
  when a folder of a project — `.wingfoil` or a Memory folder — was replaced by a link to a folder
  elsewhere, the check of the repository state hashed the files behind the link, so an edit
  outside the project could refresh open pages. Such a folder is now marked by itself, and no
  file behind it is read. The defect shipped in v0.2.0 (it dates from v0.1.0).
- **Commit texts are shown as safe text** (bug-027, task-056): the element panel's history (each
  entry's subject, reason, author and approver), the bell's *Updates* and the rejection shown in
  Today, the Memory list and the element panel passed a commit's text on as written, so a bidi
  override, a control character, a very long line or an absolute local folder in a commit message
  reached the screen — and so did the reject's reason among the element panel's fields. They now
  go through the same rule as every other tool message: control,
  bidi and invisible characters shown as visible escapes (`\u202e`), the project's, the
  repository's, the WingFoil package's and the home folders shown as `<project>`, `<repository>`,
  `<wingfoil>` and `~`, at most 4 000 characters. Who must act is still found by the author's
  email. The defect shipped in v0.1.0 and v0.2.0.

### Security

- **Repository text escaped in the API** (task-056, RP3-18 K1; spec-004 §5): an element's title in
  the Memory list, the element panel and Today comes back with control, bidi and invisible
  characters as visible escapes, as the `ui.yaml` strings of the configuration do (task-068), so a
  title cannot reorder or hide what the page shows; a backslash in a title is shown doubled
  (`Fix \\n handling`), so that every escape on the page is one the console wrote. Ids, types and
  states stay as WingFoil returns them (they are what a page sends back), and a document — an
  element's or a directive's body and fields (but the reject's reason, a commit text), a file — is
  shown as written. The other names the repository supplies (the DNA's names and descriptions, the
  directives' titles, the workflow texts, file names and paths of the documentation, the states
  named in an element's history, the project's name) are not escaped yet (bug-035).

### Known limitations

- **A partial clone** (blobless or otherwise filtered) cannot be read in full: the console's reads
  never fetch a missing object, so the Memory events read fails (*Today* answers an internal error,
  the Memory list and the element panel show their events error — from the code, not probed), and
  the console's fetch and Update do not backfill the history. Outside the console, run `git fetch
  --refetch --no-filter <remote>` (a plain `git fetch --refetch` applies the filter again), then `git
  config --unset remote.<remote>.partialclonefilter` so that later fetches stay full (checked by
  hand, git 2.43); or use a full clone (spec-010 §6).

## [0.2.0] - 2026-10-20

**Unblock.** Decide gates and submit work from *Today*, keep the copy in sync with its remote.
Supports WingFoil **0.2.2 to 0.2.x** (contract-tested: 0.2.2), as v0.1. The first version on npm:
`npx wingfoil-ui` ([README](README.md#from-npm)); published by hand by the approver from the tag
run's smoked tarball, without a provenance statement (`docs/publishing.md`, checklist step 4).

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
  npm with 2FA. The registry-side setup is the approver's checklist in `docs/publishing.md`. A
  name with no version cannot have a trusted publisher yet, so `0.2.0` itself was published by hand
  (checklist step 4); later versions go through the pipeline.

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
- **The focus comes back to the Today control that opened the element panel** (bug-018): a panel
  opened from a *Requires you* action or title, a *Waiting on others* row or an item of the roles
  summary, and closed with the gate footer's *Cancel*, with Escape or with its *Close* gives the
  focus back to that control, as the Memory list does for its row; to the main region only when it
  is no longer listed (e.g. the gate was decided).

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

- An element whose id is longer than 100 characters is listed but cannot be opened or decided
  from the console (404; bug-019, to be fixed in v0.3).
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

[Unreleased]: https://github.com/wingfoil/wingfoil-ui/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/wingfoil/wingfoil-ui/releases/tag/v0.2.0
[0.1.0]: https://github.com/wingfoil/wingfoil-ui/releases/tag/v0.1.0
