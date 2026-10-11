---
id: user-docs-rel-v0.1-plan
type: plan
title: "User docs rel-v0.1"
status: active
version: "0.2"         # optional — plan version
workflow: "user-docs"
phase: "rel-v0.1"
scope: "rl-v1/rel-v0.1"
element: "minor-v0.1" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.1"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.2 · **Date:** 2026-10-11 (0.1: plan created; 0.2: Session 1 log)
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
- `test:timing` on `main` `946ca4b` (RV-6), 14:18–14:23, load 8.4 → 10.1 (12 cores): **green**,
  3 Vitest + 14 Playwright. REQ-PERF-03 20/20 within 5 s (503–1227 ms); REQ-PERF-06 10/10 within
  3 s (600–1130 ms); TypeDoc build 9488 ms; TT-PERF-04 p95 (budget 1000 ms): Memory list 121,
  element panel 64, DNA 58, Directives 51, Team 79, Documentation 77 ms; `@live-refresh`
  recoveries 644–1443 ms (budget 5000 ms). This is the release-validation timing evidence.
- RV-9 applied: `dev-rules.md` copied to `.notes/dev-rules.md` (git-ignored).
- **check-implementation-complete:** 24/24 tasks `done`; `check_tasks.py` OK; CLI `0.2.2`.
- **align-user-docs / align-agent-docs:** drafts by a developer agent from code, specs, tests,
  task notes and the dev-loop plan (`fc8de8e`): `README.md` (updated, 134 lines),
  `docs/user-guide.md` (331), `docs/cli-reference.md` (148), `CHANGELOG.md` (95, `[0.1.0]` date
  TBD until publishing), `CLAUDE.md` (63), `.wingfoil/README.md` (146, tables generated from
  `memory.yaml`, `workflows.yaml`, `roles.yaml`). Prettier does not cover these files
  (`.prettierignore`: `*.md`, `docs/`, `.wingfoil/`); `directives list` → `warnings: []` with
  `.wingfoil/README.md` in place; `test/contracts/capabilities.test.ts` (README support section)
  passes.
- **Independent review** (fresh-context, read-only, adversarial; ran the launcher with every usage
  error, an HTTP probe, a scripted link check and a YAML-parsed dl-025 check):
  - Round 1 — FAIL: 0 blocker, 0 major, 4 minor (scp-like limit wording, header R9 trigger,
    "every string from the catalogue" vs the React Aria "Dismiss" exception, CHANGELOG bug-006
    claim vs the unknown-scheme limit), 7 nits (`Sec-Fetch-Site` on API requests only, the two
    token lines, `startMs`, token-draw ordering, CLAUDE.md wording, "Nothing leaves your
    machine", the 64-session cap). All fixed (`301c912`).
  - Round 2 — **PASS**; two nits: line wrap (fixed, `0220d4e`) and document versions (decision 9).
- **Spec vs code** (the docs follow the code): `--port=<n>` accepted, a repeated `--port` keeps the
  last; `--help`/`--version` win only when the whole line parses (`--help --bogus` → exit 2);
  "other" exit status = 70; relative `WINGFOIL_UI_STATE_DIR` resolved against the current
  directory and `APPDATA` fallback `<home>\AppData\Roaming` (spec-006 §1); Node.js checked before
  parsing; usage error = reason line + usage line (spec-007 §1, §3, §6). The spec-007 §7 manual
  Windows check (`#token` through `rundll32`) is still open (task-002/004 notes).
- **Decisions** (approver, 2026-10-11: "ok a tutto" = all as recommended):
  - UD-1 CHANGELOG links point to github.com/wingfoil/wingfoil-ui (compare, tag `v0.1.0`).
  - UD-2 README install steps keep `git checkout v0.1.0` (true from publishing, RV-7).
  - UD-3 README status "v0.1 — Read-only console"; CLAUDE.md says release validation is under way
    and is updated at submit/publishing.
  - UD-4 Known limitations: seven items in the user guide and the CHANGELOG, including React
    Aria's "Dismiss" (W5-1, spec-008 §6).
  - UD-5 `docs/examples/` does not apply to a web dashboard: accepted deviation from
    `user-docs.yaml` `align-user-docs` produces, recorded here only (RV-2).
  - UD-6 CLAUDE.md references `.wingfoil/README.md` for the dl-025 tables instead of copying them.
  - UD-7 The spec-vs-code differences above are fixed in spec-007 §1/§3/§6 and spec-006 §1 by a
    governance task after v0.1 (input of the retrospective).
  - UD-8 `bin/wingfoil-ui.cjs` is mode 100644: the docs use `node bin/…`; the executable bit is
    examined by the packaged-launch smoke (task-025, RV-3).
  - UD-9 Review-round fixes before the merge are part of draft 0.1 of each document; no version
    bump.
  - UD-10 `dev-loop-rel-v0.1-plan` (`done`) line 426 words the scp-like limit ambiguously; it is
    left unchanged — the correct wording: only an `@` in the path after the host's `:` with no
    `/` (e.g. `git@host:repo@v2.git`) is refused; `git@github.com:repo.git` is accepted.
- **Gates:** `align-user-docs` and `align-agent-docs` approved by the approver (2026-10-11).
- **Next:** `e2e-smoke` (plan `e2e-smoke-rel-v0.1-plan`, branch `design/e2e-smoke_v0.1`): task-025
  (packaged-launch smoke, `wingfoil init` fixtures), bug-004 re-check under load (RV-4), closing
  bug-004/005/006 (RV-5). Pending Memory tasks outside this phase: the spec-amendment governance
  task (UD-7, after v0.1).
