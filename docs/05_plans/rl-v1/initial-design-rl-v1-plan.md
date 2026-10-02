---
id: initial-design-rl-v1-plan
type: plan
title: "Initial design — rl-v1"
status: active
version: "1.0"         # optional — plan version
workflow: "initial-design"
phase: "rl-v1"
scope: "rl-v1"
element: "rl-v1"       # optional — the Memory element this phase iterates (e.g. a release id)
release: ""            # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Date:** 2026-10-02 · **Branch:** `design/initial-design_v1` (merged to `main` with `--ff=false` at the end)
**Workflows:** `sw-life-cycle` phase `seed-first-release-line`, then `release-line-cycle` phases
`approve` and `initial-design` (`.wingfoil/workflows/custom/initial-design.yaml`) for `rl-v1`
**Roles:** product-owner (seed-first-release-line, seed-releases), tech-lead + approver (approve),
architect (ADRs, DLs, tech-specs), approver (gates) — Roberto Pompermaier holds all of them; the
agent drafts and audits (executes as architect/developer/qa, no approval authority)
**Input:** the Vision Package `docs/01_vision/` (sequencer `07_sequencer.md` v0.5, features
`06_features.md` v0.6), the requirements `docs/02_requirements/` (story map, BDD conventions v0.3,
SARD v0.2) and the hand-off section of `docs/02_requirements/X_coherence-audit.md`, the backlog
`docs/03_backlog/04_backlog/`
**Evidence:** `docs/00_reference/adr-draft-local-server.md`, `docs/00_reference/ux-reference.md`
§6 (`ui.yaml` draft), the pinned CLI's JSON output, directives `wingfoil-cli`, `cli-only-writes`,
`claim-evidence`

Why now: `specification-downcast-specification-plan` is `done` and merged. The release-line `rl-v1`
and its roadmap, decisions and shared specs must exist before `delivery` runs `release-cycle` for
v0.1.

Preconditions:
- `npm run -s wingfoil -- --version` prints `0.2.2`, the version `package.json` pins for `wingfoil`.
- `specification-downcast-specification-plan` is `done`; `.wingfoil/` loads with no warnings
  (`directives list` → `"warnings": []`); backlog validators pass (`check_backlog.py`).

Produces:

| Step | Output |
|------|--------|
| seed-first-release-line, approve | `docs/04_memory/planning/rl-v1.md` (`active`) |
| seed-releases | `docs/04_memory/planning/v1/minor-v0.1.md` … `minor-v1.0.md` (`draft`, W-07) |
| seed-adrs | `docs/04_memory/design/adrs/adr-001-….md` (`accepted`) |
| seed-dls | `docs/04_memory/design/dls/dl-…` (`ready`), only for decisions not already recorded |
| seed-specs | `docs/04_memory/design/specs/spec-…` (`approved`) |

## Phases / Steps

Each session: the agent drafts → the session (human + agent) reviews and decides → the agent
writes the decisions into the elements and into **Session log** below → one commit per session
(`docs(design): session N — …`), plus the `wf(…)` commits the CLI makes. Fields that `--set`
cannot write are filled by editing the draft before `memory submit` (W-01); before each submit the
draft is checked against `memory.yaml`'s `required` list (W-02).

| # | Step (workflow phase) | Role | Output | Stop-check |
|---|-----------------------|------|--------|------------|
| 1 | Release-line `rl-v1`: Scope and Success Criteria; `submit` → `planning`; `approve` → `active` (`seed-first-release-line`, `release-line-cycle/approve`) | product-owner, approver | `rl-v1.md` | `title`, `version` set; Success Criteria = the canvas metrics; status `active` |
| 2 | Roadmap: five `release` elements v0.1, v0.2, v0.3, v0.4, v1.0 (`seed-releases`) | product-owner | `planning/v1/minor-v*.md` | every required field set (incl. `kind`); `features` match `07_sequencer.md` (44 features once each); `requirements` = `by-release/vX.Y.json`; `pillar` = area letter; `wingfoil_min` = sequencer floor (checked by script) |
| 3 | `adr-001` — Local server driving the WingFoil CLI (`seed-adrs`), plus any other ADR the SARD implies | architect, approver | `design/adrs/` | `sard_ref` set; every ADR-draft decision traced to a `REQ-*`; consistent with SARD v0.2 (write class (c) with clone, git allow-list) |
| 4 | Decision logs (`seed-dls`): only product/process decisions of inception/specification not yet traceable to a document (candidates: permissions left to WingFoil; presets UI-only — the presets are only the `ui.yaml` values/configurations the UI uses, not WingFoil presets, which WingFoil may define in the future) | architect, approver | `design/dls/` | each DL cites the document that records the decision |
| 5 | Tech-specs (`seed-specs`): action descriptor (REQ-ARC-06), CLI JSON contracts (REQ-INT-01, `wingfoil_version: 0.2.2`), server HTTP API + event stream (REQ-INT-09, SEC-02/03/04), `ui.yaml` schema + presets (REQ-ARC-07), Memory events from git (REQ-INT-06) | architect, approver | `design/specs/` | `scope` set; every spec traces its `REQ-*` and the scenarios it serves; CLI shapes captured from the pinned 0.2.2 output, not from memory |
| 6 | Spec review + `wingfoil-cli` directive update | architect (independent agent), approver | review report in this plan; directive v1.2 | see *Spec review* below; W-14…W-16 added |

### Spec review (replaces WingFoil's `spec-review.passed`, `dl-022`)

`initial-design` declares a `spec-review.passed` pre-check on `seed-adrs` and `seed-specs`, copied
from WingFoil's `dl-022`, with no element behind it in this project. Proposed: keep the check and
satisfy it with an **independent review** (fresh-context, read-only agent, as the specification
coherence audit) run on the ADR and tech-spec drafts **before** they are submitted, covering:
- internal consistency of each element;
- cross-spec consistency (descriptor ↔ API ↔ CLI contracts ↔ `ui.yaml` ↔ Memory events);
- BDD/vision: no element contradicts a scenario, `03_is-isnot.md`, the write classes or `cli-only-writes`;
- traceability: every element cites its `REQ-*`, every `REQ-*` the hand-off lists is covered.
Findings are fixed, then re-verified by the same reviewer; the result is logged here. The workflow
file's TODO is resolved in the same session (the check's meaning written in its comment, and
`seed-releases`' post check extended with `kind`).

### Carried open points

- v0.1 holds 34 of 50 technical tasks against a 6-day budget — weighed by v0.1 `release-planning`,
  not here; the roadmap keeps the sequencer's partition.
- v0.4 assumes WingFoil 0.3 verbs (`workflow start/next/status`, `agent execute`) — syntax
  confirmed at v0.4 `release-planning`; `minor-v0.4` records `wingfoil_min: "0.3"`.
- New CLI surprises to add to the `wingfoil-cli` directive (v1.2): W-14 numeric ids zero-padded to
  ≥ 3 digits; W-15 `add`/`submit` commit subjects carry no `[from → to]`; W-16 `init --template
  Kanban|Scrum` ingest workflows have one phase and no actions (Scrum = Kanban's 7 types).
- WingFoil requests relevant to `rl-v1` (local notes): R-01, R-02, R-03, R-09, R-10.

## Handoff

- **Agent:** drafts every element, fills the fields `--set` cannot write, runs the scripted checks,
  launches the independent spec review, keeps the session log, commits.
- **Human (product-owner / architect / approver):** decides in each session; runs or authorises
  every `memory approve` (only `approver` can, W-13).
- **Checkpoints:** end of each session; spec review result before any ADR/tech-spec is submitted.
- **Completion:** `rl-v1` `active`; five releases in `draft`; `adr-001` `accepted`; tech-specs
  `approved`; review passed; directive updated → the plan is finalized by hand (`status: done`,
  commit `wf(plan): finalize initial-design-rl-v1-plan [active → done]`, W-04) and the branch is
  merged to `main` with `--ff=false`.
- **Next:** `release-line-cycle/delivery` → `release-cycle` for `minor-v0.1`, starting with
  `release-planning` (plan scope `rl-v1/rel-v0.1`).

## Session log

<!-- One entry per session: date, decisions taken, deviations from this plan. -->

### Session 1 — Release-line `rl-v1` (2026-10-02)

- Outputs: `docs/04_memory/planning/rl-v1.md` — Scope (five releases of `07_sequencer.md` v0.5 with
  area, WingFoil floor and delivery; requirements; out of scope L1–L10; WingFoil 0.3/1.0
  dependencies) and Success Criteria (the MVP canvas metrics, as fit criteria in SARD v0.2) —
  accepted after review; `submit` → `planning`, `approve` → `active` (`fda25fa`).
- Plan accepted as drafted:
  - six sessions, commits `docs(design): session N — …`;
  - `spec-review.passed` kept and satisfied by an independent, read-only review of the ADR and
    tech-spec drafts before submit, re-verified after fixes; the workflow TODO and the `kind`
    post-check fixed in that session;
  - DLs only for decisions not yet traceable to a document; the "presets UI-only" DL states that
    presets are only the `ui.yaml` values/configurations the UI uses — WingFoil may define its own
    presets in the future;
  - `wingfoil-cli` directive v1.2 with W-14…W-16;
  - v0.1's load (34 of 50 technical tasks) weighed by v0.1 `release-planning`, not here.

### Session 2 — Release roadmap (2026-10-02)

- Outputs: five `release` elements in `draft` under `docs/04_memory/planning/v1/` (W-07) —
  `minor-v0.1` *Read-only console* (S, 0.2.2, 16 features), `minor-v0.2` *Unblock* (G, 0.2.2, 13),
  `minor-v0.3` *Project state* (R, 0.2.2, 12), `minor-v0.4` *Workflow and agents* (A, 0.3, 3),
  `minor-v1.0` *MVP complete* (X, 1.0, none); Scope, Pillar Focus, Success Criteria (sequencer exit
  criteria + bars common to every release: `@vX.Y` scenarios, prototype parity, axe, contract tests
  from `wingfoil_min`, commit classes); stop-check `docs/03_backlog/X_tools/check_releases.py` —
  accepted after review.
- Decisions:
  - `features` lists only the features a release introduces (each MVP feature once); v0.4's
    capability upgrades (T2 phases, W1 position, G5 via `workflow start`) are in its Scope;
    v1.0 keeps `features: []` — whether `submit` accepts an empty required list is checked at its
    `release-planning`;
  - v0.3 adds the WingFoil-repository dogfooding (canvas, REQ-SEC-10) to the sequencer's exit
    criteria; a v0.4 criterion on 0.2.2 fall-back was dropped as already covered by the `@v0.4`
    scenarios (e.g. T-10.1, T-10.2);
  - **new requirement — page title** (user request): the browser tab title is
    `<project> · <state> · <view or element> — WingFoil UI`, `<state>` = the current phase when
    WingFoil reports it (0.3), otherwise the project completion (v0.3), omitted before; no project
    open → `Projects — WingFoil UI`. Story US-X-10 (X1, v0.1, WCAG 2.4.2), scenarios X-10.1 …
    X-10.5 (`x/accessibility.feature`), traced in REQ-ARC-10.
- Requirements changed (no Vision Package change): story map `02` v0.5, `03` v0.5; BDD conventions
  v0.4 (299 scenarios); SARD v0.3 (`01` v0.3); backlog rebuilt (161 items, 238 links; doc v0.3);
  requirements index v1.1; `rl-v1` Scope counts updated (111 stories, 299 scenarios).
- Stop-check: `check_releases.py` — 5 releases, 44 / 44 MVP features, OK; `check_usm.py`,
  `check_bdd.py`, `check_sard.py`, `check_backlog.py` ✓; `directives list` → no warnings.

### Session 3 — ADRs (2026-10-02)

- Outputs (both `draft`, submitted after the spec review of step 6):
  - `adr-001-local-server-driving-the-wingfoil-cli` (`sard_ref` REQ-ARC-02, release v0.1) — from
    the ADR draft, decisions D1–D10; the draft's open items decided: **D2** CLI discovery
    (`node_modules/wingfoil/package.json` `bin` run with `process.execPath`, project root only, then
    PATH resolved to an absolute path, else not opened; the installed version counts); **D3**
    `--version` must be semver, range 0.2.2 → highest contract-tested inclusive, pre-releases out
    unless listed; **D4** schemas per consumed command in `contracts/`, contract tests per matrix
    version, matrix in the README, advanced by `release-planning`; **D5** batched reads, writes
    serialised per project (an addition to the SARD), 30 s timeout. CLI latency measured instead
    of estimated: ≈ 0.4 s warm, 0.85 s cold per call (WingFoil 0.2.2, this repository).
  - `adr-002-technology-stack` (`sard_ref` REQ-ARC-01, release v0.1) — after a comparison of the
    alternatives: TypeScript, npm workspaces `server/` `web/` `contracts/`; Fastify (JSON Schema
    validation with Ajv, pino with token redaction); ports and adapters for process runner,
    local-state store, event bus, per-project write lock, authentication, repository watcher;
    React + Vite, React Aria Components, TanStack Query/Router, FormatJS, CSS custom properties,
    markdown-it + DOMPurify; Vitest, Playwright, @axe-core/playwright, ESLint, Prettier.
- Decisions: `sard_ref` holds the core requirement, the full list is in each ADR's Traceability;
  local request ids are not cited (WingFoil elements are); the DNA `stacks.technologies` is
  updated through the CLI only after `adr-002` is accepted.
- `docs/00_reference/adr-draft-local-server.md` annotated "Recorded as adr-001" (kept as evidence).
- Check: every `REQ-*` and scenario cited by the two ADRs exists (script over SARD v0.3 and BDD).
