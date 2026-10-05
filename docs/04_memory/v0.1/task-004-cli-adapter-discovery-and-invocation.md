---
id: task-004-cli-adapter-discovery-and-invocation
type: task
title: "CLI adapter discovery and invocation"
status: in-progress
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-ARC-02"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-002-launcher-and-http-server-skeleton"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The CLI adapter's process runner and discovery: find the observed project's own `wingfoil` (`node_modules/wingfoil` run with `process.execPath`, else the PATH resolved to an absolute path), invoke it with an argument array and `--format json` in the project's working directory, classify results and errors, 30 s timeout, per-project write lock (adr-001 D2, D5; spec-001 §1–2).

**Backlog items:** TT-ARC-02, TT-INT-04

## Acceptance Criteria

- **TT-ARC-02** (REQ-ARC-02 — The observed project's own CLI): [boolean] With a fixture pinning 0.2.2 and `wingfoil` 0.2.1 on the PATH, 100 % of the CLI processes the server starts for that fixture run the pinned binary (process audit); the package `wingfoil-ui` declares no dependency on `wingfoil`. *Verified by:* e2e (process audit) · package.json review.
  Scenarios (`@v0.1`): S-08.1, S-08.2, S-10.1, S-10.2.
- **TT-INT-04** (REQ-INT-04 — CLI invocation and errors): [boolean] Every listed scenario passes; a CLI stub that sleeps 40 s is killed at 30 s ± 1 s and its request returns an error. *Verified by:* unit (stub) · e2e.
  Scenarios (`@v0.1`): S-27.1.

e2e closure — scenarios that need a screen are proved here by API and unit tests on the same fixtures and close in: task-014-add-project-modal: S-10.1, S-10.2; task-016-project-header-version-identity-and-role-view: S-08.1, S-08.2; task-019-dna-directives-and-team-views: S-27.1.

## Implementation Notes

- `adr-001` D2, D5; `spec-001` §1–2; directive `cli-only-writes` (which CLI), `wingfoil-cli` (W-01…W-20).
- Ports: process runner, per-project write lock (`adr-002`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-05)

- **depends_on acknowledged:** task-002 Execution Notes read — `onStop(hook)` is the stop-sequence
  hook for this task's children (order: stop accepting → hooks in registration order → bounded
  drain → stop line; every hook runs even if one fails, the first failure exits 70; `onStop`
  returns an unsubscribe, module-scope hooks); the error envelope `envelope(code, message)` of
  `http/app.ts`; the REQ-SEC-05 lint rule on `server/**`. Through task-002, task-001's notes too:
  tests under `test/` (`test/server/` mirrors `server/src`), the fixture builder, `copyFixture`,
  `fixture.env` (isolated git and home), the CLI stub / version-fake / no-CLI variants and
  `envWithoutWingfoil(env, binDir)`; task-001's REQ-SEC-05 clone hand-over goes to task-008
  (`POST /api/projects/clone`), not here.
- **Specs:** no gap. Invocation and classification: spec-001 §1–2; HTTP codes of a CLI failure:
  spec-004 §5 (`cli-refused` 422, `cli-output` 502, `cli-timeout` 504, `internal` 500);
  `cli-not-found` and its install command: spec-006 §3; discovery and process model: `adr-001` D2,
  D5; ports: `adr-002` (process runner, per-project write lock, each with an in-memory fake).
  CLI facts re-checked on `wingfoil@0.2.2` in a scratch `init --template Kanban` repository
  (`node node_modules/wingfoil/dist/cli.js --format json <command> </dev/null`):
  `--version` prints `0.2.2` as plain text with `--format json` (W-19); `memory submit nope` →
  exit 1, stdout empty, stderr `{"error":"document not found: nope"}`; `--bogus dna show` → exit 2,
  stderr `error: unknown option '--bogus'`; `memory add --type task` with stdin a pipe or
  `/dev/null` does not prompt (exit 2, `{"error":"missing required argument: --title"}`), so the
  invocation stays as spec-001 §1 fixes it (no `--no-interactive`; stdin is closed); with an
  invalid `.wingfoil/dna.yaml`, `dna show` → exit 1 with `{"error":"E_YAML_PARSE_ERROR (<abs
  path>/.wingfoil/dna.yaml): invalid DNA: YAML parse error at line 48"}` while `memory search` and
  `directives list` still exit 0 (S-27.1 is a per-command refusal).
- **Scope boundaries:**
  - here: the process runner port (local `spawn` adapter, argument array, no shell, stdin closed,
    30 s default timeout, `AbortSignal` cancellation, children tracked and terminated by an
    `onStop` hook, a spawn observer for the process audit) and its in-memory fake; the per-project
    write lock (in-process queue) and its use contract; CLI discovery (D2); the CLI adapter
    (`--format json` before the command, project root as working directory, result
    classification of spec-001 §2, `--version` read as text, user values that start with `-`
    passed as `--name=value`) and the mapping of its errors to the spec-004 §5 envelope.
  - **task-005:** the static list of consumed commands, the JSON Schemas and their validation
    (`cli-output` on a schema failure — this task only reports output that is not JSON), the
    contract tests, the direct reads.
  - **task-006:** semantic-version parsing of the `--version` text, the supported range, caching
    of the version with the resolved binary, capabilities. This task returns the trimmed text.
  - **task-008:** the routes (`POST /api/projects` → `cli-not-found` from this task's
    `CliNotFoundError`, availability), git subcommand allow-list and the clone (REQ-SEC-05 probe
    hand-over from task-001); **task-010:** re-resolution when `node_modules/wingfoil/package.json`
    changes (watching), read batching and cache; **task-012:** the read routes using the adapter.
- **AC classification (T1)** — all **red-first** (no adapter exists):
  - TT-ARC-02 — process audit on the real kanban fixture pinning 0.2.2 with a fake `wingfoil`
    0.2.1 (npm global layout: `bin/wingfoil` → `lib/node_modules/wingfoil/…`) first on the PATH:
    every process the adapter starts is `process.execPath` + the fixture's
    `node_modules/wingfoil` bin script, and the fake never runs (marker file). Package review as a
    test: no `wingfoil` in `dependencies`, `peerDependencies`, `optionalDependencies`,
    `bundleDependencies` of the root package `wingfoil-ui` nor in any workspace package; the root
    `devDependencies` pin stays — it is this repository's own governance CLI (directive
    `wingfoil-cli`), never installed by `npx wingfoil-ui`.
  - S-08.1 / S-08.2 (adapter side) — discovery reports source `project` and `--version` `0.2.2`;
    with no `node_modules/wingfoil` and the pinned package linked on the PATH as an npm global
    shim, source `path` and `0.2.2`, run as `process.execPath` + the package's bin script. The
    header ("WingFoil 0.2.2", "(from PATH)") closes in task-016.
  - S-10.1 / S-10.2 (adapter side) — no-CLI variant + `envWithoutWingfoil`: `CliNotFoundError`
    with the install command `npm install --save-dev wingfoil`, at add time and after the CLI is
    removed from a fixture that had one. Modal and switcher close in task-014.
  - S-27.1 (adapter side) — invalid `dna.yaml` on a fixture copy: `dna show` → `CliRefusedError`
    with the CLI's message verbatim, `memory search` on the same project still answers. The DNA
    view closes in task-019.
  - TT-INT-04 — classification table of spec-001 §2 on the fixture with the CLI stub (exit 1 JSON,
    exit 2 text, exit 3, exit 0 with stderr warnings, exit 0 non-JSON), a stub that sleeps 40 s
    killed at 30 s ± 1 s (the real default timeout, one 30 s test) and its error mapped to 504
    `cli-timeout`; runner units (argument array verbatim with the `SHELL_PAYLOAD` probe, cwd,
    cancellation, `terminateAll`), write lock units (serial per project, parallel across
    projects, a failed write releases the lock), the launcher registers the termination hook.
- **e2e closure:** no route uses the adapter yet; the API-level process audit of TT-ARC-02 runs
  where the first route invoking the CLI lands (task-008 add project / task-012 reads), with the
  spawn observer this task provides. Screens: task-014 (S-10.1, S-10.2), task-016 (S-08.1,
  S-08.2), task-019 (S-27.1).
