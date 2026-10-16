# UX reference — WingFoil UI

**Version:** 1.7 · **Date:** 2026-10-16 (0.2: §9 colours aligned with spec-009 — release-planning v0.1 session 2; 0.3: §3 start page with no project open, §5 modal dismissal — dev-loop task-013, decided by the user; 0.4: §4.2 v0.1 read-only panel — dev-loop task-018, decided by the user; 0.5: §4.4 and §4.9 in v0.1 — dev-loop tasks 017 and 020, decided by the user; 0.6: §4.2 panel directives, §4.5, §4.6, §4.10 in v0.1 — dev-loop task-019, decided by the user; 0.7: §3 project switcher in v0.1 (grid rows, removal confirmation, unavailable entries, trigger text) — dev-loop task-015, Wave 4, decided by the user; 0.8: §4.2 non-modal drawer — dev-loop task-015, W4-8, decided by the user; §3 keyboard wording and §4.2 v0.1 bullet aligned after review; 0.9: §3 add-project modal in v0.1 — dev-loop task-014, Wave 4, decided by the user; 1.0: §3 current user, role view and project header strip in v0.1 — dev-loop task-016, Wave 4, decided by the user; 1.1: §3 *How to join* panel — dev-loop task-035, D35-1…D35-9, decided by the approver; identity changes while open — review round 1; 1.2: §4.1 *Today* in v0.2 — dev-loop task-036, D36-1…D36-11, decided by the approver; 1.3: §4.2 *Gate footer* in v0.2 — dev-loop task-037, D37-1…D37-12, decided by the approver; 1.4: §3 *Notifications* and §4.1 all-roles summary in v0.2 — dev-loop task-042, D42-1…D42-8, decided by the approver; 1.7: §3 sidebar *Configuration* and §4.11 *UI settings* in v0.2 — dev-loop task-041, D41-1…D41-13, decided by the approver) · **Status:** Reference for `lean-inception` and `specification-downcast`
**Prototype:** `docs/00_reference/prototype/` (interactive HTML; sample data from the WingFoil
repository and from a fictional Kanban project `acme-checkout`)

This document describes the behaviour validated in the prototype. It is **evidence**, not a
specification: personas, journeys, stories and BDD scenarios are produced by the workflows.

---

## 1. Principles

1. **Lean and organised.** Few pieces of information per screen, grouped by purpose.
2. **What requires me first.** The first screen answers "what must I do or unblock?".
3. **Few clicks.** Governed actions in 1–2 clicks; everything also reachable from ⌘K.
4. **Everything visible.** DNA, workflows, Memory, directives, docs, artifacts and
   traceability are one click away from any screen.
5. **Project-agnostic.** Types, states, gates, roles and workflows come from the project;
   the UI never assumes a vocabulary.
6. **WingFoil is the only writer.** Every change is a CLI call and a commit; the UI shows the
   commit it produced.
7. **Creation only through workflows.** Memory elements are created by ingestion workflows
   (`bug-ingest`, `adr-ingest`…) or by main workflows (e.g. `release-planning` creates tasks),
   never "from scratch".

## 2. Information architecture

```
Header:  logo · project switcher · context crumb · search/⌘K · role view · notifications · user
Sidebar: Today
         Work               → Workflow · Memory · Traceability · Timeline
         Rules and context  → DNA · Directives · Team · Documentation
         Repository         → Files · Artifacts
         (pinned at bottom) → Configuration · git status
Overlay: element panel (right) · command palette · modals (ingestion, agent launch, add project)
```

## 3. Global shell

| Element | Behaviour |
|---------|-----------|
| **Project switcher** | Lists projects added to the UI (name + path, or URL → working dir). "Add project…" opens a modal: *Local folder* (absolute path) or *Remote git repository* (URL + local working dir, auto-filled `~/projects/<repo>`). Validates path/URL and duplicates. The list persists in the UI; added projects can be removed (×). **v0.1 (dev-loop task-015, decided by the user, W4-1/2/3/6):** the list is a popover holding a keyboard grid (one row per project: link to the project with name + path, and a *Remove <name>* × button; arrow keys move between rows, Tab moves from a row to its button), then a separator, *Add project…* (a button) and the footnote; the × asks for confirmation in a modal alert dialog (*Remove <name> from the list?*, "its folder and its files are not touched", Remove / Cancel, Escape cancels; removing the open project returns to `/`); a project whose folder is missing, is not a WingFoil project or whose CLI is missing is a non-link row marked *Unavailable — <reason>* (the install command for a missing CLI) that keeps its × ; the trigger shows the open project's name only (no methodology), *Projects* on `/`; switching keeps the current view in the other project. **Add project in v0.1 (dev-loop task-014, decided by the user, W4-10/11/12/13/15):** a source switch (*Local folder* / *Remote git repository*, a radio group styled as the segmented control); field-level checks before sending (path filled and absolute; URL filled and not starting with `-`, no scheme check; working directory filled when no folder name can be derived from the URL); header Close plus a footer *Cancel* next to *Add* / *Clone and add*; while adding or cloning the fields and the primary button are disabled, a status line and an indeterminate progress bar show (no progress figures: the server sends none), and Cancel, Close or Escape abort the request and close the modal; a refusal of a project already listed shows a link to open it; after a success the new project opens only when it is available, otherwise the modal stays with the reason (e.g. the install command of a missing CLI) and Close; no toast — the opened project is the feedback, with a polite announcement for screen readers. |
| **Start page** | `/` with no project open: header with the project switcher; main with the heading *Projects*, one sentence and *Add project…*. |
| **Context crumb** | Current position in the main workflow (e.g. `rl-v1 › minor-v0.3 › dev-loop`); truncates from the left. |
| **Search / ⌘K** | One palette for: start ingestion, pending actions, navigation, switch project, open any element. Arrow keys + Enter. |
| **Current user** | From `git config user.email`, matched to `dna.team.members[].email`. Shows initials; name + role when single-role; "not in team" badge when unmatched. **v0.1 (dev-loop task-016, decided by the user, W4-16/17/19/22):** at the right end of the global header, only inside a project: initials plus the name always visible (the role too for a single-role member); *not in team* shows the email with a badge, otherwise *No identity* / *Ambiguous identity*, or *team unknown* when the DNA cannot be read. A **project header strip** above the view holds the WingFoil version line (version, "(from PATH)", *Every capability of this release is available* or the missing capabilities with their minimum version; out of range: "read-only: supported <min> to <max>") and one persistent, non-dismissible read-only notice per reason (not in team, no identity with the `git config user.email` command, ambiguous naming the members, DNA unreadable), announced politely. |
| **How to join** | **v0.2 (dev-loop task-035, decided by the approver, D35-1…D35-9):** for a user not in the team (a readable DNA; not for *team unknown*, *No identity* or *Ambiguous identity*) the *not in team* badge is a button, and the not-in-team notice of the project header strip ends with a *How to join* button; both open a modal dialog (title, Close, Escape; focus returned to the opener; §5) that Today and the element panel open too. It says the user's email is not in the team; names the tech leads of the DNA as *Name <email>* in DNA order (members holding `tech-lead`), or says that the project declares no tech lead (ask any member) or no team member at all (anyone with write access can run the command); shows the exact `wingfoil dna add team.members --value "<Your Name>" --entry-email <email> --entry-roles <roles>` command in a code block (the email quoted for the shell only when needed; command words never translated) with *Copy command* (a polite "Command copied", or a text asking to copy by hand) and the roles the DNA declares. The panel follows the data, announced in a status region: a user who has become a member (or whose email now matches several members) reads so; for any other identity without the panel (no email, DNA unreadable) it says that How to join no longer applies and points to the read-only notice; closing it when its opener has gone moves the focus to the main region. Closes journey 6 step 3. |
| **Role view** | Dropdown shown only when the member holds several roles; views are the persona roles intersected with the member's roles. **v0.1 (task-016, W4-20):** a select labelled *Role view*, roles in DNA order; the choice is stored per project and re-reads the header and the directives. |
| **Notifications** | Bell with count. Panel: *To unblock* (same items as "Requires you") and *Updates* (recent activity). Footer states the configured channel. **v0.2 (dev-loop task-042, decided by the approver, D42-1…D42-4):** inside a project, between the role view and the current user, for every identity; the badge shows the length of Requires you of the role view and only when it is not 0, the count is also in the button's accessible name ("Notifications, 2 to unblock"); the panel is a popover (Escape closes it, focus back to the bell) with a heading, *Open Today*, *To unblock* — every Requires you row (type, action, title as a link to the element panel; not limited to 6 as in the prototype), "Nothing to unblock", or a pointer to the read-only notice for a user who is not identified — and *Updates* — the last 10 Memory events newest first (element id as a link, what happened and by whom, the transition, the age), read only while the panel is open; no link to the rest (the Timeline comes later) and **no channel footer** (no channel in v0.2). |
| **Git status** (sidebar) | "In sync with git" or "N commits to push" + Push (when auto-push is off). |
| **Sidebar** | Grouped by purpose (what moves / what describes the project / the repository); pinned to the viewport, Configuration and git status always visible at the bottom. **v0.2 (dev-loop task-041, D41-2):** *Configuration* is the last, heading-less group of the views navigation, pushed to its bottom; the git status sits below the navigation. |

## 4. Screens

### 4.1 Today
1. **Greeting** — "Morgan, 3 things require you"; project · view · roles.
2. **Progress card** (compact):
   - title of the current scope (e.g. release) + state pill + "phase X of Y";
   - thin phase strip (done / current / todo); in *flow* mode, columns with count and WIP
     limit (amber when full, red when over);
   - one row of clickable figures: **project completion %**, **phase completion %**,
     iterated elements done (x/y), open bugs, pending gates.
3. **Requires you** — rows: type tag, title, reason (e.g. "in-review for 2 d · minor-v0.3",
   or the rejection reason in red), state pill, one primary action button. Rejected items first.
4. **Next workflow step** — what to do next for this role, with "Launch <agent>" and the
   context the agent will receive (role, directives, DNA modules, ADRs/specs, branch).
5. **Waiting on others** — full-width card: type, title, role that must act.
6. **Recent activity** — full-width card, link to the Timeline.

All cards are stacked full width, in this order.

**v0.2 (dev-loop task-036, decided by the approver, D36-1…D36-11):** Today is the route
`/p/<id>/today`, the landing view of a project (`/p/<id>` redirects there) and the first sidebar
entry, above the named groups and without a heading. It shows the greeting, *Requires you* and
*Waiting on others* only (the progress card, *Next workflow step* and *Recent activity* come later).
The greeting's second line is "Role view: <view>" — the project name is in the switcher and the
roles in the header's selector (deviation from "project · view · roles"). *Requires you*: the reason
is "<state> for <age>", the rejection ("Rejected by <name>: <reason>", danger colour) for rework, or
"Action required — state <s> is not declared for <type>"; the one primary action (*Approve*,
*Review*, *Submit*, *Open*) and the title open the element panel — the gate and submit footers act
there (§5); empty, the card reads "Nothing requires you" and the greeting "<name>, nothing requires
you". *Waiting on others* (hidden when empty) shows type, title, state pill and who must act: "Jordan
(submitter) must act", "Reserved to approver — Morgan, Alex", "Waiting for the workflow engine". A
user not in the team sees no *Requires you* card but "You are not in this project's team — *How to
join*" (§3); *No identity* and *Ambiguous* point to the read-only notice. A refresh that changes the
rows is announced politely with the new count; a failed read is an error, never the empty state.

**v0.2 all-roles summary (dev-loop task-042, decided by the approver, D42-5…D42-7; S5 of the feature
list, absent from §4.1 above):** for a member holding several roles, a card *Your roles* between the
greeting and *Requires you*: one line per role in DNA order — a button "approver · 2" that switches
the role view, the role's first ≤ 3 items as links to the element panel, and "N more" (a switch to
that view too); the current view's line is marked *current view* and is not a switch. After a switch
the focus moves to the *Requires you* heading once the new view is read. Absent for a single-role
member and for a user not identified.

### 4.2 Element panel (right drawer)
- **v0.1 (dev-loop task-015, decided by the user, W4-8):** the drawer is **non-modal** — no backdrop over the header and sidebar and no focus trap, so the shell (project switcher included) stays operable while it is open; focus moves into the panel on open, *Close* and Escape close it and return focus.
- Type tag, id, **Edit**, close.
- Title; **state machine** as chips (past / current / future).
- Rejection banner if last transition was a reject.
- Summary; **References** with UI category per reference (see §6) and a warning when a
  required reference is missing; applied **directives**; **history** (who, when, reason,
  commit line).
- **Gate footer** (when the user's role owns the gate): reason field + *Cancel* + **all
  options of the gate side by side** (e.g. `Won't fix` · `Duplicate` · `Triage`), approve
  as primary. Reason optional to approve (configurable), mandatory to reject. If
  self-approval is forbidden and the user submitted the element, an explanation replaces
  the action.
- **v0.2 gate footer (dev-loop task-037, decided by the approver, D37-1…D37-12):** deviations from
  the prototype and the bullet above — the reason is **required for approve too**, pre-filled with an
  editable default ("Approved via WingFoil UI", selected on focus; an untouched default is cleared
  when a reject takes the focus and restored when Approve takes it back), as US-G-06 states; the
  order is reason · **Approve → <state>** (primary) · each **Reject → <state>** · *Cancel* (approve
  first, so Tab from the reason never crosses a reject); outcomes stay focusable when disabled, the
  reason ("A reason is required", or the descriptor's blocked reason) being their description;
  opened from Today's *Approve*/*Review* the reason has the focus. Where the user cannot decide the
  footer is a line instead: "Reserved to <role> — <members> can act" (role not held), "Read-only:
  <email> is not in the team — How to join" or "Read-only: see the notice above the view" (not
  identified), "Waiting for the workflow engine (state: <s>)", "Final state: no action is possible";
  a gate that is also a waiting state offers only its reject, with "Waiting for the workflow engine
  to advance". After a decision the panel stays open on the new state (the toast is task-038's).
- **Single-action footer** otherwise (Submit for review, Launch agent, Start review).
- **Edit mode**: title, summary, references (add with Enter, remove ×) → "Save and commit".
- **v0.1 (read-only, dev-loop task-018):** the panel is the route `/p/:pid/e/:eid`, a drawer
  over the project layout (non-modal since W4-8); Close and Escape go back in history, or to the project when the panel
  was opened from its URL. No Edit and no footer (writes from v0.2). Summary = the first paragraph
  of the body as plain text ("No summary in the document." otherwise; full Markdown is US-G-03,
  v0.3). References = the frontmatter fields other than id, type, title and status with their
  values ("—" when empty), without UI category (`ui.yaml` taxonomy from v0.3); a missing required
  field reads "<field> — required field, missing".
  *Directives* (dev-loop task-019): the directives of the current role view plus the global ones,
  each linking to its directive page; a user who holds no role sees the global ones with "You
  hold no role in this project".

### 4.3 Workflow
- **Main workflow tree** with status dots (done / current / todo) and notes; the iterated
  phase (e.g. `dev-loop`) expands its elements with state and who must act.
- **Ingestion workflows**: one card each — name, description, numbered steps
  (e.g. `capture → submit → triage · approver`), open runs, **Start**. Ingestion is started
  only from here, from Memory ("+ Ingestion") or from ⌘K — never from the page header.
- **Edit mode**: rename, move up/down, add phase after, remove (only phases not started);
  banner "changes apply to new runs"; **Dry-run**.

### 4.4 Memory
- Row 1: type filters (from `memory.yaml`) with counts + compact **"+ Ingestion"** button.
- Note: where elements of the selected type come from (ingestion or main workflow step).
- Row 2: state filters — with *All types*: buckets *To approve · In progress ·
  Waiting/drafts/closed · Done*; with a type: that type's real states. Plus
  **"Missing required references"**.
- List: tag, title, id, "missing refs" badge, age, state pill → element panel.
- **Ingestion modal**: choose the ingestion workflow, see its steps, type the title
  (step 1 · capture) → element created as draft by the workflow.
- **v0.1 (dev-loop task-017):** the list is `/p/:pid/memory`; `/p/:pid` redirects there until
  Today (v0.2) takes the project index. Filters live in the URL; the element panel replaces the
  list and closing it returns to the list with its filters and the originating row focused.
  Archived elements are read only once a type is selected (the landing view and type counts
  cover non-archived elements). With a type, the state filters are its `sequence` followed by
  the states found on its elements that the definitions do not declare; types found on elements
  but not in `memory.yaml` follow the declared ones. Bucket labels are the UI's closed vocabulary
  of the feature header. Not in v0.1: "+ Ingestion" (v0.2), the producer note, the "Missing
  required references" filter and badge (the panel flags missing fields); the age comes from the
  descriptor's `since`.

### 4.5 DNA
Modules, stack + methodologies, team and roles, paths. **Edit mode**: modules (name,
description, add/remove), technologies (chips + add), path values.

**v0.1 (dev-loop task-019):** `/p/:pid/dna`, read-only: Project, Modules, Stack (technologies and
methodologies), Team and roles, Paths; an empty list reads "No … declared", absent optional
fields are left out. A failed read is confined to this view and recovers by itself.

### 4.6 Directives
Directive list with bound roles; roles of the current view highlighted; "only mine / all".
**Edit mode**: toggle role bindings per directive, edit description, add/remove directive.

**v0.1 (dev-loop task-019):** list at `/p/:pid/directives` and one page per directive at
`/p/:pid/directives/:did` with its body rendered as in §4.9 (links: `http(s)` in a new tab,
in-page anchors, another directive opens its page, other repository paths read *not shown in the
UI*). "only mine / all" is a two-option control kept in the URL; a member starts on "only mine";
for a user who holds no role "only mine" is disabled with its reason.

### 4.7 Artifacts
Not Memory elements. Found through **artifact paths** (file globs or URLs with
`{release}` / `{version}` placeholders) each linked to the producing phase. URL artifacts link
to the `service` element with the same host, resolved through the taxonomy category
*external*; a warning explains when no type is mapped or no service exists.
**Edit mode**: add/edit/remove paths.

### 4.8 Traceability
- Figures: **project completion**, **current phase completion** (with bars), **reference
  coverage** (elements with required references x/y + references without elements).
- Filters: search, category (requirement / feature…), status (*Completed · In progress ·
  Not started · No elements*).
- Table: reference (hover → title, description, source doc), linked elements as state-coloured
  chips (hover → full title, id, state), completion bar + x/y (hover → elements still open).
- **Click a row** → inline detail: title, description, source, completion, linked elements
  with state and who must act (click → element panel).
- Section "Missing references in documents".

### 4.9 Documentation
Numbered **index** of `paths.docs` (sections → documents with title, description, path).
Markdown opens **inside the UI** (headings, lists, tables, code); links between indexed
documents stay in the UI; external links open in a new tab; "Open on GitHub" for the
current file.

**v0.1 (dev-loop task-020):** index at `/p/:pid/docs`, a document at `/p/:pid/docs/<path>`;
sections are folders, each entry shows its file name and path (no description). Raw HTML in
Markdown is shown as text. A link to a Memory file opens the element panel; a repository target
outside the index is checked once with the server and marked *outside the repository*, *broken
link* or *not shown in the UI*; root-relative links resolve from the repository root; only
`http`/`https` links are followed (new tab), every other scheme is marked *link not supported*.
Images are never loaded ("Image not shown" with the alt text). "Open on GitHub" is deferred.
At most 100 distinct targets per document are checked with the server; the others read *not
shown in the UI* (W3-36).

### 4.10 Team
Member cards (initials, name, email, roles, "you" badge, pending gates on their roles);
agents listed as "executes as a role, never approves". Filters: search, role, "with pending
gates".

**v0.1 (dev-loop task-019):** `/p/:pid/team`; filters kept in the URL; agents in their own
section after the member cards; pending gates per member are counted from the descriptors of the
elements (gates whose actor lists the member).

### 4.11 Configuration
Sub-tabs (one row, scrolls horizontally when narrow):
- **WingFoil** — proposed core settings (to be requested from WingFoil: a core settings file), grouped: Git, Approvals, Workflow,
  Agents, Notifications. Configuration files are edited in their own pages, not here.
- *(Superseded — specification-downcast session 3: permissions are WingFoil's, shown only once WingFoil implements them, L6; the UI keeps none.)* **Permissions** — who may perform each action that changes the project (to be requested from WingFoil: action permissions enforced by the CLI).
  Per action: allowed **roles** (or *all*) and named **people**; "you can / you cannot".
  Gate approvals are not here: they follow the gate roles in `memory.yaml`.

  | Group | Actions |
  |-------|---------|
  | Configuration | WingFoil settings · `ui.yaml` · permissions |
  | Project | DNA · workflows · directives and roles · artifact paths · team members |
  | Memory | start ingestion · edit element content |
  | Execution | launch agents · push to remote |
  | Files | create / edit / delete repository files (later) |

  Evaluated on **all the member's roles** (not the active view). Forbidden actions are shown
  dimmed with "reserved to …" and refuse with a red toast.
- **Taxonomy** (`ui.yaml`) — explains the 8 UI categories and how to fill `categories`,
  `patterns` (regular expressions, first match wins) and `requires`, with examples.
- **Progress** (`ui.yaml`) — each key (`mode`, `scope`, `phases`, `iterates`, `defects`) with
  its current value, meaning and allowed values.
- **Identity** — how the user is recognised (git email → `dna.team`), effect of an
  unregistered email, available views; permissions follow all roles.
- **UI settings** — **v0.2 (dev-loop task-041, decided by the approver, D41-1…D41-13; not in the
  prototype):** `/p/<id>/configuration` opens `/p/<id>/configuration/ui-settings`; the sub-tabs are
  links (one URL each; v0.2 has only *UI settings*). The user's own settings of the console
  (spec-006 §2), the same under every project, kept on this computer and never committed, in cards
  as the prototype's *WingFoil* tab — *Sync with the remote* (Auto-fetch, Fetch interval, Auto-update,
  Auto-push), *Appearance* (Theme: *System* / *Light* / *Dark*, the segmented control), *Agents*
  (Confirm agent launch, "takes effect from WingFoil 0.3", RP-15), *Action log* (entries kept); one row
  per setting with its label, a description and a switch, the segmented control or a number field.
  Each control saves on its own (no Save button): a switch or the theme at once, a number when its
  field is left or on Enter once it is a whole number in range (otherwise a field error, nothing
  saved; Escape restores it). A polite *Settings saved* at every save; a failed save in an alert naming
  the setting, cleared only by a save whose answer holds the value the user wanted for it (review
  round 1, R2); no toast. Next to Auto-update its declared risk (the approver's
  text, task-034 W4-16) and a pointer to the user guide's *Before you turn Auto-update on*, both its
  switch's description. The Theme overrides `prefers-color-scheme` (spec-009 §1).

### 4.12 Timeline
Two tabs; **Time axis** is the default.
- **Time axis** — horizontal arrow, one column per day: bars **above** the axis = Memory
  elements created, **below** = state changes, coloured by element type. Filters: event kind
  (all / created / state changes), element type, author. Click a day → list of its events
  (time, type, element, `from → to`, author) → element panel.
- **Git tree** — commits with branch lanes, branch label on the tip, commit-type tag
  (`wf(task)`, `feat(…)`); Memory commits have a hollow dot. Filters: message search,
  "Memory changes only", branch, author. Click a commit → full message, files (open in Files),
  link to the Memory element. Commits made from the UI appear on top.
- Data comes from `git log`; Memory events are parsed from the `wf(<type>): <verb> <id>
  [from → to]` commit convention.

### 4.13 Files
Read-only repository browser.
- Left: folder tree (folders: caret + name; files: fixed-width type badge + name).
- Right: viewer with full path on its own line, size, "GitHub ↗". Code / YAML / JSON with
  line numbers and syntax highlighting; Markdown with **Preview / Source** toggle; links
  between files stay in the browser.
- **New / Edit / Delete** are shown disabled ("coming"): later they will write the file and
  commit through the server, subject to the permissions WingFoil defines (L6).

## 5. Interaction rules

| Rule | Detail |
|------|--------|
| 2-click gates | "Approve" in Today opens the panel with the reason focused; the second click commits |
| All gate options visible | No "Cancel to find Reject": every outcome is a button |
| Feedback | Toast with result + commit line (+ "signed", "pushed"); red toast when a check blocks |
| Checks | Submit with missing required references: *block* or *warn* (setting) |
| Agent launch | Confirmation modal with context and branch when `agent.launch = confirm` |
| Edit mode | Explicit Edit → bar "Editing · <file> · N changes · Cancel · Save and commit"; leaving the page discards |
| Modal dismissal | A modal closes with its Close button or Escape, not with a click outside it (the outside-click dismiss adds a library text outside the catalogue) |
| Role views | Same screens, content filtered by the roles of the view |
| Permissions | *(Superseded — session 3: no UI-side permissions; WingFoil's, L6)* Every changing action checks the Permissions table before running; refusal names who may do it |

## 6. `ui.yaml` (owned by the UI)

```yaml
# .wingfoil/ui.yaml — WingFoil UI configuration for this project
version: 1
taxonomy:
  categories:            # project Memory type -> UI category
    task: work
    bug: defect
    adr: decision
    decision-log: decision
    tech-spec: spec
    release: release
    service: external
  patterns:              # recognise references that are not Memory ids
    - { match: '^(REQ|US)-', category: requirement }
    - { match: '^(P\d|Journey)', category: feature }
    - { match: '^(minor|patch)-v|^rl-', category: release }
  requires:              # references each type must carry
    task: [requirement]
    adr: [requirement]
    tech-spec: [requirement]
progress:
  mode: sequence         # sequence | flow
  scope: { type: release }   # type only (specification session 3): the current release is derived
  phases: [release-planning, dev-loop, user-docs, e2e-smoke, release-submit, release-publishing, retrospective]
  iterates: task
  defects: bug
artifacts:               # until WingFoil supports a paths.artifacts DNA category
  - { path: 'dist/wingfoil-{version}.tgz', phase: release-publishing }
  - { path: 'https://www.npmjs.com/package/wingfoil/v/{version}', phase: release-publishing }
  - { path: 'reports/{release}/e2e-smoke.md', phase: e2e-smoke }
```

UI categories: `work`, `defect`, `decision`, `spec`, `requirement`, `feature`, `release`,
`external`.

## 7. Computations

- **Reference completion** = done linked elements / linked elements.
- **Project completion** = mean of reference completion over requirement/feature references
  with ≥ 1 linked element.
- **Phase completion** = same, restricted to elements in the current phase scope.
- **Reference coverage** = elements that carry all `requires` categories / elements whose
  type has `requires`.
- **Tone of a state** (colour): gate state → *human* (amber); in the type's done set →
  *done* (teal); first state or engine-waiting → *neutral*; otherwise *active* (blue).

## 8. Variability validated

| Aspect | WingFoil (custom) | acme-checkout (Kanban) |
|--------|-------------------|------------------------|
| Types | task, adr, decision-log, tech-spec, bug, release, service | task, bug, rfc, adr |
| Progress | phase sequence of `release-cycle` | columns with WIP limits |
| Gates | approver / product-owner | reviewer / tech-lead / product-owner |
| Ingestion | bug, adr, decision-log, service | bug-report, rfc, adr |
| External category | service | none (artifact URL cannot be linked — warning shown) |

## 9. Visual language (prototype)

Ink `#081532`, primary `#0C469F`, accent `#1686C8`, teal `#22CEC6` (brand gradient
`#22CEC6 → #1686C8 → #0C469F` from `docs/assets`), neutrals `#F5F7FA` / `#E3E8EF` / `#6B7890`.

> **Superseded by `spec-009-theme-tokens`** (the colour source of the implementation): muted text
> is `#5C6880` (`#6B7890` fails AA at 4.45:1 on white and becomes the control-border colour);
> `#8A96A8` carries no text; added a dark palette and the *attention* (`#FDECEC/#B42318`) and
> *muted* (`#F5F7FA/#5C6880`) tones. Deviations recorded under directive `ux-consistency`.
Type: Geist + Geist Mono. State tones: human `#FFF3DC/#8A5A00`, active `#E3F0FB/#0C469F`,
done `#E2F6F1/#0B6B5C`, neutral `#EEF1F5/#4A5568`.
