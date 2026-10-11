---
id: minor-v0.1
type: release
title: "WingFoil UI v0.1 — Read-only console"
status: released
kind: "minor"
patch-of: ""           # optional — when kind is "patch": id of the released minor it patches, e.g. "minor-v0.2"
version: "v0.1"
pillar: "S"             # REQUIRED — primary feature area of docs/01_vision/06_features.md this wave centers on
features: [S1, S2, S3, S4, S8, S9, G1, M1, R1, R2, R3, R4, X1, X2, X3, X4]           # REQUIRED — feature IDs covered by this release (from 06_features.md)
wingfoil_min: "0.2.2"       # minimum WingFoil CLI version this release needs, e.g. "0.2.2"
requirements: "docs/03_backlog/04_backlog/by-release/v0.1.json"       # REQUIRED — path to per-release backlog JSON, e.g. "docs/03_backlog/04_backlog/by-release/v0.1.json"
release-line: "v1"
tmpl_version: 260929   # Orignal template version
---

## Scope

Open any WingFoil project and read it safely: local server and CLI adapter, project list (add a local folder or clone a remote), WingFoil version and capability detection, identity and role views, snapshot and refresh, the action descriptor, and read-only views of the element panel, Memory, DNA, directives, team and documentation. Cross-cutting from day one: accessibility, externalised strings, light/dark themes and local server security (sequencer rules 4 and 7). In v0.1 the project opens on the Memory list; Today arrives in v0.2.

- Features (16 features, `07_sequencer.md` v0.6): S1, S2, S3, S4, S8, S9, G1, M1, R1, R2, R3, R4, X1, X2, X3, X4.
- Journeys served: J0 steps 1–3, J6 steps 1–2 (partial), J4 step 2 (read).
- Backlog: `docs/03_backlog/04_backlog/by-release/v0.1.json` — 39 user stories,
  33 technical tasks (TT-ARC-07 moved to v0.3 by release-planning; TT-INT-08 on Chromium only in v0.1); the Memory `task` elements are created from it by
  this release's `release-planning` (`ref:` = backlog id).

## Pillar Focus

**S — Read-only console.** Every later screen stands on the server, the CLI adapter, the snapshot and the action descriptor; showing a project read-only before acting on it is sequencer rule 2 ("read before write"), and the write classes and server security must exist before the first write (rule 7).

## Success Criteria

Exit criteria of `07_sequencer.md` v0.6:

- the WingFoil and WingFoil UI repositories, and the fixture with unknown types and states and no `ui.yaml`, render without UI changes;
- the local server refuses non-loopback and cross-origin requests and every request without the session token;
- the only write is cloning a remote into a new folder — no governed write exists yet.

Bars common to every release (`08_mvp-canvas.md`, SARD v0.6):

- every scenario of `docs/02_requirements/02_bdd/` tagged `@v0.1` passes in the e2e suite;
- the screens in scope match the prototype (`docs/00_reference/prototype/`) except for the
  deviations recorded in the Vision Package (directive `ux-consistency`);
- 0 serious/critical axe violations on every screen in scope, in both themes (directive
  `accessibility`);
- the CLI JSON contract tests pass on every supported WingFoil version from `wingfoil_min`
  (0.2.2) to the latest contract-tested one;
- every commit the UI causes is a `wf(…)` commit made by the CLI, or a `chore(ui)` commit touching
  only `.wingfoil/ui.yaml`.

## Execution Notes

<!-- Running log of what actually happened during this release's workflow — filled in
     incrementally as each phase runs, not written after the fact. Raw material for the
     retrospective (docs/04_memory/design/dls/{id}.md), not the retrospective itself: capture
     what happened here; save "why it matters going forward" for the retrospective. -->

### Planning (release-planning)

<!-- identify-specs: artefacts discovered late or missed; build-backlog: scope/estimation
     surprises, bugs selected for this release and their derived fix tasks. -->

- 2026-10-02 — `release-planning-rel-v0.1-plan` started. `advance-pinned-build` no-op (0.2.2 is
  the newest published `wingfoil`); `triage-bugs`, `reconcile-governance` no-op (no bugs; DLs
  `ready`, ADRs `accepted`); `record-adrs` skipped. Load (73 backlog records vs a 6-active-day
  budget) to be weighed before `identify-specs`; tasks to be grouped into ~20 vertical tasks.
- 2026-10-03 — load decided (plan session 2): budget 6 → 9 active days (sequencer v0.6, canvas
  ≈ 33); REQ-ARC-07 / TT-ARC-07 moved to v0.3 (no `@v0.1` scenario reads `ui.yaml`; spec-005 now
  v0.3); REQ-INT-08 staged — e2e on Chromium only in v0.1, three engines from v0.2; TT-PERF-04
  kept. v0.1 = 39 stories + 33 technical tasks (72). `identify-specs`: four uncovered artefacts
  specified — spec-006 local state store, spec-007 launcher command line, spec-008 message
  catalogue, spec-009 theme tokens; independent spec review PASS — 24 findings fixed, 1 (F25) left by decision; 6 nits of the
  re-verification fixed.
- 2026-10-03 — `build-backlog` (plan session 3): 21 vertical tasks `task-001` … `task-021`
  (11 server, 1 contracts, 9 web) cover the 72 backlog records exactly once
  (`check_tasks.py`); server/contracts tasks own the technical tasks and the server-only stories,
  web tasks own the user stories; all `pending`. `dl-002` stamped `release: v0.1`; `dl-001`,
  `dl-003` left unassigned (dl-003 lands with spec-005 in v0.3). No bug selected.
- 2026-10-04 — `commit-backlog` gate (plan session 4): the independent audit FAILED (5 major — web
  task order with a 017 → 018 → 019 cycle, shell task carrying every-screen acceptance, missing
  server dependencies, fit criteria naming later capabilities, no `cli-not-found` contract).
  Fixed: web order 013 → 018 → 017 → 019 → 020 → 015 → 014 → 016 → 021 (element panel by URL
  first; US-G-02 → task-019); themes/strings acceptance → task-021; dependencies added; SARD v0.7
  v0.1 scopes; spec-006 `cli-not-found` and `availability`; BDD conventions v0.6 fixture variants.
- 2026-10-05 — 21 tasks approved into `backlog`; release `planning → in-development` (`df09286`).
  Planning took 4 active days (2026-10-02 … 2026-10-05) inside the v0.1 budget of 9.

### Implementation (dev-loop, per task)

<!-- Recurring blockers across tasks, tech-specs revised mid-release, review rejections and why,
     anything that deviated from the plan in Scope/Pillar Focus above. -->

- 2026-10-05 — `dev-loop-rel-v0.1-plan` started: one plan for the phase, one session per wave;
  `backlog → in-progress` and `approved → done` are hand edits with a `wf(task)` commit (W-20). Wave
  1 (server foundations): task-001, 002, 007, 003, 004, 005 merged after 2–4 independent review
  rounds each; 003, 004, 007 ran as parallel agents in worktrees. Approved specs amended by the user
  (spec-004 §1/§5, spec-006 §4, spec-007 §6, spec-001 errata). bug-001 (timing tests under load)
  ingested and absorbed into task-010. Deviation: fixture builder and two coverage tests written
  after the code. `main` `4d3e6cb`: 547 passed, 96.32 % statements.
- 2026-10-06 — Wave 2 (server APIs): task-011, 006, 009, 010, 008, 012 merged (2–4 review rounds
  each). User decisions 1–30 applied as amendments with dated Process Notes; a coherence audit found
  18 follow-ups, all fixed. bug-001 and bug-002 (inherited `GIT_*` variables) absorbed into
  task-010, bug-003 (confined reads swapped after the check) into task-012, all closed; the timing
  tests moved to `test:timing`. Deviation: spec-002 §4 incremental parse deferred to v0.2. External
  load 25–80 most of the wave. `main` `9bbf70b`: 1236 passed, e2e 3/3.
- 2026-10-09 — Wave 3 (web core): task-013, 018, 020, 017, 019 merged (2–3 rounds; 020 round 1 FAIL
  on focus loss). Decisions W3-1 … W3-47; W3-47: "within 5 s" live refresh proved only in
  `test:timing`, default e2e asserts behaviour. bug-004 (tests time out under extreme load) absorbed
  into task-019, `resolved`. Deviations: several e2e specs written after the code; entry bundle ≈
  618 kB. Agents interrupted by API limits four times. `main` `d433812`: 1640 passed, e2e 60/60.
  Between waves: feedback-loop governance tasks task-022 (`8c96fa2`) and task-023 (`1d9348d`),
  decisions 48–59; `main` pushed for the first time.
- 2026-10-10 — Wave 4 (project flows): task-015 (`7b6dc42`), task-014 (`dcbcfb5`), task-016
  (`0156d3f`) merged one at a time, 2–3 rounds each. Decisions W4-1 … W4-22 (ux-reference 0.6 →
  1.0); W4-8 makes task-018's element panel non-modal. bug-005 (flaky fingerprint test) absorbed
  into task-016, `resolved`; bug-006 (clone URL credentials kept in `.git/config`) found by 014's
  review, planned into task-021. Load up to ≈ 290 and one reboot. `main` `ca02d29`: 1837 passed, e2e
  104/104.
- 2026-10-11 — Wave 5 (closing pass): task-021 merged (`6cad52a`, done `4d9a811`) after 4 review
  rounds (R1 FAIL 1 blocker/1 major/4 minor/2 nits, R2 FAIL 1 blocker/2 minor, R3 FAIL 1 minor, R4
  PASS) — three rounds each found a new clone-URL credential bypass. Decisions W5-1 … W5-19: W5-1
  React Aria's "Dismiss" the one library-string exception (spec-008 §6); W5-8 no code split (entry ≈
  709 kB, 215 kB gzip); W5-14 refusal `credentials-in-url` (spec-006 §3); W5-16 header re-read alert
  (R9 accepted). bug-006 `resolved`. Governance task-024 (WingFoil source key `svc-019`, `7f921c8`).
  `main` `4d9a811`: 1926 passed, e2e 125/125; `test:timing` green on `7f921c8`.
- 2026-10-11 — implementation complete: 24/24 v0.1 tasks `done`; plan finalized (`946ca4b`).
  Recurring blockers across waves: external machine load (timing tests, then cold reads under load —
  bug-001, bug-004) and agent sessions interrupted by usage limits, resumed from commits. No change
  to Scope or Pillar Focus recorded; governance tasks 022–024 added outside the backlog.

### User docs (user-docs)

<!-- check-implementation-complete, align-user-docs, align-agent-docs: documents produced,
     review rounds, accepted deviations and spec-vs-code differences found. -->

- 2026-10-11 — `user-docs-rel-v0.1-plan` (branch `design/user-docs_v0.1`); release-validation
  decisions RV-1 … RV-10 (one session per phase, task-025 for the smoke gaps, staged gate, tag
  `v0.1.0`, tag-only publishing with `private: true`). `test:timing` green on `946ca4b` (RV-6): the
  release-validation timing evidence. 24/24 tasks `done`, `check_tasks.py` OK.
- 2026-10-11 — drafts (`fc8de8e`): `README.md` updated, `docs/user-guide.md`,
  `docs/cli-reference.md`, `CHANGELOG.md`, `CLAUDE.md`, `.wingfoil/README.md` (tables from
  `memory.yaml`, `workflows.yaml`, `roles.yaml`). Independent review round 1 FAIL (4 minor, 7 nits,
  fixed `301c912`), round 2 PASS (2 nits: wrap fixed `0220d4e`, document versions settled by UD-9).
  Decisions UD-1 … UD-10; UD-5 `docs/examples/` N/A for a web dashboard (accepted deviation); UD-7
  spec-vs-code differences of spec-007 §1/§3/§6 and spec-006 §1 (docs follow the code) fixed by a
  governance task after v0.1. The spec-007 §7 manual Windows check (`#token` through `rundll32`) is
  still open. Gates approved; plan finalized `34862a3`, merged `3a74e9c`.

### E2E smoke (e2e-smoke)

<!-- Mapping of e2e-smoke.yaml onto the suites, gaps and their tasks/bugs, smoke run results,
     bug re-checks and closures, staged-gate outcome. -->

- 2026-10-11 — `e2e-smoke-rel-v0.1-plan` (branch `design/e2e-smoke_v0.1`), decisions ES-1 … ES-7.
  `npm pack --dry-run` on `3a74e9c`: 707 files, ~2.2 MB, no `dist/` → bug-007 (packed package cannot
  start, medium), absorbed into governance task-025 (accepted deviation ES-5).
- 2026-10-11 — task-025: design decisions ES-8 … ES-17 (`files` allow-list, root runtime
  dependencies, `prepack` clean build, `test:smoke`, `scrum` fixture, no-commit check, bin mode
  100755); AC-1 and AC-3 reworded at design by the approver (contracts JSON only; the bin's own exit
  status). Review round 1 FAIL (2 minor: React development bundle packed, stale `server/dist`; 3
  nits), round 2 PASS. Tarball 120 files, 513 788 B packed. Merge `ad928af`, done `0d719fe`; bug-007
  `resolved`. bug-008 (clone hooks temp folder left on a kill) triaged low, v0.2.
- 2026-10-11 — smoke run on `main` `0d719fe`: `test:e2e` 129/129, local-security 136/136,
  accessibility 10/10, `test:contract` 144 passed, `test:smoke` 4/4, `test:coverage` 1949 passed;
  `test:timing` skipped (load 16.6, `946ca4b` run stands) — first green run of the staged gate
  (ES-7). bug-004 re-check at load 13–41 (median 34; at times below the RV-4/ES-6 bar of 15;
  accepted with the approver's OK on the gate report): two runs of coverage + e2e, no timeout. Bugs
  closed: bug-004 `a7e9c0c`, bug-005 `4f2034e`, bug-006 `facf55d`, bug-007 `cc09b60`. Plan finalized
  `6e98a9d`, merged `a33fca7`.

### Submit & Publishing

<!-- pre-release-checks failures and fixes, approve-release rejections, publishing issues. -->

- 2026-10-11 — `release-submit-rel-v0.1-plan` on `main` (RV-1). Execution Notes completed; dl-004
  (npm step skipped, RV-8); release commit `ac3b5b5` (`0.1.0`, CHANGELOG date, bug-008 known
  limitation, `CLAUDE.md` status). Independent review round 1 FAIL (1 major: wrong check-script
  paths in the plan; 4 minor), fixed `1579760`; round 2 PASS. pre-release-checks on `ac3b5b5` all
  green: coverage 1949 passed (96.67 % statements), e2e 129/129, smoke 4/4 (`0.1.0`), contract
  144, local-security 136, accessibility 10/10; `test:timing` skipped (load 18).
- 2026-10-11 — approve-release: the approver's OK in chat, recorded in the submit plan; release
  `releasing` (`677efa7`), plan finalized `c8201b7`. dl-004 approved (`f830064`).
- 2026-10-11 — `release-publishing-rel-v0.1-plan`: `test:timing` green on `f830064` (load 1.6–5.8;
  REQ-PERF-03 20/20, REQ-PERF-06 10/10, TT-PERF-04 p95 ≤ 149 ms). Annotated tag `v0.1.0` on `main`
  `545d56c` (only docs/governance changed after `ac3b5b5`), pushed on the approver's OK. `publish`
  step skipped (dl-004): not on npm, no GitHub Release. Release `released` (`0f54194`).
