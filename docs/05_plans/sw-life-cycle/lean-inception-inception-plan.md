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
