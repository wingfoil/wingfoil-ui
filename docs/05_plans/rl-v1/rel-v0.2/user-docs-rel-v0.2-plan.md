---
id: user-docs-rel-v0.2-plan
type: plan
title: "User docs rel-v0.2"
status: active
version: "0.2"         # optional — plan version
workflow: "user-docs"
phase: "rel-v0.2"
scope: "rl-v1/rel-v0.2"
element: "minor-v0.2" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.2"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.2 · **Date:** 2026-10-18 (0.1: plan created, release-validation decisions RV2-1 … RV2-8; 0.2: Session 1 log)
**Branch:** `design/user-docs_v0.2` (merged to `main` with `--no-ff` at the end, on the approver's OK)
**Workflows:** `sw-life-cycle` → `release-line-cycle` (`rl-v1`) phase `delivery` → `release-cycle`
(`minor-v0.2`, `.wingfoil/workflows/custom/release-cycle.yaml` v1.1) phase `user-docs` =
`user-docs` (`.wingfoil/workflows/custom/user-docs.yaml` v1.1; dl-013 hard release blocker,
dl-025 agent-facing docs)
**Roles:** tech-lead (check-implementation-complete), developer (align-user-docs), architect
(align-agent-docs), approver (gates) — Roberto Pompermaier holds all of them; the agent drafts the
documents and runs the independent reviews (no approval authority)
**Input:** release `docs/04_memory/planning/v1/minor-v0.2.md` (`in-development`); tasks
`docs/04_memory/v0.2/task-026` … `task-042` (`done`); plan `dev-loop-rel-v0.2-plan` (`done`, v0.8 —
Session 1–7 logs: decisions W0-1 … W6-7, accepted deviations, declared residuals, open points);
bug-008 … bug-017 (`resolved`); tech-specs `spec-001` … `spec-010` (amended in place during v0.2);
ADRs `adr-001`, `adr-002`; `README.md`, `docs/user-guide.md` (0.15), `docs/cli-reference.md` (0.2),
`CHANGELOG.md` (`[Unreleased]` filled by the tasks), `docs/publishing.md` (0.2), `CLAUDE.md` (0.5),
`.wingfoil/README.md` (0.3)
**Evidence:** `user-docs-rel-v0.1-plan` (the v0.1 run of this phase: RV-1 … RV-10, UD-1 … UD-10);
the previous session's handoff (end of Wave 6, 2026-10-18); directives `wingfoil-cli` v1.12,
`cli-only-writes`, `claim-evidence`, `documentation`, `doc-versioning`

Why now: the implementation phase is complete (every v0.2 task `done`, `dev-loop-rel-v0.2-plan`
finalized in `e692674`, `main` pushed). `release-cycle` v1.1 runs `user-docs` before `e2e-smoke`
and `submit`; it blocks the release (dl-013). In v0.2 the tasks updated the user guide and the
CHANGELOG with each change (directive `documentation`); this phase checks the whole set against
the shipped surface instead of writing it from scratch as v0.1 did.

Preconditions (checked 2026-10-18 on `e692674`):
- `npm run -s wingfoil -- --version` prints `0.2.2`, the version `package.json` pins for `wingfoil` ✓
- every task of release `v0.2` is `done` (17/17); `check_tasks.py v0.2` → 17 tasks · 46 backlog
  items · 46 listed, OK; `check_releases.py` → OK ✓

Produces:

| Step | Output |
|------|--------|
| check-implementation-complete | precondition evidence above |
| align-user-docs | `README.md`, `docs/user-guide.md`, `docs/cli-reference.md`, `CHANGELOG.md` aligned with the v0.2 surface (`docs/publishing.md` checked for consistency) |
| align-agent-docs | `CLAUDE.md`, `.wingfoil/README.md` aligned (the four dl-025 checks) |

## Phases / Steps

Each session: the agent drafts → the session (human + agent) reviews and decides → the agent
writes the decisions into **Session log** below → one commit per session
(`docs(plan): session N — …`), plus the document commits and the `wf(…)` commits the CLI makes.

| # | Step (workflow phase) | Role | Output | Stop-check |
|---|-----------------------|------|--------|------------|
| 1 | `check-implementation-complete` | tech-lead | precondition evidence | 17/17 tasks `done`; `check_tasks.py v0.2` OK |
| 2 | `align-user-docs`: inventory the v0.2 surface (Today, notifications, gate footer and submit, toasts, identity and *How to join*, UI settings, git sync: status, fetch, update, push, auto-sync; launcher; security; supported WingFoil versions; browsers) from the code, specs, task Execution Notes and the dev-loop plan; align the four documents; the `[Unreleased]` CHANGELOG section ordered and complete (date set at `release-submit`) | developer | `README.md`, `docs/user-guide.md`, `docs/cli-reference.md`, `CHANGELOG.md` | every claim traceable to code/spec/test (`claim-evidence`); nothing of v0.3 or later described as shipped; declared residuals and known limitations of v0.2 stated |
| 3 | `align-agent-docs`: `CLAUDE.md` project status (release validation of v0.2 under way; the final status at `release-submit`, RS-5 of v0.1); `.wingfoil/README.md` tables against `memory.yaml`, `workflows.yaml`, `roles.yaml` | architect | `CLAUDE.md`, `.wingfoil/README.md` | the four dl-025 checks |
| 4 | Independent review (fresh-context, read-only, adversarial) of steps 2–3, re-verified by the same reviewer until PASS (nothing above nit) | reviewer | review rounds in Session log | PASS |
| 5 | Approval gates of `align-user-docs` and `align-agent-docs`; plan finalized (separate commit); merge to `main` with `--no-ff`; push | approver | plan `done`; branch merged | approver's OK recorded in Session log |

Checks on the branch before the review and before the merge: `npm run typecheck`, `npm run lint`,
`npm run format:check`, the default suite's documentation tests (`test/docs/public-text.test.ts`,
`test/contracts/capabilities.test.ts`, `test/wingfoil-feedback.test.ts`) through targeted
`vitest run`; heavy gates only through the machine-free slot (`dev-rules`), none planned in this
phase (no source change).

### Decisions taken at the start (2026-10-18, approver: "tutto come consigliato")

Release-validation decisions (apply to this and the following phases):

- RV2-1 Phases and sessions as for v0.1 (RV-1): `user-docs` and `e2e-smoke` in this session, each
  with its plan and its branch `design/<phase>_v0.2`; `submit` and `publishing` together in one
  later session on `main`; the retrospective in a new session. If this 9th active day does not
  suffice, `submit` + `publishing` move to a 10th, recorded as a deviation.
- RV2-2 bug-008 … bug-017 `resolved → closed` at the end of `e2e-smoke` (W0-10): one hand-committed
  close note per bug, then one approve command run by the approver (W-26). The same commit stamps
  `release: "v0.2"` on bug-009 … bug-017, so the bug check of `release-submit` 1.1 counts them for
  this release (five of them carry `release-origin: "v0.1"` and an empty `release`).
- RV2-3 Heavy gates of release validation: `test:e2e` on the three engines once, on `main` after
  the merge of `e2e-smoke` (the gate hard-rejects from v0.2, ES-7 of v0.1); on the release commit
  `test:coverage`, `test:smoke`, `test:publish-smoke` (printing `0.2.0`) and `test:e2e:chromium`;
  `test:timing` evidence = the runs repeated alone on `33ab602` (dev-loop Session 7) while no source
  changes. Every heavy gate takes the machine-free slot; performance numbers taken while another
  project's builds run are repeated alone.
- RV2-4 The approver's registry checklist (`docs/publishing.md`) after `e2e-smoke` and before
  `release-submit` (RP-46), step 4 (trusted publisher before a first version) first.
- RV2-5 Dry run: one `workflow_dispatch` of `.github/workflows/publish.yml` on `main` after the merge
  of `e2e-smoke`, before the release commit (the first CI run of this repository; proves `gate` and
  `stage` on Node 22.12.0). Started only on the approver's OK; a failure is fixed on `main` before
  the release commit.
- RV2-6 v0.2 goes live on npm as `0.2.0` (tag `v0.2.0`) when the checklist is complete; if step 4
  requires it, the approver publishes the first version by hand from the pipeline's smoked tarball.
  If the checklist is not complete at `release-submit`, the release ships as a git tag only and a
  decision-log records it (as dl-004).
- RV2-7 `npm audit` re-checked (W6-3) at the start of release validation (2026-10-18 on `e692674`):
  `--omit=dev` 0 vulnerabilities; the full audit 9 (3 critical, 6 high), the same packages as the
  accepted dev-only list of `docs/publishing.md` — no new finding. Re-run at `release-submit`.
- RV2-8 No push that starts a GitHub Actions run (a `v*` tag, a `workflow_dispatch`) without the
  approver's OK. Pushes of `main` and of `design/*` branches start none (`publish.yml` triggers on
  tags and dispatch only).

## Handoff

- **Approver:** the two approval gates (`align-user-docs`, `align-agent-docs`), the plan
  finalization and the merge.
- **Agent:** inventory, drafts, independent review rounds, Session log, commits on the branch,
  push after the merge.
- **Completion:** the six documents aligned and reviewed (PASS); gates approved; plan `done`;
  `design/user-docs_v0.2` merged to `main` and pushed. Next: `e2e-smoke` (new plan
  `e2e-smoke-rel-v0.2-plan`, branch `design/e2e-smoke_v0.2`).

## Session log

<!-- One entry per session: date, decisions taken, deviations from this plan. -->

### Session 1 — 2026-10-18

- Plan created (`f6e7fd3` add, `fab9fd5` submit → `active`) on `design/user-docs_v0.2`; preconditions
  checked on `e692674` (see Context); decisions RV2-1 … RV2-8 taken at the start.
- **check-implementation-complete:** 17/17 tasks `done`; `check_tasks.py v0.2` OK; `check_releases.py`
  OK; CLI `0.2.2`.
- **align-user-docs / align-agent-docs:** drafted by a developer agent from code, specs, task and bug
  Execution Notes and the dev-loop plan: `docs/user-guide.md` 0.16 (`c9f2979`; 748 lines — the guide
  of v0.2 as a whole, *What v0.2 does not do*, known limitations of v0.2), `docs/cli-reference.md` 0.3
  (`e6c9295`; the command line is unchanged since `v0.1.0`; git environment, scheduler start, stop
  waiting for a running automatic update), `README.md` (`925a0d2`; status, features, three browsers,
  install), `CHANGELOG.md` (`05f74c4`; `[Unreleased]` ordered: Added, Changed, Fixed, Security, Known
  limitations), `CLAUDE.md` 0.6 (`b925358`; v0.2 in release validation). `.wingfoil/README.md`
  unchanged: a YAML-parsed dl-025 comparison against `memory.yaml`, `workflows.yaml`, `roles.yaml`
  reported 214 checks, 0 errors (it reported each of three planted mutations); `directives list` →
  `warnings: []`. `docs/publishing.md` read for consistency, unchanged.
- **Independent review** (fresh-context, read-only, adversarial; its own link/anchor script and its
  own YAML comparison of `.wingfoil/README.md`, the bin's usage errors, every quoted UI label against
  `web/src/i18n/en.json`):
  - Round 1 — FAIL: 1 major (the CHANGELOG said only the action's own `wf(…)` commit is pushed;
    auto-push pushes the branch), 4 minor (manual transports described with the automatic runs'
    protections — askpass, time limit, hooks; batch-mode ssh claimed for a clone; the automatic-run
    rule read as covering auto-push; task-032's accepted residual between the check and the CLI not
    stated), 5 nits (toast cap, `CLAUDE.md` *Read first* folders, wraps, the upstream-missing line and
    two open points missing from the limitations, the release-submit hand-over). Fixed `e502547`.
  - Round 2 — FAIL: 1 minor (the new residual text said WingFoil refuses a status change; its
    approve and reject refuse an uncommitted edit, submit commits it), 2 nits (placement of the
    typed-path limitation, two wraps). Fixed `2fbd44c`.
  - Round 3 — **PASS**, no finding.
  - Checks on `2fbd44c`: `typecheck`, `lint`, `format:check` ✓; `test/docs/public-text.test.ts`,
    `test/contracts/capabilities.test.ts`, `test/wingfoil-feedback.test.ts` 79/79; 0 broken links or
    anchors. No heavy gate (no source change).
- **Decisions** (approver, 2026-10-18: "tutto come consigliato", then "tutto approvato"):
  - UD2-1 Install: `git checkout v0.2.0` as the main path (v0.1.0 until v0.2 is tagged) plus *From npm
    (once published)*; nothing says the package is on npm.
  - UD2-2 The user guide describes v0.2 as a whole; the per-section "not released yet" markers are
    replaced by one statement in its introduction.
  - UD2-3 CHANGELOG: a Security section (bug-010, bug-012, bug-013, bug-017 and the v0.2 safeguards);
    Fixed keeps bug-008 and bug-016; bug-014 (found before release, on routes never released) is folded
    into the Update and Push entry; the test-only bug-009, bug-011, bug-015 are not listed.
  - UD2-4 Known limitations of v0.2 in the guide and the CHANGELOG: the declared Auto-update risk
    (W4-16) and the hooks-at-the-next-action residual; push only to the upstream, never `pushRemote`,
    never forced; a cancelled fetch or push is not recorded; the caret on a mouse click in the default
    reason; the message-sanitising residuals (W6-4, W6-7); the owner-check residuals of Wave 3; the gap
    between the console's check and the WingFoil process (task-032); the sync status kept per project
    (D33-10); plus the v0.1 items still valid.
  - UD2-5 Wave 6 follow-ups listed as limitations: git-sourced project data shown as written, the
    offline pause, and (option B, after review round 1) the typed path echoed by the project list's
    refusals (from v0.1). Left to the retrospective: the key-rendering build, the typed
    `SafeToolMessage`, the WingFoil pipeline note.
  - UD2-6 `docs/examples/` does not apply to a web dashboard: accepted deviation from `user-docs.yaml`
    `align-user-docs` produces, as UD-5 of v0.1.
  - UD2-7 Spec-vs-code differences — spec-007 §6 (the stop waits for a running automatic merge; the
    5 s drain), §3 (the scheduler starts after listening), §1 (`--version` example) — are amended by a
    governance task after v0.2 (input of the retrospective, as UD-7 of v0.1); the docs follow the code.
  - UD2-8 The README keeps no Version line, as in v0.1.
- **Gates:** `align-user-docs` and `align-agent-docs` approved by the approver (2026-10-18).
- **Hand-over to `release-submit`** (transitional text to change when v0.2 is tagged or published):
  README status block, install note and the `git checkout v0.2.0` comment; the user guide's
  introduction and its "not tagged yet" sentence; `CLAUDE.md` project status; CHANGELOG `[Unreleased]`
  → `[0.2.0] - <date>`, its compare and tag links, and "Not published on npm" if RV2-6 publishes;
  `--version` examples print `0.2.0` only after the release commit.
- **Next:** `e2e-smoke` (plan `e2e-smoke-rel-v0.2-plan`, branch `design/e2e-smoke_v0.2`).
