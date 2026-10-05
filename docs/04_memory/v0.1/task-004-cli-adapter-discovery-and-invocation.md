---
id: task-004-cli-adapter-discovery-and-invocation
type: task
title: "CLI adapter discovery and invocation"
status: in-review
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

### red / green / refactor (2026-10-05)

- **Red:** `test/server/process/{runner,write-lock}.test.ts`, `test/server/cli/{discovery,adapter}.test.ts`,
  `test/server/launcher/stop-children.test.ts` written first; all 5 files failed on the missing
  modules (`Cannot find module '…/server/src/process/runner.js'` …), commit `668dfcb`.
- **Green — built:**
  - `server/src/process/runner.ts` — the process runner port (`ProcessRunner`) and
    `LocalProcessRunner`: `spawn` with an argument array (no shell, REQ-SEC-05), stdin closed,
    `DEFAULT_TIMEOUT_MS` 30 s (`timeoutMs: null` for cancellable git transport), `AbortSignal`,
    SIGTERM then SIGKILL after 2 s, output cap 64 MiB, `ended` ∈ `exit | timeout | cancelled |
    overflow | terminated`, `onSpawn` observer (process audit), `terminateAll()` (refuses new
    processes, ends the running ones).
  - `server/src/process/write-lock.ts` — `WriteLock` port and `InProcessWriteLock` (queue per
    project key, arrival order, released before the caller sees the outcome, failure releases).
  - `server/src/cli/discovery.ts` — `discoverCli(projectRoot, { env })` per adr-001 D2 →
    `ResolvedCli { source: 'project' | 'path', file, prefixArgs, packageDir? }`, or
    `CliNotFoundError` (`code: 'cli-not-found'`, `installCommand: 'npm install --save-dev
    wingfoil'`).
  - `server/src/cli/adapter.ts` — `WingfoilCli.json(words, options)` (`--format json` before the
    command; words must not start with `-`; options rendered with `optionArg`, `--name=value` when
    the value starts with `-`, a repeated option once per value), `version()` (plain text, W-19),
    the error classes of spec-001 §2 and `cliErrorEnvelope()` (spec-004 §5, spec-006 §3).
  - `server/src/launcher/start.ts` — `LauncherIo.processes` (default a new `LocalProcessRunner`);
    `runLauncher` registers `onStop(() => processes.terminateAll())` before building the app and
    unsubscribes it when the listen fails.
  - `test/server/process/fake-runner.ts` — the port's in-memory fake (adr-002);
    `test/server/cli/fake-cli.ts` — hand-made `wingfoil` packages and an npm-global install layout.
- **Decisions:**
  - Process errors (another exit status, a foreign signal, cancelled, stopped, overflow) map to
    500 `internal` (spec-004 §5 has no dedicated code); the reason is in the error and the log.
  - A `node_modules/wingfoil` present without a usable `bin.wingfoil` is "no CLI" and does **not**
    fall back to the PATH (it would silently run another version, against REQ-ARC-02).
  - Relative `PATH` entries are never searched (they would resolve against the project folder).
    On Windows only npm shims (`wingfoil.cmd` → `node_modules/wingfoil` next to it) and `.exe`
    are used — a `.cmd` that is not a shim would need a shell.
  - "The package `wingfoil-ui` declares no dependency on `wingfoil`" is checked on
    `dependencies`, `peerDependencies`, `optionalDependencies` and bundled dependencies of the root
    and every workspace package; the root `devDependencies` pin is this repository's governance CLI
    (never installed by `npx wingfoil-ui`) and stays — **to confirm at review**.
- **Deviations (honest):**
  - The harness CLI stub (task-001, `test/harness/fixtures/variants.ts`) matched failures only on
    the words before the first `-` argument, so it never matched the server's invocation
    (`--format json` first): the stub-based classification tests passed through to the real CLI
    (found in green). The stub now skips wingfoil's global options (`--format <v>`, `--verbose`,
    `--no-color`, `--no-interactive`) first; new case in `test/harness/variants.test.ts`, README
    updated (commit `c6a51bb`).
  - TT-ARC-02's process audit runs at the adapter level (Vitest, real kanban fixture), not through
    the HTTP API: no route invokes the CLI yet (hand-over below).
  - Children are killed individually, not as a process group: a `git` started by a killed
    `wingfoil` may outlive it briefly. Accepted for v0.1 (no shell, no detached group on Windows).
  - Windows rules are unit-tested on Linux through the `platform` option (host path separators);
    a manual Windows check stays open with spec-007 §7's.
- **CLI facts (wingfoil 0.2.2) — new, for the coordinator (directive not edited):**
  - exit 2 is not always plain text as spec-001 §2 says: a missing required option gives JSON on
    stderr. `node node_modules/wingfoil/dist/cli.js --format json memory approve task-001-a
    </dev/null` → exit 2, stdout empty, stderr `{"error":"missing required argument: --reason"}`
    (also `memory add --type task` → `{"error":"missing required argument: --title"}`); an unknown
    option stays text (`--bogus dna show` → `error: unknown option '--bogus'`). The adapter treats
    every exit 2 as internal whatever its format.
  - With stdin a pipe or `/dev/null` the CLI never prompts (above), so `--no-interactive` is not
    needed; the `--name=value` form works for a value starting with `-`: `memory reject
    task-001-login-form --reason=-x dash first` as Morgan on the kanban fixture writes
    `reason: "-x dash first"` (asserted by `adapter.test.ts`).
- **Hand-overs:**
  - **task-005:** validate `WingfoilCli.json(...)` data against the command schema and throw
    `CliOutputError` (→ 502 `cli-output`) on failure; the static list of consumed commands; pass user
    values only through the `options` map.
  - **task-006:** parse the `version()` text (semantic version or "unrecognised"), cache it with the
    `ResolvedCli`; `cli.source === 'path'` gives "(from PATH)".
  - **task-008:** `discoverCli` rejection → `availability: 'cli-not-found'` and the
    `POST /api/projects` refusal via `cliErrorEnvelope` (422, `detail { path, command }`); git
    reads through the runner (30 s default), transport with `timeoutMs: null` + `signal`; the
    API-level process audit of TT-ARC-02 with `new LocalProcessRunner({ onSpawn })`.
  - **task-010:** re-run `discoverCli` when `node_modules/wingfoil/package.json` changes.
  - **task-008/012 (wiring):** `runLauncher` creates the runner (`io.processes ?? new
    LocalProcessRunner()`) but does not hand it to routes yet: pass that instance (and one
    `InProcessWriteLock`) to `buildApp({ register })` so the stop hook covers every child.
- **Checks (refactor):** `npx tsc -b server` OK · `npm run -s typecheck` clean · `npm run -s lint`
  clean · `npm run -s format:check` clean · `npm run -s docs:api` OK (`html generated at
  ./docs-api`) · `npm run -s test:coverage` 20 files, **193/193** passed, coverage **95.41 %**
  statements / **88.88 %** branches / 94.23 % functions / 96.62 % lines (`server/src/cli` 98.68 %,
  `server/src/process` 98.8 % statements) · `npm run -s test:e2e` 3/3 (Chromium). Timeout test:
  `npx vitest run test/server/cli/adapter.test.ts -t "sleeps 40 s" --reporter=verbose` →
  passed in 30 925 ms including the fixture copy (assertion 29 000 ≤ elapsed ≤ 31 000 ms on the
  request itself). No flaky test seen in these runs.

### review (2026-10-05)

- Independent review of HEAD `1481944`: **PASS WITH FIXES**. Fixed test-first: red tests in
  `9c41102`; before the fixes they failed for the expected reasons (runner: terminate/abort
  before 'spawn' and the two grandchild cases hit the test timeout; dangling link fell back to the
  PATH; build failure left the hook; adapter: the new `json(words, { options, positionals })`
  shape, redacted logs, empty refusal message).
  - **1 (major)** `runner.ts` — a child is tracked synchronously right after `spawn()` returns (and
    the stopping check stays at the top of `run()`): `run()` then an immediate `terminateAll()`
    ends it ('terminated'). A kill requested before 'spawn' is sent on 'spawn'.
  - **2 (major)** the abort listener is attached synchronously after `spawn()`: an abort before
    'spawn' cancels the process.
  - **3** POSIX children are spawned `detached: true` (own process group) and every kill goes to
    the group (`process.kill(-pid, sig)`, falling back to the child); Windows keeps `child.kill`.
    A child whose long-lived grandchild inherits its stdout/stderr now returns at its timeout
    (1 s timeout, result < 4 s) and from `terminateAll` (< 3 s), and the grandchild is gone.
    This closes the grandchild deviation noted in red/green/refactor (POSIX only). Consequence:
    children no longer receive the terminal's Ctrl+C directly; the stop sequence terminates them.
  - **4** `discovery.ts` — presence of `node_modules/wingfoil` checked with `lstat`: a dangling
    link is a broken pinned install → `CliNotFoundError`, no PATH fallback.
  - **5** `adapter.ts` — every internal, process and timeout error is logged; errors and logs carry
    `CliCommand { words, options }` (command words, option names), never option values or
    positionals (the `secret-…` probe in the test is absent from the log).
  - **6** `start.ts` — the `onStop` hook is registered after `buildApp`, removed when the listen
    fails (`test/server/launcher/stop-hook-leak.test.ts`: a later stop must not terminate the
    failed launch's runner — build failure was red, listen failure a characterization).
  - **8** user positionals go after `--`: `json(['memory', 'history'], { positionals: ['--version'] })`
    runs `… memory history -- --version` and gets the CLI refusal `document not found: --version`.
  - **9** TT-ARC-02 positive control: after `removeCli`, rediscovery with the same PATH gives source
    `path`, `version()` `0.2.1` and the marker file exists.
  - **10** fixed 200 ms sleep replaced with `vi.waitFor`; the grandchild tests wait on a pid file.
  - **11** `shell: false` explicit; exit 1 with an empty stderr → `WingFoil refused (exit status 1)
    without a message`.
  - Package review now lists every `wingfoil` occurrence in every dependency field of the root and
    workspace packages and expects exactly `package.json devDependencies` (this repository's own
    governance CLI, never installed by `npx wingfoil-ui`).
- **API change for the hand-overs:** `WingfoilCli.json(words, { options?, positionals?, signal? })`
  — words are the adapter's own; ids, titles, reasons go in `positionals`/`options`.
- **Hand-over additions (task-008/012):** the write-lock key must be the opaque project id
  (spec-004 `:pid`), never a user-supplied path; `InProcessWriteLock` is **not re-entrant** — a
  task holding the lock must not call `run` with the same key (it would wait forever).
- **Checks after the fixes:** `npx tsc -b server` OK · typecheck, lint, format:check clean ·
  `docs:api` OK · `npm run -s test:coverage` 21 files, **203/203**, coverage **95.46 %**
  statements / **89.37 %** branches / 94.49 % functions / 96.59 % lines · `test:e2e` 3/3.
  `npx vitest run test/server/process test/server/launcher` repeated 3× → 66/66 each time (no
  flakiness seen).
- Re-verification by the same agent: **PASS WITH FIXES** — every original finding resolved and
  re-probed (`run` + immediate `terminateAll` → terminated in 28 ms; immediate abort → cancelled
  in 14 ms; a grandchild holding the pipes → timeout at 1.2 s, grandchild gone). New findings:
  - N1 (minor) with process groups, a forced stop or an unhandled exit could orphan children:
    `LocalProcessRunner.killAllNow()` (synchronous SIGKILL to every tracked group) runs before
    exit 130 and on `process.on('exit')` (`3ddff61`, red tests in `85906cf`). ~~Open point:
    SIGHUP not handled~~ — closed: implemented per the spec-007 §6 amendment of 2026-10-05
    (below).
  - N3 (nit) the exit-2 stderr is logged truncated to 200 characters (`3123dad`): Commander's
    choice errors may quote a rejected value.
  - N4 (nit) **deviation note:** a grandchild that detaches itself (`setsid`, `detached`) leaves
    the group and escapes the group kill; wingfoil 0.2.2 and git do not do this.
  - N5 (nit) the grandchild timeout test uses `timeoutMs: 3_000` so a slow Node start cannot kill
    the child before it reports the grandchild; the TT-ARC-02 audit has a 90 s budget (ten CLI
    processes on a loaded machine, `6388717`).
  - N6 (nit) **hand-over to task-008/012:** pass exactly the positionals a command expects
    (Commander silently drops extras: `memory submit -- a b` acts on `a`); for git transport set
    `GIT_TERMINAL_PROMPT=0` — detached children have no controlling terminal, so git/ssh fail
    instead of prompting.
  - The agent session ended before this note and the final gate run; the coordinator wrote the
    note and ran the gates (below).
- Checks after the re-verification fixes (coordinator, 2026-10-05 11:20): `npx tsc -b`,
  typecheck, lint, format:check clean · `docs:api` OK · `npm run -s test:coverage` **205/207**:
  the two failures are the timing tests of task-001/002 (TypeDoc build > 30 s, REQ-PERF-06
  > 3.0 s) with load average 64–68 on 12 cores from another project's builds
  (`ps`: `.wf2-wt/task-*` tsc/typedoc/jest); to be re-run on a quiet machine before the merge.
- **SIGHUP** (spec-007 §6 amended on `main`, commit `429aab3`, approved by the user 2026-10-05;
  not merged into this branch): `main.ts` registers the same stop handler on `SIGINT`, `SIGTERM`
  and `SIGHUP` (registered on Windows too: Node.js emits `SIGHUP` there when the console window
  is closed). Reviewer nit taken: the runner's synchronous exit kill is registered by
  `runLauncher` through the new optional `LauncherIo.onExit`, **only for a start** (`--version`,
  `--help` and usage errors register nothing); `main(argv, { processes })` accepts an injected
  runner (tests). Red first (`52890c8`: SIGHUP had no listener, `--version` registered an exit
  listener, the injected runner was ignored), green `2f7ac50`. Tests: `test/server/main.test.ts`
  — SIGHUP terminates a running child, prints `WingFoil UI stopped`, exits 0; the exit listener
  SIGKILLs a running child. `test/launcher/launcher.test.ts` — the bin stops on `SIGHUP` with the
  stop line and exit 0 (`a42753f`; written after the code — it would have failed before, the
  default SIGHUP action kills the process; skipped on Windows, where a child cannot be sent
  SIGHUP).
- Checks after SIGHUP (2026-10-05 16:51, load average 6.7–9.7): `npx tsc -b server`, typecheck,
  lint, format:check clean · `docs:api` OK · `npm run -s test:coverage` 21 files, **210/210**
  (the TypeDoc-build and REQ-PERF-06 timing tests pass on this quieter machine), coverage
  **95.99 %** statements / **89 %** branches / 96.46 % functions / 97.11 % lines ·
  `npm run -s test:e2e` 3/3.
- Integration with `main` (tasks 003, 007, spec amendments `429aab3`) merged into this branch
  (`6876e83`) before submit; conflicts resolved in `start.ts`, `main.ts`, `test/README.md`;
  `stateDir` added to the stop-children and stop-hook-leak tests. Focused review of the SIGHUP
  change (`5fdb82d`): **PASS**. Full suite on the integrated branch at load ≈ 10: **422/422**,
  coverage 96.44 % statements / 89.65 % branches; REQ-PERF-06 spawn → URL 1068–2790 ms with the
  load rising again to ≈ 38 (≤ 3.0 s, but a thin margin under load — quiet machine: 386–693 ms).
