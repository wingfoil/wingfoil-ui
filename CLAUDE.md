# CLAUDE.md — agent entry point

**Version:** 0.20 · **Date:** 2026-11-08 (0.1: release v0.1, `user-docs` `align-agent-docs`; 0.2: v0.1.0 released, release submit; 0.3: `test:smoke` wave gate — task-026; 0.4: e2e on three engines, inner-loop Chromium run — task-027; 0.5: `test:publish-smoke`, the publishing guide — task-029; 0.6: release v0.2 user-docs — v0.2 in release validation; 0.7: v0.2.0 released — git tag and npm, the first version by hand; 0.8: the GitHub Release of v0.2.0 made; 0.9: the pin on `wingfoil@0.3.1` — task-046; 0.10: the packs `base`, `software`, `methodology/scrum` adopted, `AGENTS.md` — governance-alignment-rel-v0.3-plan step 3; 0.11: BOOTSTRAP.md marked historical — its review round 1; 0.12: W-20, W-25, W-26 already superseded — round 2; 0.13: `wingfoil-cli` re-checked against 0.3.1 — step 4; 0.14: the next step and the directive version after the v0.3 pre-step — its step 7 review; 0.15: v0.3 in development in Sprint 1, directive 1.20 — release-planning-rel-v0.3-plan step 9; 0.16: the procedures folded into directives, `test:timing` at the wave gate and before a release — task-049; 0.17: the draft GitHub Release job — task-052; 0.18: the agents' own git identity (`WingFoil UI Agent <352896614+wingfoil-dev@users.noreply.github.com>`, the machine account `wingfoil-dev`), its reach and self-check, approvals from the approver's console — task-050; 0.19: the self-check stops on any identity but the agent's — its review round 2; 0.20: the heavy gates on `.github/workflows/gates.yml` — task-071, dl-016)

WingFoil UI: a local web UI for WingFoil-governed projects. A Node.js server (`server/`) drives
each project's pinned `wingfoil` CLI and reads git; a React app (`web/`) shows the result;
`contracts/` holds the JSON schemas, the support matrix and the capability table. This repository
is itself governed by WingFoil (`.wingfoil/`).

## Project status

Latest release: **v0.2 — Unblock** (`docs/04_memory/planning/v1/minor-v0.2.md`), git tag `v0.2.0`
(`package.json` version `0.2.0`) and the first version on npm, `wingfoil-ui@0.2.0`. npmjs.com offers
no trusted publisher for a name with no version, so the approver published `0.2.0` **by hand**, with
2FA, from the tag run's smoked tarball (the run's `promote` rejected): that version has no
provenance statement. Later versions go through `.github/workflows/publish.yml` — `gate`, `stage`,
then `promote` to the npm stage queue through the trusted publisher, live after the approver's `npm
stage approve` ([`docs/publishing.md`](docs/publishing.md)). The GitHub Release of `v0.2.0` was made
by hand (2026-10-20); from v0.3 the workflow's `release` job creates a draft after `promote`, made
public by the approver after `npm stage approve` (task-052). The previous release, **v0.1 — Read-only
console** (git tag `v0.1.0`), was not published on npm (dl-004). Next: `minor-v0.3` is in development in
Sprint 1 (`sprint-001`, run `sw-life-cycle-1-plan` on WingFoil's workflow engine): 19 tasks in four
waves, from the governance wave (`release-planning-rel-v0.3-plan`, RP3-19; one session per Sprint
stage, RP3-13).

Released in `v0.1.0`:

- the launcher command line `wingfoil-ui [--port <n>] [--no-open] [--version] [--help]` —
  [`docs/cli-reference.md`](docs/cli-reference.md), spec-007 (unchanged in v0.2);
- read-only views: project list (add a local folder, clone a remote), project switcher, project
  header (WingFoil version, capabilities, identity, role view), Memory list, element panel, DNA,
  directives, team, documentation — [`docs/user-guide.md`](docs/user-guide.md);
- cross-cutting: loopback-only server with session token and Host/Origin checks, externalised
  strings, light/dark themes, accessibility.

Released in `v0.2.0` (`CHANGELOG.md` *[0.2.0]*): *Today*, the notification bell, the gate footer
(`memory approve` / `reject`) and *Submit* (`memory submit`) with toasts, *How to join*, UI
settings, the git status with *Fetch*, *Update* (fast-forward only) and *Push*, the automatic sync
(auto-fetch on, auto-update and auto-push off by default); e2e on Chromium, Firefox and WebKit.

Not shipped (v0.3 and later): editing (fields, DNA, directives, files), ingestion, workflow views,
timeline, traceability, files, command palette, `.wingfoil/ui.yaml`, agent launch. The feature
plan per release is `docs/01_vision/07_sequencer.md`; what shipped and what was accepted as a
limitation: [`CHANGELOG.md`](CHANGELOG.md).

## Read first

| What | Where |
|------|-------|
| The governance every agent shares: approvals, the CLI, the life cycle, Scrum (generated from the packs) | [`AGENTS.md`](AGENTS.md) |
| How this repository was bootstrapped (historical: the `wingfoil@0.2.2` era, before the packs adoption — its CLI facts are superseded by directive `wingfoil-cli` and `.wingfoil/README.md`) | [`BOOTSTRAP.md`](BOOTSTRAP.md) |
| Memory types with paths, id patterns, states and gates; workflows; role → directive bindings; directive list | [`.wingfoil/README.md`](.wingfoil/README.md) — the tables projected from `memory.yaml`, `workflows.yaml` and `roles.yaml` live there, not here |
| Directives (loaded per role, `.wingfoil/roles.yaml`) | `.wingfoil/directives/custom/` and `built-in/` — global to every role: `wingfoil-cli`, `claim-evidence`, `claim-sources`, `documentation`, `doc-versioning`, `security-secrets` |
| How each stage is done here (the packs' workflows say what, `workflow next` prints the directives of each step's role) | directives `release-planning` (planning a release), `definition-of-done` (building a task: design → red → green → refactor, review, done), `release-conventions` (the release checks, publishing, seeding a release line) |
| The current phase and its decisions | the `active` plan in `docs/05_plans/` (one plan per workflow phase; e.g. `docs/05_plans/rl-v1/rel-v0.2/`) |
| Tasks, specs, ADRs, decision logs, bugs | `docs/04_memory/` (`v0.1/`, `v0.2/`, `v0.3/`, `sprints/`, `design/specs/`, `design/adrs/`, `design/dls/`, `bugs/`) |
| UX reference and prototype | `docs/00_reference/` |
| Tests and their suites | [`test/README.md`](test/README.md) |
| npm publishing: pipeline, approver checklist, release runbook (agents never publish or configure the registry) | [`docs/publishing.md`](docs/publishing.md) |

## Working with the WingFoil CLI

- Run only the pinned CLI: `npm run -s wingfoil -- <command>` (`wingfoil@0.3.1`, devDependency, since
  task-046; the support matrix is 0.2.2 and 0.3.1).
- `.wingfoil/` is composed from the packs `base@2.0.1`, `software@1.0.0` and
  `methodology/scrum@1.0.0`, with this repository's own entries and three deviations
  ([`.wingfoil/README.md`](.wingfoil/README.md)); delivery runs in Sprints of 2 weeks.
- Every governance change goes through a CLI verb (`memory add`, `memory submit`, `memory approve`,
  `memory reject`, `memory park`, …; directive `cli-only-writes`); hand edits only where directive
  `wingfoil-cli` says so — the only one is closing a phase plan by hand (W-04). The task
  transitions `backlog → in-progress` and `approved → done`, and the release transitions up to
  `releasing`, are `memory submit`; `releasing → released` and a bug's `triaged → planned` are the
  approver's `memory approve` (W-25, W-26). WingFoil 0.3.1 accepts a hand-committed `status:`
  without the approver (W-34): never set a state a verb owns by hand. The directive was re-checked
  against `wingfoil@0.3.1` at `governance-alignment-rel-v0.3-plan` step 4 (1.15; now 1.22); where an
  entry and `.wingfoil/memory.yaml` disagree, `memory.yaml` is right. Read the directive's *Known
  behaviours* table before running a verb; do not copy it here.
- The DNA's agent executes as facilitator, product-owner, developer, reviewer, qa, architect and
  tech-lead with **no approval authority**: `memory approve` / `reject` are run by the human
  approver. Agent sessions commit as
  `WingFoil UI Agent <352896614+wingfoil-dev@users.noreply.github.com>` (the project's machine
  account `wingfoil-dev`), set by the approver as the four `GIT_AUTHOR_*`/`GIT_COMMITTER_*`
  variables in the Claude Code `env` of the main checkout's git-ignored
  `.claude/settings.local.json` (task-050). It reaches Claude Code
  sessions whose working directory is in this repository, on the approver's machine, and their
  subagents; another tool (Cursor, Codex), a cloud session, another machine, a session started in
  another repository, or a missing or broken file gets no agent identity — there the process rule
  alone applies. At the start of every session run `git var GIT_AUTHOR_IDENT`: if it does not show
  the agent's address (`352896614+wingfoil-dev@users.noreply.github.com`) — a team member's,
  another address, or a failure — stop and tell the approver before any commit. Never unset or override the variables, and never set an identity in the repository's git
  configuration. Under the agent identity the CLI refuses `memory approve`, `reject` and `amend`
  (`user not authorized to approve type '…'`): this prevents approvals by mistake, not a deliberate
  override (`wingfoil-cli` W-39), so "an agent never approves" stays a process rule. Paths that
  still act as the approver: the desktop app's terminal panel (its shells are not the session's
  children) and a browser driven on the approver's console. An agent never runs `approve`,
  `reject` or `amend`, nor clicks Approve or Reject, through either. A console acts as whoever
  started it (its children keep the identity variables): approvals are made from a console the
  approver started, never from one an agent session started.
- A wrong or surprising CLI behaviour becomes a `wingfoil-cli` entry and, when it is a WingFoil
  defect or gap, a note in `docs/wingfoil-feedback/`.

## Rules of thumb

- **Language:** chat in the user's language; everything written to the repository (code, docs,
  Memory elements, commit messages) in English.
- **Claims:** every factual claim names the command, test or file that establishes it (directive
  `claim-evidence`); nothing of a later release is described as shipped.
- **Docs:** bump a document's `Version`/`Date` on its first edit after a commit (`doc-versioning`);
  update the affected docs in the same change as the behaviour (`documentation`).
- **Checks before handing work back:** `npm run typecheck`, `npm run lint`, `npm run format:check`,
  `npm test` (or `test:coverage`); when the UI changes `npm run test:e2e:chromium` plus the task's
  own specs on the three engines (`npm run test:e2e -- <spec files>`); `npm run test:e2e` (Chromium,
  Firefox, WebKit) at the end of every wave and at release validation; `test:timing` alone
  through the machine-free slot at the end of every wave and at `pre-release-checks` (dl-009
  action 6); `npm run test:smoke` at the end of every wave and when packaging, the launcher or
  the bin changes ([`test/README.md`](test/README.md) *Launch smoke*, *Temporary folders*);
  `npm run test:publish-smoke` when packaging or `.github/workflows/publish.yml` changes
  ([`docs/publishing.md`](docs/publishing.md) *Local staging smoke*). Where
  `.github/workflows/gates.yml` exists on the branch, the heavy ones (`test:coverage`,
  `test:contract`, `test:e2e:chromium`, the own specs on Firefox and WebKit, both smokes; its
  `wave` scope for the three-engine `test:e2e` at the wave gate) run there, on the run a push
  starts — followed with `gh run watch`, `gh run view --log-failed`, `gh run download`; typecheck,
  lint, format:check, `docs:api`, targeted `npx vitest run` and `test:timing` stay local
  ([`test/README.md`](test/README.md) *CI gates*, dl-016).
- **Never** edit `.wingfoil/` or Memory files to change a state a verb owns; never put secrets in
  the repository or the local state (`security-secrets`).
