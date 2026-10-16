# User guide — WingFoil UI v0.1

**Version:** 0.14 · **Date:** 2026-10-16 (0.1: release v0.1; 0.2: bug-008 known limitation, release submit; 0.3: bug-008 wording; 0.4: bug-008 marked fixed after 0.1.0 — task-026; 0.5: *How to join*, unreleased v0.2 — task-035; 0.6: *Today*, unreleased v0.2 — task-036; 0.7: what runs during a clone, a local repository of another user, unreleased v0.2 — task-033 / bug-010, bug-013; 0.8: a local source git cannot read — task-033 review round 3; 0.9: *Deciding a gate*, unreleased v0.2 — task-037; 0.10: *Automatic sync with the remote*, unreleased v0.2 — task-034 / bug-014, its security reviews; 0.11: the notification bell and *Your roles* on Today, unreleased v0.2 — task-042; 0.14: *UI settings*, unreleased v0.2 — task-041)

WingFoil UI v0.1 is a **read-only console** for WingFoil-governed projects: you open a project and
read its Memory, elements, DNA, directives, team and documentation, kept up to date while you work
in the repository. It changes nothing in a project; the only write it makes is cloning a remote
repository into a new folder.

Contents: [Launching](#launching) · [Session](#the-session-and-the-browser) ·
[Projects](#projects) · [Project header](#the-project-header) · [Today](#today) · [Memory](#memory) ·
[Element panel](#the-element-panel) · [DNA](#dna) · [Directives](#directives) · [Team](#team) ·
[Documentation](#documentation) · [Automatic sync](#automatic-sync-with-the-remote) ·
[UI settings](#ui-settings) ·
[Themes, keyboard, accessibility](#themes-keyboard-and-accessibility) ·
[Local security](#local-security) · [Local state](#where-the-local-state-lives) ·
[Troubleshooting](#troubleshooting) · [Not in v0.1](#what-v01-does-not-do) ·
[Known limitations](#known-limitations)

## Launching

Requirements and installation are in the [README](../README.md#install-and-run). From the
checkout:

```bash
node bin/wingfoil-ui.cjs
```

The terminal prints one line:

```
WingFoil UI is running at http://127.0.0.1:<port>/#token=<token>
```

and the console opens in your default browser. If no browser can be opened, it prints
`Open this URL in your browser: <url>` and keeps running: copy the URL into a browser. To choose
the port or skip the browser, use `--port <n>` and `--no-open`
([CLI reference](cli-reference.md)). Stop the console with Ctrl-C in its terminal; it prints
`WingFoil UI stopped`.

Starting reads no project: the URL is printed first, each project is read when you open it.

## The session and the browser

- The token after `#token=` is drawn anew at every start. The page reads it, removes it from the
  address bar and exchanges it for a session cookie of this console; reloading the page keeps the
  session.
- After the console is stopped and started again (or when the page belongs to another console),
  the page shows **This page is no longer recognised by the console**: open the URL the console
  printed in its terminal.
- The console keeps up to 64 browser sessions; opening one more evicts the oldest, whose page then
  shows the same **This page is no longer recognised by the console**.
- When the console cannot be reached for 10 s, a banner says so (**Cannot reach the console…**);
  the page reconnects by itself when the console answers again.
- Project pages have stable addresses (`/p/<id>/memory`, `/p/<id>/e/<element id>`, …): the id is
  an opaque id issued by the console, never a path, and stays the same across restarts.

## Projects

With no project open, the start page shows **Projects** and **Add project…**. The project switcher
at the left of the header lists the projects you added, in the order you added them, each with its
name and path.

### Add a local folder

**Add project…** → *Local folder* → enter the **Folder path** (absolute, or starting with `~`) →
**Add**. The folder must be a git repository with a `.wingfoil/` folder at its root, and the
project must have a WingFoil CLI (pinned in its `node_modules`, else on the `PATH`). The project
opens when it is available.

Refusals you may see:

| Message | Meaning |
|---------|---------|
| `Folder not found: <path>` | the path does not exist |
| `Not a WingFoil project: no .wingfoil/ folder in <path>` | no `.wingfoil/` at the root |
| `Git refused the action:` + git's message | e.g. the folder has `.wingfoil/` but is not a git repository |
| `Already in the list: <name>` (with an **Open <name>** link) | the same folder, or a working copy of the same remote, is already listed |
| `WingFoil CLI not found for this project. Install it with: npm install --save-dev wingfoil` | no CLI for this project |
| `The state directory <stateDir> of WingFoil UI lies inside the project <path>` | see [local state](#where-the-local-state-lives) |

### Clone a remote repository

**Add project…** → *Remote git repository* → **Repository URL** (e.g.
`https://github.com/org/repo.git` or `git@github.com:org/repo.git`) → **Local working directory**
(filled in as `~/projects/<repo>`; you can change it) → **Clone and add**.

- The URL is compared with the listed projects **before** cloning: a second working copy of a
  known remote is refused (`Already in the list: <name> (same remote)`).
- The working directory must be empty or not exist yet, and must not lie inside a listed project
  or inside the state directory of WingFoil UI.
- While cloning, the fields are disabled and a progress bar shows; **Cancel**, **Close** or Escape
  stop the clone and remove what it created.
- Nothing of the cloned repository runs during the clone: no hooks, no CLI. Its name is the folder
  name until you first open it. Your own git configuration still applies, as in a terminal: the
  tools it names may run — filter drivers such as git-lfs (chosen by the repository's
  `.gitattributes`), your ssh command (`core.sshCommand`), your credential helper, and hooks your
  configuration defines itself (`hook.<name>.command`, recent git versions).
- A local repository (a `file://` URL or a folder path) that belongs to another user of the
  computer is refused (*The repository of this remote is a folder of another user…*): cloning it
  could run that user's code in your git. Use a git version with the fixes of CVE-2024-32004 and
  CVE-2024-32465 (README *Requirements*).
- A local source that git cannot read — the folder does not exist or cannot be opened — is
  refused before git runs (*Git cannot read the repository of this remote: check its path with git
  in a terminal*).
- A clone without `.wingfoil/` is removed (`Not a WingFoil project: no .wingfoil/ folder in the
  cloned repository`). A clone whose project has no CLI is kept and listed as unavailable, with
  the install command.
- Transports: `https`, `http`, `ssh`, `git` and `file` — also when `GIT_ALLOW_PROTOCOL` is set in
  your environment; git never prompts for a password. A failed
  clone (unreachable remote, refused authentication) shows `Git refused the action:` and git's
  message.

**URLs with credentials are refused.** A URL holding a user name, token or password
(`https://user:token@host/…`, any user info in `git://`, a password in an `ssh://` or
`user:pass@host:` address) is refused before anything runs, with: *The URL holds credentials:
WingFoil UI does not clone with them, because git would keep them in the clone's configuration.
Clone over SSH, or enter the URL without them and let a git credential helper supply the
password.* A plain SSH login (`git@github.com:org/repo.git`, `ssh://user@host/…`) is accepted.

### Switch and remove

- Open the switcher and choose a project: the console switches to it and keeps the current view
  (e.g. from one project's DNA to the other's DNA). An open element panel is closed.
- A project whose folder is missing, which has no `.wingfoil/` any more, or whose CLI is missing
  shows **Unavailable — <reason>** (with the install command for a missing CLI) and cannot be
  opened. It becomes available again by itself when the cause is fixed (e.g. the folder comes
  back).
- **Remove <name>** (×) asks *Remove <name> from the list?* — "Its folder and its files are not
  touched." Removing the open project returns to the start page.

## The project header

Inside a project, the right end of the global header shows **you**: your initials and name (and
your role, when you hold a single one), resolved from `git config user.email` — the repository's,
else your global one — matched without regard to letter case against `dna.team.members` of the
project. A change of your git email is followed without a reload.

Above each view, the project header strip shows:

- **The WingFoil version line:** `WingFoil <version>`, plus `(from PATH)` when the project pins no
  CLI, then *Every capability of this release is available* or the capabilities the version lacks
  with the version they need.
- **Out of the supported range** (v0.1 supports **0.2.2 to 0.2.x**,
  [README](../README.md#supported-wingfoil-versions)): `WingFoil <version> — read-only: supported
  0.2.2 to 0.2.x`. A version that cannot be read shows `(unknown version)`.
- **Read-only notices**, one per reason: you are not in the team (`<email>` with a *not in team*
  badge), git has no `user.email` (with the `git config user.email` command to fix it), your email
  matches several members (give each member an email of their own), or the DNA cannot be read
  (*team unknown*).

In v0.1 every project is read-only anyway: these notices tell you why actions would stay
unavailable once they exist.

**How to join** (v0.2, not released yet). When you are not in the team, the *not in team* badge
and the notice's **How to join** button open a panel that names the project's tech leads (the
members holding the `tech-lead` role, as *Name <email>*) — or says that the project declares no
tech lead, or no member at all — and gives the exact command a member runs to add you, for your
git email:

```sh
wingfoil dna add team.members --value "<Your Name>" --entry-email <your email> --entry-roles <roles>
```

**Copy command** puts it on the clipboard; replace `<Your Name>` and `<roles>` (comma-separated,
among the roles the panel lists — WingFoil refuses a role the DNA does not declare) before running
it. Close or Escape closes the panel.

**Role view.** When you hold several roles, a **Role view** select lists them in DNA order. The
choice is remembered per project and changes what "mine" means in the Directives view and which
directives the element panel lists.

## Today

**v0.2, not released yet.** A project opens on **Today** (`/p/<id>/today`), the first entry of the
sidebar (in v0.1 it opened on the Memory list). The greeting counts what requires you in your role
view — *Morgan, 2 things require you* — and names the role view (*Role view: approver*).

- **Requires you** lists the elements whose next move needs you or a role of your view: type, title,
  the reason (the state and how long the element has been in it, e.g. *pending for 3 days*; your
  work rejected back, listed first, with *Rejected by <name>: <reason>*; *Action required* for a
  state its type does not declare), the state pill and **one action** — *Approve*, *Review*,
  *Submit* or *Open*. The action and the title open the element panel; nothing is run from Today.
  *Approve* and *Review* open it with the reason of the gate focused: the second click decides
  (see *Deciding a gate*).
  With nothing to do it says **Nothing requires you**.
- **Waiting on others** lists the elements blocked on someone else, with who must act: a member
  (*Jordan (submitter) must act*), a role you do not hold with the members holding it (*Reserved to
  approver — Morgan, Alex*), or *Waiting for the workflow engine* for a state WingFoil 0.2.2 leaves
  only by a hand-edited commit.
- Changing the **Role view** changes the list; a change in the repository updates it by itself and
  screen readers hear the new count.
- **Your roles** — when you hold several roles, a card between the greeting and Requires you gives
  one line per role, in the order of the DNA: the role with how many items require it (*approver ·
  2*), its first three items (links to the element panel) and *N more* when there are others.
  Pressing a role, or its *N more*, switches the role view to it; the focus moves to Requires you
  once it is read. The line of your current view is marked *current view*.
- **The notification bell** — in the header of every project view, between the role view and your
  name, the bell shows how many items Requires you lists in your role view (no number when there
  is none). It opens a panel (Escape closes it) with **To unblock** — the same items as Requires
  you, each a link to the element panel — and **Updates** — the last 10 Memory events, newest
  first: the element, what happened and who did it, the transition and how long ago. *Open Today*
  goes to Today. The count follows every change, also an approval you make.
- When you are not in the team, Today shows Waiting on others only, with *You are not in this
  project's team —* **How to join**; with no git identity, or an ambiguous one, it points to the
  read-only notice of the header.

## Memory

The **Memory** list (`/p/<id>/memory`) shows every element of every type of
`.wingfoil/memory.yaml`, each with its type, title, id, age in its state and state pill.

- **Element types:** *All types* or one type, each with its count. Types found on elements but not
  declared in `memory.yaml` are listed under their own names after the declared ones.
- **States:** with *All types*, four buckets — *To approve*, *In progress*, *Waiting/drafts/closed*,
  *Done*; with one type, that type's own states in their sequence, followed by any state found on
  its elements that the type does not declare. Archived elements are read once you select a type.
- Filters are kept in the address, so a filtered list can be bookmarked.
- An element with uncommitted changes in your working copy is marked **local changes**; a new,
  uncommitted element appears too.
- **Live refresh:** when the repository changes (a commit, a checkout, an edit in the working
  tree), the list updates by itself and screen readers hear *The list was updated.*

If `memory.yaml` cannot be read, the list still shows, with a notice that some filters, buckets or
tones may be missing.

## The element panel

Selecting an element opens its panel on the right (`/p/<id>/e/<element id>`, which you can also
open directly from its address). The panel is **non-modal**: the header and the sidebar stay
usable. **Close** or Escape close it and give the focus back to the row you came from.

The panel shows, read-only:

- the type, id and title, and the **state machine** of the type as chips (past, current, future
  states; a state off the sequence is shown too);
- a **rejection banner** when the last transition was a reject (*Rejected by <name>: <reason>*);
- a **summary** — the first paragraph of the element's body;
- **References** — the other frontmatter fields with their values; a required field that is
  missing reads *<field> — required field, missing*;
- the **directives** that apply to the current role view, plus the global ones, each linking to
  its page;
- the **history**: who created, submitted, signed off, rejected or edited the element, the
  transition, the reason, the date and the commit (short hash; the full hash as its tooltip).

An open panel refreshes when the element changes in the repository.

### Deciding a gate

**v0.2, not released yet.** At the bottom of the panel of an element waiting on a gate, a member
holding the gate's role (`approver` on WingFoil 0.2.2) sees the **gate footer**:

- a **reason**, recorded in the commit and required for every outcome. For an approval it is
  pre-filled with *Approved via WingFoil UI*, selected so that typing replaces it; moving to a
  reject clears that untouched text, moving back to approve restores it. While the reason is empty
  (or only spaces) the outcomes are disabled and the footer says *A reason is required*;
- **every outcome side by side**: *Approve → <next state>* first, then each *Reject → <state>*,
  then *Cancel*, which closes the panel without running anything. From Today the gate takes two
  clicks (or Tab and Enter): *Approve* on the row, then *Approve → …* in the panel;
- the outcome runs `wingfoil memory approve` or `memory reject` with your reason; the panel then
  shows the new state and screen readers hear *<id> is now <state>*. A refusal is shown in the
  footer — WingFoil's own message when the CLI refused — and the reason is kept;
- an outcome is also disabled, with the reason, when the element has local changes, the WingFoil
  version is not supported or your copy is behind, diverged or detached.

Instead of the gate footer the panel says:

- *Reserved to approver — Morgan, Alex can act* when you do not hold the gate's role;
- *Read-only: <email> is not in the team —* **How to join**, or *Read-only: see the notice above
  the view* (no git identity, an ambiguous one), when you are not identified as one member;
- *Waiting for the workflow engine (state: <state>)* for a state WingFoil advances by itself or
  that this repository leaves by a hand-edited commit; a gate that is also such a state offers only
  its reject, with *Waiting for the workflow engine to advance*;
- *Final state: no action is possible* on a final state (the state chip reads *final state*).

Submitting a draft from the panel comes with a later v0.2 task.

## DNA

**DNA** (`/p/<id>/dna`) shows the project's `dna.yaml`: Project (with its methodology), Modules,
Stack (technologies and methodologies), Team and roles (members, roles, agents) and Paths. An empty
section reads *No … declared*. If the DNA cannot be read, only this view shows the error; it
recovers by itself when the file is fixed.

## Directives

**Directives** (`/p/<id>/directives`) lists the project's directives with the roles they are bound
to; directives that apply to every role are marked *All roles*.

- **Only mine / All**: a member starts on *Only mine* (the directives of the current role view and
  the global ones). If you hold no role in the project, *Only mine* is disabled with the reason.
- Selecting a directive opens its page with its body rendered (links: `http(s)` in a new tab,
  another directive opens its page, other repository paths read *not shown in the UI*).

## Team

**Team** (`/p/<id>/team`) shows a card per member — initials, name, email, roles, *you* on your
own card, and the number of pending gates on their roles — and then the agents, marked as
executing as their roles and never approving. Filters: **Search by name or email**, **Roles**,
**With pending gates**; they are kept in the address.

## Documentation

**Documentation** (`/p/<id>/docs`) indexes the files under the DNA's `paths.docs`, grouped by
folder, **without** Memory element files and plan files. A Markdown document opens inside the UI.

- A link to another indexed document stays inside the UI; a link to a Memory file opens the
  element panel.
- `http` and `https` links open in a new tab; any other scheme is marked *link not supported*.
- A link to a repository file outside the index is checked with the console and marked *outside
  the repository*, *broken link* or *not shown in the UI* (at most 100 distinct targets per
  document are checked; the others read *not shown in the UI*).
- Images are never loaded (*Image not shown: <alt text>*); raw HTML in Markdown is shown as text.

## Automatic sync with the remote

**v0.2, not released yet.** While it runs, the console keeps the projects you have opened since
it started up to date with their remote, by itself. Three settings drive it (spec-006 §2; change
them in *Configuration › UI settings*, see [UI settings](#ui-settings)):

| Setting | Default | What the console does |
|---------|---------|-----------------------|
| Auto-fetch, every *Fetch interval* | on, 60 s | fetches each opened project's remote: the upstream's remote, else the only remote, else `origin` |
| Auto-update | off | right after a fetch, fast-forwards a copy that is behind (`git merge --ff-only`) — only when you are identified in the team |
| Auto-push | off | after each submit, approve or reject made in the console, pushes the branch to its upstream |

### Before you turn Auto-update on

Auto-update makes the console do what `git pull` does, on a timer:
the commits someone pushes can run commands that **your own** git configuration points at — a
filter driver (for example git-lfs or a `filter.<x>.clean` script), your `core.sshCommand`, a
credential helper, an `uploadpack` command or an alias they call — when such a command reads or
runs a file of the project, and hooks your configuration defines (`hook.<name>.command` in newer
git). The console runs no hook of the repository, no fsmonitor and no configuration that comes
with the repository (see also *Hooks come back with your next action* below), but it cannot tell from your configuration whether a command reads
project files: shell forms such as a `$HOME` path, `$(pwd)/…`, backticks or a script that sources
another file all hide it. Leave Auto-update off if your configuration runs scripts from your
projects.

### How the automatic sync runs

- **Projects one at a time.** A project whose repository is busy with a write of the console is
  left to the next round; two projects of one repository are fetched once.
- **What runs, unattended.** The automatic fetch and update run **no hook** of the repository —
  neither `.git/hooks` nor a hooks folder the incoming commits bring (`core.hooksPath`) — and no
  askpass program: a credential git cannot get from your credential helper or ssh agent makes the
  fetch fail with git's message instead of opening a dialog. Your own git tools still run (filter
  drivers such as git-lfs, your ssh command, credential helpers). A fetch is stopped after 60 s and
  tried again at the next round.
- **Not when the repository configures itself.** If the repository's own configuration includes
  another file (`include.path`, `includeIf` — e.g. a `.gitconfig` committed in the project, even
  one not there yet or for another branch), the console does not fetch or update it by itself: the
  commits it would bring could change that file and make git run a command. The sidebar shows why,
  and the console's log names the setting that stopped it (for example `includeif.path`);
  `git config --list --show-origin` shows where it comes from. Fetch and update with git in a
  terminal. Includes of your global configuration (`~/.gitconfig`)
  are yours and do not count, unless they point into the project's folder.
- **Stopping the console during an automatic update** lets the update finish first, so the working
  tree is never left half updated; the log says so, and a second Ctrl-C (or signal) stops at once.
- **Hooks come back with your next action.** Hooks an automatic update brought in through a hooks
  folder of the project (`core.hooksPath`, e.g. husky) run at your next submit, approve or reject
  (WingFoil's commit) or auto-push — as they would after your own `git pull`. Likewise a clean
  filter that a configuration file of the project names runs when the console reads the status,
  once your own pull or Update brought that file — as in your own `git status`.
- **What is never done by itself.** No merge commit, no rebase, no stash: a copy that diverged from
  the remote, a local change to a file the incoming commits change, or a git operation you have in
  progress (a merge, rebase, cherry-pick, revert, `git am` or bisect) is not updated — fast-forward
  it yourself once done. Your local branches and tags are never pruned: a remote whose fetch
  refspecs write outside `refs/remotes/` (a mirror configuration), or that has none, is not fetched
  automatically, and a manual fetch refuses it with a message.
- **Auto-push pushes the branch, not only the console's commit.** It is the same push as *Push*:
  every local commit of the branch not yet on the remote goes with it, your own included. It runs
  the repository's `pre-push` hook, is stopped after 60 s, and never forces: a remote that moved
  rejects it, and the commit stays local (the copy is *ahead*). A commit left by a WingFoil command
  that failed after committing is not pushed by itself: it goes with the next push.

## UI settings

**v0.2, not released yet.** *Configuration* at the bottom of a project's sidebar opens
*Configuration › UI settings*: your own settings for the console, the same under every project.
They are kept in the local state on this computer (see [Where the local state lives](#where-the-local-state-lives)),
never in a project and never committed, and they apply at once, without a restart.

| Setting | Default | What it does |
|---------|---------|--------------|
| Auto-fetch | on | fetches the remote of every project opened in the console ([Automatic sync](#automatic-sync-with-the-remote)) |
| Fetch interval (seconds) | 60 | how often Auto-fetch runs, from 15 to 3600 seconds |
| Auto-update | off | fast-forwards a copy that is behind right after a fetch — read [Before you turn Auto-update on](#before-you-turn-auto-update-on) first |
| Auto-push | off | pushes the branch after each submit, approve or reject made in the console |
| Theme | System | *System* follows your system's light or dark preference; *Light* or *Dark* forces one |
| Confirm agent launch | on | asks before an agent is launched on a step; kept now, takes effect from WingFoil 0.3 |
| Entries kept (action log) | 5000 | how many commits of the console's decisions the action log keeps, from 100 to 100000; lowering it removes the oldest entries at once |

- **Saving.** Each setting is saved as soon as you change it: a switch or the theme at once, a
  number when you leave its field or press Enter (Escape puts the saved value back). A number out
  of its range is shown as an error under its field and is not saved. *Settings saved* confirms a
  save; a save that fails is reported with the setting's name until that setting is saved as you
  wanted, and the page shows what is stored.
- **Other tabs** of the same console follow a change by themselves. A second console started on the
  same state directory shows it the next time it reads the settings (e.g. on a reload).
- **Under the Auto-update switch** the page states its risk and points to
  [Before you turn Auto-update on](#before-you-turn-auto-update-on).

## Themes, keyboard and accessibility

- **Themes:** light and dark, following your system preference — the page follows a change without
  a reload. From v0.2 (not released yet) the *Theme* UI setting forces *Light* or *Dark*
  ([UI settings](#ui-settings)); until the settings are read, a page opens in the system's theme.
- **Keyboard:** every v0.1 screen is reachable with the keyboard; the first Tab stop is **Skip to
  content**. Focus is always visible. In the project switcher the arrow keys move between projects
  and Tab reaches a project's *Remove* button. Escape closes the element panel and the dialogs; a
  dialog closes with its **Close** button or Escape, not with a click outside it.
- **Screen readers:** status changes (a project added, the list updated, read-only notices) are
  announced politely; the tab title names the project and the view, or the open element
  (e.g. `kanban · Memory — WingFoil UI`).
- **Target:** WCAG 2.1 AA; every screen of v0.1 passes an axe scan with no serious or critical
  violation in both themes (`test/e2e/accessibility.spec.ts`).
- **Language:** English. Every UI string comes from one message catalogue, except one
  screen-reader-only library string (React Aria's "Dismiss"); project data (names, titles, states)
  is shown as written.

## Local security

- The console listens on `127.0.0.1` and `::1` only: it cannot be reached from another machine.
- Every API request and the event stream need the session of this start (cookie, or the token as
  a Bearer header for scripts). The token sits in the URL fragment, which the browser never sends,
  and is never written to the log or to disk.
- Every request is checked for its `Host` and, when present, its `Origin` (`127.0.0.1`,
  `localhost` or `[::1]` on the console's port): a request from another web page is refused (*The
  console refused a request that did not come from its own page*).
- URLs carry opaque project ids, never paths. Files are read only inside the project's repository:
  a path that leaves it is refused (*This path is outside the repository.*).
- `wingfoil` and `git` run without a shell, with a fixed set of git commands. Nothing of a cloned
  repository runs at clone time.
- The local state holds no token, no credential and no project content; the user info of a remote
  URL is removed before it is stored.

## Where the local state lives

The project list, the role view of each project and (v0.2) the [UI settings](#ui-settings) are
kept outside every repository, in `state.json` of the state directory:

| Platform | Directory |
|----------|-----------|
| Linux and other Unix | `$XDG_CONFIG_HOME/wingfoil-ui`, else `~/.config/wingfoil-ui` |
| macOS | `~/Library/Application Support/wingfoil-ui` |
| Windows | `%APPDATA%\wingfoil-ui` |
| any (override) | `$WINGFOIL_UI_STATE_DIR` |

- The directory is created on the first change (mode `0700`, the file `0600` on POSIX). You never
  need to edit the file.
- The state directory must not lie inside a listed project: such a project cannot be added, and a
  list that already holds one stops the start with exit 4 (set `WINGFOIL_UI_STATE_DIR` to a folder
  outside every project).
- Two consoles started at once (on different ports) share the list and see each other's changes.
- A `state.json` that cannot be parsed is kept aside as `state.json.corrupt-<timestamp>` and the
  console starts with an empty list, with a warning naming the kept file. A file written by a newer
  WingFoil UI is read but not changed (*Project list saved by a newer WingFoil UI — changes are not
  saved*).

## Troubleshooting

| You see | Cause and fix |
|---------|---------------|
| `WingFoil UI needs Node.js 22.12 or later (found <major>.<minor>)` | install Node.js 22.12 or later |
| `WingFoil UI stopped on an unexpected error: …` right at start | the checkout is not built (`npm run build`), or `state.json` cannot be read; the message names the cause |
| `Port <n> is already in use` | choose another `--port`, or omit it to get a free port |
| `No free port found after <tries> tries` | the loopback ports are exhausted or blocked; retry, or give a `--port` |
| `The WingFoil UI state directory … lies inside the project …` | set `WINGFOIL_UI_STATE_DIR` to a folder outside every project |
| `Open this URL in your browser: <url>` | no browser opener: open the URL by hand |
| *This page is no longer recognised by the console* | the console was restarted: open the new URL from its terminal |
| *Cannot reach the console…* banner | the console stopped: start it again and open the URL it prints |
| `WingFoil CLI not found for this project. Install it with: npm install --save-dev wingfoil` / *Unavailable — WingFoil CLI not found* | install the CLI in the project (or put `wingfoil` on the `PATH`) |
| `WingFoil <version> — read-only: supported 0.2.2 to 0.2.x` | the project's CLI is outside the supported range: pin a supported version in the project |
| *Unavailable — folder not found* | the folder was moved or deleted: put it back, or remove the project and add the new path |
| *Read-only: git has no user.email for this project…* | `git config user.email '<your email>'` |
| *Read-only: <email> is not in the team of this project.* | your git email is not in `dna.team.members` |
| `The working directory is not empty: <path>` | choose another working directory, or empty it |
| `Git refused the action:` + git's message | read git's message (unreachable remote, refused authentication, not a git repository) |
| `WingFoil did not answer within 30 seconds` | the project's CLI is slow or stuck; retry |
| *Something went wrong in the console: see its log in the terminal* | read the log lines on the console's terminal |

## What v0.1 does not do

- **No governed write.** No submit, approve or reject, no ingestion, no editing of elements, DNA
  or directives, no fetch, pull or push. The only write is cloning a remote into a new folder
  (plus the console's own local state).
- **No Today view** — it arrives in v0.2; until then a project opens on its Memory list.
- **No UI settings** (forcing the theme arrives in v0.2), no `.wingfoil/ui.yaml` configuration,
  no workflow, timeline, traceability, files or artifacts views, no command palette, no
  notifications, no "Open on GitHub" link.
- **Not on npm yet:** run it from a checkout ([README](../README.md#install-and-run)).

## Known limitations

Accepted for v0.1 and recorded in the implementation plan
(`docs/05_plans/rl-v1/rel-v0.1/dev-loop-rel-v0.1-plan.md`), the task notes and the bug records
(`docs/04_memory/bugs/`):

- **Clone URL check, two edge cases.** An scp-like address with an `@` in its path (after the
  host's `:`) and no `/`, e.g. `git@host:repo@v2.git`, is refused as if it held credentials
  (`git@github.com:repo.git` and `git@host:org/repo@v2.git` are accepted); a URL with an unknown
  scheme and credentials (`git+https://user:pass@…`) is passed to `git clone`, which refuses the transport — nothing
  connects, nothing is stored, the URL is not echoed.
- **A killed clone leaves its folder.** If the console is killed (not stopped) during a clone, the
  partial folder stays; a retry says *The working directory is not empty*. Delete the folder by
  hand.
- **Role view refusal.** If a *Role view* change is refused and the following header re-read never
  completes, the refusal is not shown and the select stays disabled; reload the page.
- **Windows** is tested only through simulated platform behaviour: opening the browser (the
  `#token` fragment through `rundll32`), finding the CLI, and stopping child processes (a
  `wingfoil` process may outlive the console briefly) have not been checked on a Windows machine.
- **Browsers:** the end-to-end suite runs on Chromium only in v0.1; Firefox and WebKit from v0.2.
- **Event streams:** the console sets no limit on the number of open pages (event streams).
- **History reading:** after each new commit, the Memory history is re-read by walking the whole
  git log, not incrementally; very long histories make this read slower.
- **One string outside the catalogue:** a screen-reader-only library string (React Aria's
  "Dismiss", in popovers).
- **A killed console leaves a temporary folder** (fixed after 0.1.0, see `CHANGELOG.md`,
  *Unreleased*). In 0.1.0, if the console is killed by a signal it does not handle (e.g. `kill -9`;
  Ctrl-C, `kill` and closing the terminal clean up) after a clone, an empty folder
  `wfui-no-hooks-*` stays in the system temporary directory; it holds no data and can be deleted
  by hand.
