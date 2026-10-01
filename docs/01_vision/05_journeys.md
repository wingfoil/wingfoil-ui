# User Journeys — WingFoil UI

**Version:** 0.2
**Date:** 2026-10-01 (0.2: J4 obstacle, J0 landing in v0.1 — coherence audit)
**Status:** Accepted in lean-inception session 3 (2026-10-01)
**Input:** `04_personas.md` · `02_product-vision.md` · `03_is-isnot.md`
**Evidence:** `docs/00_reference/ux-reference.md` (screen references below as §n) and the prototype

Each step names the screen that serves it (UX reference section) or **GAP** when the UX reference
has no screen for it yet; gaps are collected at the end. The *WF* column is the minimum WingFoil
version the step needs (`02_product-vision.md`, Q2); `—` means no WingFoil call (UI or git only).

---

## Journey 0 — Add a project to the UI

**Actor:** Alex (solo maintainer) · any member
**Goal:** Open a WingFoil project in the UI, from a local folder or a remote repository.

| # | Action | Screen | WF | Outcome |
|---|--------|--------|----|---------|
| 1 | Open the project switcher → *Add project…* | Shell · project switcher (§3) | — | Modal: *Local folder* or *Remote git repository* |
| 2 | Give the folder path, or the remote URL and the working dir (auto-filled) | Add-project modal (§3) | — | Path/URL validated; a remote is cloned |
| 3 | The UI checks it is a WingFoil project and reads its WingFoil version | Add-project modal (§3) · **GAP** version notice | 0.2.2 | Project added; capabilities the project's WingFoil lacks are listed |
| 4 | The UI identifies the user from git and opens Today | Today (§4.1) | 0.2.2 | Today for the user's role view, or the read-only view (Journey 6) |

**Rules:** the same repository cannot be added twice — two working copies would show the same
project (**Q3**). A second add of a known remote, or of a working copy of it, is refused and points
to the existing entry.

**Success:** a project is browsable in under a minute, with what it cannot do yet stated up front.

---

## Journey 1 — Morgan clears the gates

**Actor:** Morgan (approver / tech lead)
**Goal:** Unblock the team: pass or reject every gate waiting on the approver role.

| # | Action | Screen | WF | Outcome |
|---|--------|--------|----|---------|
| 1 | Open the UI; the bell shows the count of gates to unblock | Shell · notifications (§3) | 0.2.2 | Knows how much is waiting before opening anything |
| 2 | Read *Requires you*: type, title, reason, age; rejected-again first | Today (§4.1) | 0.2.2 | Prioritises without navigating |
| 3 | Click *Approve* on an item → element panel opens, reason focused | Element panel (§4.2) · rule "2-click gates" (§5) | 0.2.2 | Element, references, history and directives in view |
| 4 | Choose an outcome (approve, or a reject target such as *Won't fix*), with reason | Element panel · gate footer (§4.2) | 0.2.2 | CLI verb runs; toast with the `wf(…)` commit (§5) |
| 5 | Check who is still blocked and by whom | Today · waiting on others (§4.1) · Team (§4.10) | 0.2.2 | Follows up with the right person |

**Obstacles:** a gate the CLI refuses (missing required field, wrong role) — shown as a red toast
with the CLI's reason. No `--dry-run` before WingFoil provides it (`wingfoil-cli` W-02).

**Success:** each gate passed or rejected in ≤ 2 clicks from Today, reason recorded.

---

## Journey 2 — Casey follows the project and decides a product item

**Actor:** Casey (product owner / manager)
**Goal:** Know where the project stands and take the product decisions waiting on them.

| # | Action | Screen | WF | Outcome |
|---|--------|--------|----|---------|
| 1 | Read the progress card: scope, phase X of Y, completion, open bugs, pending gates | Today · progress card (§4.1) | 0.2.2 (phases: 0.3) | Understands progress in plain words |
| 2 | Click a figure (e.g. pending gates, open bugs) | Memory filtered (§4.4) | 0.2.2 | Sees the items behind the number |
| 3 | Open a decision-log `in-discussion` and read it as a document | Element panel (§4.2) · Documentation (§4.9) | 0.2.2 | Reads context, options, history |
| 4 | Decide it (approve, or reject with reason) | Element panel · gate footer (§4.2) | 0.2.2 | Decision recorded as a `wf(…)` commit |
| 5 | Follow a feature down to the work delivering it | Traceability (§4.8) | 0.2.2 | Sees what is done, open and missing |

**Obstacles:** in WingFoil 0.2.2 a gate is passed by the `approver` role, not by a per-gate role —
Casey needs `approver` in the DNA to decide; otherwise the item shows "reserved to approver".
Phase progress needs the workflow engine (0.3); before it, the card shows Memory figures only.

**Success:** Casey follows the project and decides product items without a developer.

---

## Journey 3 — Jordan works the next step with an agent

**Actor:** Jordan (team developer)
**Goal:** Pick up the next task, run the agent on it with the right context, submit the result.

| # | Action | Screen | WF | Outcome |
|---|--------|--------|----|---------|
| 1 | Read *Requires you*: work rejected back (with reason) and the next workflow step | Today (§4.1) | 0.2.2 (next step: 0.3) | Knows what to do first |
| 2 | Inspect the step's context: role, directives, DNA modules, specs, branch | Today · next step (§4.1) | 0.3 | Knows what the agent will receive |
| 3 | Click *Launch agent* (confirmation modal when configured) | Today / element panel · rule "Agent launch" (§5) | 0.3+ | Agent started on the step |
| 4 | The button becomes **View agent's logs**; click it to follow the run (**Q6**) | **GAP** agent log view | 0.3+ | Output followed inside the UI, live |
| 5 | Submit the element when the work is done | Element panel · single-action footer (§4.2) | 0.2.2 | Element moves to the next state; commit shown |

**Obstacles:** agent execution and the next step need WingFoil 0.3+; on 0.2.2 steps 2–4 are shown
disabled with the reason, and Jordan runs the agent outside the UI.

**Success:** the day starts from Today, not from the terminal history.

---

## Journey 4 — Sam reviews a submission

**Actor:** Sam (reviewer)
**Goal:** Review what is waiting, against the standards that apply, and pass or send it back.

| # | Action | Screen | WF | Outcome |
|---|--------|--------|----|---------|
| 1 | Open the reviewer view: items in a review state | Today (§4.1) · Memory buckets (§4.4) | 0.2.2 | Review queue in one list |
| 2 | Open an item: state machine, references, applied directives, history | Element panel (§4.2) | 0.2.2 | Everything relevant on one panel |
| 3 | Optionally launch an assisted review; follow it via *View agent's logs* | Element panel (§4.2) · **GAP** agent log view | 0.3+ | Review support from an agent |
| 4 | Approve, or reject back with the reason | Element panel · gate footer (§4.2) | 0.2.2 | Decision recorded; author sees the reason in their Today |

**Obstacles:** in WingFoil 0.2.2 both `memory approve` and `memory reject` need the `approver`
role (their CLI help): a reviewer without it cannot pass or send back an item from the UI — the
gate shows "reserved to approver", as for Casey (J2).

**Success:** a review decided with everything relevant on one panel.

---

## Journey 5 — Alex switches hats and projects

**Actor:** Alex (solo maintainer, every role)
**Goal:** Work as each role in turn, across several projects.

| # | Action | Screen | WF | Outcome |
|---|--------|--------|----|---------|
| 1 | See the **all-roles summary**: what requires each of Alex's roles | **GAP** all-roles summary in Today | 0.2.2 | Knows which hat to put on first |
| 2 | Switch role view (e.g. approver → developer) | Shell · role view (§3) | 0.2.2 | Today refilled for that role |
| 3 | Switch project from the project switcher or ⌘K | Shell · project switcher, ⌘K (§3) | — | Same screens, other project's vocabulary |

**Success:** switching role or project takes one action; nothing about one project leaks into another.

---

## Journey 6 — Riley explores a project before joining

**Actor:** Riley (newcomer, git email not in `dna.team`)
**Goal:** Understand the project; learn how to join.

| # | Action | Screen | WF | Outcome |
|---|--------|--------|----|---------|
| 1 | Open the project; the user badge says "not in team" | Shell · current user (§3) | 0.2.2 | Knows the UI is read-only for them |
| 2 | Explore workflows, Memory, DNA, directives, docs, traceability | §4.3–§4.9, §4.12, §4.13 | 0.2.2 | Understands state, rules and decisions |
| 3 | Open *How to join*: the tech lead to contact and the command they run | **GAP** How-to-join panel (Configuration › Identity §4.11 explains the rule only) | — | Knows the next step to become a member |

**Success:** Riley understands the project without being able to change it.

---

## Journey 7 — Report a bug through its ingestion workflow

**Actor:** any member (Jordan, Sam, Morgan)
**Goal:** Capture a defect as a governed `bug` element.

| # | Action | Screen | WF | Outcome |
|---|--------|--------|----|---------|
| 1 | Start the ingestion from Memory (*+ Ingestion*), Workflow or ⌘K | Memory (§4.4) · Workflow (§4.3) · ⌘K (§3) | 0.2.2 | Ingestion modal with the workflow's steps |
| 2 | Type the title (step *capture*) and fill the required fields | Ingestion modal (§4.4) | 0.2.2 | Bug created as `draft` by the CLI |
| 3 | Submit it | Element panel (§4.2) | 0.2.2 | `draft → open`; appears in the triager's Today |
| 4 | The approver triages it (Journey 1) | Element panel · gate footer (§4.2) | 0.2.2 | `open → triaged` or closed with reason |

**Obstacles:** on 0.2.2 there is no `workflow start`: the UI runs the ingestion's steps as their
Memory verbs (`memory add` + `submit`), as the project does by hand. With 0.3 it starts the
workflow itself.

**Success:** a bug reported in under a minute, through the same workflow the CLI would use.

---

## Journey 8 — Stay in sync with the remote

**Actor:** any member
**Goal:** Work on an up-to-date copy and share what WingFoil committed.

| # | Action | Screen | WF | Outcome |
|---|--------|--------|----|---------|
| 1 | The UI fetches the remote automatically (option) and shows ahead/behind | Sidebar · git status (§3) | — | Knows if the copy is behind or has local changes |
| 2 | A gate or submit commits through the CLI | Element panel (§4.2) | 0.2.2 | New `wf(…)` commit |
| 3 | The commit is pushed automatically (option), or with *Push* when the option is off | Sidebar · git status (§3) | — | Remote updated; toast says "pushed" |

**Rules (Q4):** synchronisation is part of how WingFoil works; options enable **automatic fetch**
and **automatic push**. Where these options live (WingFoil core settings when they exist, UI
settings until then) is decided in session 4. Conflicts, merges and rebases are not handled by
the UI (`03_is-isnot.md`).

**Success:** the copy shown is current, and nothing committed from the UI stays unshared by accident.

---

## Journey 9 — Edit a repository file (after v1.0)

**Actor:** Jordan, Morgan
**Goal:** Fix a file from the Files browser and commit it.

| # | Action | Screen | WF | Outcome |
|---|--------|--------|----|---------|
| 1 | Open a file in Files → *Edit* | Files (§4.13) | — | Editor with "Editing · <file> · N changes" bar (§5) |
| 2 | *Save and commit* | Files (§4.13) | — | Plain git commit made by the server |

**Rules (Q12):** **every file is editable**, except WingFoil's own files, which need a specific
permission. **Minor feature, after v1.0.** To settle when it is specified: WingFoil's files
(`.wingfoil/`, Memory and plan files) have governed CLI paths, and `cli-only-writes` forbids
writing them directly — the "specific permission" must therefore be reconciled with that rule
(e.g. only files outside the governed paths, or edits that go through the CLI once verbs exist).

---

## Gaps (steps with no screen in the UX reference)

| Gap | Journeys | To address in |
|-----|----------|---------------|
| WingFoil version / capability notice on add and per feature | 0, 3 | session 4 (features) |
| Agent log view (*View agent's logs* replaces *Launch agent*) | 3, 4 | session 4 |
| All-roles summary in Today | 5 | session 4 |
| *How to join* panel for users not in the team | 6 | session 4 |
| Ahead/behind and local-changes indicator; auto-fetch / auto-push options | 8 | session 4 |
