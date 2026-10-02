# SARD — WingFoil UI

**Version:** 0.4
**Date:** 2026-10-02 (0.2: coherence audit fixes — session 6; 0.3: page title in REQ-ARC-10 — initial-design session 2; 0.4: REQ-ARC-04 allow-list of direct reads, REQ-INT-06 Memory-event source — initial-design session 5)
**Status:** Draft — specification-downcast session 4 (`volere-requirements`)
**Input:** `../02_bdd/` (scenarios and conventions) · `../01_user_story_map/` ·
`docs/01_vision/` (`02_product-vision.md` v0.3, `06_features.md` v0.5, `08_mvp-canvas.md` v0.3) ·
`docs/00_reference/adr-draft-local-server.md` · directives `cli-only-writes` (v1.3), `wingfoil-cli`
(v1.1), `accessibility`, `security-secrets`

The **System Architecture Requirements Document**: the infrastructural, business-rule and
non-functional requirements that support the BDD scenarios, in the Volere shell, grouped in five
macro-areas. The scenarios say *what* the UI does; the SARD says *under which constraints* and
*how much*. It is the input of `initial-design` (`adr-001`, tech-specs) and of `backlog-export`
(one technical task per requirement).

---

## Volere shell

Each requirement is a `### REQ-<AREA>-<nn> — <title>` heading followed by a table with:

| Field | Content |
|-------|---------|
| Release | First release it applies to (`07_sequencer.md`); later stages after a `·` |
| Description | The requirement, in testable terms |
| Rationale | Why — the decision, rule or risk it comes from |
| Traceability | Stories (`US-…`) · scenarios (`<area>-<nn>.<k>`) · features (`06_features.md`) · source documents |
| Fit criterion | Starts with its class — **[boolean]**, **[numeric]** or **[percentage]** — then the measurable condition |
| Verified by | The test or check that proves it (directive `claim-evidence`) |

## Macro-areas

| # | Area | File | Requirements |
|---|------|------|--------------|
| 1 | Architectural Constraints (`ARC`) | [01_architectural-constraints.md](01_architectural-constraints.md) | 11 |
| 2 | Performance & Latency (`PERF`) | [02_performance-latency.md](02_performance-latency.md) | 11 |
| 3 | State & Context (`STATE`) | [03_state-context.md](03_state-context.md) | 9 |
| 4 | Integrations & Interfaces (`INT`) | [04_integrations-interfaces.md](04_integrations-interfaces.md) | 9 |
| 5 | Security, Roles & Governance (`SEC`) | [05_security-roles-governance.md](05_security-roles-governance.md) | 10 |
| | **Total** | | **50** |

## Reference environment

Timings (`PERF`) are measured on:

- **Machine:** the CI runner of the repository (GitHub-hosted `ubuntu-latest`, 4 vCPU, 16 GB),
  Node.js 22.12, the e2e browser on the same machine.
- **Large fixture:** the `custom` fixture of `02_bdd/00_conventions.md` plus 500 generated Memory
  elements (tasks, bugs, decision-logs in every state) and 2 000 commits.
- **p95:** over 20 runs after 1 warm-up run, unless the requirement says otherwise.

---

## Coverage

### Items the plan requires the SARD to cover

| Item (plan, *Phases / Steps*) | Requirements |
|-------------------------------|--------------|
| CLI contract: JSON schemas per consumed command | REQ-INT-01 |
| Pinned and supported CLI range, capability detection | REQ-ARC-02, REQ-INT-02, REQ-INT-03 |
| Latency of Today and of gate actions | REQ-PERF-01, REQ-PERF-02 |
| Cache invalidation on git HEAD + working-tree status | REQ-STATE-02 |
| Identity from git (`user.email` ↔ `dna.team`) | REQ-STATE-05, REQ-SEC-08 |
| No direct writes (write classes, `wf(…)` / `chore(ui)` only) | REQ-ARC-03, REQ-ARC-04, REQ-INT-06 |
| Local server security (loopback, token, Origin/Host) | REQ-SEC-01 … REQ-SEC-06 |
| Accessibility (WCAG 2.1 AA, 0 serious/critical axe violations) | REQ-ARC-10 |
| Supported browsers | REQ-INT-08 |
| Externalised strings and themes | REQ-ARC-09, REQ-ARC-11 |

### MVP canvas success metrics → fit criteria

| Metric (`08_mvp-canvas.md`) | Requirement |
|-----------------------------|-------------|
| Time to see what requires me — 0 navigation steps | REQ-PERF-09 |
| Clicks to pass or reject a gate — ≤ 2 from Today | REQ-PERF-10 |
| Methodology independence — three fixtures, no code change | REQ-ARC-05 |
| No divergence from WingFoil — only `wf(…)` / `chore(ui)` commits | REQ-ARC-03 |
| Local server safety | REQ-SEC-01, REQ-SEC-02, REQ-SEC-03 |
| Accessibility — 0 serious/critical axe violations | REQ-ARC-10 |
| Adoption (dogfooding) | REQ-SEC-10 |

### Values proposed in sessions 2–3 → fit criteria

| Value | Requirement |
|-------|-------------|
| Refresh after an external change ≤ 5 s | REQ-PERF-03 |
| Auto-fetch every 60 s (status within 65 s) | REQ-PERF-07, REQ-STATE-09 |
| Bell *Updates* 10 events · summary ≤ 3 per role · Recent activity 5 events | REQ-PERF-11 |
| Agent log lines ≤ 2 s | REQ-PERF-08 |
| Focus contrast ≥ 3:1, axe in both themes | REQ-ARC-10, REQ-ARC-11 |
| Node.js ≥ 22.12 refused below | REQ-ARC-01 |
| Settings defaults (auto-fetch on, auto-update off, auto-push off, theme System, confirm agent on) | REQ-STATE-09 |

### New values set in this session

| Value | Requirement |
|-------|-------------|
| Today p95 ≤ 2.0 s warm, ≤ 5.0 s cold; other views ≤ 1.0 s | REQ-PERF-01, REQ-PERF-04 |
| Gate/submit p95 ≤ 3.0 s | REQ-PERF-02 |
| ≤ 6 CLI processes for a cold Today, 0 on an unchanged repository | REQ-PERF-05, REQ-INT-09 |
| Server start ≤ 3.0 s | REQ-PERF-06 |
| CLI timeout 30 s | REQ-INT-04 |
| Session token ≥ 128 bits | REQ-SEC-02 |
| Browsers: Chrome, Edge, Firefox, Safari through the Chromium, Firefox and WebKit engines of the pinned Playwright | REQ-INT-08 |
| Dogfooding ≥ 80 % of approve/reject commits from the UI (local action log) | REQ-SEC-10 |

Checked by `../X_checks/check_sard.py` (shell fields present, fit-criterion class, ids unique,
every cited story and scenario exists, every coverage row points to existing requirements).
