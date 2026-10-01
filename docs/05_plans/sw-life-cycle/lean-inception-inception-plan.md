---
id: lean-inception-inception-plan
type: plan
title: "Lean inception"
status: active
version: "1.0"         # optional — plan version
workflow: "lean-inception"
phase: "inception"
scope: "sw-life-cycle"
element: ""            # optional — the Memory element this phase iterates (e.g. a release id)
release: ""            # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Date:** 2026-10-01 · **Branch:** `design/inception_v1` (merged to `main` with `--ff=false` at the end)
**Workflow:** `.wingfoil/workflows/custom/lean-inception.yaml` (phase `inception` of `sw-life-cycle`)
**Roles:** facilitator, architect, product-owner, approver — Roberto Pompermaier holds all of them;
the agent drafts and audits (executes as architect/developer, no approval authority)
**Input:** `docs/01_vision/01_product-brief.md` (the only workshop input)
**Evidence:** `docs/00_reference/ux-reference.md` and the prototype, `docs/00_reference/adr-draft-local-server.md`,
`docs/00_reference/open-questions.md`, local notes `.notes/wingfoil-requests.md`

Why now: `init` is done and `dl-001-initialise-wingfoil-before-inception` is `ready`, so inception is
the next phase of `sw-life-cycle`. It turns the brief into the Vision Package that
`specification-downcast` consumes.

Preconditions:
- `npm run -s wingfoil -- --version` prints `0.2.2`, the version `package.json` pins for `wingfoil`.
- `dl-001` is `ready`; `.wingfoil/` loads with no warnings (`directives list` → `"warnings": []`).

Produces (mirroring WingFoil's `docs/01_vision/`): `00_index.md`, `02_product-vision.md`,
`03_is-isnot.md`, `04_personas.md`, `05_journeys.md`, `06_features.md`, `07_sequencer.md`,
`08_mvp-canvas.md`, plus `X_coherence-audit.md` (an addition of ours: WingFoil's `lean-inception`
declares no checks). This plan replaces WingFoil's `X_lean-inception-plan.md`.

## Phases / Steps

Each session: the agent drafts from the brief and the evidence → the session (human + agent) reviews
and decides → the agent writes the decisions into the document and into **Session log** below →
one commit per session (`docs(vision): session N — …`). The open questions are closed in the
session where they belong; each answer is recorded in the session's document and struck in
`open-questions.md` with a pointer to it.

| # | Session (workflow phase) | Role | Output | Open questions closed | Stop-check |
|---|--------------------------|------|--------|-----------------------|------------|
| 1 | Product Vision · Is/Is Not/Does/Does Not (`vision`) | facilitator | `02_product-vision.md`, `03_is-isnot.md` | 2 (WingFoil version floor), 10 (accessibility, i18n), 11 (UI-only permissions acceptable) | one vision statement; every brief §7 item placed in Is/Is Not/Does/Does Not |
| 2 | Personas (`personas`) | facilitator | `04_personas.md` | 5 (unregistered users) | every brief §4 target user is a persona or explicitly merged/dropped |
| 3 | User Journeys (`journeys`) | facilitator | `05_journeys.md` | 3 (multiple working copies), 4 (remote sync), 6 (agent output), 12 (file editing scope) | every persona has ≥ 1 journey; every journey step maps to a UX-reference screen or is flagged as a gap |
| 4 | Feature Brainstorm + Technical/Business Review (`features`) | architect | `06_features.md` | 7 (`ui.yaml` presets), 8 (completion %), 9 (documentation index) | every journey step covered by ≥ 1 feature; each feature has an id, a business/technical/UX score and the WingFoil version it needs |
| 5 | Sequencer + MVP Canvas (`sequencer`) | product-owner | `07_sequencer.md`, `08_mvp-canvas.md` | 1 (packaging); 2 confirmed per wave | waves respect the WingFoil version each feature needs; the MVP canvas names the MVP features, metrics and cost/schedule |
| 6 | Coherence audit | architect (agent) | `X_coherence-audit.md`, `00_index.md` | — | all checks below pass, or each failure is fixed or recorded as a decision |

Coherence audit checks (step 6):
- vision ↔ Is/Is Not ↔ brief §6–7: no MVP feature contradicts an "Is not";
- personas ↔ journeys ↔ features ↔ sequencer: every link both ways, no orphan feature;
- every feature that needs a WingFoil verb missing from 0.2.2 is placed in a wave whose WingFoil
  floor provides it (`wingfoil-cli` directive, ADR draft API table);
- all 12 open questions answered or explicitly deferred with an owner;
- terminology matches WingFoil (element types, states, gates, roles, phases) — `ux-consistency`.

The release waves in `BOOTSTRAP.md` §7 are only a starting hypothesis for session 5.

## Handoff

- **Agent:** drafts every document, keeps the session log, runs the coherence audit, commits.
- **Human (facilitator / product-owner / architect):** decides in each session; nothing is final
  until the session review accepts it.
- **Checkpoints:** end of each session (review of its documents); end of step 6 (audit result).
- **Completion:** all eight documents and the audit exist, the audit passes, the human accepts the
  Vision Package → the plan is finalized by hand (`status: done`, commit
  `wf(plan): finalize lean-inception-inception-plan [active → done]` — directive `wingfoil-cli`
  W-04) and the branch is merged to `main` with `--ff=false`.
- **Next:** `specification-downcast` (its own plan, scope `sw-life-cycle`).

## Session log

<!-- One entry per session: date, decisions taken, open questions closed, deviations from this plan. -->

### Session 1 — Product Vision · Is/Is Not/Does/Does Not (2026-10-01)

- Outputs: `02_product-vision.md`, `03_is-isnot.md` — accepted as drafted.
- Decisions: one role-aware vision; primary target teams already running WingFoil (the WingFoil
  repository first); WingFoil UI is a client of WingFoil, not part of it; core value word "unblock".
- Open questions closed: **2** (WingFoil floor 0.2.2 for the first waves, 1.0 for UI v1.0,
  per-feature floor with capability detection), **10** (WCAG 2.1 AA; English-only MVP with
  externalised strings), **11** (UI-side permissions acceptable as advisory; gates enforced by the CLI).
- Is/Is Not additions confirmed: not a git client (at most push; fetch/pull is Q4); a multi-project
  console whose project list is local UI state.
- Side effects: `01_product-brief.md` v0.2 (§8 WingFoil floor); `open-questions.md` 2/10/11 struck.
- New point for `initial-design` / `adr-001`: which CLI the server runs for an observed project and
  how its version is detected.
- Stop-check: one vision statement ✓; every brief §7 item placed in Is/Is Not/Does/Does Not ✓.

### Session 2 — Personas (2026-10-01)

- Output: `04_personas.md` — accepted as drafted.
- Decisions: WingFoil's personas reused, rewritten around their needs from the UI; primary
  personas Morgan (approver) and Casey (product owner); Jordan (team developer) and Alex (solo
  maintainer, every role) kept separate; agents are not personas of the UI; Taylor kept as future.
- New persona: Riley, the newcomer not in `dna.team`.
- Open question closed: **5** (read-only access, "not in team" badge, *How to join* panel naming
  the tech lead and the `dna add team.members` command; no guided flow in the MVP).
- Role views table (role view → what Today shows first) added for sessions 3–4.
- Stop-check: every brief §4 target user is a persona (Morgan, Jordan/Alex, Sam, Casey) ✓.

### Session 3 — User Journeys (2026-10-01)

- Output: `05_journeys.md` — accepted as drafted: journeys 0–9 (add project, gates, follow and
  decide, agent step, review, switch roles/projects, newcomer, bug ingestion, remote sync, file
  editing after v1.0), each step mapped to a UX-reference screen or a GAP, with the minimum
  WingFoil version.
- Open questions closed: **3** (same repository not addable twice), **4** (sync intrinsic;
  auto-fetch/auto-push options), **6** (*View agent's logs* replaces *Launch agent*), **12** (all
  files editable, WingFoil files with a specific permission; after v1.0).
- Recorded for later: Q12 vs `cli-only-writes` (reconcile when file editing is specified); Casey
  needs the `approver` role to decide gates on WingFoil 0.2.2; where the sync options live → session 4.
- Side effect: `03_is-isnot.md` v0.2 (git sync rule).
- Gaps handed to session 4: version/capability notice, agent log view, all-roles summary,
  How-to-join panel, ahead/behind indicator with sync options.
- Stop-check: every persona has ≥ 1 journey (Riley 6, Taylor covered by Morgan/Sam) ✓; every step
  maps to a screen or is a listed GAP ✓.

### Session 4 — Feature Brainstorm + Technical/Business Review (2026-10-01)

- Output: `06_features.md` — accepted as drafted: 42 MVP features (first reported as 38 — a miscount, corrected in session 5) in areas S, T, G, M, R, A, C, Y, X
  plus 9 later features (L1–L9), each with journeys, personas, minimum WingFoil version and
  value/effort/UX/confidence scores; journey-coverage table.
- Open questions closed: **7** (`ui.yaml` presets Kanban/Scrum/`sw-life-cycle`, inferred defaults),
  **8** (unweighted mean completion), **9** (docs index = `paths.docs` minus Memory/plan paths).
- Decisions: sync options are local per-user UI settings (auto-fetch on, auto-push off; WingFoil
  core settings take precedence when they exist); areas are the release `pillar` values; the
  reason is required on approve too (WingFoil 0.2.2), pre-filled — supersedes ux-reference §4.2.
- Stop-check: every journey step covered by ≥ 1 feature, all five session-3 gaps covered ✓; every
  feature has an id, scores and a WingFoil version ✓.

### Session 5 — Sequencer + MVP Canvas (2026-10-01)

- Outputs: `07_sequencer.md`, `08_mvp-canvas.md` — accepted as drafted.
- Releases of `rl-v1`: v0.1 read-only console (S, 0.2.2, 14 features) · v0.2 unblock (G, 0.2.2, 12,
  first usable) · v0.3 project state (R, 0.2.2, 13) · v0.4 workflow and agents (A, WingFoil 0.3, 3 +
  3 upgrades) · v1.0 MVP complete (X, WingFoil 1.0). Forecast ≈ 30 active days from specification
  to v1.0, plus waits on WingFoil 0.3 and 1.0.
- Open question closed: **1** (separate npm package `wingfoil-ui`, run with `npx`, `0.x` from v0.1;
  no `wingfoil ui` subcommand; desktop wrapper after v1.0). **2** confirmed per release.
- All 12 open questions are now closed.
- Stop-check: waves respect each feature's WingFoil version ✓; the MVP canvas names MVP features,
  metrics and cost/schedule ✓.

### Step 6 — Coherence audit (2026-10-01)

- Outputs: `X_coherence-audit.md` (passed with fixes), `00_index.md`.
- Fixed: `03_is-isnot.md` v0.3 (local settings), `05_journeys.md` v0.2 (J4 approver obstacle),
  `06_features.md` v0.2 (coverage: T5, C1, C3; cross-cutting S1, S8, X1–X3), `07_sequencer.md` v0.2
  (J0 completes in v0.2; v0.1 opens on the Memory list).
- Recorded: brief §6 *WingFoil settings* tab superseded by L7.
- New CLI behaviour found: approve/reject always need `approver` → directive `wingfoil-cli` v1.1 W-13.
- Hand-off to `specification-downcast`: deviations from the UX reference; canvas metrics → SARD.

### Session 7 — External review integration (2026-10-01)

- Not in the original plan: an external review of the Vision Package found three blockers and
  several gaps; all were verified (files + CLI 0.2.2) and integrated, as proposed and accepted.
- Decisions: ingestion only for types whose required fields the CLI sets (decision-log on 0.2.2;
  J7 bug → v0.4, conditional); four write classes (governed / `ui.yaml` / git transport / files
  later); the UI runs the observed project's own CLI (supported range, read-only outside, not
  opened without CLI); exit criteria per role (approver vs informational); working-tree snapshot
  with actions blocked on local changes and while behind; fast-forward update; action descriptor;
  local server security; hidden vs read-only rule; D3 kept, worktrees as L10.
- New verified CLI behaviour: `memory search` reads the working tree; `submit` commits the
  target's uncommitted edits.
- Updated: `02` v0.2, `03` v0.4, `05` v0.3, `06` v0.3 (45 features), `07` v0.3, `08` v0.2,
  `X_coherence-audit.md` v1.1, `00_index.md`; directive `cli-only-writes` v1.1; `e2e-smoke`
  (`local-security` phase, write-class and fixture checks); ADR draft.
