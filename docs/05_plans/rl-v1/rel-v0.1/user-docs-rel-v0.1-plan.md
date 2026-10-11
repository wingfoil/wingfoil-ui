---
id: user-docs-rel-v0.1-plan
type: plan
title: "User docs rel-v0.1"
status: active
version: "0.1"         # optional — plan version
workflow: "user-docs"
phase: "rel-v0.1"
scope: "rl-v1/rel-v0.1"
element: "minor-v0.1" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.1"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.1 · **Date:** 2026-10-11 (0.1: plan created)
**Branch:** `design/user-docs_v0.1` (merged to `main` with `--no-ff` at the end, on the approver's OK)
**Workflows:** `sw-life-cycle` → `release-line-cycle` (`rl-v1`) phase `delivery` → `release-cycle`
(`minor-v0.1`, `.wingfoil/workflows/custom/release-cycle.yaml` v1.1) phase `user-docs` =
`user-docs` (`.wingfoil/workflows/custom/user-docs.yaml` v1.1; dl-013 hard release blocker,
dl-025 agent-facing docs)
**Roles:** tech-lead (check-implementation-complete), developer (align-user-docs), architect
(align-agent-docs), approver (gates) — Roberto Pompermaier holds all of them; the agent drafts the
documents and runs the independent reviews (no approval authority)
**Input:** release `docs/04_memory/planning/v1/minor-v0.1.md` (`in-development`); tasks
`docs/04_memory/v0.1/task-001` … `task-024` (`done`); plan `dev-loop-rel-v0.1-plan` (`done`,
v0.7 — Session 1–5 logs: decisions, accepted deviations, deferrals); tech-specs `spec-001` …
`spec-009`; ADRs `adr-001`, `adr-002`; `README.md`; `BOOTSTRAP.md`
**Evidence:** handoff of session "WFUI v0.1 - 9. implementation W5" (2026-10-11); directives
`wingfoil-cli` v1.6, `cli-only-writes`, `claim-evidence`

Why now: the implementation phase is complete (every v0.1 task `done`, `dev-loop-rel-v0.1-plan`
finalized in `946ca4b`, `main` pushed). `release-cycle` v1.1 runs `user-docs` before `e2e-smoke`
and `submit`; it blocks the release (dl-013).

Preconditions (checked 2026-10-11 on `946ca4b`):
- `npm run -s wingfoil -- --version` prints `0.2.2`, the version `package.json` pins for `wingfoil` ✓
- every task tagged `v0.1` is `done` (24/24); `check_tasks.py` → OK ✓

Produces:

| Step | Output |
|------|--------|
| check-implementation-complete | precondition evidence above |
| align-user-docs | `README.md` (updated), `docs/user-guide.md`, `docs/cli-reference.md`, `CHANGELOG.md` (new) |
| align-agent-docs | `CLAUDE.md` (new, minimal), `.wingfoil/README.md` (new) |

## Phases / Steps

Each session: the agent drafts → the session (human + agent) reviews and decides → the agent
writes the decisions into **Session log** below → one commit per session
(`docs(plan): session N — …`), plus the document commits and the `wf(…)` commits the CLI makes.

| # | Step (workflow phase) | Role | Output | Stop-check |
|---|-----------------------|------|--------|------------|
| 1 | `check-implementation-complete` | tech-lead | precondition evidence | 24/24 tasks `done`; `check_tasks.py` OK |
| 2 | `align-user-docs`: inventory the shipped surface (launcher, screens, security, state, supported WingFoil versions, accessibility, themes) from the code, specs and task Execution Notes; draft the four documents | developer | `README.md`, `docs/user-guide.md`, `docs/cli-reference.md`, `CHANGELOG.md` | every claim traceable to code/spec/test (directive `claim-evidence`); no feature of a later release described as shipped |
| 3 | `align-agent-docs`: minimal `CLAUDE.md` pointing to `BOOTSTRAP.md`, the directives and the plans; `.wingfoil/README.md` describing this project's `.wingfoil/` (memory types and states, workflows, roles, directives) | architect | `CLAUDE.md`, `.wingfoil/README.md` | the four dl-025 checks (status vs shipped surface, element/state tables vs `memory.yaml`, workflow list vs `workflows.yaml`, role bindings vs `roles.yaml`) |
| 4 | Independent review (fresh-context, read-only, adversarial) of steps 2–3, re-verified by the same reviewer until PASS (nothing above nit) | reviewer | review rounds in Session log | PASS |
| 5 | Approval gates of `align-user-docs` and `align-agent-docs`; plan finalized; merge to `main` with `--no-ff`; push | approver | plan `done`; branch merged | approver's OK recorded in Session log |

### Decisions taken at the start (2026-10-11, approver: "si procedi" = all as recommended)

Release-validation decisions (apply to this and the following phases):

- RV-1 One session per phase for `user-docs`, `e2e-smoke` and `retrospective`; `submit` and
  `publishing` together in one session. One plan per phase (`{workflow}-rel-v0.1-plan`). Branch
  `design/<phase>_v0.1` for the phases that produce files (user-docs, e2e-smoke, retrospective);
  submit and publishing work on `main`.
- RV-2 `user-docs` scope: README updated; `CHANGELOG.md` and `docs/user-guide.md` created;
  `docs/cli-reference.md` documents the `wingfoil-ui` launcher command line (spec-007);
  `docs/examples/` does not apply to a web dashboard → accepted deviation, recorded here.
  `align-agent-docs`: minimal `CLAUDE.md` pointing to `BOOTSTRAP.md`, plus `.wingfoil/README.md`.
  The agent drafts; an independent reviewer verifies until PASS.
- RV-3 `e2e-smoke`: each step mapped to the existing suites (e2e, security, axe, contract); the
  missing pieces (a packaged-launch smoke: `npm pack` → install in a temp folder → `npx
  wingfoil-ui` → UI reachable on localhost; a `wingfoil init` fixture per template) are built by a
  new task `task-025` through the normal task flow. The gate is staged: warn on failure for v0.1.
- RV-4 bug-004 re-check during `e2e-smoke`: two full runs of the default suite (`test:coverage` +
  `test:e2e`) at load ≥ 15 (synthetic load if the machine is idle); both green without timeouts →
  close bug-004.
- RV-5 bug-004, bug-005, bug-006 `resolved → closed` at the end of `e2e-smoke`, before `submit`: a
  hand-committed "close" note in each bug, then one approve command run by the approver.
- RV-6 `test:timing` started at once on `main` (load ~9 at the start of this phase); else retried
  during `e2e-smoke`, then before the tag; last resort: the Wave 5 values (`7f921c8`, merge of 021)
  as evidence, with a deviation recorded in the plan.
- RV-7 Version and tag: `package.json` → `0.1.0`; annotated tag `v0.1.0` on `main` after the merge
  (dl-024; `release-publishing` asks for "the semver git tag" — `v0.1.0` is release `v0.1`).
- RV-8 Publishing: tag only for v0.1; `package.json` keeps `private: true`; the npm step of
  `release-publishing` (no `.github/workflows/publish.yml`, no OIDC / npm stage setup) is an
  accepted deviation recorded in a decision-log; npm publishing planned for a later release. A
  GitHub Release only on the approver's explicit OK.
- RV-9 The agents' rules file (`dev-rules.md`) moves to `.notes/` (git-ignored), so it survives
  reboots.
- RV-10 Messages from other sessions (WFCoord, "Meccanismo feedback wingfoil") wait for a phase
  boundary and the approver's OK. `wingfoil-sync` and the alignment of `.wingfoil/` with the
  WingFoil-Templates base pack happen after the v0.1 retrospective, outside this cycle.

## Handoff

- **Approver:** the two approval gates (`align-user-docs`, `align-agent-docs`), the plan
  finalization and the merge.
- **Agent:** inventory, drafts, independent review rounds, Session log, commits on the branch,
  push after the merge.
- **Completion:** the six documents committed and reviewed (PASS); gates approved; plan `done`;
  `design/user-docs_v0.1` merged to `main` and pushed. Next: `e2e-smoke` (new plan
  `e2e-smoke-rel-v0.1-plan`, branch `design/e2e-smoke_v0.1`).

## Session log

### Session 1 — 2026-10-11

- Plan created (`6eb4189`); preconditions checked on `946ca4b` (see Context).
- `test:timing` launched in background on `main` `946ca4b` (RV-6).
