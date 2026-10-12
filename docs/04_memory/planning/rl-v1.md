---
id: rl-v1
type: release-line
title: "WingFoil UI v1"
status: active
version: "v1"
tmpl_version: 260703   # Orignal template version
---

## Scope

The MVP of WingFoil UI (`docs/01_vision/08_mvp-canvas.md`): a local web console over WingFoil and
git — a local server driving the project's `wingfoil` CLI and a browser UI — that shows each member
what requires them and the whole project state, and turns governed operations into one or two
clicks, with WingFoil as the only writer.

It delivers the 44 MVP features of `docs/01_vision/06_features.md` in five releases, as sequenced
by `docs/01_vision/07_sequencer.md` (v0.6):

| Release | Area (`pillar`) | `wingfoil_min` | Delivers |
|---------|-----------------|----------------|----------|
| v0.1 | S — Read-only console | 0.2.2 | open and read any WingFoil project safely (16 features) |
| v0.2 | G — Unblock | 0.2.2 | Today, gates in ≤ 2 clicks, sync — **first usable release** (13) |
| v0.3 | R — Project state | 0.2.2 | progress, traceability, timeline, files, decision-log ingestion, `ui.yaml` (12) |
| v0.4 | A — Workflow and agents | 0.3 | next step, agent launch and logs, all ingestions (3 + 3 upgrades) |
| v1.0 | X — MVP complete | 1.0 | `npx wingfoil-ui` stable, support matrix, polish (no new features) |

Requirements: the user story map, BDD scenarios and SARD of `docs/02_requirements/` (111 MVP
stories, 299 scenarios, 50 `REQ-*`); backlog partitions in `docs/03_backlog/04_backlog/by-release/`.

Out of scope: L1–L10 of `06_features.md` (editing content, DNA, directives, workflows and files;
artifacts; external notifications; core-enforced permissions; core settings; second language;
hosted deployment; worktrees) — each waits for a later release-line or its WingFoil dependency.

Dependencies: v0.4 waits for a WingFoil 0.3 release, v1.0 for WingFoil 1.0; v0.1–v0.3 need only
the pinned 0.2.2.

## Success Criteria

The release-line is done when every criterion below holds (MVP canvas success metrics; fit
criteria in the SARD):

- every release v0.1 → v1.0 is `released`, and `npx wingfoil-ui` is published as stable 1.0;
- every MVP journey J0–J8 passes the e2e smoke on WingFoil 1.0;
- 0 navigation steps to see what requires me (everything on Today) and ≤ 2 clicks from Today to
  pass or reject a gate;
- the Kanban fixture, the WingFoil (`custom`) project and a project with unknown types/states and
  no `ui.yaml` render with no UI code change;
- every commit the UI causes is a `wf(…)` commit made by the CLI, or a `chore(ui)` commit touching
  only `.wingfoil/ui.yaml` — 0 direct writes to governed files;
- the local server refuses non-loopback and cross-origin requests and every request without the
  session token;
- 0 serious/critical axe violations on every MVP screen, in both themes;
- dogfooding: WingFoil UI's own gates passed from the UI from v0.2, the WingFoil repository's from
  v0.3 (≥ 80 % of approve/reject commits, measured by the local action log).

## Execution Notes

### Initial Design (seed-adrs / seed-dls / seed-specs)

<!-- Decisions/specs formalized up front for this release-line; anything discovered late that
     should have been seeded here instead of during a release's identify-specs. -->

2026-10-02 — `initial-design-rl-v1-plan`:
- Roadmap: `minor-v0.1` … `minor-v1.0` (`draft`), from `07_sequencer.md` v0.5; new requirement
  US-X-10 (browser tab title) added to v0.1.
- ADRs (`accepted`): `adr-001` local server driving the project's own CLI (discovery, version
  range, contract matrix, serialised writes, read allow-list D1a), `adr-002` technology stack
  (TypeScript workspaces, Fastify, ports and adapters, React + Vite + React Aria, Vitest, Playwright).
- DLs (`ready`): `dl-002` permissions left to WingFoil, `dl-003` presets limited to UI configuration.
- Tech-specs (`approved`): `spec-001` CLI and file read contracts, `spec-002` Memory events from
  git, `spec-003` action descriptor, `spec-004` server HTTP API and event stream, `spec-005` UI
  configuration file and presets.
- Found late, worth seeding earlier next time: WingFoil 0.2.2 exposes no read verb for type
  definitions, element content or directive bodies (→ SARD REQ-ARC-04 allow-list); archived
  states (`deprecated`, `superseded`) are hidden by `memory search` and end some sequences
  (→ "last non-archived state"). Both were found by capturing real CLI output, not from documents.
- Spec review: independent, read-only reviewer — 6 major + 10 minor fixed, re-verification
  confirmed with 4 minor remarks, fixed.

### Delivery (per release)

<!-- Cross-release patterns: recurring blockers, releases that slipped and why, whether the
     release roadmap seeded here needed revision mid-line. -->

- 2026-10-04 — v0.1 `release-planning`: budget v0.1 6 → 9 active days (sequencer v0.6, line ≈ 33);
  REQ-ARC-07 (`ui.yaml`) moved to v0.3; REQ-INT-08 staged (Chromium in v0.1); v0.1 scope written
  into six SARD requirements whose fit criteria named later capabilities (SARD v0.7); four new
  tech-specs (spec-006…009). The roadmap itself (five releases, features) is unchanged.
- 2026-10-12 — v0.2 `release-planning`: budget v0.2 5 → 8 active days (sequencer v0.7, line ≈ 36),
  all 46 v0.2 backlog records kept; spec-002 §4 incremental parse moved to v0.3; one new tech-spec
  (spec-010, git sync). The roadmap itself is unchanged.
