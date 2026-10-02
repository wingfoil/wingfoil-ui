# User Story Map — MVP Cut

**Version:** 0.5
**Date:** 2026-10-01 (0.2: US-S-11, US-X-07 moved to v0.2 — session 2; 0.3: C3 and US-C-05, US-C-06 dropped — session 3; 0.4: input versions — session 6; 0.5: US-X-10 page title — initial-design session 2)
**Status:** Draft — specification-downcast session 1 (`user-story-mapping`, phase `mvp-cut`)
**Input:** `02_story-map.md` · `docs/01_vision/07_sequencer.md` (v0.5) · `08_mvp-canvas.md` (v0.3)

The MVP is the release-line `rl-v1` (v0.1 → v1.0, `08_mvp-canvas.md`). The cut slices the map
horizontally by release: each story carries the release of `07_sequencer.md` in which it is
complete. A story is never earlier than its main feature's release; a story can be later (e.g.
US-G-03 reads a decision-log as a document, which needs R4 in the element panel and lands with
Casey's journey in v0.3).

**Totals:** 111 MVP stories (69 nominal, 42 edge) + 10 future stories.

---

## Slices

| Release | Area | WingFoil | Stories | Nominal | Edge |
|---------|------|----------|---------|---------|------|
| v0.1 — Read-only console | S | ≥ 0.2.2 | 39 | 24 | 15 |
| v0.2 — Unblock | G | ≥ 0.2.2 | 34 | 18 | 16 |
| v0.3 — Project state | R | ≥ 0.2.2 | 25 | 17 | 8 |
| v0.4 — Workflow and agents | A | ≥ 0.3 | 11 | 8 | 3 |
| v1.0 — MVP complete | X | 1.0 | 2 | 2 | 0 |

### v0.1 — Read-only console

- **Nominal:** US-S-01 · US-S-03 · US-S-04 · US-S-08 · US-S-12 · US-S-16 · US-S-17 · US-S-18 ·
  US-S-22 · US-S-25 · US-S-26 · US-S-28 · US-G-01 · US-G-02 · US-M-01 · US-R-05 · US-R-06 ·
  US-R-07 · US-R-08 · US-X-02 · US-X-06 · US-X-08 · US-X-09 · US-X-10
- **Edge:** US-S-05 · US-S-06 · US-S-07 · US-S-09 · US-S-10 · US-S-13 · US-S-14 · US-S-15 ·
  US-S-19 · US-S-27 · US-M-02 · US-R-09 · US-X-03 · US-X-04 · US-X-05
- **Exit criteria → stories:** three fixtures render without UI changes → US-S-28, US-M-02;
  non-loopback and cross-origin requests refused → US-X-03, US-X-04; no governed write → the only v0.1
  write is the clone of US-S-04 (checked by REQ-ARC-03 and e2e-smoke).

### v0.2 — Unblock (first usable)

- **Nominal:** US-S-21 · US-S-23 · US-T-01 · US-T-02 · US-T-03 · US-T-04 · US-T-11 · US-G-04 ·
  US-G-05 · US-G-06 · US-G-10 · US-G-13 · US-C-07 · US-C-08 · US-Y-01 · US-Y-02 · US-Y-05 ·
  US-Y-07
- **Edge:** US-S-11 · US-S-24 · US-T-05 · US-T-06 · US-T-07 · US-G-07 · US-G-09 · US-G-11 ·
  US-G-12 · US-G-14 · US-C-09 · US-Y-03 · US-Y-04 · US-Y-06 · US-Y-08 · US-X-07
- **Exit criteria → stories:** a member holding `approver` passes a gate from Today in ≤ 2 clicks
  with the commit shown and pushed → US-G-04, US-G-05, US-G-13, US-Y-07; a reviewer without `approver`
  sees the gate as informational → US-T-06, US-G-09; actions blocked on local changes and while
  behind → US-G-11, US-G-12; the project's own gates passed from the UI → dogfooding metric (SARD).

### v0.3 — Project state

- **Nominal:** US-S-20 · US-T-08 · US-T-12 · US-T-13 · US-T-14 · US-G-03 · US-G-08 · US-G-15 ·
  US-M-03 · US-M-05 · US-M-07 · US-R-01 · US-R-02 · US-R-04 · US-R-10 · US-C-01 · US-C-02
- **Edge:** US-T-15 · US-G-16 · US-G-17 · US-M-04 · US-R-03 · US-R-11 · US-C-03 · US-C-04
- **Exit criteria → stories:** Casey follows the project without a developer → US-T-12–US-T-14,
  US-R-01, US-R-02; holding `approver`, decides a product item → US-G-03, US-G-08; a decision-log
  captured through its ingestion → US-G-15; `ui.yaml` written only as a schema-valid `chore(ui)`
  commit → US-C-02, US-C-03.

### v0.4 — Workflow and agents

- **Nominal:** US-T-09 · US-T-16 · US-T-17 · US-G-18 · US-M-06 · US-A-01 · US-A-02 · US-A-04
- **Edge:** US-T-10 · US-A-03 · US-A-05
- **Exit criteria → stories:** Jordan starts the day from Today and runs the agent on the next
  step with its logs in the UI → US-T-09, US-T-17, US-A-01, US-A-04. US-G-18 (bug ingestion) is
  **conditional**: it lands with the first WingFoil that sets a bug's required fields
  (`07_sequencer.md` v0.4).

### v1.0 — MVP complete

- **Nominal:** US-S-02 · US-X-01
- **Exit criteria → stories:** every MVP journey passes the e2e smoke on WingFoil 1.0 → all MVP
  stories re-run on WingFoil 1.0 (SARD, support matrix of US-S-02). v1.0 adds no feature: its other
  scope (contract tests, capability detection reviewed, polish) is technical and goes to the SARD
  and the backlog as technical tasks.

---

## Feature coverage (stop-check: 100 % of the MVP Canvas features)

Every one of the 44 MVP features of `06_features.md` is delivered by ≥ 1 story (checked by script
over `06_features.md` and `02_story-map.md`).

| Feature | Release | Stories |
|---------|---------|---------|
| S1 Local server + CLI adapter | v0.1 | US-S-01, US-S-02, US-S-10, US-S-27 |
| S2 Project list | v0.1 | US-S-03, US-S-04, US-S-05, US-S-06, US-S-07, US-S-16, US-S-17, US-S-18, US-S-19 |
| S3 WingFoil version and capabilities | v0.1 | US-S-02, US-S-05, US-S-08, US-S-09, US-S-10, US-S-11, US-T-10, US-T-15, US-G-16, US-M-04, US-A-03, US-Y-04 |
| S4 Identity and role views | v0.1 | US-S-12, US-S-13, US-S-14, US-S-15, US-S-22, US-T-01 |
| S5 All-roles summary | v0.2 | US-S-23 |
| S6 Command palette | v0.3 | US-S-20, US-G-15 |
| S7 In-app notifications | v0.2 | US-S-21 |
| S8 Live refresh and snapshot | v0.1 | US-S-25, US-S-26, US-G-11 |
| S9 Action descriptor | v0.1 | US-S-24, US-S-28, US-T-02, US-T-05, US-T-06, US-G-05, US-G-09, US-M-02 |
| T1 Requires you | v0.2 | US-T-01, US-T-02, US-T-03, US-T-04, US-T-05, US-T-06, US-T-07, US-G-04 |
| T2 Progress card | v0.3 | US-T-12, US-T-13, US-T-14, US-T-15, US-T-16 |
| T3 Next workflow step | v0.4 | US-T-09, US-T-10, US-T-17 |
| T4 Waiting on others | v0.2 | US-T-11 |
| T5 Recent activity | v0.3 | US-T-08 |
| G1 Element panel | v0.1 | US-S-24, US-G-01, US-G-02, US-G-03, US-R-09 |
| G2 Gate footer | v0.2 | US-G-04, US-G-05, US-G-06, US-G-07, US-G-08, US-G-09, US-G-11, US-G-12 |
| G3 Single-action footer | v0.2 | US-G-10, US-G-11, US-G-12 |
| G4 Action feedback | v0.2 | US-G-13, US-G-14, US-G-17, US-Y-08 |
| G5 Ingestion start | v0.3 | US-G-15, US-G-16, US-G-17, US-G-18 |
| M1 Memory list | v0.1 | US-S-28, US-T-04, US-T-13, US-M-01, US-M-02 |
| M2 Missing references | v0.3 | US-M-03, US-M-04 |
| W1 Workflow tree | v0.3 | US-M-05, US-M-06 |
| W2 Ingestion cards | v0.3 | US-M-07 |
| R1 DNA view | v0.1 | US-R-05 |
| R2 Directives view | v0.1 | US-G-02, US-R-06 |
| R3 Team view | v0.1 | US-T-11, US-R-07 |
| R4 Documentation | v0.1 | US-G-03, US-R-08, US-R-09 |
| R5 Traceability | v0.3 | US-T-14, US-R-01 |
| R6 Timeline — time axis | v0.3 | US-R-02, US-R-03 |
| R7 Timeline — git tree | v0.3 | US-R-04 |
| R8 Files (read-only) | v0.3 | US-R-10, US-R-11 |
| A1 Launch agent | v0.4 | US-A-01, US-A-02, US-A-03 |
| A2 Agent log view | v0.4 | US-A-04, US-A-05 |
| C1 `ui.yaml` and presets | v0.3 | US-C-01, US-C-02, US-C-03, US-C-04 |
| C2 Identity and How to join | v0.2 | US-C-08, US-C-09 |
| C4 UI settings | v0.2 | US-A-01, US-C-07, US-Y-02, US-Y-05, US-Y-07 |
| Y1 Repository status | v0.2 | US-Y-01, US-Y-04 |
| Y2 Fetch | v0.2 | US-Y-02, US-Y-03 |
| Y3 Push | v0.2 | US-Y-07, US-Y-08 |
| Y4 Update (fast-forward) | v0.2 | US-G-12, US-Y-05, US-Y-06 |
| X1 Accessibility | v0.1 | US-X-06, US-X-07, US-X-10 |
| X2 Externalised strings | v0.1 | US-X-09 |
| X3 Light and dark themes | v0.1 | US-X-08 |
| X4 Local server security | v0.1 | US-R-11, US-X-02, US-X-03, US-X-04, US-X-05 |

The capability upgrades of v0.4 have their own stories: T2 phases → US-T-16, W1 position →
US-M-06, G5 via `workflow start` → US-G-18.

## Edge cases (stop-check: edge-case stories present)

The journeys' common rules and obstacles, and the features' refusal cases, each have ≥ 1 story.

| Edge case | Source | Stories |
|-----------|--------|---------|
| Element with local changes | common rule *Snapshot*, S8 | US-S-25, US-G-11 |
| Copy behind the remote; update cannot fast-forward | common rule *Behind*, Y4 | US-G-12, US-Y-06 |
| Member without `approver` on WingFoil 0.2.2 | common rule *Roles*, J2/J4 obstacles, W-13 | US-T-06, US-G-09 |
| Unknown types and states, no `ui.yaml` | S9, R7 of the external review | US-S-28, US-T-05, US-M-02 |
| Capability not available (version or role) vs not applicable | common rule *Unavailable capabilities*, S3 | US-S-11, US-T-10, US-T-15, US-G-16, US-M-04, US-A-03, US-Y-04 |
| CLI outside the supported range; no CLI found | J0 rules, S3 | US-S-09, US-S-10 |
| Not in team; no identity; ambiguous identity | J6, S4 | US-S-13, US-S-14, US-S-15 |
| Invalid add (not WingFoil, duplicate, failed clone, missing folder) | J0 rules, S2 | US-S-05, US-S-06, US-S-07, US-S-19 |
| CLI refuses an action or an ingestion step | J1 obstacles, G4, G5 | US-G-07, US-G-14, US-G-17 |
| Impossible moves (terminal, engine-waiting states) | S9 | US-S-24 |
| Git transport failures (fetch, push, no remote) | J8, Y2, Y3 | US-Y-03, US-Y-04, US-Y-08 |
| Local server attacked (network, other web page, paths) | X4 | US-R-11, US-X-03, US-X-04, US-X-05 |
| Malformed project files (governance file, `ui.yaml`) | S1, C1 | US-S-27, US-C-04 |
| Invalid `ui.yaml` write | C1 | US-C-03 |
| Agent run fails | A2 | US-A-05 |
| Empty states | T1 | US-T-07 |
| Links that leave the repository or point nowhere | R4 | US-R-09 |
| Non-governed commits in the governed time axis | R6 | US-R-03 |
| No tech lead declared | C2 | US-C-09 |
| Accessibility of feedback | X1 | US-X-07 |

## Stop-check

| Check | Result |
|-------|--------|
| 100 % of the MVP Canvas features covered by ≥ 1 story | ✓ 44 / 44 |
| Every story tagged `[MVP · vX.Y]` or `[Future · Ln]` | ✓ 111 MVP + 10 future |
| No story earlier than its main feature's release (`07_sequencer.md`) | ✓ |
| No duplicate story id | ✓ |
| Edge-case stories present for every common rule and refusal case | ✓ 42 edge stories (table above) |
| Every MVP journey step (J0–J8) lands on a task with stories | ✓ `01_backbone.md` |
