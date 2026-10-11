---
id: task-025-installable-package-and-e2e-smoke-gaps
type: task
title: "Installable package and e2e-smoke gaps"
status: in-progress
release: "v0.1"
module: "governance"   # optional — server | web | contracts (dna.yaml modules)
priority: "high"       # optional — high | medium | low
tags: ["v0.1","governance","e2e-smoke"]
ref: "GOV"             # optional — backlog item ID, e.g. "TASK-001"
bug: ["bug-007-packed-package-cannot-start-and-would-ship-private-and-development-files"]  # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-001-workspace-tooling-and-e2e-harness", "task-002-launcher-and-http-server-skeleton", "task-021-accessibility-page-title-and-performance-pass"]  # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Release-validation task of minor-v0.1, phase `e2e-smoke` (plan `e2e-smoke-rel-v0.1-plan`, decisions
RV-3 and ES-1…ES-7): close the gaps the mapping of `.wingfoil/workflows/custom/e2e-smoke.yaml` onto
the existing suites found.

- **launch** — the packed package cannot start and would ship private and development files
  (bug-007, absorbed here, dl-045 pattern). US-S-01 ("start the console with `npx wingfoil-ui`") and
  TT-ARC-01 are v0.1 items (covered by task-002), but every test starts `node bin/wingfoil-ui.cjs`
  inside the checkout; nothing exercises the installed package.
- **fixture-project** — the fixtures run `wingfoil init --template Kanban` only; the pinned CLI
  (0.2.2) also offers `Scrum`, never opened by the console in a test.
- **drive-browser** — the check "every commit is a CLI `wf(…)` commit or a `chore(ui)` commit
  touching only `.wingfoil/ui.yaml`" has no test; in v0.1 the UI makes no governed write, so the
  check is "a console session leaves the observed repository's history unchanged".

Governance task (`module: governance`, `ref: GOV`) because `check_tasks.py` requires every backlog
item to be listed by exactly one task and US-S-01 / TT-ARC-01 already belong to task-002; it is
run through the full dev-loop (worktree, TDD, independent review until PASS, approver gates).
The package stays `private: true` and is not published (RV-8).

**Backlog items:** GOV (governance — release validation; serves US-S-01, TT-ARC-01, X1 via the e2e-smoke gate)

## Acceptance Criteria

- **AC-1 (bug-007, packaging)** `npm pack` produces a tarball whose file list is an explicit
  allow-list: `bin/wingfoil-ui.cjs`, the built server, web and contracts code the runtime needs,
  the message catalogues the bin and server read, `package.json`, `LICENSE`, `README.md`,
  `CHANGELOG.md`; nothing git-ignored or development-only (`export*/`, `.idea/`, `.mcp.json`,
  `test/`, `docs/`, sources not needed at runtime, `node_modules/` of the workspaces). The runtime
  dependencies are declared so that an install of the tarball resolves them, including
  `@wingfoil-ui/contracts` (bundled, inlined or otherwise resolvable — decided at design);
  `prepack` builds. `private: true` and version are unchanged by this task.
- **AC-2 (packaging guard)** A Vitest test runs `npm pack --dry-run --json` (or equivalent) and
  fails when the tarball holds a path outside the allow-list or misses a required runtime file.
- **AC-3 (launch smoke)** A smoke test packs the repository, installs the tarball into an empty
  temporary folder (offline-capable where possible, e.g. `--prefer-offline`), runs
  `npx wingfoil-ui --no-open` there with an isolated `WINGFOIL_UI_STATE_DIR` and home, asserts the
  URL line with the token, an authenticated `GET` of the UI and of one API route, and a clean stop
  (SIGINT → exit 0, no process left). Also `npx wingfoil-ui --version` and `--help` exit 0.
  It runs in an explicit script (e.g. `npm run test:smoke`), not in the default suite if it needs
  network or more than a few minutes; its run time is recorded.
- **AC-4 (Scrum fixture)** The fixture builder offers a `scrum` kind (`wingfoil init --template
  Scrum` with the pinned CLI, a few elements in different states); an e2e test opens it in the
  console: the Memory list renders its elements, the element panel opens one, and axe reports 0
  serious/critical violations in both themes.
- **AC-5 (no commit)** An e2e test drives the read views of a fixture (Memory list, element panel,
  DNA, Directives, Team, Documentation, switcher) and asserts the fixture's `HEAD`, refs and
  working tree are unchanged afterwards (`git rev-parse`, `git status --porcelain`).
- **AC-6** `typecheck`, `lint`, `format:check`, `test:coverage` (≥ 80 %), `test:e2e`, `docs:api`
  green; `check_tasks.py` OK; `test/README.md` and the user docs (README install section,
  `docs/cli-reference.md`) updated where the package or the new scripts change them; bug-007
  follows this task's state (bug.sync_state).

## Implementation Notes

- The launcher resolves `server/dist/main.js` relative to `bin/` and reads
  `server/src/i18n/en.json` (`bin/wingfoil-ui.cjs` `launcherMessage`): the allow-list must keep both
  reachable, or the bin must read the catalogue from the built tree.
- `contracts` exports `./src/index.ts` types; check what `server/dist` imports at runtime.
- `bin/wingfoil-ui.cjs` is mode 100644 in git (UD-8): npm sets the bin link executable on install;
  decide at design whether to set the mode in git too.
- Directive `security-secrets`: nothing from `export*/` may ever be packed.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
