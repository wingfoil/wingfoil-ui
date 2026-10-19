---
id: e2e-smoke-rel-v0.2-plan
type: plan
title: "E2E smoke rel-v0.2"
status: active
version: "0.2"         # optional — plan version
workflow: "e2e-smoke"
phase: "rel-v0.2"
scope: "rl-v1/rel-v0.2"
element: "minor-v0.2" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.2"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.2 · **Date:** 2026-10-19 (0.1: plan created, mapping, decisions ES2-1 … ES2-4; 0.2: Session 1 log — task-043, smoke green, bugs closed, bug-019; inputs for the retrospective)
**Branch:** `design/e2e-smoke_v0.2` (merged to `main` with `--no-ff` at the end, on the approver's OK)
**Workflows:** `sw-life-cycle` → `release-line-cycle` (`rl-v1`) phase `delivery` → `release-cycle`
(`minor-v0.2`, v1.1) phase `e2e-smoke` = `e2e-smoke` (`.wingfoil/workflows/custom/e2e-smoke.yaml`
v1.0); task-043 through `dev-loop` v1.4
**Roles:** qa (every smoke step), developer / reviewer (task-043), approver (gates) — Roberto
Pompermaier holds all of them; the agent runs the suites, develops task-043 through a developer
agent and runs the independent reviews (no approval authority)
**Input:** release `docs/04_memory/planning/v1/minor-v0.2.md` (`in-development`, success criteria);
`user-docs-rel-v0.2-plan` (`done`, merge `5a53911`; decisions RV2-1 … RV2-8, UD2-1 … UD2-8);
`e2e-smoke-rel-v0.1-plan` (the v0.1 run: ES-1 … ES-17, first green run of the staged gate);
`test/README.md`; bug-008 … bug-017 (`resolved`)
**Evidence:** the dev-loop's last gate on `main` `33ab602` (`dev-loop-rel-v0.2-plan` Session 7:
`test:e2e` three engines 908 passed, `test:coverage` 3193 passed / 1 skipped, `test:smoke` 4/4,
`test:publish-smoke` 11/11, `test:timing` repeated alone); no file under `server/`, `web/`,
`contracts/`, `test/`, `package.json` or `playwright.config.ts` changed since

Why now: `user-docs` is done; `release-cycle` v1.1 runs `e2e-smoke` before `submit`. Since the first
green run of v0.1 (ES-7) the gate **hard-rejects**: a failed step blocks `release-submit`.

Preconditions:
- `npm run -s wingfoil -- --version` prints `0.2.2`, the version `package.json` pins for `wingfoil`.
- `user-docs-rel-v0.2-plan` is `done` and merged.

Produces: task-043 `done`; the smoke report of every step below after the merge of task-043; bug-008 … bug-017 `closed`, decided from the console (ES2-1); the approver's OK on the
gate.

## Phases / Steps

### Mapping of `e2e-smoke.yaml` onto this repository (v0.2)

Read-only mapping on `70d28dc`; every `@v0.2` scenario id of `docs/02_requirements/02_bdd/features/`
(93) appears in an e2e test title under `test/e2e/`.

| Step | Command / suite | Covers | Gap |
|------|-----------------|--------|-----|
| fixture-project | `test/harness/fixtures/` (`buildFixture`; kinds `kanban` — `init --template Kanban`, `custom` — this repository's `.wingfoil/`, `unknown` — hand-written types and states, no `ui.yaml`; `scrum` — `init --template Scrum`; `large`; team; CLI variants), checked by `test/harness/fixtures.test.ts`; `test/contracts/descriptor-contract.test.ts` (every outcome the descriptor offers is accepted by the CLI, three kinds) | the standard element states of the BDD conventions; further states created with the CLI on copies by the specs | coverage of every state by convention only; Scrum and `unknown` have no write from the UI (accepted, ES2-3) |
| drive-browser | `npm run test:e2e` (Chromium, Firefox, WebKit; `@perf` on Chromium only) | Today, gate footer, submit footer, toasts, How to join, bell, git status, Update/Push, UI settings, read views; HEAD subject `wf(…)` after each UI write (`lastCommitSubject`); refusals on local changes (G-11.x) and while behind (G-12.x); reviewer and product-owner without `approver` (G-09.x, T-06.x); `no-commit.spec.ts` (a read-only session over the 27 screens changes nothing). v0.2 makes no `chore(ui)` commit (no `ui.yaml` write before v0.3). Server side: `element-writes.test.ts` (exactly the action's own commit, only the element file), `governed-verbs.test.ts` | no session-wide check of every commit after UI writes (G2); success criterion 1 proved by separate tests (G3); Submit while behind not tested in the UI (G5) → task-043 |
| local-security | `npx vitest run test/launcher/local-security.test.ts test/launcher/launcher.test.ts test/server/http/guards.test.ts test/server/http/element-writes.test.ts` | loopback only (REQ-SEC-01, X-03.1/X-03.2 — X-03.2 skips without an external IPv4), session token, Origin/Host/`Sec-Fetch-Site`, Files confinement, path ids on the write routes; rows for the v0.2 routes (governed writes, fetch/update/push, settings, Today, memory events, role view) | no route-inventory test (accepted, ES2-3) |
| accessibility | `npx playwright test test/e2e/accessibility.spec.ts` (also in `test:e2e`) | axe 0 serious/critical on the 27 `SCREENS` (16 of v0.1, 11 of v0.2) in both themes, plus per-spec scans of variant states; keyboard: X-06.2 (Today → Approve), Submit, Update/Push, bell, settings | Reject and Cancel not walked by keyboard (G4) → task-043 |
| contract | `npm run test:contract` | CLI JSON contract, `wingfoil_min` 0.2.2 … pinned 0.2.2 (`contracts/matrix.json`); API schemas of v0.2 | — |
| launch | `npm run test:smoke`; `npm run test:publish-smoke` | the installed tarball starts, serves the UI and the API, clones without hooks, stops cleanly; publish to a local registry and install by name | the installed package makes no governed write (accepted, ES2-3) |
| gate | this plan's report | hard-reject (ES-7 of v0.1) | — |

Release success criteria (`minor-v0.2.md`):

| Criterion | Evidence | Gap |
|-----------|----------|-----|
| a member holding `approver` passes a gate from Today in ≤ 2 clicks, with the `wf(…)` commit shown and pushed | G-04.1 (two clicks), G-13.1 (commit and *pushed* in the toast), Y-07.3 | one test from Today with auto-push on (G3) → task-043 |
| a reviewer without `approver` sees the gate as informational, with who can act | G-09.1, G-09.3, T-06.1, T-06.2 | — |
| actions blocked on local changes and while behind | G-11.1 … G-11.3, G-12.1 … G-12.3; server tests | Submit while behind in the UI (G5) → task-043 |
| this project's own gates passed from the UI (REQ-SEC-10) | none yet: every approve and reject of v0.2 ran on the CLI | G1 → the bug closes from the console (ES2-1) |
| every `@v0.2` scenario passes; axe 0 serious/critical; contract tests | step table above | — |

### Steps

| # | Step | Role | Output | Stop-check |
|---|------|------|--------|------------|
| 1 | This plan; task-043 (`add` with W-27 placeholders, fields by hand, `submit`; the approver's approve → `backlog`) | qa, approver | plan `active`; task-043 `backlog` | `check_tasks.py v0.2` OK |
| 2 | task-043 through `dev-loop`: worktree `.worktrees/task-043-…`, developer agent (rules `.notes/dev-rules.md`), design checkpoint with numbered decisions D43-n, red-first tests, independent review until PASS, the approver's gates; task transitions on `design/e2e-smoke_v0.2` (the task file lives there), merge of the task branch into it (`--no-ff`), push; `main` receives it with the phase merge | developer, reviewer, approver | task-043 `done` | its gates green |
| 3 | Smoke run after the merge of task-043, on `design/e2e-smoke_v0.2` (the code of `main` plus task-043's tests; `main` merged into it first if it moved), every heavy step through the machine-free slot, in series: light checks (`typecheck`, `lint`, `format:check`, `docs:api`, `check_tasks.py v0.2`, `check_releases.py`), local-security, `test:contract`, `test:coverage`, `test:e2e` (three engines; includes accessibility), `test:smoke`, `test:publish-smoke` | qa | smoke report in Session log | every step green (hard-reject) |
| 4 | Close bugs from the console (ES2-1): close notes and `release: "v0.2"` on bug-009 … bug-017 committed first (RV2-2); the agent starts the console on this repository's checkout (branch `design/e2e-smoke_v0.2`, pushed, so its commits reach `main` with the merge); the approver approves each bug from its element panel; the agent records the `wf(bug): approve …` shas and the output of `scripts/action-log-ratio.mjs` | tech-lead, approver | bug-008 … bug-017 `closed`; REQ-SEC-10 evidence | ten `wf(bug)` commits in the action log |
| 5 | Gate: report, the approver's OK; plan finalized (separate commit); merge `design/e2e-smoke_v0.2`; push | approver | plan `done` | the approver's OK |

### Decisions taken at the start (2026-10-18, approver: "tutto come consigliato")

- ES2-1 G1 (dogfooding, REQ-SEC-10, a success criterion of the release): bug-008 … bug-017 are
  closed by the approver **from the WingFoil UI console** opened on this repository, not with
  `memory approve` on the CLI; the shas and the `action-log-ratio.mjs` output are recorded here. The
  SARD fit criterion (≥ 80 % of approve/reject commits in the action log between v0.2 and v0.3) is
  measured at the v0.3 retrospective.
- ES2-2 G2–G5 go to a test-only governance task **task-043** (`module: governance`, `ref: GOV`, as
  task-025 in v0.1): a session-wide commit-provenance e2e test after UI writes (G2); G-04.1 with
  auto-push on, asserting the commit shown, *pushed* and the remote head (G3); Reject and Cancel of
  the gate footer by keyboard (G4); Submit blocked while the copy is behind, in the UI (G5). Full
  dev-loop; W-27 placeholders so it is numbered after task-042.
- ES2-3 Accepted, recorded for the retrospective: fixture coverage of every state by convention;
  no UI write on the Scrum and `unknown` fixtures; no product-owner holding `approver` test; no
  route-inventory test for local-security; the installed package makes no governed write; the
  commit author is never asserted (e2e identities set only `user.email`). The local-security
  command now includes `launcher.test.ts` and `element-writes.test.ts`.
- ES2-4 Order: plan → task-043 → smoke run on `main` (step 3) → bug closes from the console → gate.
  No separate bug-004 re-check under load (v0.1 RV-4): every v0.2 wave gate ran the full suites at
  load 15–29 without timeouts.

## Handoff

- **Approver:** the approvals of task-043, its design decisions, the bug approvals from the console,
  the gate, the plan finalization and the merges.
- **Agent:** task-043 through a developer agent and independent reviews, hand transitions (W-20,
  W-26), suites through the slot, the console for step 4, Session log, commits, push after each
  merge.
- **Completion:** every smoke step green on the code of `main`; bugs closed from the console; plan `done`; branch
  merged and pushed. Next: the approver's registry checklist (RV2-4) and the `workflow_dispatch` dry
  run (RV2-5), then `submit` + `publishing` (RV2-1).

## Session log

<!-- One entry per session: date, decisions taken, deviations from this plan. -->

### Session 1 — 2026-10-18 – 2026-10-19

- Plan created (`70d28dc` add, `6885e32` submit → `active`); mapping read-only on `70d28dc` (93
  `@v0.2` scenario ids, each in an e2e test title); decisions ES2-1 … ES2-4 at the start.
- **task-043** (test-only governance task, ES2-2; W-27 placeholders named like elements, see
  *For the retrospective*): add `a6d8dd7`, submit `e6082ce`, approve → `backlog` `a1ae4ad`,
  `in-progress` `7de04dd`; worktree `.worktrees/task-043`, developer agent. Design `54ee570`:
  decisions D43-1 … D43-9 (the approver: "as recommended") — the CLI's two full subject forms,
  the remote's commits excluded by ancestry, the kanban session order, the sidebar's Fetch, the
  focus after Cancel returned to the Today opener (D43-5 (a): the current `#main` is a defect →
  **bug-018**), Jordan on `task-004` for AC-4, a harness checker with a self-test, `.git/index`
  covered by `git status`, tests next to their sibling scenarios.
- **bug-018** (the focus after Cancel from Today goes to the main region): add `966b873`, submit
  `9bf9684`, triaged by the approver `a751253` (low), `planned` `01fdc84` and `in-progress`
  `e79a6f1` by hand — absorbed into task-043 as AC-7; `design/e2e-smoke_v0.2` merged into the
  task branch (`7962c89`).
- task-043 implementation: AC-1 `test/e2e/commit-provenance.spec.ts` with
  `test/harness/commit-provenance.ts` (11 self-test cases); AC-2 G-04.1 with auto-push; AC-3
  Reject and Cancel by keyboard; AC-4 Submit blocked while behind; AC-7 red first (`dd46038`),
  fix `c5397fe`. Independent review: round 1 FAIL (2 minor — only the Today action returned the
  focus while the docs promised every opener; `test/README.md` incomplete; 4 nits) → D43-10
  (coordinator: the title link, the *Waiting on others* links and, round 2, the summary items
  record their opener too); round 2 FAIL (1 minor — the summary items; 1 nit — version bumps);
  round 3 **PASS** (2 nits: a circular import between `RoleSummary.tsx` and `TodayView.tsx`
  accepted as a follow-up, a CHANGELOG wrap fixed). Gates of the task: `test:coverage` 3213 passed
  / 1 skipped, `test:e2e:chromium` 319, own specs on three engines 144–210. Submit `9c64864`
  (task), `d548298` (bug-018); approver: `8094c91` (task → `approved`), `729a63d` (bug-018 →
  `resolved`); merged into `design/e2e-smoke_v0.2` `39ac65c`, `done` `b286ab9`; worktree and branch
  removed. UX reference 1.10 §4.2, user guide 0.18, `test/README.md` 0.44, CHANGELOG *Fixed*.
- **Step 3 — smoke run on `b286ab9`** (2026-10-19 17:08–18:52, in series, every heavy step through
  the machine-free slot; logs in the session scratchpad): light checks (`typecheck`, `lint`,
  `format:check`, `docs:api`, `check_tasks.py v0.2` 18 tasks, `check_releases.py`) ✓ ·
  local-security (`local-security.test.ts`, `launcher.test.ts`, `guards.test.ts`,
  `element-writes.test.ts`) **251/251** · contract `test:contract` **263 passed, 1 skipped** ·
  `test:coverage` **3213 passed, 1 skipped** (statements 96.58 %, branches 91.42 %) · fixture-project
  + drive-browser + accessibility `test:e2e` **935 passed** (Chromium 319, Firefox 308, WebKit 308;
  0 flaky; 59.8 min at load 11–19) · launch `test:smoke` **4/4**, `test:publish-smoke` **11/11**. No
  console, registry or `wfui-*` entry left. After `b286ab9` only documents and Memory files changed.
- **Step 4 — bugs closed** (ES2-1, RV2-2): close notes and `release: "v0.2"` on bug-009 … bug-017
  (`2e69b69`). The console (code of `b286ab9`, run from a separate worktree) on this repository:
  the approver approved bug-008 … bug-014 and bug-016 from the element panel (`54ef033`,
  `40f68c5`, `ee38579`, `c2484c9`, `94fc101`, `acd7720`, `eae29a3`, `d10465c`). A reject of
  bug-016 made by mistake (`36917f3`, never pushed) was removed with `git reset --keep` at the
  approver's explicit request (an exception to the no-rewrite rule). bug-015, bug-017 and bug-018
  answered *not found*: **bug-019** (an element id longer than 100 characters matches no route —
  Fastify's default `maxParamLength` — so its panel, history and writes answer 404) ingested
  (`0916bad`, `c2bd718`), triaged by the approver (`c784652`, medium); fix planned for v0.3
  (approver), known limitation of v0.2 (user guide 0.19, CHANGELOG, `77d60ba`). bug-015, bug-017,
  bug-018 closed with the CLI (`0c8dee1`, `b6540cf`, `c89ee99`; close notes `2f9e767`).
  `node scripts/action-log-ratio.mjs --state <the console's state file> 2e69b69..HEAD`: **8/12
  (66.7 %)** in the action log; the four others are the CLI approvals forced by bug-019.
  REQ-SEC-10 (this project's own gates passed from the UI) shown for v0.2; its ≥ 80 % fit criterion
  is measured at the v0.3 retrospective.
- **Step 5 — gate:** every step of `e2e-smoke.yaml` green on `b286ab9` (hard-reject gate, ES-7 of
  v0.1). Approved by the approver (2026-10-19).
- **Next:** the approver's registry checklist (RV2-4) and the `workflow_dispatch` dry run on `main`
  (RV2-5, on the approver's OK), then `submit` + `publishing` (RV2-1).

### For the retrospective of `minor-v0.2` (recorded 2026-10-18)

- **Adoption of the WingFoil-Templates base pack** (approver, 2026-10-18): WingFoil v0.3 is expected
  within a day and the `base` pack right after it. v0.2 is validated and released on the pinned
  `wingfoil@0.2.2` with `.wingfoil/` unchanged (alignment only between releases, on the pinned
  release). Proposal for the retrospective: a governance-alignment pre-step before the
  `release-planning` of v0.3 — advance the pin to WingFoil 0.3 (`advance-pinned-build`, only with the
  contract tests green on 0.3; the product's `wingfoil_min` may stay 0.2.2 with 0.3 added to the
  matrix), adopt `base` on `.wingfoil/` with dl-008's tailoring re-applied on top, re-check the
  directive `wingfoil-cli` against 0.3 (e.g. W-27, fixed after 0.2.2), independent review, the
  approver's OK. Preconditions: the WingFoil `v0.3.0` tag, a tagged `base` pack, and the pack
  catalogue's `compat.yaml` listing 0.3 with `pack-install`; if one is missing at v0.3 planning, or
  0.3 has a blocking defect, the adoption moves to the preparation of v0.4. Accepted risk: first
  adopter of both, with feedback to WingFoil and to the pack catalogue.
- **bug-019 found by dogfooding:** the first decisions taken from the console on this repository
  found a defect no test had seen (fixture ids are short); a fixture element with a long id is a
  candidate test-data rule.
- **task-043 follow-up:** move `rememberOpener` and its state to a small `web/src/today/opener.ts`
  (the circular import accepted at review round 3).
- **W-27 workaround wording:** the placeholders must be named like elements (`task-<n>-….md`);
  other file names are not counted (a first `memory add` of task-043 gave `task-018`, reset before
  any push). The directive's workaround text to be made precise.
