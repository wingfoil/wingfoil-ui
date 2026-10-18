# CLAUDE.md — agent entry point

**Version:** 0.6 · **Date:** 2026-10-18 (0.1: release v0.1, `user-docs` `align-agent-docs`; 0.2: v0.1.0 released, release submit; 0.3: `test:smoke` wave gate — task-026; 0.4: e2e on three engines, inner-loop Chromium run — task-027; 0.5: `test:publish-smoke`, the publishing guide — task-029; 0.6: release v0.2 user-docs — v0.2 in release validation)

WingFoil UI: a local web UI for WingFoil-governed projects. A Node.js server (`server/`) drives
each project's pinned `wingfoil` CLI and reads git; a React app (`web/`) shows the result;
`contracts/` holds the JSON schemas, the support matrix and the capability table. This repository
is itself governed by WingFoil (`.wingfoil/`).

## Project status

Release **v0.2 — Unblock** (`docs/04_memory/planning/v1/minor-v0.2.md`, `in-development`): the
implementation is complete (17/17 tasks `done`, `dev-loop-rel-v0.2-plan` `done`) and **release
validation is under way** — `user-docs`, then `e2e-smoke`, `submit` and `publishing`, one plan per
phase in `docs/05_plans/rl-v1/rel-v0.2/`. The v0.2 surface is on `main` but **not released**: the
latest release is **v0.1 — Read-only console**, git tag `v0.1.0` (`package.json` version
`0.1.0`), not on npm (dl-004). The root `package.json` is no longer `private` and the publish
pipeline `.github/workflows/publish.yml` exists (task-029), but no version has been published
([`docs/publishing.md`](docs/publishing.md)). The final status is written at `release-submit`.

Released in `v0.1.0`:

- the launcher command line `wingfoil-ui [--port <n>] [--no-open] [--version] [--help]` —
  [`docs/cli-reference.md`](docs/cli-reference.md), spec-007 (unchanged in v0.2);
- read-only views: project list (add a local folder, clone a remote), project switcher, project
  header (WingFoil version, capabilities, identity, role view), Memory list, element panel, DNA,
  directives, team, documentation — [`docs/user-guide.md`](docs/user-guide.md);
- cross-cutting: loopback-only server with session token and Host/Origin checks, externalised
  strings, light/dark themes, accessibility.

On `main`, not released (v0.2, `CHANGELOG.md` *[Unreleased]*): *Today*, the notification bell, the
gate footer (`memory approve` / `reject`) and *Submit* (`memory submit`) with toasts, *How to
join*, UI settings, the git status with *Fetch*, *Update* (fast-forward only) and *Push*, the
automatic sync (auto-fetch on, auto-update and auto-push off by default); e2e on Chromium, Firefox
and WebKit.

Not shipped (v0.3 and later): editing (fields, DNA, directives, files), ingestion, workflow views,
timeline, traceability, files, command palette, `.wingfoil/ui.yaml`, agent launch. The feature
plan per release is `docs/01_vision/07_sequencer.md`; what shipped and what was accepted as a
limitation: [`CHANGELOG.md`](CHANGELOG.md).

## Read first

| What | Where |
|------|-------|
| How this repository was bootstrapped, and the CLI facts that shape every step | [`BOOTSTRAP.md`](BOOTSTRAP.md) |
| Memory types with paths, id patterns, states and gates; workflows; role → directive bindings; directive list | [`.wingfoil/README.md`](.wingfoil/README.md) — the tables projected from `memory.yaml`, `workflows.yaml` and `roles.yaml` live there, not here |
| Directives (loaded per role, `.wingfoil/roles.yaml`) | `.wingfoil/directives/custom/` and `built-in/` — global to every role: `wingfoil-cli`, `claim-evidence`, `documentation`, `doc-versioning`, `security-secrets` |
| The current phase and its decisions | the `active` plan in `docs/05_plans/` (one plan per workflow phase; e.g. `docs/05_plans/rl-v1/rel-v0.2/`) |
| Tasks, specs, ADRs, decision logs, bugs | `docs/04_memory/` (`v0.1/`, `v0.2/`, `design/specs/`, `design/adrs/`, `design/dls/`, `bugs/`) |
| UX reference and prototype | `docs/00_reference/` |
| Tests and their suites | [`test/README.md`](test/README.md) |
| npm publishing: pipeline, approver checklist, release runbook (agents never publish or configure the registry) | [`docs/publishing.md`](docs/publishing.md) |

## Working with the WingFoil CLI

- Run only the pinned CLI: `npm run -s wingfoil -- <command>` (`wingfoil@0.2.2`, devDependency).
- Every governance change goes through a CLI verb (`memory add`, `memory submit`, `memory approve`,
  `memory reject`, …; directive `cli-only-writes`); hand edits only where directive
  `wingfoil-cli` says so — e.g. closing a plan by hand (W-04) and the task transitions
  `backlog → in-progress`, `approved → done` (W-20). Read that directive's
  *Known behaviours* table before running a verb; do not copy it here.
- The DNA's agent executes as developer, reviewer, qa and architect with **no approval
  authority**: `memory approve` / `reject` are run by the human approver.
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
  Firefox, WebKit) at the end of every wave and at release validation; `test:timing` only on a
  quiet machine; `npm run test:smoke` at the end of every wave and when packaging, the launcher or
  the bin changes ([`test/README.md`](test/README.md) *Launch smoke*, *Temporary folders*);
  `npm run test:publish-smoke` when packaging or `.github/workflows/publish.yml` changes
  ([`docs/publishing.md`](docs/publishing.md) *Local staging smoke*).
- **Never** edit `.wingfoil/` or Memory files to change a state a verb owns; never put secrets in
  the repository or the local state (`security-secrets`).
