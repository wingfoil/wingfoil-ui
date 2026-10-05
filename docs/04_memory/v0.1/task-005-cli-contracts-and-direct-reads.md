---
id: task-005-cli-contracts-and-direct-reads
type: task
title: "CLI contracts and direct reads"
status: in-progress
release: "v0.1"
module: "contracts"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-INT-01"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-004-cli-adapter-discovery-and-invocation"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

`contracts/`: one JSON Schema per consumed CLI command and per directly read file shape (`memory.yaml` subset, element frontmatter, directive frontmatter), captured from WingFoil 0.2.2, the support matrix and the contract tests; the server's direct reads restricted to the allow-list, status cross-check with `memory search` (spec-001 §3–7, adr-001 D1a, D4).

**Backlog items:** TT-INT-01, TT-ARC-04

## Acceptance Criteria

- **TT-INT-01** (REQ-INT-01 — CLI JSON contract): [percentage] 100 % of the CLI commands invoked by the server (static list from the adapter) have a schema and a passing contract test for each WingFoil version of the support matrix. *Verified by:* contract tests (e2e-smoke `contract`).
  Scenarios (`@v0.1`): S-27.1.
- **TT-ARC-04** (REQ-ARC-04 — Reads through the CLI, direct reads on an allow-list): [boolean] A unit test with a file-system spy over every read endpoint records 0 direct reads of `.wingfoil/*.yaml` other than `ui.yaml` and `memory.yaml`, 0 reads of Memory or directive files at a path not returned by the CLI, and 0 writes to any of them; every allow-listed shape has a schema and a passing contract test per supported version; a fixture whose element file `status` differs from `memory search` shows a read error for that element. *Verified by:* unit (fs spy).
  Scenarios (`@v0.1`): S-25.1, S-27.1, M-01.1, R-05.1.

e2e closure — scenarios that need a screen are proved here by API and unit tests on the same fixtures and close in: task-017-memory-list-and-live-refresh: S-25.1, M-01.1; task-019-dna-directives-and-team-views: S-27.1, R-05.1.

## Implementation Notes

- `spec-001` §3–7; `adr-001` D1a, D4; directive `cli-only-writes` §2 (read allow-list); `claim-evidence` (shapes captured from real 0.2.2 output, never from memory).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-05)

- **depends_on acknowledged (dl-015):** task-004 Execution Notes read, review included. Taken
  from its hand-over: validate the data `WingfoilCli.json(words, { options?, positionals?,
  signal? })` returns against the command's schema and throw `CliOutputError` (→ 502
  `cli-output` through `cliErrorEnvelope`) on failure; the static list of consumed commands
  lives here; user values only in `options`/`positionals` (positionals after `--`, W-22); every
  exit 2 stays an adapter defect (W-22); `version()` returns the trimmed text, parsed by task-006.
  Conventions from task-001/002/003/007: tests under `test/` (`test/server/` mirrors
  `server/src`, `test/contracts/` for the schemas), `buildFixture` / `copyFixture` /
  `fixture.env`, the CLI stub and `FakeProcessRunner`; schemas read at run time with Ajv as
  `server/src/state/schema.ts` does for `contracts/state/state.schema.json`; the error envelope of
  `http/app.ts`.
- **Specs:** spec-001 §3–§7, `adr-001` D1a/D4, REQ-INT-01, REQ-ARC-04, directive `cli-only-writes`
  §2 cover the scope; no missing spec. Re-captured on `wingfoil@0.2.2` (fixtures built with the
  harness, `node node_modules/wingfoil/dist/cli.js --format json <command> </dev/null`): every
  §3 shape matches except one detail — `directives list` → `frontmatter.tags` is **absent** for
  directives whose file has no `tags:` (custom fixture: `determinism`, `doc-versioning`,
  `security-secrets`, `traceability`), while §3 writes `tags[]` without `?`. The schema follows
  the real output (tags optional); spec-001 §3 needs a one-character erratum (`tags[]?`) —
  reported to the coordinator, not edited here. Also observed: `dna show` modules carry `path`,
  `project` may carry `license`/`repository`, `stacks.technologies[]` are objects
  `{name, category?, version?, notes?}`, `stacks.methodologies[]` are `{name, phase?}` (all
  accepted as additional properties by §5).
- **Scope boundaries:**
  - here: `contracts/cli/*.schema.json` (one per §3 row: `version`, `dna-show`, `paths`,
    `directives-list`, `workflow-list`, `memory-search` — also for the two `--status` calls,
    `memory-history`, `memory-submit`, `memory-approve`, `memory-reject`, `memory-add`),
    `contracts/files/{memory-yaml,element,directive}.schema.json`, `contracts/matrix.json`
    (support matrix `["0.2.2"]`), their TypeScript types in `contracts/src/`; the static list of
    consumed commands in the server (`server/src/cli/commands.ts`), enforced by the adapter (a
    command not on the list is refused before any process starts) with schema validation of every
    exit-0 output; the direct readers (`server/src/reads/`): `memory.yaml` subset with the §4.1
    resolution rule, element files at a `memory search` path with the `id`/`type`/`status`
    cross-check, directive files at `.wingfoil/<path>` of `directives list`, every path confined
    (lexically and by realpath) to the project; a read facade over CLI reads and direct reads (the
    "read endpoints" of the fs-spy test); the contract tests per matrix version and the captured
    samples.
  - **task-006:** semantic-version parsing and the supported range (it reads `matrix.json`),
    `contracts/capabilities.json` (spec-001 §6), selection of a versioned schema variant by the
    detected version (only 0.2.2 exists: no variant now).
  - **task-012:** the read routes over the facade, the HTTP mapping of a direct-read error (see
    the open point below), REQ-SEC-06 confinement of `/files/*`. **task-010:** caching/batching of
    the reads (one `memory search` per repository state), the local-changes marker (S-25.1's
    marker half). **task-008:** add-project and availability.
- **Open point for task-012 (not blocking here):** spec-004 §5 has no error code for a failed
  direct read (a file outside the allow-list, failing its schema, or an element whose `status`
  differs from `memory search`). This task raises a typed `DirectReadError` and does not map it
  to HTTP.
- **AC classification (T1)** — all **red-first** (no schema, list, reader or contract test exists):
  - TT-INT-01 / S-27.1 — contract tests (`test/contracts/cli-contract.test.ts`): for each version
    of `contracts/matrix.json`, the three fixtures built with that CLI; every command of the
    static list run through the adapter and validated (reads on the fixtures, writes and the
    archived searches on copies); a check that the commands run equal the static list (100 %);
    S-27.1: `dna show` refused with the CLI message on an invalid `dna.yaml` while `memory search`
    still validates. Schema units on the captured samples
    (`test/contracts/samples/wingfoil-0.2.2/`), with negative cases (a missing required field
    fails). Adapter units: unlisted command refused, schema failure → `CliOutputError` (502).
  - TT-ARC-04 / S-25.1 / M-01.1 / R-05.1 — `test/server/reads/*.test.ts`: fs spy
    (`vi.mock('node:fs/promises')`, `node:fs`) over every facade read on the real fixtures:
    reads only `.wingfoil/memory.yaml` and CLI-returned paths, 0 writes; traversal and escaping
    symlinks refused with 0 bytes read; an element whose file `status` changed after
    `memory search` is a read error; S-25.1 (an uncommitted title edit is read as the working
    tree, no read error), M-01.1 (kanban: `task` 4, `bug` 1 from `memory search` + `memory.yaml`
    types), R-05.1 (custom: modules `server`, `web`, `contracts` with descriptions and paths,
    technologies, methodologies with phase, team roles, paths); §4.1 resolution check.
- **Where:** schemas and samples in `contracts/` and `test/contracts/`; npm script
  `test:contract` (= the e2e-smoke `contract` suite: `vitest run test/contracts`).
