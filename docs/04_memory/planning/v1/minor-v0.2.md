---
id: minor-v0.2
type: release
title: "WingFoil UI v0.2 — Unblock"
status: in-development
kind: "minor"
patch-of: ""           # optional — when kind is "patch": id of the released minor it patches, e.g. "minor-v0.2"
version: "v0.2"
pillar: "G"             # REQUIRED — primary feature area of docs/01_vision/06_features.md this wave centers on
features: [T1, T4, S5, S7, G2, G3, G4, C2, C4, Y1, Y2, Y3, Y4]           # REQUIRED — feature IDs covered by this release (from 06_features.md)
wingfoil_min: "0.2.2"       # minimum WingFoil CLI version this release needs, e.g. "0.2.2"
requirements: "docs/03_backlog/04_backlog/by-release/v0.2.json"       # REQUIRED — path to per-release backlog JSON, e.g. "docs/03_backlog/04_backlog/by-release/v0.1.json"
release-line: "v1"
tmpl_version: 260929   # Orignal template version
---

## Scope

The human-on-the-loop core — **first usable release**: Today (Requires you, waiting on others, all-roles summary), in-app notifications, the gate footer with every outcome, submit, action feedback, identity and *How to join*, UI settings, and git sync (repository status, fetch, push, fast-forward update).

- Features (13 features, `07_sequencer.md` v0.6): T1, T4, S5, S7, G2, G3, G4, C2, C4, Y1, Y2, Y3, Y4.
- Journeys served: J0 (complete), J1 (complete), J4 (gate — reviewers holding `approver`; informational otherwise), J5, J6 step 3, J8.
- Browsers: the e2e suite extends from Chromium (v0.1) to Firefox and WebKit (REQ-INT-08, staged by
  release-planning v0.1).
- Backlog: `docs/03_backlog/04_backlog/by-release/v0.2.json` — 34 user stories,
  12 technical tasks; the Memory `task` elements are created from it by
  this release's `release-planning` (`ref:` = backlog id).

## Pillar Focus

**G — Unblock.** Deciding gates in two clicks is the core value for the primary persona Morgan (J1); it lands as early as the WingFoil floor allows (sequencer rule 3), and from this release the WingFoil UI repository is run from the UI (rule 5).

## Success Criteria

Exit criteria of `07_sequencer.md` v0.6:

- a member holding `approver` passes a gate from Today in ≤ 2 clicks, with the `wf(…)` commit shown and pushed;
- a reviewer without `approver` sees the gate as informational, with who can act (sequencer rule 6);
- actions are blocked on elements with local changes and while the copy is behind;
- the WingFoil UI project's own gates are passed from the UI (dogfooding, REQ-SEC-10).

Bars common to every release (`08_mvp-canvas.md`, SARD v0.3):

- every scenario of `docs/02_requirements/02_bdd/` tagged `@v0.2` passes in the e2e suite;
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

Actual effort per phase (dl-006 action 6; wall-clock of the working sessions, 2026-10-12 on):

| Phase | Plan | Sessions | Effort |
|-------|------|----------|--------|
| Governance alignment (pre-step) | `governance-alignment-rel-v0.2-plan` | 2026-10-12 10:05–11:00 | ~1 h |
| release-planning | `release-planning-rel-v0.2-plan` | sessions 1–4 2026-10-12 11:00–20:00 (wall-clock, incl. waits; sessions 3–4 from 19:20) | ~9 h wall-clock, 1 active day |
| implementation — Wave 0 (task-026, task-028, task-027) | `dev-loop-rel-v0.2-plan` session 1 | 2026-10-12 23:30 – 2026-10-13 15:20 (overnight pause) | ~9 h working time, 1 active day |
| implementation — Wave 1 (task-030, task-031, task-035) | `dev-loop-rel-v0.2-plan` session 2 | 2026-10-13 15:56 – 2026-10-14 09:55 (overnight pause) | ~8 h working time, 1 active day |
| implementation — Wave 2 (task-032, task-036) | `dev-loop-rel-v0.2-plan` session 3 | 2026-10-14 13:20 – 23:15 (interruption ~2 h) | ~8 h working time, 1 active day |
| implementation — Wave 3 (task-033, task-037) | `dev-loop-rel-v0.2-plan` session 4 | 2026-10-15 08:50 – 16:05 (a crash of ~10 min) | ~7 h working time, 1 active day |
| implementation — Wave 4 (task-034, task-042) | `dev-loop-rel-v0.2-plan` session 5 | 2026-10-15 17:45 – 2026-10-16 17:15 (pauses, a reboot) | ~11 h working time, 1 active day |
| implementation — Wave 5 (task-038, task-039, task-041) | `dev-loop-rel-v0.2-plan` session 6 | 2026-10-16 19:25 – 2026-10-17 14:25 (overnight pause) | ~10 h working time, 1 active day |
| implementation — Wave 6 (task-040, task-029) | `dev-loop-rel-v0.2-plan` session 7 | 2026-10-17 15:05 – 2026-10-18 19:50 (overnight pause) | ~14 h working time, 1 active day |
| release validation — user-docs, e2e-smoke (task-043) | `user-docs-rel-v0.2-plan`, `e2e-smoke-rel-v0.2-plan` | 2026-10-18 20:10 – 2026-10-19 19:31 (overnight pause) | 1 active day (the 9th) |
| release validation — submit pre-step (three dry runs, task-044, task-045) | `release-submit-rel-v0.2-plan` session 1 | 2026-10-19 19:35 – 2026-10-20 19:56 (overnight pause; waits for the CI runs and the slot) | 1 active day (the 10th) |

- 2026-10-12 — `release-planning-rel-v0.2-plan` sessions 1–2 (branch `design/release-planning_v0.2`).
  `advance-pinned-build` no-op (0.2.2 newest); `minor-v0.2` `draft → planning` (`4c8ead3`);
  `triage-bugs`, `reconcile-governance` empty; no ADR. Load: all 46 backlog records kept, budget
  5 → 8 active days (sequencer v0.7, RP-8); spec-002 §4 incremental parse moved to v0.3 (RP-9).
  `identify-specs`: one uncovered artefact — spec-010 git sync (approved `1fcedfb`) — and
  amendments of spec-001/002/003/004/006/007, adr-001 D5/D7, SARD 0.11, BDD G-14.2, directive
  `cli-only-writes` 1.6 (RP-10 … RP-41); independent spec review PASS at round 3 (FAIL 2 major/10
  minor, FAIL 2 minor, PASS). Governance/technical tasks for build-backlog: load-independent tests
  with bug-008, public-text check, npm publishing pipeline (RP-3, RP-11).
- 2026-10-12 — `build-backlog` (plan session 3): 17 tasks `task-026` … `task-042` (4 governance —
  026 load-independent tests absorbing bug-008, 027 e2e on Firefox and WebKit, 028 public-text
  check, 029 npm publishing pipeline — 5 server, 8 web) cover the 46 backlog records exactly once
  (`check_tasks.py v0.2`); all `pending`. bug-008 `triaged → planned` (`c01d13f`); dl-006 stamped
  `v0.2`. Surprise: `memory add` numbers tasks per folder (`wingfoil-cli` W-27); the first run
  (`task-001` … `017`) was dropped from the branch history at the approver's request and redone
  as `task-026` … `042`.
- 2026-10-12 — `commit-backlog` gate (plan session 4): independent audit round 1 FAIL (3 major —
  ids shifted by the renumbering in the plan, G-13.2 closable only after task-040, missing
  dependencies on task-035 — 7 minor, 7 nits); decisions RP-52 … RP-55 (G-13.2 split closure,
  fetch-interval scenarios at 15 s in `test:e2e`, npm publishing as WingFoil's two-gate staged
  pipeline, append-only shell and merge order).
- 2026-10-12 — audit round 2 FAIL (3 minor: Y-05.2 added to RP-53 with the approver's OK, plan
  version, effort table), round 3 PASS (`4c13e9d`). The approver approved the 17 tasks into
  `backlog`; release `planning → in-development` by hand (W-25). Planning took 1 active day
  (2026-10-12) of the v0.2 budget of 8.

### Implementation (dev-loop, per task)

<!-- Recurring blockers across tasks, tech-specs revised mid-release, review rejections and why,
     anything that deviated from the plan in Scope/Pillar Focus above. -->

- 2026-10-13 — Wave 0 (`dev-loop-rel-v0.2-plan` session 1): task-026, task-028, task-027 done;
  review rounds 2, 3, 2 (task-026 also an adversarial security review, PASS). bug-008 resolved
  (task-026), bug-009 ingested and resolved (task-027), bug-010 ingested and planned into task-033.
  Deviation: e2e on three engines only at wave gates and release validation; tasks run Chromium
  plus their own specs on three engines (W0-9, cost-driven). `test:timing` not yet run on `main`
  (load).
- 2026-10-14 — Wave 1 (`dev-loop-rel-v0.2-plan` session 2): task-030, task-031, task-035 done; 2
  review rounds each. Approved specs amended in place: spec-006 §2/§4, spec-004 §3, spec-003 §5,
  spec-008 §6; UX reference 1.1 (*How to join*). `test:timing` passed on `main` at low load
  (2026-10-13).
- 2026-10-14 — Wave 2 (`dev-loop-rel-v0.2-plan` session 3): task-032, task-036 done; review rounds
  3 each (task-032 also an adversarial security review, 3 rounds). bug-011 ingested and resolved
  (task-036). WingFoil feedback F-023 … F-026. Open point: CLI refusal texts quoting the
  repository's absolute path (became bug-012).
- 2026-10-15 — Wave 3 (`dev-loop-rel-v0.2-plan` session 4): task-033, task-037 done; review rounds
  4 and 3 (task-033 also an adversarial security review, 3 rounds). bug-010 resolved; bug-012 and
  bug-013 (a v0.1 clone could run an `ext::` command through `GIT_ALLOW_PROTOCOL`) ingested,
  absorbed into task-033 and resolved. Approved specs amended in place: spec-010, spec-004 §5,
  spec-006 §3, spec-003 §6, adr-001 D6; UX reference 1.3. Budget: 5 of 8 active days used.
- 2026-10-16 — Wave 4 (`dev-loop-rel-v0.2-plan` session 5): task-034, task-042 done; review rounds
  5 and 4 + a confirmation round (task-034 also an adversarial security review, 5 rounds). bug-014
  and bug-015 ingested, absorbed and resolved. Deviation: the automatic update's value guards were
  removed and its risk declared instead (W4-16; a retrospective question). Approved specs amended
  in place: spec-010, spec-004 §5, adr-001 D5; UX reference 1.4. Budget: 6 of 8 active days
  used.
- 2026-10-17 — Wave 5 (`dev-loop-rel-v0.2-plan` session 6): task-038, task-039, task-041 done;
  review rounds 4, 3 and 2 + a confirmation round. bug-016 (a token pasted into an open tab is
  not read) ingested, to triage. Deviation: every heavy gate
  waited for a machine-free slot shared with another project's worktrees (approver's rule); the
  D38-1 live regions carry no `status`/`alert` role (approved). Approved specs amended in place:
  spec-009 §1; UX reference 1.7. Budget: 7 of 8 active days used.
- 2026-10-18 — Wave 6 (`dev-loop-rel-v0.2-plan` session 7): task-040, task-029 done — every v0.2 task done;
  review rounds: task-029 2; task-040 5 independent + 5 adversarial security (approver's extension of RP-47).
  bug-016 and bug-017 (ingested during task-040's security review) resolved by task-040. Deviations: Push
  shown whatever auto-push says (UX reference 1.8); Y-08.1 reworded (BDD conventions 0.10); root
  `package.json` no longer `private` (publish pipeline, dl-004 follow-up). Approved specs amended in place:
  spec-010 §4. Budget: 8 of 8 active days used; release validation on a 9th (overrun accepted by the
  approver).
- 2026-10-18 — implementation complete: 17/17 tasks `done`; `dev-loop-rel-v0.2-plan` finalized
  (`e692674`); last gate on `main` `33ab602`: `test:e2e` three engines 908 passed, `test:coverage`
  3193 passed / 1 skipped, `test:smoke` 4/4, `test:publish-smoke` 11/11, `test:timing` repeated alone.
  Three test-only governance tasks (`module: governance`, `ref: GOV`) followed at release validation:
  task-043 (e2e-smoke gaps), task-044 (test harness git identity) and task-045 (sanitiser test
  independent of the git version) — see *E2E smoke* and *Submit & Publishing* below. Recurring
  blockers across waves: machine load from another project's gates (the machine-free slot from Wave
  5 on); security review rounds on the server write tasks (3–5 rounds each on task-032, task-033,
  task-034, task-040) finding new bypasses of git-URL and tool-text handling. No change to Scope or
  Pillar Focus recorded.

### User docs (user-docs)

<!-- check-implementation-complete, align-user-docs, align-agent-docs: documents produced,
     review rounds, accepted deviations and spec-vs-code differences found. -->

- 2026-10-18 — `user-docs-rel-v0.2-plan` (branch `design/user-docs_v0.2`); release-validation
  decisions RV2-1 … RV2-8 (user-docs and e2e-smoke in one session, submit and publishing together on
  `main`; bug closes at the end of e2e-smoke; heavy gates through the machine-free slot; the
  registry checklist and a `workflow_dispatch` dry run before submit; v0.2 on npm as `0.2.0` if the
  checklist is complete; no Actions run without the approver's OK). 17/17 tasks `done`,
  `check_tasks.py v0.2` and `check_releases.py` OK; `npm audit --omit=dev` 0, full audit 9 = the
  accepted dev-only list.
- 2026-10-18 — the user guide 0.16 (v0.2 as a whole, known limitations of v0.2), CLI reference 0.3
  (command line unchanged since `v0.1.0`), `README.md`, `CHANGELOG.md` `[Unreleased]` (Added,
  Changed, Fixed, Security, Known limitations), `CLAUDE.md` 0.6; `.wingfoil/README.md` unchanged
  (dl-025 comparison: 214 checks, 0 errors). Independent review round 1 FAIL (1 major: auto-push
  described as pushing only the action's own commit; 4 minor; 5 nits), round 2 FAIL (1 minor, 2
  nits), round 3 PASS. Decisions UD2-1 … UD2-8; UD2-6 `docs/examples/` N/A (accepted deviation, as
  UD-5 of v0.1); UD2-7 spec-007 §1/§3/§6 differences (docs follow the code) amended by a governance
  task after v0.2. Gates approved; plan finalized `0867cb0`, merged `5a53911`.

### E2E smoke (e2e-smoke)

<!-- Mapping of e2e-smoke.yaml onto the suites, gaps and their tasks/bugs, smoke run results,
     bug re-checks and closures, staged-gate outcome. -->

- 2026-10-18 — `e2e-smoke-rel-v0.2-plan` (branch `design/e2e-smoke_v0.2`); mapping on `70d28dc`:
  the 93 `@v0.2` scenario ids each in an e2e test title; gaps G1–G5. Decisions ES2-1 … ES2-4: bugs
  closed from the console (G1, REQ-SEC-10); G2–G5 to task-043; accepted gaps recorded (ES2-3).
- 2026-10-19 — task-043 (design decisions D43-1 … D43-10; commit-provenance e2e check of a UI
  session, G-04.1 with auto-push, Reject and Cancel by keyboard, Submit blocked while behind).
  bug-018 (the focus after Cancel from Today went to the main region) found at its design, absorbed
  as AC-7 and fixed in `web/src/today/`. Review round 1 FAIL (2 minor), round 2 FAIL (1 minor), round
  3 PASS. Merged into the phase branch `39ac65c`, done `b286ab9`.
- 2026-10-19 — smoke run on `b286ab9` (in series through the slot): light checks ✓, local-security
  251/251, `test:contract` 263 passed / 1 skipped, `test:coverage` 3213 passed / 1 skipped (96.58 %
  statements), `test:e2e` 935 passed (Chromium 319, Firefox 308, WebKit 308; 59.8 min at load
  11–19), `test:smoke` 4/4, `test:publish-smoke` 11/11 — gate green (hard-reject).
- 2026-10-19 — bugs closed: close notes and `release: "v0.2"` on bug-009 … bug-017 (`2e69b69`);
  from the console the approver closed bug-008 … bug-014 and bug-016 (8 `wf(bug)` commits; a mistaken
  reject of bug-016, never pushed, removed with `git reset --keep` at the approver's request).
  bug-015, bug-017, bug-018 answered *not found* → bug-019 (an element id over 100 characters
  matches no route: Fastify's default `maxParamLength`), triaged medium, fix in v0.3, a known
  limitation of v0.2 (user guide 0.19, CHANGELOG `77d60ba`); the three closed with the CLI.
  `action-log-ratio.mjs`: 8/12 (66.7 %) decisions in the action log. Gate approved; plan finalized
  `fc0be06`, merged `08a84db`.

### Submit & Publishing

<!-- pre-release-checks failures and fixes, approve-release rejections, publishing issues. -->

- 2026-10-19 — `release-submit-rel-v0.2-plan` on `main` (RV2-1). Pre-step: the approver's registry
  checklist (`docs/publishing.md`) steps 1–3 done; step 4 — npmjs.com offers no trusted publisher for
  a name with no version, so `0.2.0` is published by hand by the approver from the tag run's smoked
  tarball (no provenance for that version), steps 5–6 after it.
- 2026-10-19 — first `workflow_dispatch` dry run (run `39315562583` on `08a84db`, the repository's
  first CI run): `gate` failed at *Tests with coverage* — 61 tests, "Author identity unknown" (the
  runner's account has no full name) → bug-020; the design of task-044 found a second cause, git ≥
  2.48 creating `refs/remotes/<remote>/HEAD` on fetch → bug-021. Both absorbed into task-044 (review
  round 1 FAIL, round 2 PASS), merged `891aab5`, done `f73294e`.
- 2026-10-19 — second dry run (run `39328350689` on `f73294e`): one test relied on git 2.43's
  quoting of a `gitdir:` path (git 2.55 prints `(null)`) → bug-022, absorbed into task-045 (review
  PASS), merged `547714f`, done `c22d847`. Local `test:coverage` timed out three times at load 20–26
  (`auto-sync.test.ts` RP-36) → bug-023 (test-only, low, fix in v0.3); the approver accepted the
  third dry run as task-045's AC-3 evidence.
- 2026-10-20 — third dry run (run `39451186680` on `c22d847`) green: `gate` (Node 22.22.2)
  `test:coverage` 3220 passed / 1 skipped, `test:smoke` 4/4, `npm pack` (587 057 bytes); `stage`
  (Node 22.12.0) `test:publish-smoke` 11/11; `promote` skipped (dispatch). bug-020 … bug-022 closed
  with the CLI. Open for v0.3: bug-019 and bug-023, `release: "v0.3"`.
