# UX reference — WingFoil UI

**Version:** 0.2 · **Date:** 2026-10-03 (0.2: §9 colours aligned with spec-009 — release-planning v0.1 session 2) · **Status:** Reference for `lean-inception` and `specification-downcast`
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
| **Project switcher** | Lists projects added to the UI (name + path, or URL → working dir). "Add project…" opens a modal: *Local folder* (absolute path) or *Remote git repository* (URL + local working dir, auto-filled `~/projects/<repo>`). Validates path/URL and duplicates. The list persists in the UI; added projects can be removed (×). |
| **Context crumb** | Current position in the main workflow (e.g. `rl-v1 › minor-v0.3 › dev-loop`); truncates from the left. |
| **Search / ⌘K** | One palette for: start ingestion, pending actions, navigation, switch project, open any element. Arrow keys + Enter. |
| **Current user** | From `git config user.email`, matched to `dna.team.members[].email`. Shows initials; name + role when single-role; "not in team" badge when unmatched. |
| **Role view** | Dropdown shown only when the member holds several roles; views are the persona roles intersected with the member's roles. |
| **Notifications** | Bell with count. Panel: *To unblock* (same items as "Requires you") and *Updates* (recent activity). Footer states the configured channel. |
| **Git status** (sidebar) | "In sync with git" or "N commits to push" + Push (when auto-push is off). |
| **Sidebar** | Grouped by purpose (what moves / what describes the project / the repository); pinned to the viewport, Configuration and git status always visible at the bottom. |

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

### 4.2 Element panel (right drawer)
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
- **Single-action footer** otherwise (Submit for review, Launch agent, Start review).
- **Edit mode**: title, summary, references (add with Enter, remove ×) → "Save and commit".

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

### 4.5 DNA
Modules, stack + methodologies, team and roles, paths. **Edit mode**: modules (name,
description, add/remove), technologies (chips + add), path values.

### 4.6 Directives
Directive list with bound roles; roles of the current view highlighted; "only mine / all".
**Edit mode**: toggle role bindings per directive, edit description, add/remove directive.

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

### 4.10 Team
Member cards (initials, name, email, roles, "you" badge, pending gates on their roles);
agents listed as "executes as a role, never approves". Filters: search, role, "with pending
gates".

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
