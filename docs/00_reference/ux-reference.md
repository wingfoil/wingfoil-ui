# UX reference — WingFoil UI

**Version:** 1.20 · **Date:** 2026-11-12 (0.2: §9 colours aligned with spec-009 — release-planning v0.1 session 2; 0.3: §3 start page with no project open, §5 modal dismissal — dev-loop task-013, decided by the user; 0.4: §4.2 v0.1 read-only panel — dev-loop task-018, decided by the user; 0.5: §4.4 and §4.9 in v0.1 — dev-loop tasks 017 and 020, decided by the user; 0.6: §4.2 panel directives, §4.5, §4.6, §4.10 in v0.1 — dev-loop task-019, decided by the user; 0.7: §3 project switcher in v0.1 (grid rows, removal confirmation, unavailable entries, trigger text) — dev-loop task-015, Wave 4, decided by the user; 0.8: §4.2 non-modal drawer — dev-loop task-015, W4-8, decided by the user; §3 keyboard wording and §4.2 v0.1 bullet aligned after review; 0.9: §3 add-project modal in v0.1 — dev-loop task-014, Wave 4, decided by the user; 1.0: §3 current user, role view and project header strip in v0.1 — dev-loop task-016, Wave 4, decided by the user; 1.1: §3 *How to join* panel — dev-loop task-035, D35-1…D35-9, decided by the approver; identity changes while open — review round 1; 1.2: §4.1 *Today* in v0.2 — dev-loop task-036, D36-1…D36-11, decided by the approver; 1.3: §4.2 *Gate footer* in v0.2 — dev-loop task-037, D37-1…D37-12, decided by the approver; 1.4: §3 *Notifications* and §4.1 all-roles summary in v0.2 — dev-loop task-042, D42-1…D42-8, decided by the approver; 1.5: §4.2 *Single-action footer* and §5 *Feedback* in v0.2 — dev-loop task-038, D38-1…D38-13, decided by the approver; 1.6: §2, §3 *Git status* and *Sidebar* in v0.2 — dev-loop task-039, D39-1…D39-13, decided by the approver; 1.7: §3 sidebar *Configuration* and §4.11 *UI settings* in v0.2 — dev-loop task-041, D41-1…D41-13, decided by the approver; 1.8: §3 *Git status* *Update*/*Push* in v0.2, *Push* whatever auto-push says (a deviation) — dev-loop task-040, D40-1…D40-12, decided by the approver; 1.9: §4.2 the focus after the panel closes — bug-018, task-043 AC-7, decided by the approver; 1.10: §4.2 every opener on Today, the "otherwise" rule, the notification bell — task-043 review rounds 1–2, D43-10; 1.11: §4.6 one row per directive in force — task-047, bug-025, decided by the approver; 1.12: §4.1 Today in v0.3 (roles on one line, filters, entry date, 10 rows, short ids), §4.2 the element page and the rendered summary and document, §4.4 the states of a bucket — release-planning v0.3, RP3-7 N1–N7, RP3-14 D1–D3, D7, D8, decided by the approver; its review round 1, decided by the approver: §4.1, §4.2 the held gates (F1), §4.2 the bell opens the side panel (S5), §6 `holds` and the packs' phases (F6); round 2: S-23.5, the main region for every link (P2), the held-gate bullet after the v0.2 footer (m1); round 3: §4.9 a Memory link opens the main region
from v0.3; 1.13: §4.8 Traceability in v0.3, the screen study N8 — release-planning v0.3, RP3-7, RP3-14 D2, D9, RP3-16 P2, its open questions TQ-1 … TQ-4 for the approver; 1.14: TQ-1 … TQ-4 decided by the approver, §4.8's v0.1-era detail line superseded, §4.4 v0.3 missing references and figure filters, §4.1 v0.3 no phase strip or flow columns until v0.4 — release-planning v0.3 step 5c, X1; 1.15: §4.2 v0.3 one blocked line per distinct reason in the gate footer — task-073, decided by the approver; 1.16: §4.2 v0.3 the element page's footer bar and the toasts above it, §5 *Feedback* — dev-loop task-062, D62-2, D62-12, decided by the approver; 1.17: §3 *Lost session*, the page recovers in place — task-063, adr-003 D6, D7; 1.18: §4.2 v0.3 the side panel in the address — dev-loop task-077, D77-4, D77-7, decided by the approver; 1.19: §4.2 v0.3 the rendered document — comments left out, anchors, the dialog's links — dev-loop task-078, D78-3, D78-5, decided by the approver; 1.20: §4.2 v0.3 only the comments left out, the document that could not be loaded — task-078 security review rounds 1–2) · **Status:** Reference for `lean-inception` and `specification-downcast`
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
| **Lost session** | A page whose session the console refuses (401: the console was stopped and started again, or the page belongs to another console) shows only the header's home link and a full page: the heading *This page is no longer recognised by the console* and the sentence to open the URL printed in the terminal in any tab of this browser — the page reconnects by itself if the console runs on the same port again (decision W3-7). **v0.3 (task-063, adr-003 D6, D7):** the page keeps its address; once another tab of the same origin opens a session, or when the user returns to the page, it checks its cookie and reloads that address (the element it showed); without `--port` a restart is another origin and the page stays on the notice. |
| **Context crumb** | Current position in the main workflow (e.g. `rl-v1 › minor-v0.3 › dev-loop`); truncates from the left. |
| **Search / ⌘K** | One palette for: start ingestion, pending actions, navigation, switch project, open any element. Arrow keys + Enter. |
| **Current user** | From `git config user.email`, matched to `dna.team.members[].email`. Shows initials; name + role when single-role; "not in team" badge when unmatched. **v0.1 (dev-loop task-016, decided by the user, W4-16/17/19/22):** at the right end of the global header, only inside a project: initials plus the name always visible (the role too for a single-role member); *not in team* shows the email with a badge, otherwise *No identity* / *Ambiguous identity*, or *team unknown* when the DNA cannot be read. A **project header strip** above the view holds the WingFoil version line (version, "(from PATH)", *Every capability of this release is available* or the missing capabilities with their minimum version; out of range: "read-only: supported <min> to <max>") and one persistent, non-dismissible read-only notice per reason (not in team, no identity with the `git config user.email` command, ambiguous naming the members, DNA unreadable), announced politely. |
| **How to join** | **v0.2 (dev-loop task-035, decided by the approver, D35-1…D35-9):** for a user not in the team (a readable DNA; not for *team unknown*, *No identity* or *Ambiguous identity*) the *not in team* badge is a button, and the not-in-team notice of the project header strip ends with a *How to join* button; both open a modal dialog (title, Close, Escape; focus returned to the opener; §5) that Today and the element panel open too. It says the user's email is not in the team; names the tech leads of the DNA as *Name <email>* in DNA order (members holding `tech-lead`), or says that the project declares no tech lead (ask any member) or no team member at all (anyone with write access can run the command); shows the exact `wingfoil dna add team.members --value "<Your Name>" --entry-email <email> --entry-roles <roles>` command in a code block (the email quoted for the shell only when needed; command words never translated) with *Copy command* (a polite "Command copied", or a text asking to copy by hand) and the roles the DNA declares. The panel follows the data, announced in a status region: a user who has become a member (or whose email now matches several members) reads so; for any other identity without the panel (no email, DNA unreadable) it says that How to join no longer applies and points to the read-only notice; closing it when its opener has gone moves the focus to the main region. Closes journey 6 step 3. |
| **Role view** | Dropdown shown only when the member holds several roles; views are the persona roles intersected with the member's roles. **v0.1 (task-016, W4-20):** a select labelled *Role view*, roles in DNA order; the choice is stored per project and re-reads the header and the directives. |
| **Notifications** | Bell with count. Panel: *To unblock* (same items as "Requires you") and *Updates* (recent activity). Footer states the configured channel. **v0.2 (dev-loop task-042, decided by the approver, D42-1…D42-4):** inside a project, between the role view and the current user, for every identity; the badge shows the length of Requires you of the role view and only when it is not 0, the count is also in the button's accessible name ("Notifications, 2 to unblock"); the panel is a popover (Escape closes it, focus back to the bell) with a heading, *Open Today*, *To unblock* — every Requires you row (type, action, title as a link to the element panel; not limited to 6 as in the prototype), "Nothing to unblock", or a pointer to the read-only notice for a user who is not identified — and *Updates* — the last 10 Memory events newest first (element id as a link, what happened and by whom, the transition, the age), read only while the panel is open; no link to the rest (the Timeline comes later) and **no channel footer** (no channel in v0.2). |
| **Git status** (sidebar) | "In sync with git" or "N commits to push" + Push (when auto-push is off). **v0.2 (dev-loop task-039, decided by the approver, D39-1…D39-13):** a labelled region *Git status* at the bottom of the sidebar, below the views navigation and outside it: the branch and the 7-character hash in mono (*Detached HEAD at <hash>* on a detached HEAD) and "N local changes" when > 0 — always; while the `has-remote` condition holds: the copy line (*In sync with git*, "N ahead", "N behind", "A ahead · B behind", *No upstream branch on the remote* or "<upstream> is not on the remote yet — Fetch reads it"), *Fetch* — aria-disabled and reading *Fetching…* while it runs, *Cancel* next to it, focus back on *Fetch* after a cancel — the last fetch error "Fetch failed — last fetched at <time>" (the time alone for today, date and time otherwise; the only place that time shows) with git's message in a tooltip of an ⓘ button on hover and keyboard focus and in a dismissable popover dialog on press — a tap shows no tooltip; the dialog takes the focus, closes on a second press, a press outside or Escape and gives the focus back — (also its description, kept out of the live region) and the code's catalogue text, the last update error's catalogue text, and a manual fetch's refusal in an alert of its own; without `has-remote` no count and no sync control (S-11.2). **v0.2 (dev-loop task-040, decided by the approver, D40-1…D40-5):** *Update* while the copy is behind (also diverged: the refusal names the terminal commands), not cancellable, reading *Updating…* while it runs; "N commits to push" and *Push* while the copy is only ahead — **deviation:** whatever auto-push says, not only "when auto-push is off" (a failed or timed-out auto-push is retried with *Push*; the copy line "N ahead" stays above it); *Push* reads *Pushing…* with *Cancel*; one transport at a time (the other controls aria-disabled, the focus handed to *Fetch* when the control that held it goes); update refusals as the last-update-error line (or the block's alert when not recorded), a failed push as a red sticky toast "Not pushed — … local" with git's text; for a user who is not one member *Update* and *Push* disabled with "Read-only: Update and Push need you identified in the team". The element footer's copy-behind reason ends with an *Update* link that runs the same update (G-12.2), then the focus goes to the reason (or *Submit*). |
| **Sidebar** | Grouped by purpose (what moves / what describes the project / the repository); pinned to the viewport, Configuration and git status always visible at the bottom. **v0.2 (task-039, D39-1):** one sticky column holding the views navigation (it scrolls) and, below it, the git status (it scrolls on its own only when taller than half the column). **v0.2 (dev-loop task-041, D41-2):** *Configuration* is the last, heading-less group of the views navigation, at its bottom and kept visible (sticky) while the navigation scrolls. |

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

**v0.3 (release-planning v0.3, RP3-7 N1–N4, RP3-14 D1, D2, D8; the tasks of `minor-v0.3`):**
- *Your roles* (N1) is **one line**: one tag per role in DNA order, "approver · 2" — the role and
  the count of *Requires you* in that role view; a click switches the role view (focus as in v0.2);
  the current view's tag is marked *current view* (pressed) and is not a switch. No items and no
  "N more" (S-23.4, S-23.5). Absent as in v0.2.
- *Requires you* and *Waiting on others* (N2, N3) each have two filters, **type** and **state**,
  listing the types and the states of that card's rows with their counts (*All* by default; a
  filter applies to its own card only). Each row shows when its element **entered its current
  state** — the descriptor's `since` (spec-003 §8) as a date, the full time as its accessible
  description; nothing when `since` is absent. Each card shows **10 rows** at first, then "Show all
  (<n>)" expands it and "Show fewer" collapses it back; filters apply before the limit; the
  greeting and the bell keep counting every row of *Requires you*, unfiltered.
- Each row names its element by its **short id** (N4, e.g. `task-046`; the full id when the type's
  id pattern has no number) — the rule is the element-addressing spec's (RP3-14, step 5b).
- *Waiting on others* keeps the v0.2 texts; "Waiting for the workflow engine" on a settled decision
  does not occur (spec-003 §2 kind `last`), and the engine's own step text is v0.4 (D1).
- A **held gate** (`ui.yaml` `holds`, spec-005 §4a; RP3-14 D5) is never in *Requires you* and is
  not a pending gate: it is in *Waiting on others* for **every** member, approvers included, with
  the hold's reason in place of "Reserved to approver — …": "Approved outside the console
  (ui.yaml)" (`held-by-config`) or "Waits for <n> referencing element(s) to be done"
  (`held-until-references-done`) (S-24.5, S-24.6).
- The progress card shows its phase figures read-only until v0.4 (spec-005 §4, D2) — and neither
  the phase strip nor the `flow` columns of item 2 above: both need `workflow status` (v0.4,
  spec-012 §3); *Recent
  activity* lists the last 5 Memory events (REQ-PERF-11) with no link while the Timeline is v0.4
  (D8).

### 4.2 Element panel (right drawer)
- **v0.1 (dev-loop task-015, decided by the user, W4-8):** the drawer is **non-modal** — no backdrop over the header and sidebar and no focus trap, so the shell (project switcher included) stays operable while it is open; focus moves into the panel on open, *Close* and Escape close it and return focus. **v0.2 (bug-018, task-043 AC-7, decided by the approver):** the focus returns to the opener — the control that opened the panel — when it is one of: the Memory list's row (X-06.3), or on Today a *Requires you* action, a *Requires you* title link, a *Waiting on others* link or an item of the all-roles summary (review rounds 1–2, D43-10) — also after the gate footer's *Cancel*, and while that control is still listed. Otherwise the focus goes to the main region: when the opener is no longer listed (e.g. a decided gate left *Requires you*), and when the panel was opened another way — an item of the notification bell (it opens the panel from a popover that closes), its address, or another link.
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
- **v0.3 held gate (RP3-14 D5, spec-005 §4a, spec-003 §3):** the footer shows the hold's reason as an
  informational line ("Approved outside the console (ui.yaml)", "Waits for <n> referencing
  element(s) to be done") and no *Approve*; a member holding `approver` keeps the reason field, each
  **Reject → <state>** and *Cancel*; any other member sees the reason line only (S-24.5, S-24.6).
- **v0.3 state at its limit (task-073, spec-003 §6 rule 5, RP3-14 D11; decided by the approver,
  2026-11-11, design Q3 option A):** a `submit` or `approve` whose next state is at its `limits` is
  disabled with "Blocked: only <limit> <state> at a time" (S-24.7); a reject is never limited. The
  gate footer shows one blocked line per **distinct** reason, and each disabled outcome is described
  by its own reason's line: a reason shared by every outcome (rules 1–4) keeps the single line of
  v0.2, while the limit has a line of its own that only *Approve* points to, each *Reject* staying
  enabled.
- **Single-action footer** otherwise (Submit for review, Launch agent, Start review).
- **v0.2 single-action footer (dev-loop task-038, decided by the approver, D38-6, D38-7):** *Submit
  → <next state>* (primary, the target named as the gate outcomes do — "Submit for review" would be
  wrong where the next state is not a review) then *Cancel*, offered to every member identified in
  the team (WingFoil requires no role for `submit`), not only to the prototype's "assignee";
  disabled like the gate outcomes (focusable, the descriptor's reason shown and as its
  description). No *Launch agent* / *Start review* in v0.2. The gate footer's inline result
  ("<id> is now <state>", the refusal band) is replaced by the toasts of §5.
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
- **v0.3 (release-planning v0.3, RP3-7 N5, N6, dl-012 R2, bug-019; RP3-14 D3):**
  - **Where it opens (N5).** Opened from Today — *Requires you*, *Waiting on others*, *Recent
    activity* — or from an item of the notification bell, the element stays in the **side panel**
    above (non-modal, its focus rules; the bell, review round 1 S5, decided by the approver): the
    side panel is for Today and the bell **only**. Opened any other way — its address, the Memory
    list, a link inside a document, a directive or another element (review round 2 P2, decided by
    the approver) — it is shown in the page's **main region**, with
    the sidebar, as a page of its own; *Close* and Escape go back in history, or to the Memory list
    when it was opened from its address. Same content and footers in both places.
  - **The element page (dev-loop task-062, D62-2, D62-12, decided by the approver).** The title is the
    page's level-1 heading and takes the focus on open; the footer sits in a bar at the bottom of
    the window while the page scrolls, and the toasts of §5 stay just above that bar (and below the
    page's header while it is in view), never over its actions. No prototype screen: the drawer's
    content is shown in the main region as is.
  - **The side panel (dev-loop task-077, D77-4, D77-7; decided by the approver, Q1 (a), Q2 (a)).** The
    v0.2 drawer over the view, which stays mounted (Today keeps its filters and expanded lists);
    the address is the view's plus `?panel=<id>` (spec-011 §2). Opening pushes a history entry only
    when no panel is open; opening another element while one is replaces it, so one *Close* — or
    Back — returns to the view. The heading takes the focus on open; after *Close*, Escape,
    *Cancel* or Back the focus returns to the opener of §4.2 v0.2, else to the main region. On the
    element page a bell item opens that item's element page (the panel is not shown there). A
    short value shows its element, an ambiguous one its candidates in the panel (each a `?panel=`
    link on the view), any other value the panel's *not found*.
  - **Its address.** `/p/<id>/e/<element id>` as before; a short id resolves to its element and the
    address is rewritten to the full id; a short id that matches several elements shows the
    candidates, each a link, instead of *not found* (dl-012 R2, D3); an id longer than 100
    characters opens and is decided like any other (bug-019). The URL forms and the resolution
    are the element-addressing spec's (RP3-14, step 5b).
  - **Summary (N6).** The body's first paragraph **rendered as Markdown** (emphasis, code, links),
    no longer as plain text; "No summary in the document." otherwise. A button *Open document*
    opens a **modal dialog** with the whole body, **rendered** by default, with a *Rendered /
    Source* switch (source: the Markdown as written, in a monospace block); an empty body reads
    "No content yet" (G-03.3). The dialog closes with *Close* or Escape (§5 *Modal dismissal*) and
    gives the focus back to the button.
  - **Rendering.** The documentation view's renderer (§4.9; `adr-002`: markdown-it with raw HTML
    shown as text, DOMPurify): relative links resolve against the **element file's folder** and are
    classified as the documentation view's links — a link to another element's file opens that
    element (G-03.2); images are **never loaded** (their alternative text is shown, marked). The
    body comes with the element's read (`GET /api/p/<id>/elements/<element id>`, its `body`,
    spec-001 §4.2): no other read.
  - **The rendered document (dev-loop task-078, D78-3, D78-5; decided by the approver, task-062
    Q2 (b)).** The body's HTML comments (a template's placeholders) are left out of the summary and
    of the rendered document, outside code — only the comments: text after one stays (security
    review rounds 1–2); *Source* shows them. When the summary and the document cannot be loaded, their
    place says so with *Reload the page*, and the rest of the element stays. A link selected in the dialog
    closes it and opens its target (from the side panel, the element page in the main region); a
    link to a heading of the same body moves the focus to that heading in the dialog, and from the
    summary opens the dialog on it. The links of a body that names no repository file need no read
    (the documentation index, the elements and the file checks are read only for one that does).

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
- **v0.3 state filter (release-planning v0.3, RP3-7 N7, RP3-14 D7):** with *All types* the four
  buckets stay as **groups**; each group also offers its **states** — the states of the elements
  in that bucket, by name — as sub-options. Selecting a bucket lists all its elements, as in v0.1
  (M-01.2, M-02.2); selecting one of its states narrows the list to that bucket's elements in that
  state (M-02.4). The URL keeps the bucket and the state. With a type selected the state filters
  are unchanged (the type's real states).
- **v0.3 missing references and figure filters (release-planning v0.3, M2, US-M-03, US-M-04,
  US-T-13; spec-012 §3, §5; TQ-4, TQ-5 decided by the approver):** the state filters gain
  **"Missing required references"** with its count, shown whenever the effective `ui.yaml`
  `taxonomy.requires` names a type — **with a count of 0** when nothing is missing — and hidden
  otherwise (M-04.1, M-04.2); it lists the elements whose `missingCategories` is set, each row
  with the badge **"missing refs"** (M-03.1), its accessible description naming the missing
  categories. A progress-card figure of Today opens `/p/<id>/memory?figure=<code>`
  (`completion`, `iterated`, `open-defects`, `pending-gates`): the list shows that figure's
  elements, its other filters cleared, the active filter named by the figure ("Pending gates",
  T-13.1) with a control that clears it; an unknown code shows the list unfiltered.

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
One row per directive id, the one in force (task-047, bug-025): when a custom directive overrides
a built-in one, only the custom file's row is listed, at its place in WingFoil's order, and
WingFoil's warning naming both files is shown under the list as its text; a link to the shadowed
file reads *not shown in the UI*. The element panel's *Directives* section (§4.2) lists the same
entries.

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
  with state and who must act (click → element panel). *(Superseded for v0.3 by the block below:
  no description or source for a pattern reference, D9; a click opens the element page, P2.)*
- Section "Missing references in documents".

**v0.3 (release-planning v0.3, RP3-7 R5 with the screen study N8, RP3-14 D2, D9, RP3-16 P2; the
API is spec-012; the figures are spec-005 §4's, not re-derived by the web):**
- **Route.** `/p/<id>/traceability`, the sidebar's *Work* group (§2). The filters live in the URL
  (`scope`, `category`, `status`, `q`), as the Memory list's; the open row does not.
- **What a row is.** One per **reference** (spec-005 §4): a value of a top-level frontmatter field
  (a string, or a string item of a list) that equals the id of another non-archived element — its
  category is that element type's — or matches a `taxonomy.patterns` entry (the first that
  matches; its category). Values are taken **as written**: no grouping by prefix (a deviation, below).
  A reference whose category is none (a type with no category) is not listed. Every category is
  listed (TQ-1). Without `ui.yaml` there are no patterns: only element-to-element references are
  recognised (below). In *Whole project* scope a non-archived element whose type has the category
  `requirement` or `feature` and that no element references is a row too, with no linked
  elements (*No elements*).
- **Scope (TQ-2).** A two-option control "<current element> (current <type>)" · "Whole project"
  above the figures, the current element by default; the figures and the rows follow it — in the
  current scope a row lists only its linked elements in scope (spec-005 §4 in-scope rule) and a
  reference with none is left out. Hidden when there is no current element (`flow` mode, no
  `progress.scope`, or "No current <type>"): the page is then project-wide.
- **Figures** (three cards, as the prototype): *Project completion* — spec-005 §4 over the scope
  shown, with a bar and the same explanation as Today's on hover **and** focus (T-14.1, T-14.2),
  or "Completion needs references — see Configuration › Taxonomy" when no reference has a
  `requirement` or `feature` category (T-12.2); *Phase completion* — read-only until v0.4 (D2),
  "Phase completion — needs WingFoil 0.3" below 0.3.0, the `not-in-release` reason from it;
  *Reference coverage* — x/y project-wide in both scopes, with "<n> references without elements"
  (*Whole project*), or "No type requires references — see Configuration › Taxonomy" when
  `taxonomy.requires` is empty.
- **Table** — three columns: *Reference*, *Linked elements*, *Completion*. *Reference*: the
  category tag and the id. A **pattern reference shows its id only** (D9: no title, description or
  source document, so no hover card); an **element reference** shows its short id (spec-011 §1),
  its title and its state pill, the id a link to its element page. *Linked elements*: one chip per
  element, labelled with its short id, coloured by its tone (spec-003 §7), every chip shown
  (wrapping); its tooltip — full title, full id, state — appears on hover and on focus; a chip
  opens the element page in the main region (P2, spec-011 §2). *Completion*: a bar and
  "50 % · 1/2" (R-01.1); "—" for no linked element. Rows in natural id order (digit runs compared
  as numbers), chips the same.
- **Filters** — a search field (a case-insensitive substring of the id and, for an element
  reference, its title; never a regular expression); **category**: *All* and each category found,
  in the closed order of §6, each with its count; **status** (counts within the chosen category):
  *All*, *Completed* (every linked element done), *In progress* (some, not all), *Not started*
  (none done), *No elements* (no linked element; *Whole project* only). Done = spec-003 kind
  `last` (spec-005 §4). Filters combine.
- **Inline detail** — a click on a row (or Enter/Space on its toggle) opens its detail under it,
  one at a time: the id, the category, for an element reference its title, state and *Open*; the
  completion x/y; each linked element as "short id · title · state pill · who must act", the
  texts of *Waiting on others* (§4.1, spec-003 §5: "Jordan (submitter) must act", "Reserved to
  approver — …", "Waiting for the workflow engine", a held gate's reason), nothing for a done
  element; each opens the element page. No description or source for a pattern reference (D9).
- **Missing references** — the prototype's *Missing references in documents* listed the elements
  that lack a reference their type requires; v0.3 keeps that meaning under the title **"Elements
  missing required references (<n>)"**: every non-archived element whose type has
  `taxonomy.requires` and that carries no reference of at least one required category — the same
  set as the Memory list's filter (M2, §4.4) —, each row its type tag, short id, title and "needs
  <categories>", opening the element page, and a link *Show in Memory* (the Memory list with that
  filter). Hidden when `taxonomy.requires` is empty; "Every element carries its required
  references" when the set is empty. **Out of v0.3:** references a *document* names that no
  element links (e.g. a requirement of the SARD no task cites) — the console reads no source
  document of a reference (D9), so it cannot list them; a candidate once WingFoil gives a project a
  machine-readable chain (the feedback note of D9).
- **No `ui.yaml`** (or an ignored one) — the inferred values (spec-005 §3): no patterns and no
  `requires`, so only references between Memory elements are listed (e.g. a field holding another
  element's id), a note above the table reads "No ui.yaml — only references to other Memory
  elements are recognised" with links to *Use preset* (when offered, spec-005 §5) and
  Configuration › Taxonomy; an ignored file shows its warning "ui.yaml ignored: …" at the top of
  the page as Today does (C-04.1). The inferred categories name no `requirement` or `feature`, so
  *Project completion* reads "Completion needs references — …" and coverage "No type requires
  references — …".
- **Empty states** — no reference at all: "No references found — declare taxonomy patterns in
  ui.yaml" when the effective `taxonomy.patterns` is empty (R-01.4), else "No references found —
  no element carries a value matching the taxonomy patterns or another element's id"; filters that
  match nothing: "No reference matches" (R-01.3) and *Clear filters*. A failed read is an error,
  never an empty state (as Today).
- **Refresh** — on the event stream's `repo` the page reads again (within 5 s, REQ-PERF-03); the
  open row stays open while its reference exists; the focus is not moved; a change of the row count
  after a refresh is not announced.
- **Accessibility** — a `<table>` with column headers; the row toggle is a button in the
  *Reference* cell with `aria-expanded` and `aria-controls` naming the detail, which is the next
  row (one cell spanning the columns) headed by the reference id; the scope, category and status
  filters are groups of toggle buttons (`aria-pressed`) with a visible label and the count in each
  button's name; after a filter change the number of rows shown is announced politely ("12
  references"); every bar has its text ("50 % · 1/2"); state colours always come with the state's
  name (pill text, chip accessible name "task-002 — <title> — done"); tooltips open on focus as on
  hover and close with Escape; nothing is reachable on hover only.
- **Deviations from the prototype** (`docs/00_reference/prototype/`, its *Tracciabilità* view):
  (1) no grouping of references by their first two dash-separated parts (the prototype's `keyOf`
  merges `REQ-ARC-03` into `REQ-ARC`): a methodology's id shape is not the UI's to know
  (REQ-ARC-05); (2) every category listed, not only `requirement` and `feature` (TQ-1); (3) no
  hover card with title, description and source document for a pattern reference, nor in the
  detail (D9); (4) *Phase completion* read-only (D2) where the prototype computed it on the
  iterated type; (5) *Project completion* over the scope (spec-005 §4) with the scope control
  (TQ-2), new; (6) a chip or a detail row opens the element page in the main region, not the
  element panel (P2); (7) chips labelled by the short id of spec-011, not by the id's first two
  parts; (8) the hover-only texts (the open elements on the completion bar) are in the detail,
  reachable by keyboard; (9) the missing-references section renamed and defined (above); (10) the
  no-`ui.yaml` note, new.
- **Decided by the approver (2026-11-03, "TQ-1…TQ-6 … come consigliato")** — the text above follows each recommendation:
  - **TQ-1 — which categories are rows.** (a) `requirement` and `feature` only, as the prototype
    and the completion figure; (b) every category, *All* by default, the figures still on
    `requirement` and `feature`. Decided: **(b)** — without `ui.yaml` the only references are
    element-to-element ones (`release`, `decision`, `spec` …), so (a) would leave the page empty on
    every project without the file, and a spec or a decision with the elements that cite it is
    traceability too.
  - **TQ-2 — the scope of the rows.** (a) the current scope only, as the figures (a reference
    whose elements all lie in an earlier release disappears); (b) the whole project for the rows,
    the current scope for the figure (the figure no longer adds up from the rows); (c) a scope
    control, current by default, rows and figures following it. Decided: **(c)** — one more
    query parameter (`scope`, spec-012 §4), and the figure always matches the rows shown.
  - **TQ-3 — a reference to an archived element** (e.g. `supersedes: spec-002`). (a) not
    recognised in v0.3 (the archived elements are not read: two more CLI processes, spec-001 §3);
    (b) recognised, reading the archived lists for this page. Decided: **(a)** — archived
    elements leave every figure (spec-005 §4) and Today must stay within REQ-PERF-05; a value that
    matches a pattern is still a reference.
  - **TQ-4 — figure filters on the Memory list (T-13).** (a) `/p/<id>/memory?figure=<code>`, the
    list taking the ids from the progress answer it shares with Today; (b) the ids in the URL.
    Decided: **(a)** — short, stable addresses that follow the next repository state; (b)
    can exceed an address's length and goes stale.

### 4.9 Documentation
Numbered **index** of `paths.docs` (sections → documents with title, description, path).
Markdown opens **inside the UI** (headings, lists, tables, code); links between indexed
documents stay in the UI; external links open in a new tab; "Open on GitHub" for the
current file.

**v0.1 (dev-loop task-020):** index at `/p/:pid/docs`, a document at `/p/:pid/docs/<path>`;
sections are folders, each entry shows its file name and path (no description). Raw HTML in
Markdown is shown as text. A link to a Memory file opens the element panel (from v0.3 the element
page in the main region, §4.2 v0.3); a repository target
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
| Feedback | Toast with result + commit line (+ "signed", "pushed"); red toast when a check blocks. **v0.2 (dev-loop task-038, decided by the approver, D38-1…D38-5):** deviations from the prototype (one toast, dark, 4.2 s) — a stack of at most 3 at the bottom centre, newest last, light surface with an accent (danger for a refusal); while the element panel is open the stack is centred in the area between the main region's left edge and the panel (the sidebar, with the Git status at its foot, stays clear), or — when that area is narrower than 360 px — placed just above the panel's footer, never over its actions; with no footer yet (loading, a read error) it keeps the bottom centre (review rounds 1–2, R1, R2-1, R2-2); the stack is never taller than the room below the header (below the panel's own header too when it is over the panel, so its Close stays reachable) and scrolls (then taking the pointer) when sticky toasts outgrow it (R2-3); a fourth toast evicts the oldest *non-sticky* one; a result goes after 8 s, paused while hovered or focused; a refusal, and a result whose auto-push failed, are sticky — they leave only by Close or when a new result for the same element replaces them (R5); a toast removed while it held the focus gives it to the Close of the nearest toast left (the next one, else the previous one), or to the main region when none is left (R3-3); an overflowing stack scrolls by itself only to show a toast just added, at its top (R3-1); each toast has *Close notification*; a new result for the same element replaces its toast; the focus is never moved to a toast. Content: "Approved/Submitted/Rejected <id>", one line per commit (7-character hash, subject), "pushed"; a failed auto-push adds "Not pushed — the commit stays local" and the reason (catalogue code or git's text verbatim); a refusal reads "<Verb> of <id> not done" and the error (WingFoil's text verbatim). Results are announced politely, refusals assertively (two always-present live regions without `status`/`alert` role, each toast `aria-atomic`; the stack belongs to React Aria's top layer so it is announced while a popover is open). No "signed" in v0.2. **v0.3 (task-062, D62-12):** on the element page the stack stays above the page's footer bar while it is in view, and below the page's header |
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
  phases: [sprint-planning, development, plan-release, release, sprint-review, retrospective, close]
  iterates: task
  defects: bug
holds:                   # gates whose Approve the console does not offer (spec-005 §4a)
  release: { releasing: { approve: never } }
  release-line: { active: { approve: when-references-done } }
artifacts:               # until WingFoil supports a paths.artifacts DNA category
  - { path: 'dist/wingfoil-{version}.tgz', phase: release }
  - { path: 'https://www.npmjs.com/package/wingfoil/v/{version}', phase: release }
  - { path: 'reports/{release}/e2e-smoke.md', phase: release }
```

The WingFoil `sw-life-cycle` preset's exact content is spec-005 §5, which is authoritative where
this example differs (the phases of the packs' `sprint` workflow, every artifact at `release`).

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
