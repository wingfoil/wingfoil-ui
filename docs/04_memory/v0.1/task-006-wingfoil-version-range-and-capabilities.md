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
