---
id: task-006-wingfoil-version-range-and-capabilities
type: task
title: "WingFoil version range and capabilities"
status: in-progress
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-INT-02"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-005-cli-contracts-and-direct-reads"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Detect each project's WingFoil version, compare it with the supported range (0.2.2 → highest contract-tested), open out-of-range projects read-only with the reason, and the capability table (`contracts/capabilities.json`) that hides or disables what a version lacks (adr-001 D3, spec-001 §6).

**Backlog items:** TT-INT-02, TT-INT-03

## Acceptance Criteria

- **TT-INT-02** (REQ-INT-02 — Supported WingFoil range): [boolean] A fixture pinning a version below or above the range opens with 0 enabled actions and the reason naming the range; a version inside it passes every scenario of the release. *Verified by:* e2e · README review.
  Scenarios (`@v0.1`): S-08.1, S-09.1, S-09.2.
- **TT-INT-03** (REQ-INT-03 — Capability detection: read-only or hidden): [boolean] Every listed scenario passes on WingFoil 0.2.2; the capability table in `contracts/` declares a minimum version for 100 % of the capabilities. v0.1 (version notice): the table exists with a minimum version for every capability, and the project header shows the version and the version notice (S-08.1, S-08.2). *Verified by:* e2e · unit.

e2e closure — scenarios that need a screen are proved here by API and unit tests on the same fixtures and close in: task-016-project-header-version-identity-and-role-view: S-08.1, S-09.1, S-09.2.

## Implementation Notes

- `adr-001` D3; `spec-001` §6 (`capabilities.json`), §5 (`matrix.json`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-05)

- **depends_on acknowledged (dl-015):** task-005 Execution Notes read, review included (and,
  through it, task-004's). Taken from them: `contracts/matrix.json` `{pinned, versions}` is the
  support matrix this task reads; `WingfoilCli.version()` returns the trimmed `--version` text
  (validated as one non-empty line by `contracts/cli/version.schema.json`, a failure is a
  `CliOutputError`); `ResolvedCli.source === 'path'` gives "(from PATH)"; cache the version with
  the resolution (re-resolution on `node_modules/wingfoil/package.json` changes is task-010's);
  `cliBuildFor` (`test/contracts/support.ts`) throws for a version other than the pinned one; a
  versioned schema variant is selected by the detected version when a second version enters the
  matrix; the version-fake fixture variant `installCliStub(fx, { version })`; tests under `test/`,
  `buildFixture`/`copyFixture`/`fixture.env`, `FakeProcessRunner`, `fake-cli.ts`.
- **Specs:** `adr-001` D3/D4, spec-001 §3 (`--version`), §5 (layout), §6 (initial table),
  spec-003 §6 rule 2, spec-004 §3 (`GET /api/server`, `/api/p/:pid` — task-012) and §4 row 6
  (`unsupported-version`), spec-008 §5 (the server sends keys and arguments, never browser text),
  REQ-INT-02/03, `capabilities.feature` S-08.1/S-08.2/S-09.1/S-09.2. CLI fact re-checked:
  `node node_modules/wingfoil/dist/cli.js --format json --version </dev/null | od -c` → `0.2.2\n`
  (pinned 0.2.2).
- **Spec gaps (reported to the coordinator, not edited):**
  1. *Upper bound of the range.* `adr-001` D3: "from 0.2.2 to the highest WingFoil version
     contract-tested by that release, inclusive" (matrix `["0.2.2"]` → 0.2.2 to 0.2.2), while the
     scenarios read "supported 0.2.2 to 0.2.x" (S-09.1/S-09.2, feature header), "0.2.2 to 0.3.x"
     (S-08.3) and REQ-INT-02 "0.2.2 to 1.x at v1.0". Implemented: lower bound = lowest matrix
     version, upper bound = the caret line of the highest matrix version (`^0.2.2` → `< 0.3.0`,
     label `0.2.x`; `^1.0.3` → `< 2.0.0`, label `1.x`), pre-releases only when listed — the one
     rule that yields the three labels. Alternative: exact highest version (label `0.2.2`), a
     one-function change (`supportedRange`). Either way S-09.1 (0.4.0) and S-09.2 (0.2.0) are
     outside.
  2. *Field editing has no minimum version* (spec-001 §6: "WingFoil task-127 / task-163", not
     released) while REQ-INT-03 wants "a minimum version for 100 % of the capabilities".
     Implemented: `minVersion` is a required key of every entry, `null` = "in no released WingFoil
     version" (always read-only). Alternative: drop the row until WingFoil releases it.
  3. *Format of `capabilities.json`* is not fixed by a spec beyond "capability → minimum WingFoil
     version, conditions" (§5) and the §6 rows: fixed here by `contracts/capabilities.schema.json`
     (below); proposed as a spec-001 §6 addendum.
- **Design:**
  - `contracts/capabilities.json` + `contracts/capabilities.schema.json`: `{capabilities: [{id,
    name, minVersion: semver | null, via, replacedBy?, conditions: string[]}]}`; the §6 rows, the
    "Workflow position, next step, start" row split into `workflow-position`, `workflow-next-step`,
    `workflow-start` (S-08.3 names "Next workflow step" alone), all with `minVersion` `0.3.0`;
    `agent-launch` `0.3.0`; `field-editing` `null`; the four 0.2.2 rows `0.2.2`. `conditions`
    are project-condition ids (S-11.2 "no remote" style, v0.2+); none in v0.1.
  - `server/src/cli/version.ts`: strict SemVer 2.0 parsing and precedence (no `v` prefix: the CLI
    prints `0.2.2`), `supportedRange()` from `matrix.json`, `classifyVersion(text, range)` →
    `in-range | below | above | pre-release | unrecognised`, `detectVersion(cli)` (a
    `CliOutputError` of `--version` — empty or several lines — is `unrecognised`; refusals,
    timeouts and process errors propagate), `VersionCache` (one `--version` per `ResolvedCli`
    object, concurrent callers share it, a failure is not cached).
  - `server/src/cli/capabilities.ts`: the table loaded and schema-checked once at load,
    `evaluateCapabilities(detected, { conditions })` → per capability `enabled | read-only |
    hidden` with a reason `{code: 'unsupported-version', range}` or `{code: 'needs-version',
    minVersion}`, and `missing` = the capabilities whose minimum version lies inside the range but
    above the project's (the version notice: empty → "Every capability of this release is
    available"). Out of range → every capability read-only (0 enabled).
  - `WingfoilCli.resolved` getter (the cache key). Package README: a "Supported WingFoil
    versions" section (range, matrix, capability table), checked by a test against the JSON files.
  - `cliBuildFor(version)` becomes async: the pinned build as today; another matrix version is
    installed once with `npm install --prefix <cache> wingfoil@<version>` into
    `node_modules/.cache/wingfoil-ui-matrix/<version>` (reused when present).
  - Deferred (honest): the versioned schema variant selection — with a matrix of one there is no
    variant to select; release-planning adds it with the second version.
- **AC classification (T1)** — all **red-first** (no parser, range, table or detection exists):
  - TT-INT-02 / S-09.1, S-09.2 — `test/server/cli/version-detection.test.ts` on the real kanban
    fixture with the version-fake variant (0.4.0 → `above`, 0.2.0 → `below`): out of range, 0
    enabled capabilities, reason carrying the range `0.2.2`–`0.2.x`; units in
    `test/server/cli/version.test.ts` (parse, precedence, range from matrices of one and several
    versions, pre-release, unrecognised). README review → `test/contracts/capabilities.test.ts`.
  - TT-INT-03 / S-08.1, S-08.2 — the same detection test: pinned 0.2.2 → `in-range`, source
    `project`, `missing` empty, the 0.2.2 capabilities enabled; PATH install → source `path`;
    `test/contracts/capabilities.test.ts`: the table validates, 100 % of the entries declare
    `minVersion`, the §6 rows are present; `test/server/cli/capabilities.test.ts` evaluation units.
  - The header texts close in task-016 (screens).

### red / green / refactor (2026-10-05)

- **Red** (`6a62e91`): `test/server/cli/{version,capabilities,version-detection}.test.ts`,
  `test/contracts/{capabilities,support}.test.ts`; four files failed on the missing
  `server/src/cli/version.js` / `capabilities.js`, `support.test.ts` 3/4 on `cliBuildFor`
  throwing "wingfoil 0.3.0 is in contracts/matrix.json but no build of it is installed".
- **Green** (`7419aa5`), as designed:
  - `server/src/cli/version.ts` — `parseSemVer`/`formatSemVer`/`compareSemVer` (SemVer 2.0, no
    dependency added), `rangeFromMatrix`, `supportedRange()` (matrix read once at load: `{min:
    '0.2.2', max: '0.2.x', below: '0.3.0', versions: ['0.2.2']}`), `classifyVersion`,
    `detectVersion(cli)`, `VersionCache` (WeakMap keyed by the `ResolvedCli` object; concurrent
    callers share one process; a failure is dropped). The upper bound compares the release triple,
    so `0.3.0-beta.1` is `above`, `0.2.2-rc.1` `below`, an unlisted `0.2.3-rc.1` `pre-release`.
  - `contracts/capabilities.json`, `contracts/capabilities.schema.json`,
    `contracts/src/capabilities.ts` (`SupportMatrix`, `Capability`, `CapabilityTable`, one export
    line in `contracts/src/index.ts`); `server/src/cli/capabilities.ts` — `CAPABILITIES` (checked
    at load: schema + unique ids), `evaluateCapabilities(version, range, { conditions?, table? })`
    → `{capabilities: [{id, state, reason?}], missing: [{id, minVersion}]}`; reasons are codes +
    arguments for the web catalogue (`unsupported-version {range{min,max}}`, `not-released`,
    `needs-version {minVersion}`).
  - `WingfoilCli.resolved` getter (`server/src/cli/adapter.ts`).
  - `test/contracts/support.ts` — `cliBuildFor(version, { cacheRoot?, install? })` is now async:
    pinned → `pinnedCli()`; another exact version → installed once with npm (`npm_execpath` run
    by this Node.js, else `npm`; `--no-save --ignore-scripts`) into
    `node_modules/.cache/wingfoil-ui-matrix/<version>`, reused when present, refused when the
    install gives another version. Callers in `cli-contract.test.ts` / `capture-samples.test.ts`
    await it. The real npm path is not exercised (matrix of one; needs the registry).
  - Root `README.md` "Supported WingFoil versions" (range, matrix, capability table), checked by
    `capabilities.test.ts` against `matrix.json`/`capabilities.json`; `test/README.md` 0.7.
- **AC → test:**
  - TT-INT-02 — S-09.1/S-09.2: `version-detection.test.ts` (kanban + version-fake 0.4.0 →
    `above`, 0.2.0 → `below`; 0 enabled capabilities; every reason `unsupported-version` with
    `{min: '0.2.2', max: '0.2.x'}`); units `version.test.ts`; README review:
    `capabilities.test.ts` "package README". "A version inside passes every scenario of the
    release": the release suite runs on the pinned 0.2.2.
  - TT-INT-03 — `capabilities.test.ts` (schema, 100 % `minVersion` declared — 9/9 —, §6 rows);
    S-08.1 (pinned 0.2.2: `in-range`, source `project`, `missing` `[]`, the four 0.2.2
    capabilities enabled), S-08.2 (PATH install: source `path`) in `version-detection.test.ts`;
    evaluation units in `capabilities.test.ts`. Header texts: task-016.
- **Deviations (honest):** range upper bound and `field-editing` `minVersion: null` are my
  readings of spec gaps 1–2 (design); versioned schema variants not implemented (nothing to select
  with a matrix of one — release-planning adds the selection with the second version); the
  `--version` cache is per `ResolvedCli` object identity, so it only helps when the caller keeps
  the resolution (task-010).
- **Hand-overs:**
  - **task-012** (`GET /api/server`, `GET /api/p/:pid`): range `supportedRange()` (send `{min,
    max}`), table `CAPABILITIES`; per project keep one `VersionCache` for the server, call
    `cache.detect(cli)` → `DetectedVersion {text, version, state, inRange, source}` and
    `evaluateCapabilities(detected, supportedRange(), { conditions })`. A rejected `detect`
    (refusal/timeout/process error of `--version`) is a CLI error → `cliErrorEnvelope`. Header:
    "WingFoil <version ?? text> [(from PATH) when source === 'path']", out of range → "read-only:
    supported <min> to <max>". `contracts/api` schemas for these shapes are 012's.
  - **task-011 / write routes (v0.2):** spec-003 §6 rule 2 and spec-004 §4 row 6
    (`unsupported-version`, 409) = `!detected.inRange`, from the cache (no process).
  - **task-010:** keep the `ResolvedCli` object between snapshots and replace it only on
    re-resolution (`node_modules/wingfoil/package.json` change), so `--version` runs once per
    resolution; a new object triggers a new detection automatically.
  - **task-016:** catalogue keys `capability.<id>`, reason codes above; the notice is
    `missing.length === 0` → "Every capability of this release is available".
  - **release-planning (matrix advance):** add the version to `matrix.json` (the range follows),
    update `capabilities.json` and the README section (test enforces), `npm run test:contract`
    installs the new build via `cliBuildFor`; add a versioned schema variant only for a changed
    shape.
- **Checks (refactor, load average 60–75 on 12 cores):** typecheck, lint, format:check clean ·
  `docs:api` OK · `test:e2e` 3/3 · `check_tasks.py` OK · `npx vitest run --coverage
  --coverage.reportOnFailure` 46 files, **613 passed / 2 failed / 1 skipped**: the two failures
  are the known bug-001 timing tests (TypeDoc build > 30 s, REQ-PERF-06), re-run alone the
  TypeDoc build still fails at load 73. Coverage **96.31 %** statements / 90.13 % branches /
  96.14 % functions / 98.07 % lines; `version.ts` 98.97 %, `capabilities.ts` 100 % statements
  after the table-check test.

### review (2026-10-05)

- Review round 1: **PASS** with fixes, all taken:
  - 4 — new test: two `WingfoilCli` built from one `ResolvedCli` share a single `--version`; a
    copy of the resolution is detected again (a cache keyed by the adapter would fail it).
  - 5 — `capabilities.schema.json` is registered in `CONTRACT_SCHEMAS` (`server/src/contracts.ts`);
    `checkCapabilityTable` uses `schemaProblems` (no second Ajv).
  - 6 — `cliBuildFor` installs into a `mkdtemp` staging folder next to the prefix and renames it
    into place; when the rename fails, a concurrent winner with the right version is accepted.
    Tests: parallel installs of one version, no staging folder left, a wrong-version install
    leaves no prefix.
  - 7 — `npmInstall` TSDoc: no shell only through `npm_execpath`; plain `npm` is found by
    `execFile` on Linux/macOS only (on Windows run the tests through `npm run`).
  - 8 — the always-true `validate.errors` assertion is gone; the README check compares the
    "Minimum WingFoil" column exactly; the output-error test asserts the logged
    `Unexpected output of --version`.
  - 9 — `parseSemVer` TSDoc: a numeric part or pre-release identifier above 2^53 − 1 is refused
    (unrecognised, the conservative side); tests for 2^53 − 1 accepted and above refused.
  - The lower-bound rule is not changed (pending spec gap 1).
- **Hand-over addition (task-011 / merge):** `cliBuildFor` is now async: any new caller (e.g.
  task-011's `test/contracts/descriptor-contract.test.ts`) must `await` it.
- Checks: `npx vitest run test/server/cli test/contracts/{capabilities,support,schemas}.test.ts`
  9 files, 160/160 · typecheck, lint, format:check clean · `docs:api` OK (load average ≈ 64).
- Review round 2: **PASS**, follow-ups taken (`test/contracts/support.ts`):
  - N1 — a broken existing prefix (unreadable or wrong-version `package.json`) no longer blocks
    forever: when the rename fails and the prefix is invalid, it is moved aside to
    `<prefix>.stale-<uuid>`, removed, and the rename retried once. Test starts from a truncated
    `package.json`.
  - N2 — on entry, `<version>.tmp-*` / `.stale-*` siblings older than `ORPHAN_AGE_MS` (6 h,
    option `orphanAgeMs`) are removed; recent ones (a live worker) are kept. Test with `utimes`.
  - Lower-bound rule unchanged (pending spec gap 1).
- Review round 3: **PASS**, follow-ups taken (`test/contracts/support.ts`):
  - R1 — `moveIntoPlace`: a folder moved aside that holds the requested version (a winner that
    landed between the check and the move) is renamed back and kept; our staging is discarded.
    No lock file. Tested: a concurrent worker replacing the broken prefix during our install is
    kept. The narrower check-to-move window itself has no deterministic test (it would need a
    file-system hook).
  - R2 — orphan cleanup now runs on every non-pinned call, before the version check (fast path
    included; tested). This corrects the round 2 note: in round 2 the cleanup ran only on the
    install path, not "on entry".

### spec gaps decided (2026-10-06)

- Decided by the user 2026-10-06 (all option a); the coordinator amends REQ-INT-02/03,
  `adr-001` D3 and spec-001 §5/§6 on `main` (received through the merge of `main` before submit):
  1. Range = the **declared minimum** + the caret line of the highest contract-tested version
     (label `X.Y.x`). Implemented: `contracts/matrix.json` gains `"min": "0.2.2"` (no matrix
     schema exists; `SupportMatrix.min` in `contracts/src/capabilities.ts`); `rangeFromMatrix`
     takes the lower bound from `min`, not from the lowest listed version, and fails loudly at
     load when `min` is not semantic or lies above a listed version. Tests in `version.test.ts`
     (declared min below every listed version, the two refusals); the README check asserts
     `supportedRange().min === matrix.min`; README text updated.
  2. `minVersion: null` = not released, reason `not-released` — kept.
  3. `capabilities.json` shape — kept.
- Checks: `npx vitest run test/server/cli test/contracts/{capabilities,schemas,support}.test.ts`
  9 files, 165/165 · typecheck, lint, format:check clean · `docs:api` OK.
