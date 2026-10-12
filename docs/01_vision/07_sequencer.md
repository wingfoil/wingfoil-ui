# Sequencer — WingFoil UI v1 (v0.1 → v1.0)

**Version:** 0.7
**Date:** 2026-10-12 (0.2: J0 completion and v0.1 landing screen — coherence audit; 0.3: external
review — session 7; 0.4: permissions left to WingFoil — specification session 3; 0.5: input count, v0.1 exit (clone) — coherence audit of the specification — session 6; 0.6: v0.1 budget 6 → 9 active days — release-planning v0.1 session 2; 0.7: v0.2 budget 5 → 8 active days — release-planning v0.2 session 2)
**Status:** Accepted in lean-inception session 5 (2026-10-01)
**Input:** `06_features.md` (44 MVP features, areas, WingFoil versions, scores) · `05_journeys.md` ·
`02_product-vision.md` (Q2: WingFoil floor) · starting hypothesis in `BOOTSTRAP.md` §7

All releases belong to the release-line **v1** (`rl-v1`). Each release has a primary **area**
(the `pillar` of its `release` element) and a **WingFoil floor** (its `wingfoil_min`): no feature
is placed in a release whose floor lacks the WingFoil capability it needs.

---

## Sequencing rules

1. **WingFoil floor first.** Features needing WingFoil 0.3 (workflow engine, agent execution) wait
   for a WingFoil 0.3 release; v1.0 waits for WingFoil 1.0.
2. **Read before write.** A screen is shown read-only before it acts (the element panel before the
   gate footer).
3. **Value early.** The primary personas' core journeys (Morgan J1, Casey J2) land as early as the
   WingFoil floor allows.
4. **Cross-cutting from day one.** Accessibility, externalised strings and themes (X1–X3) apply to
   every screen from v0.1; they are not a late release.
5. **Dogfooding.** From v0.2 the WingFoil UI repository — and then the WingFoil repository — is run
   from the UI.
6. **Promises per role.** On WingFoil 0.2.2 only members holding `approver` decide gates: every exit
   criterion that involves a gate names the role, and the fixtures include a reviewer and a product
   owner **with and without** `approver` (without it their experience is informational).
7. **Safe by construction.** Write classes, snapshot rules and local server security (X4) apply
   from v0.1, before the first write exists.

---

## Releases

### v0.1 — Read-only console · area **S** · WingFoil ≥ 0.2.2

Open any WingFoil project and read it safely.

| Features | Journeys served |
|----------|-----------------|
| S1 local server + CLI adapter · S2 project list · S3 WingFoil version and capabilities · S4 identity and role views · S8 snapshot and refresh · S9 action descriptor · G1 element panel (read-only) · M1 Memory list · R1 DNA · R2 directives · R3 team · R4 documentation · X1 accessibility · X2 externalised strings · X3 themes · X4 local server security | J0 steps 1–3 (in v0.1 the project opens on the Memory list; Today arrives in v0.2), J6 (steps 1–2, partial), J4 step 2 (read) |

16 features. **Exit:** the WingFoil and WingFoil UI repositories, and a fixture with unknown types
and states and no `ui.yaml`, render without UI changes; the local server refuses non-loopback and
cross-origin requests; the only write is cloning a remote into a new folder (no governed write yet).

### v0.2 — Unblock · area **G** · WingFoil ≥ 0.2.2

The human-on-the-loop core: see what requires you and act on it in two clicks.

| Features | Journeys served |
|----------|-----------------|
| T1 Requires you · T4 waiting on others · S5 all-roles summary · S7 notifications · G2 gate footer · G3 submit · G4 action feedback · C2 identity and How to join · C4 UI settings · Y1 repository status · Y2 fetch · Y3 push · Y4 update (fast-forward) | J0 (complete), J1 (complete), J4 (gate — reviewers holding `approver`; informational otherwise), J5, J6 step 3, J8 |

13 features. **Exit — first usable release:** a member holding `approver` passes a gate from Today
in ≤ 2 clicks with the `wf(…)` commit shown and pushed; a reviewer without `approver` sees the gate
as informational with who can act; actions are blocked on elements with local changes and while
behind; the WingFoil UI project's own gates are passed from the UI.

### v0.3 — Project state · area **R** · WingFoil ≥ 0.2.2

Everything Casey needs, plus governed creation through ingestion where WingFoil 0.2.2 allows it.

| Features | Journeys served |
|----------|-----------------|
| T2 progress card (Memory figures) · T5 recent activity · M2 missing references · R5 traceability · R6 timeline axis · R7 git tree · R8 files · W1 workflow tree (definitions) · W2 ingestion cards · G5 ingestion start · S6 command palette · C1 `ui.yaml` and presets | J2 (complete for a product owner holding `approver`; informational otherwise), decision-log ingestion |

12 features. **Exit:** Casey follows a project without a developer, and — holding `approver` —
decides a product item; a decision-log is captured through its ingestion workflow from the UI;
`ui.yaml` is written only as a schema-valid `chore(ui)` commit.

### v0.4 — Workflow and agents · area **A** · WingFoil ≥ 0.3

What the WingFoil workflow engine and agent execution make possible.

| Features | Journeys served |
|----------|-----------------|
| T3 next workflow step · A1 launch agent · A2 agent log view · upgrades on 0.3: T2 phases, W1 current position, G5 via `workflow start` (all ingestion types, when the engine or a field setter sets their required fields) | J3 (complete), J4 step 3, J2 step 1 (phases), J7 (if WingFoil 0.3 sets the required fields; otherwise with the first WingFoil that does) |

3 features + 3 capability upgrades. **Exit:** Jordan starts the day from Today and runs the agent
on the next step with its logs in the UI.

### v1.0 — MVP complete · area **X** · WingFoil 1.0

Stable, packaged, supported.

| Scope | |
|-------|--|
| Packaging stable: `npx wingfoil-ui` (Q1) · support matrix and contract tests from the floor to WingFoil 1.0 · capability detection reviewed against WingFoil 1.0 · polish from the retrospectives · user guide | all journeys J0–J8 |

No new features. **Exit:** every MVP journey (J0–J8) passes the e2e smoke on WingFoil 1.0.

### After v1.0

L1–L10 of `06_features.md`, each when its WingFoil dependency exists; L4 (file editing, Q12) is
the first candidate that needs nothing from WingFoil.

---

## Overview

| Release | Area (`pillar`) | `wingfoil_min` | Features | Primary personas | Journeys completed |
|---------|-----------------|----------------|----------|------------------|--------------------|
| v0.1 | S | 0.2.2 | 16 | Riley, Alex | — (J0 steps 1–3) |
| v0.2 | G | 0.2.2 | 13 | Morgan, Alex | J0, J1, J5, J8 |
| v0.3 | R | 0.2.2 | 12 | Casey | J2 (with `approver`), J6 |
| v0.4 | A | 0.3 | 3 (+3 upgrades) | Jordan, Sam | J3, J4, J7 (conditional) |
| v1.0 | X | 1.0 | — | all | all (on WingFoil 1.0) |

Total: 44 features (16 + 13 + 12 + 3).

---

## Schedule (forecast)

Budgets are in **active days** (a date with at least one commit), as WingFoil does
(its `dl-096`); the calendar is a forecast refreshed at every release's retrospective.
Reference: WingFoil spent 9 active days on inception + specification and 5 on its v0.1.

| Release | Budget (active days) | Can start |
|---------|----------------------|-----------|
| Specification + initial design | 5 | after this inception |
| v0.1 | 9 | after initial design |
| v0.2 | 8 | after v0.1 |
| v0.3 | 7 | after v0.2 |
| v0.4 | 4 | after v0.3 **and** a WingFoil 0.3 release |
| v1.0 | 3 | after v0.4 **and** WingFoil 1.0 |

**Dependency risk:** v0.4 and v1.0 wait on WingFoil releases. If WingFoil 0.3 is late, v0.4 waits;
v0.1–v0.3 are not affected (all on 0.2.2).

---

## Key Decisions

Decided in session 5 (2026-10-01), all as proposed.

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Q1 — Packaging** | **`npx wingfoil-ui`**: a separate npm package `wingfoil-ui` with a `bin`, published from v0.1 as `0.x` (so it is usable from the first release), stable at v1.0. A `wingfoil ui` subcommand is **not** pursued (it would make the UI part of WingFoil, against the "client" decision); a desktop wrapper stays a post-v1.0 option | Same runtime and registry as WingFoil; zero install for users who already have Node 22 |
| **Q2 — confirmation per release** | v0.1–v0.3 on **0.2.2**; v0.4 on **0.3**; v1.0 on **1.0** | Rule 1; matches every feature's WF column |
| First usable release | **v0.2** | It delivers the core value (unblock) to the primary persona Morgan |
| Five waves | **v0.1–v0.4 + v1.0**, as hypothesised in `BOOTSTRAP.md` §7, with v0.3 refocused on project state and v0.4 on workflow/agents | Keeps each release small (≤ 16 features) and isolates the WingFoil 0.3 dependency in one release |
| Review integration *(session 7)* | S9, X4 in v0.1; Y4 in v0.2; J7 (bug ingestion) moves from v0.3 to v0.4, conditional on WingFoil setting required fields; exit criteria per role (rule 6) | External review of the Vision Package |
