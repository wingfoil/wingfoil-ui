# User guide — WingFoil UI v0.2

**Version:** 0.16 · **Date:** 2026-10-18 (0.1: release v0.1; 0.2: bug-008 known limitation, release submit; 0.3: bug-008 wording; 0.4: bug-008 marked fixed after 0.1.0 — task-026; 0.5: *How to join*, unreleased v0.2 — task-035; 0.6: *Today*, unreleased v0.2 — task-036; 0.7: what runs during a clone, a local repository of another user, unreleased v0.2 — task-033 / bug-010, bug-013; 0.8: a local source git cannot read — task-033 review round 3; 0.9: *Deciding a gate*, unreleased v0.2 — task-037; 0.10: *Automatic sync with the remote*, unreleased v0.2 — task-034 / bug-014, its security reviews; 0.11: the notification bell and *Your roles* on Today, unreleased v0.2 — task-042; 0.12: *Submitting* and *After an action*, unreleased v0.2 — task-038; 0.13: *Git status in the sidebar*, unreleased v0.2 — task-039; 0.14: *UI settings*, unreleased v0.2 — task-041; 0.15: *Update* and *Push* in the sidebar, a URL pasted into an open tab, tool messages shown safely, unreleased v0.2 — task-040 / bug-016, bug-017; 0.16: release v0.2 user-docs — the guide describes v0.2 as a whole, known limitations of v0.2)

WingFoil UI v0.2 — **Unblock** — is a local console for WingFoil-governed projects: you open a
project, see on **Today** what requires you, decide its gates and submit its work, and keep your
copy in sync with its remote; you also read its Memory, elements, DNA, directives, team and
documentation, kept up to date while you work in the repository. The console changes a project
only through:

- the WingFoil CLI of the project — `memory submit`, `memory approve` and `memory reject`, which
  make WingFoil's own `wf(…)` commit (see [Deciding a gate](#deciding-a-gate) and
  [Submitting](#submitting));
- git — *Fetch*, *Update* (fast-forward only) and *Push* from the sidebar, and the automatic sync
  you turn on in the UI settings ([Git status in the sidebar](#git-status-in-the-sidebar),
  [Automatic sync](#automatic-sync-with-the-remote));
- cloning a remote repository into a new folder ([Projects](#projects)).

It never edits a file of a project itself. What changed since v0.1 is listed in the
[CHANGELOG](../CHANGELOG.md); v0.2 is not tagged yet, so the latest release is still `v0.1.0`
(read-only).

Contents: [Launching](#launching) · [Session](#the-session-and-the-browser) ·
[Projects](#projects) · [Project header](#the-project-header) · [Today](#today) · [Memory](#memory) ·
[Element panel](#the-element-panel) · [DNA](#dna) · [Directives](#directives) · [Team](#team) ·
[Documentation](#documentation) · [Git status](#git-status-in-the-sidebar) ·
[Automatic sync](#automatic-sync-with-the-remote) · [UI settings](#ui-settings) ·
[Themes, keyboard, accessibility](#themes-keyboard-and-accessibility) ·
[Local security](#local-security) · [Local state](#where-the-local-state-lives) ·
[Troubleshooting](#troubleshooting) · [Not in v0.2](#what-v02-does-not-do) ·
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
`WingFoil UI stopped` (an automatic update that is running finishes first; a second Ctrl-C stops at
once — [Automatic sync](#automatic-sync-with-the-remote)).

Starting reads no project: the URL is printed first, each project is read when you open it. The
automatic fetch (*Auto-fetch*, on by default) runs one *Fetch interval* after the start and then
at every interval, for the projects opened since the console started.

## The session and the browser

- The token after `#token=` is drawn anew at every start. The page reads it, removes it from the
  address bar and exchanges it for a session cookie of this console; reloading the page keeps the
  session.
- After the console is stopped and started again (or when the page belongs to another console),
  the page shows **This page is no longer recognised by the console**: open the URL the console
  printed in its terminal — in a new tab or pasted into this one (the page then reads the new token
  without a reload of its own). A page whose session the console still knows ignores a `#token=…`
  it did not need and keeps its session.
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
- **Out of the supported range** (v0.2 supports **0.2.2 to 0.2.x**,
  [README](../README.md#supported-wingfoil-versions)): `WingFoil <version> — read-only: supported
  0.2.2 to 0.2.x`. A version that cannot be read shows `(unknown version)`.
- **Read-only notices**, one per reason: you are not in the team (`<email>` with a *not in team*
  badge), git has no `user.email` (with the `git config user.email` command to fix it), your email
  matches several members (give each member an email of their own), or the DNA cannot be read
  (*team unknown*).

While a notice or an unsupported version applies, the element panel offers no decision and no
submit, with the reason; while you are not identified as one member of the team, *Update* and
*Push* in the sidebar are disabled too (*Fetch* stays available to anyone). Between the role view
and your name, the **notification bell** counts what requires you ([Today](#today)).

**How to join.** When you are not in the team, the *not in team* badge and the notice's **How to
join** button open the panel *How to join this project*: it names the project's tech leads (the
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
choice is remembered per project and changes what requires you on Today and in the bell, what
"mine" means in the Directives view and which directives the element panel lists.

## Today

A project opens on **Today** (`/p/<id>/today`), the first entry of the sidebar (in v0.1 it opened
on the Memory list). The greeting counts what requires you in your role view — *Morgan, 2 things
require you* — and names the role view (*Role view: approver*).

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

The panel shows:

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

An open panel refreshes when the element changes in the repository. Its fields cannot be edited;
at its bottom, a footer offers the decision of a gate or the submit when one applies (below).

### Deciding a gate

At the bottom of the panel of an element waiting on a gate, a member holding the gate's role
(`approver` on WingFoil 0.2.2) sees the **gate footer**:

- a **reason**, recorded in the commit and required for every outcome. For an approval it is
  pre-filled with *Approved via WingFoil UI*, selected so that typing replaces it; moving to a
  reject clears that untouched text, moving back to approve restores it. While the reason is empty
  (or only spaces) the outcomes are disabled and the footer says *A reason is required*;
- **every outcome side by side**: *Approve → <next state>* first, then each *Reject → <state>*,
  then *Cancel*, which closes the panel without running anything. From Today the gate takes two
  clicks (or Tab and Enter): *Approve* on the row, then *Approve → …* in the panel;
- the outcome runs `wingfoil memory approve` or `memory reject` with your reason; the panel then
  shows the new state and a toast says the result (see *After an action*). On a refusal the
  reason is kept;
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

### Submitting

On an element whose state moves on by `memory submit` (a draft, work sent back by a reject), every
member of the team sees *Submit → <next state>* and *Cancel* at the bottom of the panel: one click
runs `wingfoil memory submit`. *Submit* is disabled, with the reason, when the element has local
changes (*Blocked: this element has local changes — commit or discard them first*: `memory submit`
would commit them), when the WingFoil version is not supported or when your copy is behind, diverged
or detached. An element waiting on a gate offers no *Submit*.

### After an action

Every submit or decision ends with a **toast** at the bottom of the window — while the element panel
is open, between the sidebar and the panel, or just above the panel's buttons when the window is too
narrow, so a toast covers neither those buttons nor the sidebar:

- the result (*Approved <id>*, *Submitted <id>*, *Rejected <id>*), the commit line — short hash
  and `wf(…)` subject — and *pushed* when auto-push pushed it. When auto-push is on and the push
  failed, the toast says *Not pushed — the commit stays local* with the reason (git's own message,
  or e.g. *The push did not finish within 60 s*) and stays until you close it;
- a refusal is a **red toast** that stays until you close it: *Submit of <id> not done* with
  WingFoil's own message (e.g. a required field left empty), *This element changed since you
  opened it* when someone moved it meanwhile (the panel then shows its new state), or *This element
  has local changes …*.

A result toast goes after 8 s, not while the pointer is over it or the focus is inside it; each
toast has a *Close notification* button, and a new result for the same element replaces its toast.
At most three toasts are shown: a new toast beyond three removes the oldest toast that closes by
itself. Refusals and failed pushes never close by themselves and stay until you close them (or a new
result for the same element replaces them); when the toasts are taller than the window, the stack
scrolls (to a new toast's top when one arrives, otherwise where you left it), and Tab reaches every
*Close notification*. Closing a toast with the keyboard moves the focus to the next toast's *Close
notification* (or the previous one; back to the page when none is left). Screen readers hear results
politely and refusals at once.

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

## Git status in the sidebar

The bottom of the project sidebar shows where your copy stands, read with git each time the
repository changes:

- **Always:** the branch and its short commit hash (or *Detached HEAD at <hash>* when no branch is
  checked out — governed actions are then blocked with *Blocked: no branch checked out*) and the
  number of files with local changes, when there are any.
- **When the repository has a remote:** *In sync with git*, or how many commits your copy is *ahead*
  of and *behind* the last fetched state of its upstream (*No upstream branch on the remote* when
  the branch tracks none; *<upstream> is not on the remote yet — Fetch reads it* when the branch
  tracks a remote branch that the last fetch did not bring), and **Fetch**. Without a remote none of
  this is shown — no count, no *Fetch*; it appears by itself once you add one with `git remote add`.
- **Fetch** asks git to fetch the upstream's remote now (the only remote, or `origin`, when the
  branch has no upstream); it never changes your branch or your files. While it runs the button
  reads *Fetching…* and **Cancel** stops it. Anyone may fetch, also a user not in the team. Your
  ssh agent and credential helpers are used; git never prompts in a terminal, ssh runs in batch
  mode unless you configured an ssh command of your own, and an askpass program you configured
  (`GIT_ASKPASS`, `core.askPass`, `SSH_ASKPASS`) may still open its dialog — the automatic fetch
  and update run none. A missing credential fails with git's own message. A manual fetch, update
  or push has no time limit (the automatic fetch and auto-push stop after 60 s).
- **A failed fetch** — offline, refused credentials, a remote that does not answer — shows
  *Fetch failed — last fetched at <time>* (the last successful fetch since the console started;
  *last fetched on <date>* when it was on another day, *not fetched since the console started*
  when there was none), with git's message behind the ⓘ button: hover or focus it, or press or tap
  it to open the message — press it again, press outside or use Escape to close it. Nothing else is
  blocked: every view still reads the project. A fetch refused before git runs (several remotes
  and no upstream, a remote of another user, a mirror configuration) shows the reason under the
  button.
- **Update** shows when your copy is *behind* (also when it diverged): it runs `git pull
  --ff-only` with the console's safeguards (never a merge commit, a rebase, a stash or a squash; no
  local tag or branch pruned) and the repository's hooks, as your own `git pull` would. It cannot be
  cancelled: while it runs the button reads *Updating…*. When git cannot fast-forward, nothing
  changes and the sidebar says what to run in a terminal — *Cannot fast-forward: your copy and the
  remote have diverged — run git pull --rebase or git merge in a terminal*, or *Cannot
  fast-forward: local changes to <files> are in the way — commit or stash them in a terminal*.
  Local changes to other files stay as they are.
- **N commits to push** and **Push** show when your copy is only *ahead* — whatever *Auto-push*
  says, so a push that failed after a submit, approve or reject can be tried again. Push sends
  your branch (`HEAD`) to its upstream branch on the upstream's remote — never to a
  `branch.<name>.pushRemote` or `remote.pushDefault` you configured, and never forced — and runs
  the repository's `pre-push` hook. While it runs the button reads *Pushing…* and **Cancel** stops
  it: nothing is shown then, and the sidebar shows where your copy stands (also when the push
  finished just before the cancel). A push goes on when you switch to another project (back on
  it, the sidebar still reads *Pushing…* with *Cancel*); a fetch is cancelled when you leave its
  project. A push cancelled while a local remote receives it can leave git's temporary folder
  `objects/tmp_objdir-incoming-*` in that remote until git's own clean-up (`git gc`) removes it.
  A rejected push — the remote moved, no permission — is a **red
  toast** *Not pushed — the commit stays local* with git's message (*Not pushed — <project>: …*
  when you are on another project by then), and the sidebar still offers *Push*; the toast goes
  when a new push starts or when no commit is left to push.
- **One at a time.** While a fetch, an update or a push runs, the other buttons wait; when the
  button you used goes away with the result (e.g. *Update* once in sync), the focus moves to
  *Fetch*.
- **Who may update and push:** only a user identified as one member of the team (a fetch, anyone).
  Otherwise *Update* and *Push* show, disabled, with *Read-only: Update and Push need you
  identified in the team*.
- **A failed update** — from *Update* or automatic (*Auto-update*) — shows its reason there too,
  until the next update succeeds or the copy moves.
- **Blocked while behind.** Governed actions are blocked while your copy is behind its remote: the
  element panel's footer says *Blocked: your copy is 1 commit behind the remote — Update*, and its
  **Update** runs the same update; once it succeeds the panel's actions are enabled again and the
  focus moves to the reason (or *Submit*). A copy that is only ahead is not blocked.
- **Git's messages are shown as git prints them**, with the folders of this computer that the
  console knows replaced — the project's (`<project>`), the repository's (`<repository>`), a local
  remote's (`<remote>`) and your home folder (`~`) — and the credentials of a URL removed. Other
  absolute paths that git or a hook prints (a folder outside your home, for example) are shown as
  printed (and a hook that prints `<project>` itself cannot be told from the console's replacement).
  Control characters (an escape sequence, a carriage return), invisible format characters (those
  that reverse the direction of text, zero-width ones) and line separators are shown as visible
  escapes such as `\x1b` or `\u202e` — the zero-width joiners of some scripts and emoji (U+200C,
  U+200D) too; a backslash git printed is shown as `\\`, and the text is shown left to right in the
  order git printed it: words of a right-to-left script (Hebrew, Arabic) therefore read reversed
  there. File names and branch names that the git status and its messages quote follow the same
  rule. A very long message keeps its beginning and its end — where git says why it refused — as
  whole lines around one line that stands for the rest (`…`, or `… N characters without a line break
  omitted` when the rest lies inside one line). Credentials written without a scheme
  (`user:password@host`) are removed only after a space, a quote or an opening bracket; other
  spellings (after `=` or `,`, for example) may stay. The same holds for the messages of a refused
  *Add project* or clone, for WingFoil's refusals and for the CLI's warnings (the Memory list's and
  the Directives' notices).

## Automatic sync with the remote

While it runs, the console keeps the projects you have opened since it started up to date with
their remote, by itself. Three settings drive it (spec-006 §2; change
them in *Configuration › UI settings*, see [UI settings](#ui-settings)):

| Setting | Default | What the console does |
|---------|---------|-----------------------|
| Auto-fetch, every *Fetch interval* | on, 60 s | fetches each opened project's remote: the upstream's remote, else the only remote, else `origin` |
| Auto-update | off | right after a fetch, fast-forwards a copy that is behind (`git merge --ff-only`) — only when you are identified in the team |
| Auto-push | off | after each submit, approve or reject made in the console, pushes the branch to its upstream |

### Before you turn Auto-update on

Auto-update makes the console do what `git pull` does, on a timer: the commits someone pushes can
run commands that **your own** git configuration points at — a filter driver (for example git-lfs
or a `filter.<x>.clean` script), your `core.sshCommand`, a credential helper, an `uploadpack`
command or an alias they call — when such a command reads or runs a file of the project, and hooks
your configuration defines (`hook.<name>.command` in newer git). The console runs no hook of the
repository, no fsmonitor and no configuration that comes with the repository (see also *Hooks come
back with your next action* below), but it cannot tell from your configuration whether a command
reads project files: shell forms such as a `$HOME` path, `$(pwd)/…`, backticks or a script that
sources another file all hide it. Leave Auto-update off if your configuration runs scripts from
your projects. This is a declared risk of v0.2 ([Known limitations](#known-limitations)).

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

*Configuration* at the bottom of a project's sidebar opens *Configuration › UI settings*: your own
settings for the console, the same under every project. They are kept in the local state on this
computer (see [Where the local state lives](#where-the-local-state-lives)), never in a project and
never committed, and they apply at once, without a restart.

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
  a reload, unless the *Theme* UI setting forces *Light* or *Dark*
  ([UI settings](#ui-settings)); until the settings are read, a page opens in the system's theme.
- **Keyboard:** every screen is reachable with the keyboard; the first Tab stop is **Skip to
  content**. Focus is always visible. In the project switcher the arrow keys move between projects
  and Tab reaches a project's *Remove* button. Escape closes the element panel and the dialogs; a
  dialog closes with its **Close** button or Escape, not with a click outside it.
- **Screen readers:** status changes (a project added, the list updated, read-only notices) are
  announced politely; the tab title names the project and the view, or the open element
  (e.g. `kanban · Memory — WingFoil UI`).
- **Target:** WCAG 2.1 AA; every screen listed in `test/e2e/support/screens.ts` (the v0.1
  screens, Today, the gate and submit footers, the notification panel, *How to join*, the git
  status and the UI settings) passes an axe scan with no serious or critical violation in both
  themes, on Chromium, Firefox and WebKit (`test/e2e/accessibility.spec.ts`).
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
- **Governed changes go through WingFoil only.** A decision or a submit runs the project's own
  `wingfoil memory approve`, `reject` or `submit`, which makes WingFoil's `wf(…)` commit; the
  console never edits a Memory file itself. One change runs at a time per repository; the console
  checks that the element is still in the state you saw (*This element changed since you opened
  it* otherwise) and has no local changes right before it runs WingFoil — see
  [Known limitations](#known-limitations) for what happens in between.
- **Git transports** (clone, *Fetch*, *Update*, *Push* and the automatic sync) use only the
  `https`, `http`, `ssh`, `git` and `file` transports, whatever `GIT_ALLOW_PROTOCOL` says in your
  environment, and git never prompts in a terminal. For *Fetch*, *Update*, *Push* and the
  automatic sync, ssh runs in batch mode when you configured no ssh command of your own. A local
  remote that belongs to another user of the computer is refused.
  The automatic fetch and update also run no repository hook, no fsmonitor and no askpass program
  ([Automatic sync](#automatic-sync-with-the-remote)).
- **Messages of git and WingFoil** are shown with the folders of this computer that the console
  knows replaced, the credentials of a URL removed and control characters made visible
  ([Git status in the sidebar](#git-status-in-the-sidebar), last item).
- The local state holds no token, no credential and no project content; the user info of a remote
  URL is removed before it is stored.

## Where the local state lives

The project list, the role view of each project, the [UI settings](#ui-settings) and the action
log (the full hash and the time of each commit made by a decision or submit in the console, at most
*Entries kept* of them) are kept outside every repository, in `state.json` of the state directory:

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
| *A reason is required* (the outcomes disabled) | type the reason of the decision: it is recorded in the commit |
| *Blocked: this element has local changes — commit or discard them first* | commit or discard the element's uncommitted changes with git |
| *Blocked: your copy is N commits behind the remote — Update* | press **Update** (in the footer or the sidebar), then decide |
| *Blocked: your copy has diverged from the remote* / *Cannot fast-forward: your copy and the remote have diverged …* | reconcile in a terminal (`git pull --rebase` or `git merge`); the console never merges or rebases |
| *Blocked: no branch checked out* | check out a branch with git |
| *This element changed since you opened it* | someone moved the element meanwhile: the panel shows its new state; decide again if still needed |
| *WingFoil did not finish the action: check <file> with git before trying again* | WingFoil stopped half-way (e.g. a stale `index.lock` or a failing pre-commit hook): inspect the file and the last commit with git |
| *Not pushed — the commit stays local* | read git's message in the toast; when the remote moved, **Update**, then **Push** |
| *Fetch failed — …* in the sidebar | open git's message (ⓘ): offline, refused credentials or an unreachable remote; nothing else is blocked |
| *Not synced automatically: this repository's git configuration includes another file …* | fetch and update with git in a terminal ([Automatic sync](#automatic-sync-with-the-remote)) |
| *Read-only: Update and Push need you identified in the team* | set your git `user.email` to the one of your team entry, or join the team (**How to join**) |

## What v0.2 does not do

From the release plan (`docs/01_vision/07_sequencer.md`, `docs/01_vision/06_features.md`):

- **No editing.** No field editing (the *Field editing* capability needs a WingFoil verb that is
  not released), no editing of the DNA, directives, workflows or repository files, no new Memory
  element and no ingestion (ingestion cards and start: v0.3). The governed changes are submit,
  approve and reject.
- **No git beyond fetch, fast-forward and push.** No merge, rebase, stash, squash or forced push,
  no push to a `pushRemote`, no branch switching or conflict resolution: use git in a terminal.
- **Not yet on Today:** the progress card and the recent activity (v0.3); the next workflow step
  (v0.4, with WingFoil 0.3).
- **No** workflow tree or workflow position, timeline, traceability, git tree, files view or
  missing-references view, command palette, `.wingfoil/ui.yaml` configuration or presets (v0.3),
  no agent launch or agent log (v0.4, with WingFoil 0.3; *Confirm agent launch* is stored but has
  no effect yet), no artifacts view, no "Open on GitHub" link.
- **Notifications stay inside the console:** the bell, Today and the toasts; no e-mail, chat or
  system notification.
- **Not on npm yet:** run it from a checkout or an installed package
  ([README](../README.md#install-and-run)); the publishing pipeline is ready but no version is on
  npm.

## Known limitations

Accepted for v0.2 and recorded in the implementation plans
(`docs/05_plans/rl-v1/rel-v0.1/dev-loop-rel-v0.1-plan.md`,
`docs/05_plans/rl-v1/rel-v0.2/dev-loop-rel-v0.2-plan.md`), the task notes and the bug records
(`docs/04_memory/bugs/`).

Git sync and actions (new in v0.2):

- **Auto-update is a declared risk.** Turned on, it does what `git pull` does on a timer: incoming
  commits can run commands your own git configuration points at — see
  [Before you turn Auto-update on](#before-you-turn-auto-update-on). It is off by default. Hooks
  an automatic update brings through a hooks folder of the project run at your next submit,
  approve, reject or push, as after your own `git pull`.
- **Push goes to the upstream only.** *Push* and Auto-push send the branch to its upstream branch
  on the upstream's remote, never to a `branch.<name>.pushRemote` or `remote.pushDefault`, and
  never force.
- **A cancelled Fetch or Push is not recorded.** The sidebar shows no message and *last fetched
  at* does not move, also when git had finished just before the cancel; the console's log records
  the run as a `git transport` line with `"ended":"cancelled"`. A push cancelled while a local
  remote receives it can leave `objects/tmp_objdir-incoming-*` in that remote until `git gc`
  removes it.
- **Fetch status per project.** Two projects of one repository keep their own fetch status: a
  manual *Fetch* in one moves the other's *ahead* and *behind*, but not its *Fetch failed — last
  fetched at …* line, which changes at that project's own next fetch.
- **The checks before a governed change have a gap.** An edit made by another program between the
  console's check and the WingFoil process (milliseconds) is not caught by the console; WingFoil
  itself refuses one that changes the element's status. Another console or a terminal committing
  at the same moment makes one of the two fail on git's `index.lock`, with git's message. The
  repository's own commit hooks run inside WingFoil's `git commit`, as for any commit of yours.
- **The default reason and a mouse click.** Clicking into the untouched *Approved via WingFoil UI*
  places the caret instead of selecting the text, so typing adds to it; select it first (Tab and
  focus from Today select it).
- **Messages of git and WingFoil, three gaps.** Absolute paths other than the folders the console
  knows (e.g. a folder outside your home) are shown as printed; credentials written without a
  scheme are removed only after a space, a quote or an opening bracket; a hook that prints
  `<project>` cannot be told from the console's replacement.
- **Text from the repository is shown as written.** Names and reasons that come from commits and
  Memory files — the author of an event in the bell's *Updates* and in the history, *Rejected by
  <name>: <reason>* — are not escaped like git's messages: control or
  direction-changing characters in them are not made visible.
- **Offline system, paused page.** While the operating system reports no network connection, the
  page holds its requests to the console (which runs on the same machine) until the connection
  is back: the views do not refresh meanwhile.
- **Local remotes of another user, residual cases.** The refusal is POSIX only (not on Windows); a
  remote whose parent folder another user can write may change between the check and git's use of
  it; a linked worktree whose `commondir` points into another user's repository is not detected;
  `~user` paths are resolved from `/etc/passwd` only (other users fail closed). Pushing to a local
  remote can run that repository's own `git gc --auto`.

From v0.1, still valid:

- **Paths you type are echoed as typed.** The refusals of *Add project* (*Folder not found: <path>*,
  *The working directory is not empty: <path>*, …) show the path you entered without the escaping
  of git's messages.
- **Clone URL check, two edge cases.** An scp-like address with an `@` in its path (after the
  host's `:`) and no `/`, e.g. `git@host:repo@v2.git`, is refused as if it held credentials
  (`git@github.com:repo.git` and `git@host:org/repo@v2.git` are accepted); a URL with an unknown
  scheme and credentials (`git+https://user:pass@…`) is passed to `git clone`, which refuses the
  transport — nothing connects, nothing is stored, the URL is not echoed.
- **A killed clone leaves its folder.** If the console is killed (not stopped) during a clone, the
  partial folder stays; a retry says *The working directory is not empty*. Delete the folder by
  hand.
- **Role view refusal.** If a *Role view* change is refused and the following header re-read never
  completes, the refusal is not shown and the select stays disabled; reload the page.
- **Windows** is tested only through simulated platform behaviour: opening the browser (the
  `#token` fragment through `rundll32`), finding the CLI, stopping child processes (a `wingfoil`
  process may outlive the console briefly) and the git sync have not been checked on a Windows
  machine.
- **Event streams:** the console sets no limit on the number of open pages (event streams).
- **History reading:** after each new commit, the Memory history is re-read by walking the whole
  git log, not incrementally; very long histories make this read slower.
- **One string outside the catalogue:** a screen-reader-only library string (React Aria's
  "Dismiss", in popovers).

Fixed since v0.1.0 (see the [CHANGELOG](../CHANGELOG.md)): the end-to-end suite now runs on
Chromium, Firefox and WebKit; a console killed after a clone no longer leaves an empty
`wfui-no-hooks-*` folder in the system temporary directory (bug-008).
