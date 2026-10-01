# Features — WingFoil UI

**Version:** 0.1
**Date:** 2026-10-01
**Status:** Accepted in lean-inception session 4 (2026-10-01)
**Input:** `05_journeys.md` (steps and gaps) · `04_personas.md` · `02_product-vision.md` ·
`03_is-isnot.md` · **Evidence:** `docs/00_reference/ux-reference.md`, the prototype,
`docs/00_reference/adr-draft-local-server.md`

Features are grouped by **area** (the `pillar` of a release, see `.wingfoil/memory.yaml`). Each has:
ID · journeys (`J<n>` = `05_journeys.md` Journey n) · personas · description · **WF** (minimum
WingFoil version) · review scores.

**Review scores** (Lean Inception technical/business/UX review), 1 = low, 3 = high:
**Val** business value · **Eff** effort · **UX** user-experience impact. **Conf** = confidence we
know how to build it (H/M/L).

---

## Area S — Shell, projects and identity

| ID | Feature | Journeys | Personas | Description | WF | Val | Eff | UX | Conf |
|----|---------|----------|----------|-------------|----|-----|-----|----|------|
| S1 | Local server + CLI adapter | all | all | Node server on `localhost` that runs the project's `wingfoil` with `--format json` and reads git; serves the UI (draft ADR) | 0.2.2 | 3 | 3 | 1 | M |
| S2 | Project list | J0, J5 | Alex, all | Add a local folder or clone a remote; remove; persisted as local UI state. The same repository cannot be added twice (Q3) | — | 3 | 2 | 2 | H |
| S3 | WingFoil version and capabilities | J0, J3 | all | Detect the project's WingFoil version; per feature, show unavailable capabilities read-only or hidden with the reason (GAP J0/J3) | 0.2.2 | 3 | 2 | 2 | M |
| S4 | Identity and role views | J1–J6 | all | User from `git config user.email` → `dna.team.members`; role-view switch for multi-role members; "not in team" badge | 0.2.2 | 3 | 1 | 3 | H |
| S5 | All-roles summary | J5 | Alex | In Today, per role held: count and top items requiring it (GAP J5) | 0.2.2 | 2 | 1 | 2 | H |
| S6 | Command palette (⌘K) | J5, J7 | all | Navigate, open any element, start an ingestion, switch project, pending actions | 0.2.2 | 2 | 2 | 3 | H |
| S7 | In-app notifications | J1 | Morgan, Casey | Bell with count: *To unblock* (same as Requires you) and *Updates* | 0.2.2 | 2 | 1 | 2 | H |
| S8 | Live refresh | all | all | Re-read on git HEAD change and file watch; cache keyed on HEAD | 0.2.2 | 3 | 2 | 2 | M |

## Area T — Today

| ID | Feature | Journeys | Personas | Description | WF | Val | Eff | UX | Conf |
|----|---------|----------|----------|-------------|----|-----|-----|----|------|
| T1 | Requires you | J1, J3, J4 | Morgan, Jordan, Sam, Alex | Items whose next move needs one of the view's roles: gates, rejected-back work, reviews; rejected first; one primary action each | 0.2.2 | 3 | 2 | 3 | H |
| T2 | Progress card | J2 | Casey, all | Scope, phase X of Y (0.3), project/phase completion, iterated x/y, open bugs, pending gates; each figure clickable (→ M1) | 0.2.2 (phases 0.3) | 3 | 2 | 3 | M |
| T3 | Next workflow step | J3 | Jordan | Next step for the role with the context the agent will receive | 0.3 | 3 | 2 | 3 | L |
| T4 | Waiting on others | J1 | Morgan | Items blocked on another role, with the role that must act | 0.2.2 | 2 | 1 | 2 | H |
| T5 | Recent activity | J2 | Casey | Last Memory events, link to Timeline | 0.2.2 | 1 | 1 | 1 | H |

## Area G — Gates and governed actions

| ID | Feature | Journeys | Personas | Description | WF | Val | Eff | UX | Conf |
|----|---------|----------|----------|-------------|----|-----|-----|----|------|
| G1 | Element panel | J1–J4, J7 | all | State machine chips, rejection banner, summary, references (missing required flagged), directives, history with commits | 0.2.2 | 3 | 2 | 3 | H |
| G2 | Gate footer — all outcomes | J1, J2, J4, J7 | Morgan, Casey, Sam | Every outcome of the gate side by side (approve + each reject target), reason field focused; runs `memory approve/reject --reason`. The reason is **required for approve too** (WingFoil 0.2.2 requires it, `wingfoil-cli` W-05), pre-filled with an editable default | 0.2.2 | 3 | 2 | 3 | H |
| G3 | Single-action footer | J3, J7 | Jordan, all | Submit (and, with 0.3+, start review / launch agent) | 0.2.2 | 3 | 1 | 2 | H |
| G4 | Action feedback | J1–J4, J7, J8 | all | Toast with result and the `wf(…)` commit ("pushed" when pushed); red toast with the CLI's reason on refusal | 0.2.2 | 3 | 1 | 3 | H |
| G5 | Ingestion start | J7 | all | Start an ingestion from Memory, Workflow or ⌘K: on 0.2.2 the UI runs its steps as Memory verbs (`memory add` + `submit`); on 0.3 `workflow start` | 0.2.2 | 3 | 2 | 3 | M |

## Area M — Memory and workflows

| ID | Feature | Journeys | Personas | Description | WF | Val | Eff | UX | Conf |
|----|---------|----------|----------|-------------|----|-----|-----|----|------|
| M1 | Memory list | J2, J4, J7 | all | Type filters from `memory.yaml` with counts; state filters (buckets for all types, real states per type); list → element panel | 0.2.2 | 3 | 2 | 2 | H |
| M2 | Missing references | J2 | Morgan, Casey | Filter and badge for elements missing a reference their type `requires` (`ui.yaml`) | 0.2.2 | 2 | 1 | 2 | H |
| W1 | Workflow tree | J2, J3 | all | Main workflow tree from the definitions; current position, iterated elements and who must act | 0.2.2 (position 0.3) | 2 | 2 | 2 | M |
| W2 | Ingestion cards | J7 | all | One card per ingestion workflow: steps, open runs, Start (→ G5) | 0.2.2 | 2 | 1 | 2 | H |

## Area R — Reading the project

| ID | Feature | Journeys | Personas | Description | WF | Val | Eff | UX | Conf |
|----|---------|----------|----------|-------------|----|-----|-----|----|------|
| R1 | DNA view | J6 | Riley, all | Modules, stacks, methodologies, team and roles, paths | 0.2.2 | 2 | 1 | 1 | H |
| R2 | Directives view | J3, J4, J6 | Jordan, Sam | Directives with bound roles; "only mine / all"; rendered body | 0.2.2 | 2 | 1 | 2 | H |
| R3 | Team view | J1, J6 | Morgan | Member cards, roles, pending gates per member; agents "never approve" | 0.2.2 | 2 | 1 | 2 | H |
| R4 | Documentation | J2, J6 | Casey, Riley | Index of `paths.docs` **excluding Memory/plan files** (Q9); Markdown rendered in the UI; links stay in the UI | 0.2.2 | 2 | 2 | 2 | H |
| R5 | Traceability | J2 | Casey, Morgan | Reference → linked elements, completion (Q8), coverage, missing references | 0.2.2 | 3 | 3 | 2 | M |
| R6 | Timeline — time axis | J2 | Casey | Memory creations and state changes per day, parsed from `wf(…)` commits | 0.2.2 | 2 | 2 | 2 | M |
| R7 | Timeline — git tree | J8 | Morgan, Alex | Commits with lanes and filters; Memory commits marked; commit → files, element | — | 1 | 2 | 1 | M |
| R8 | Files (read-only) | J6, J9 | all | Tree + viewer with highlighting and Markdown preview; New/Edit/Delete shown as "coming" | — | 2 | 2 | 1 | H |

## Area A — Agents

| ID | Feature | Journeys | Personas | Description | WF | Val | Eff | UX | Conf |
|----|---------|----------|----------|-------------|----|-----|-----|----|------|
| A1 | Launch agent | J3, J4 | Jordan, Sam | Launch `agent execute` on the next step or an element, with confirmation and the context shown | 0.3+ | 3 | 2 | 3 | L |
| A2 | Agent log view | J3, J4 | Jordan, Sam | After launch the button becomes **View agent's logs**: live output of the run in the UI (GAP J3/J4, Q6) | 0.3+ | 3 | 2 | 3 | L |

## Area C — Configuration

| ID | Feature | Journeys | Personas | Description | WF | Val | Eff | UX | Conf |
|----|---------|----------|----------|-------------|----|-----|-----|----|------|
| C1 | `ui.yaml` and presets | J0, J2 | Alex, Morgan | Taxonomy and Progress tabs explaining each key; when a project has no `ui.yaml`, the UI infers defaults and offers a **preset** (Kanban, Scrum, WingFoil `sw-life-cycle`) to commit (Q7) | 0.2.2 | 2 | 2 | 2 | M |
| C2 | Identity and *How to join* | J6 | Riley | How the user is recognised; for users not in the team, the tech lead to contact and the exact `dna add team.members` command (GAP J6, Q5) | 0.2.2 | 2 | 1 | 2 | H |
| C3 | Advisory permissions | J1 | Morgan | Permissions table per action (roles/people), evaluated on all the member's roles; labelled "not a security boundary" (Q11) | 0.2.2 | 1 | 2 | 1 | H |
| C4 | UI settings | J8 | all | Local, per-user settings (not versioned): auto-fetch, auto-push, theme, agent launch confirmation (sync options) | — | 2 | 1 | 2 | H |

## Area Y — Synchronisation

| ID | Feature | Journeys | Personas | Description | WF | Val | Eff | UX | Conf |
|----|---------|----------|----------|-------------|----|-----|-----|----|------|
| Y1 | Repository status | J8 | all | Ahead/behind, local changes, branch, in the sidebar (GAP J8) | — | 3 | 1 | 2 | H |
| Y2 | Fetch | J8 | all | Automatic fetch (C4) and on demand; "behind" shown, never pulled over local changes | — | 2 | 1 | 2 | M |
| Y3 | Push | J8 | all | Automatic push after a UI action (C4), or *Push* button | — | 3 | 1 | 2 | H |

## Area X — Cross-cutting qualities

| ID | Feature | Journeys | Personas | Description | WF | Val | Eff | UX | Conf |
|----|---------|----------|----------|-------------|----|-----|-----|----|------|
| X1 | Accessibility | all | all | WCAG 2.1 AA (directive `accessibility`) | — | 2 | 2 | 3 | M |
| X2 | Externalised strings | all | all | English-only MVP, every string externalised | — | 1 | 1 | 1 | H |
| X3 | Light and dark themes | all | all | Both themes, AA contrast in each | — | 1 | 1 | 2 | H |

## Later — after v1.0 or after a WingFoil capability

| ID | Feature | Needs | Description |
|----|---------|-------|-------------|
| L1 | Edit element fields | WingFoil `memory amend` / field setter | Title, summary, references from the element panel |
| L2 | Edit DNA, directives, workflows | WingFoil verbs (workflow editing is a request to WingFoil) | Edit modes of DNA, Directives, Workflow |
| L3 | Artifacts view | WingFoil `paths.artifacts` (request) or `ui.yaml` | Artifacts by phase, URLs linked to `service` elements |
| L4 | Edit repository files | after v1.0 (Q12) | All files; WingFoil's files only with a specific permission, reconciled with `cli-only-writes` |
| L5 | External notifications | WingFoil notification channels (request) | Email/chat for pending gates |
| L6 | Core-enforced permissions | WingFoil action permissions (request) | C3 enforced by the CLI |
| L7 | WingFoil core settings page | WingFoil core settings (request) | Git, approvals, workflow, agents, notifications |
| L8 | Second UI language | — | Built on X2 |
| L9 | Multi-user / remote deployment | — | Out of the MVP (`03_is-isnot.md`) |

---

## Journey coverage

| Journey | Steps → features |
|---------|------------------|
| J0 Add a project | 1–2 S2 · 3 S3 · 4 S4, T1 |
| J1 Morgan clears the gates | 1 S7 · 2 T1 · 3 G1 · 4 G2, G4 · 5 T4, R3 |
| J2 Casey follows and decides | 1 T2 · 2 M1, M2 · 3 G1, R4 · 4 G2, G4 · 5 R5 |
| J3 Jordan with an agent | 1 T1, T3 · 2 T3 · 3 A1 · 4 A2 · 5 G3, G4 |
| J4 Sam reviews | 1 T1, M1 · 2 G1, R2 · 3 A1, A2 · 4 G2, G4 |
| J5 Alex switches | 1 S5 · 2 S4 · 3 S2, S6 |
| J6 Riley explores | 1 S4 · 2 R1–R8, W1, M1 · 3 C2 |
| J7 Bug ingestion | 1 G5, W2, S6 · 2 G5 · 3 G3, G4 · 4 G2 |
| J8 Remote sync | 1 Y1, Y2, C4 · 2 G4 · 3 Y3, C4 |
| J9 Edit a file (after v1.0) | 1–2 L4 (R8 shows "coming") |

All five gaps of `05_journeys.md` are covered: S3, A2, S5, C2, Y1 (+ C4 for the sync options).

---

## Key Decisions

Decided in session 4 (2026-10-01), all as proposed.

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Q7 — `ui.yaml` presets** | **Yes**: presets for Kanban, Scrum (WingFoil's `init` templates) and WingFoil's `sw-life-cycle`. Without `ui.yaml` the UI infers defaults from `memory.yaml` and `workflows.yaml` and works read-only on them; *Use preset* writes `.wingfoil/ui.yaml` as one commit (the only file the UI owns) | A project renders on day one; the preset makes the conventions explicit and versioned |
| **Q8 — Completion %** | **Unweighted mean** of per-reference completion (ux-reference §7) in the MVP; the definition is shown on hover. Weighting (e.g. story points) is a later `ui.yaml` option | Simple, explainable to Casey, needs no extra field |
| **Q9 — Documentation index** | **`paths.docs` only, excluding the Memory and plan paths** declared in `memory.yaml`; those files open in the element panel instead (from Memory, links and search) | One home per file: documents in Documentation, elements in the element panel with their state and history |
| Where the sync options live (from session 3) | **UI settings, local per user** (C4): auto-fetch on by default, auto-push off by default. If WingFoil adds core settings (`git.autoPush`), they take precedence and the UI shows them read-only | Sync is a per-user, per-machine preference; it must not need a commit |
| Areas as release `pillar` | **S, T, G, M, R, A, C, Y, X** as the `pillar` values of releases | Matches the template rule: the release's primary feature area |
| Reason on approve | **Required**, pre-filled with an editable default (G2) | WingFoil 0.2.2 requires `--reason` on approve; supersedes ux-reference §4.2 "reason optional to approve" |
