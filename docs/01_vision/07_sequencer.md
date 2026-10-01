# Sequencer — WingFoil UI v1 (v0.1 → v1.0)

**Version:** 0.2
**Date:** 2026-10-01 (0.2: J0 completion and v0.1 landing screen — coherence audit)
**Status:** Accepted in lean-inception session 5 (2026-10-01)
**Input:** `06_features.md` (42 MVP features, areas, WingFoil versions, scores) · `05_journeys.md` ·
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

---

## Releases

### v0.1 — Read-only console · area **S** · WingFoil ≥ 0.2.2

Open any WingFoil project and read it safely.

| Features | Journeys served |
|----------|-----------------|
| S1 local server + CLI adapter · S2 project list · S3 WingFoil version and capabilities · S4 identity and role views · S8 live refresh · G1 element panel (read-only) · M1 Memory list · R1 DNA · R2 directives · R3 team · R4 documentation · X1 accessibility · X2 externalised strings · X3 themes | J0 steps 1–3 (in v0.1 the project opens on the Memory list; Today arrives in v0.2), J6 (steps 1–2, partial), J4 step 2 (read) |

14 features. **Exit:** the WingFoil and WingFoil UI repositories render without UI changes; no write
path exists yet.

### v0.2 — Unblock · area **G** · WingFoil ≥ 0.2.2

The human-on-the-loop core: see what requires you and act on it in two clicks.

| Features | Journeys served |
|----------|-----------------|
| T1 Requires you · T4 waiting on others · S5 all-roles summary · S7 notifications · G2 gate footer · G3 submit · G4 action feedback · C2 identity and How to join · C4 UI settings · Y1 repository status · Y2 fetch · Y3 push | J0 (complete), J1 (complete), J4 (gate), J5, J6 step 3, J8 |

12 features. **Exit — first usable release:** a gate is passed from Today in ≤ 2 clicks with the
`wf(…)` commit shown and pushed; the WingFoil UI project's own gates are passed from the UI.

### v0.3 — Project state · area **R** · WingFoil ≥ 0.2.2

Everything Casey needs, plus governed creation through ingestion.

| Features | Journeys served |
|----------|-----------------|
| T2 progress card (Memory figures) · T5 recent activity · M2 missing references · R5 traceability · R6 timeline axis · R7 git tree · R8 files · W1 workflow tree (definitions) · W2 ingestion cards · G5 ingestion start · S6 command palette · C1 `ui.yaml` and presets · C3 advisory permissions | J2 (complete on 0.2.2), J7 |

13 features. **Exit:** Casey follows a project and decides a product item without a developer; a
bug is reported through its ingestion workflow from the UI.

### v0.4 — Workflow and agents · area **A** · WingFoil ≥ 0.3

What the WingFoil workflow engine and agent execution make possible.

| Features | Journeys served |
|----------|-----------------|
| T3 next workflow step · A1 launch agent · A2 agent log view · upgrades on 0.3: T2 phases, W1 current position, G5 via `workflow start` | J3 (complete), J4 step 3, J2 step 1 (phases) |

3 features + 3 capability upgrades. **Exit:** Jordan starts the day from Today and runs the agent
on the next step with its logs in the UI.

### v1.0 — MVP complete · area **X** · WingFoil 1.0

Stable, packaged, supported.

| Scope | |
|-------|--|
| Packaging stable: `npx wingfoil-ui` (Q1) · support matrix and contract tests from the floor to WingFoil 1.0 · capability detection reviewed against WingFoil 1.0 · polish from the retrospectives · user guide | all journeys J0–J8 |

No new features. **Exit:** every MVP journey (J0–J8) passes the e2e smoke on WingFoil 1.0.

### After v1.0

L1–L9 of `06_features.md`, each when its WingFoil dependency exists; L4 (file editing, Q12) is
the first candidate that needs nothing from WingFoil.

---

## Overview

| Release | Area (`pillar`) | `wingfoil_min` | Features | Primary personas | Journeys completed |
|---------|-----------------|----------------|----------|------------------|--------------------|
| v0.1 | S | 0.2.2 | 14 | Riley, Alex | — (J0 steps 1–3) |
| v0.2 | G | 0.2.2 | 12 | Morgan, Alex | J0, J1, J5, J8 |
| v0.3 | R | 0.2.2 | 13 | Casey | J2, J6, J7 |
| v0.4 | A | 0.3 | 3 (+3 upgrades) | Jordan, Sam | J3, J4 |
| v1.0 | X | 1.0 | — | all | all (on WingFoil 1.0) |

Total: 42 features (14 + 12 + 13 + 3).

---

## Schedule (forecast)

Budgets are in **active days** (a date with at least one commit), as WingFoil does
(its `dl-096`); the calendar is a forecast refreshed at every release's retrospective.
Reference: WingFoil spent 9 active days on inception + specification and 5 on its v0.1.

| Release | Budget (active days) | Can start |
|---------|----------------------|-----------|
| Specification + initial design | 5 | after this inception |
| v0.1 | 6 | after initial design |
| v0.2 | 5 | after v0.1 |
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
| Five waves | **v0.1–v0.4 + v1.0**, as hypothesised in `BOOTSTRAP.md` §7, with v0.3 refocused on project state and v0.4 on workflow/agents | Keeps each release small (≤ 14 features) and isolates the WingFoil 0.3 dependency in one release |
