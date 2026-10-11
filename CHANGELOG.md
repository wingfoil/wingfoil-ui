# Changelog

All notable changes to WingFoil UI are recorded in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html); release `v0.1` is the git tag `v0.1.0`.

## [Unreleased]

## [0.1.0] - TBD

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

Details: [user guide — Known limitations](docs/user-guide.md#known-limitations).

[Unreleased]: https://github.com/wingfoil/wingfoil-ui/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/wingfoil/wingfoil-ui/releases/tag/v0.1.0
