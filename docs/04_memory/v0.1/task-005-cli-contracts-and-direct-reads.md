---
id: task-005-cli-contracts-and-direct-reads
type: task
title: "CLI contracts and direct reads"
status: done
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

### red / green / refactor (2026-10-05)

- **Samples first (claim-evidence):** `test/contracts/capture-samples.test.ts` (skipped unless
  `WFUI_CAPTURE_SAMPLES=1`) built the three fixtures with `wingfoil@0.2.2` (test clock
  2026-10-02T15:30Z) and saved the raw CLI output of every §3 command — reads on the fixtures,
  `submit`/`approve`/`reject`/`add` on copies, the two `--status` searches after one element is
  archived (kanban: `memory deprecate` of the bug; custom: the ADR's working-tree `status:
  superseded`) — plus the allow-listed files as found, under
  `test/contracts/samples/wingfoil-0.2.2/<fixture>/` (Prettier-ignored). One more sample by hand
  on a kanban copy: `directives-list-shadowed.json` (two files with id `testing`).
- **Red** (`5c3b7cf`): `test/contracts/{schemas,cli-contract}.test.ts`,
  `test/server/cli/commands.test.ts`, `test/server/reads/{memory-yaml,files,project-reads}.test.ts`;
  all six files failed on the missing modules (`Cannot find module
  '…/server/src/cli/commands.js'`, `'…/server/src/reads/confine.js'`). One task-004 test changed
  its call to the new rule (`memory submit` id as a positional, no longer a command word).
- **Green — built:**
  - `contracts/cli/*.schema.json` (11: `version`, `dna-show`, `paths`, `directives-list`,
    `workflow-list`, `memory-search`, `memory-history`, `memory-submit`, `memory-approve`,
    `memory-reject`, `memory-add`), `contracts/files/{memory-yaml,element,directive}.schema.json`,
    each with `$comment: "wingfoil 0.2.2 — captured from …"`; additional properties accepted, the
    fields the UI reads required. `contracts/matrix.json` `{pinned: "0.2.2", versions: ["0.2.2"]}`.
    Types in `contracts/src/cli.ts`, `contracts/src/files.ts` (exported by the package index).
  - `server/src/cli/commands.ts` — `CLI_COMMANDS`, the static list of §3 with `since`;
    `CliCommandOutputs`; `commandFor(words)`, `outputProblem(name, data)`.
    `server/src/contracts.ts` — the schemas compiled once at load, `schemaProblems(file, data)`
    (instance path + message, never a value).
  - `server/src/cli/adapter.ts` — `json(words, …)` refuses a command not on the list before any
    process (`CliInternalError` "command not on the static list: …", logged); every exit-0 output
    and the `--version` text (one non-empty line) validated: a failure is a `CliOutputError`
    (`problems`, 502 `cli-output`), logged with the problems only. New `run(name, args)` typed by
    the command.
  - `server/src/reads/` — `confine.ts` (`ReadFs`: `readFile`/`realpath` only; `confinedPath` /
    `readConfined`: empty, NUL, POSIX or Windows absolute, `..` refused lexically, then the base
    and the target realpath'd and compared — no byte outside is read; `DirectReadError` with
    `kind` ∈ `outside | missing | shape | mismatch` and the CLI-given `file`); `frontmatter.ts`
    (YAML 1.2 core via `yaml`, the frontmatter between the first two `---` lines);
    `memory-yaml.ts` (§4.1 subset — `template.frontmatter.required` exposed as `required` —,
    `resolveStates`, `declaredStates`, `transitionTarget` mirroring WingFoil 0.2.2's
    `resolveTransitionTarget`, `BUILT_IN_STATES`); `element.ts` (`id`/`type`/`status` cross-check);
    `directive.ts` (confined to `.wingfoil/`, `id` cross-check); `project-reads.ts` —
    `ProjectReads`, the read facade: `dna`, `paths`, `workflows`, `directives`, `elements`,
    `archivedElements(status)`, `history(id)`, `memoryTypes`, `elementFromMatch`, `element(id)`
    (default search, then the archived ones lazily), `directiveFromEntry`, `directive(id)`. No path
    is built from a caller's value.
  - `yaml@^2.9.1` added to `@wingfoil-ui/server` dependencies (adr-002 names it; already in the
    lock as a dev dependency of typedoc/vite); npm script `test:contract` (`vitest run
    test/contracts`, the e2e-smoke `contract` suite).
- **How the ACs are proved:**
  - TT-INT-01 / S-27.1 — `test/contracts/cli-contract.test.ts` for every version of
    `matrix.json` (0.2.2): on kanban, custom, unknown every read command and history through the
    adapter (schema-validated), every element and directive file through the readers; writes on
    copies (kanban submit/approve/reject, custom approve ×2/reject, unknown submit/reject, `add` on
    each) and the archived searches; the last test asserts the commands run equal `CLI_COMMANDS`
    (11/11 = 100 %). S-27.1: `dna show` → `CliRefusedError` `E_YAML_PARSE_ERROR (…dna.yaml):
    invalid DNA: YAML parse error …`, `memory search` on the same copy validates.
    `schemas.test.ts`: every sample validates; 16 negative mutations fail; unknown fields pass.
  - TT-ARC-04 — `test/server/reads/project-reads.test.ts`: `vi.mock('node:fs/promises')` and
    `vi.mock('node:fs')` record every call while every facade read runs on kanban and custom: 0
    calls other than reads on project files; 0 reads of `.wingfoil/*.yaml` but `memory.yaml`; the
    files read are exactly `memory.yaml` + the `memory search` paths + `.wingfoil/<directives list
    path>`; directories resolved only for the confinement (root, `.wingfoil`). Status cross-check:
    `memory search`, then the file's `status` changed → `DirectReadError` `mismatch` "…: status
    "approved" differs from memory search ("pending")" for that element, the others read fine.
    Traversal / absolute / escaping-symlink / linked-folder cases in `files.test.ts` (0 reads
    outside). The §4.1 resolution check: every `submit`/`approve`/`reject` in `memory history` of
    the three fixtures, and every write the contract test runs, equals `transitionTarget` of the
    resolved states.
  - S-25.1 (API half: working-tree title read by `memory search` and the reader, no read error;
    the marker is task-010), M-01.1 (kanban `task` 4, `bug` 1, both types in `memory.yaml`),
    R-05.1 (custom `dna show`: modules `server`/`web`/`contracts` with description and path,
    `TypeScript` among technologies, `TDD` phase `delivery`, Morgan's roles, `paths.tests`).
- **Decisions:**
  - `--version` is on the static list with a schema of its own (one non-empty line); parsing the
    semantic version stays task-006's.
  - Directive files also get an `id` cross-check with the list entry (spec-001 §4.3 does not
    require it; same rule as elements).
  - `memory.yaml` read errors (`shape`, `missing`, `outside`) are `DirectReadError`s like the
    element and directive ones; the HTTP mapping is task-012's (open point below).
- **Deviations (honest):**
  - The schema of `directives list` makes `frontmatter.tags` optional, against spec-001 §3's
    `tags[]` — real 0.2.2 output (design note); spec erratum for the coordinator.
  - Coverage of spec-001 §7 "for every version of the matrix": a matrix of one; `cliBuildFor`
    throws for a version other than the pinned one, so a matrix advance must add the install there
    (`test/contracts/support.ts`, documented in `test/README.md`).
  - Fixture-build hooks raised to 600 s, CLI-heavy tests to 120–300 s (`0f2be23`): under a load
    average of ~50 (another project's builds, `ps`: `tsc`/`cli.js`) the contract
    suite's three builds exceeded the 180 s default hook timeout.
- **CLI facts (wingfoil 0.2.2) — new, for the coordinator (directive not edited):**
  - `directives list` omits `frontmatter.tags` when the file has no `tags:` (custom fixture:
    `node …/cli.js --format json directives list` → `determinism`, `doc-versioning`,
    `security-secrets`, `traceability` without `tags`); `ref` likewise.
  - Two directive files with the same id are both listed (built-in first) and `warnings` says
    which is used: `"directive 'testing' defined in directives/built-in/testing.md,
    directives/custom/testing.md; using directives/custom/testing.md"` (sample
    `kanban/directives-list-shadowed.json`). A dangling `roles.yaml` binding gives **no** warning
    without `--role` (W-09 holds only for `--role`): with `- ghost-directive` added under `qa:`,
    `directives list` → `"warnings": []`, `directives list --role qa` → `["directive
    'ghost-directive' bound to role 'qa' has no directive file"]`. The server calls it without
    `--role`, so a dangling binding is invisible to the UI in v0.1.
  - `workflow list` `version` is a number (`1`, `1.1`, `1.4`), not a string; `fallback` may carry
    `set_state` besides `step` (custom `release-planning`, `dev-loop`).
  - `dna show`: `modules[]` carry `path`; `stacks.technologies[]` are `{name, category?, version?,
    notes?}`, `stacks.methodologies[]` `{name, phase?}`; `project` may carry `license`,
    `repository`.
  - `memory history` timestamps carry the committer's offset (`2026-10-05T17:35:06+02:00` for a
    commit made on this machine; fixture commits `+00:00`).
  - `memory deprecate <id> --reason <text>` answers `{id, path, from, to, reason}` (not consumed;
    used by the harness only).
- **Hand-overs:**
  - **task-006:** read `contracts/matrix.json` (`pinned`, `versions`) for the range; add
    `contracts/capabilities.json`; when a second version enters the matrix, a versioned schema
    variant is selected by the detected version (none needed now) and `cliBuildFor` installs it.
  - **task-012:** routes over `ProjectReads` (`/elements/:eid` → `element(id)`, `/directives/:did`
    → `directive(id)`, `/history` → `history(id)`); `CliOutputError` → 502 via
    `cliErrorEnvelope`; **spec-004 §5 has no code for a `DirectReadError`** (element/directive/
    `memory.yaml` read error) — a spec decision is needed at task-012 design (e.g. 502
    `read-error` with `detail { file, kind }`), and the element panel shows it for that element
    only.
  - **task-010:** cache `ProjectReads` results per repository state; `element(id)` and
    `directive(id)` each run the list command again — use `elementFromMatch` /
    `directiveFromEntry` with the cached list.
  - **task-017 / task-019:** screens of S-25.1, M-01.1 / R-05.1, S-27.1 over these reads.
  - **release-planning (matrix advance):** re-capture the samples
    (`WFUI_CAPTURE_SAMPLES=1 npx vitest run test/contracts/capture-samples.test.ts`) and run
    `npm run test:contract`.
- **Checks (refactor, 2026-10-05):** `npx tsc -b server` OK · `npm run -s typecheck` clean ·
  `npm run -s lint` clean · `npm run -s format:check` clean · `npm run -s docs:api` OK (`html
  generated at ./docs-api`) · `npm run -s test:e2e` 3/3 (Chromium) · `npx vitest run --coverage
  --coverage.reportOnFailure` 41 files, **528 passed / 2 failed / 1 skipped** (the capture test):
  the two failures are the timing tests of task-001/002 under a load average of 48–58 on 12 cores
  (another project's builds): TypeDoc build > 30 s and REQ-PERF-06 (max 3074–5150 ms); re-run
  alone, `test/launcher/launcher.test.ts -t REQ-PERF-06` passed (load 46) and
  `test/docs/api-docs.test.ts` 2/2 passed (load 28). Coverage **96.61 %** statements / **90.12 %**
  branches / 96.79 % functions / 98.04 % lines (`server/src/cli` 98.9 %, `server/src/reads`
  99.06 %, `server/src/contracts.ts` 100 % statements). `npx vitest run
  test/contracts/cli-contract.test.ts` 8/8 in 93 s (load ~30); `test/server/reads/project-reads.test.ts`
  6/6 in 72 s.

### review (2026-10-05)

- Independent review of HEAD `89d5d22`: **PASS WITH FIXES** (samples verified byte-identical on
  re-capture). Fixed test-first: red in `8f3c35a`. Before the fixes, the new contract test on a
  mutated kanban copy failed with `CliOutputError: Unexpected output of dna show` even though the
  real 0.2.2 CLI had answered. The units failed for the expected reasons: integer `version`,
  `id_pattern` required, the CRLF body kept `\r`, a linked `.wingfoil` was read, `size` was
  missing, a `..notes` folder was refused, the swapped file was read, and `directive(id)` picked by
  list order.
  - **1–3 (major) schemas stricter than WingFoil 0.2.2** (`3abb6af`), now as `dist/dna/schema.js`,
    `dist/workflow/schema.js` and `dist/memory/schema.js` declare them:
    - `dna show`: `project` and each of its fields, a member's `email`, `stacks.technologies` and
      `stacks.methodologies` are optional. Also relaxed, found in the same file: an agent's
      `approval_authority` and a positive-number `version`.
    - `workflow list`: `manifest.version` and a workflow's `description` are optional.
    - `memory.yaml`: `id_pattern` is optional (`pickType` omits it), `version` is a positive
      number, and an empty `types` is accepted.
    - Types in `contracts/src/cli.ts` and `files.ts` follow, and consumers must handle the absence
      (the R-05.1 test now does). Proof on the real CLI (`cli-contract.test.ts`, "accepts what
      WingFoil itself accepts"): a kanban copy with no `project`, no stack lists, a member without
      `email`, an agent without `approval_authority`, `workflows.yaml` without `version`,
      `bug-ingest` without `description`, `memory.yaml` `version: 1.5`, `adr` without
      `id_pattern` and a type `incident` with `<<: *bug`. `dna show`, `workflow list` and
      `memory search` all validate, and `memoryTypes()` gives `incident` the merged `id_pattern`.
      `schemas.test.ts` adds 8 positive mutation cases.
  - **4 (major) CRLF** (`8b93557`): the frontmatter is split on `\r?\n`, and the body comes back
    with LF line ends. Proved by a unit test and by a CRLF `task-001-login-form.md` on the real
    CLI: `memory search` gives `pending`, and the reader gives `pending` with no mismatch.
  - **5** `parseYaml` resolves merge keys (`merge: true`); the library's alias limit is kept. An
    alias bomb is a `shape` error (unit test).
  - **7** `confinedPath(root, base, rel)`: `realpath(base)` must be the project root or inside it.
    A `.wingfoil` symlinked outside is now `outside` for both `memory.yaml` and directives, and
    nothing under the target is touched.
  - **8** A size cap of `MAX_DIRECT_READ_BYTES` (5 MiB) is checked with `stat` before the read and
    on the text after it; a larger file is a `shape` error "too large (over 5242880 bytes)" and is
    never read. `inside()` now accepts names starting with `..` (`docs/..notes/…`). The path is
    resolved again after the read, so a file swapped for a link out of the folder meanwhile is
    `outside`. `ReadFs` gains `size(file)`, which is still read-only.
  - **9** `directive(id)` reads the entry whose path the warning `directive '<id>' defined in …;
    using <path>` names; the last entry listed is the fallback. Tested with the captured shadowed
    list, also with its entries reversed.
  - **11** A comment on the REQ-INT-01 "100 %" test says it depends on test order (it reads the
    commands the earlier tests ran) and must stay last.
- **Spec errata pending** (the coordinator is proposing them to the user; spec-001 and spec-004
  are not edited here):
  - spec-001 §3: `directives list` `tags[]?`.
  - spec-001 §3: the `dna show` and `workflow list` optional fields above.
  - spec-001 §4.1: `id_pattern` optional and `version` a positive number.
  - spec-001 §4.2: `\r?\n` delimiters.
  - spec-004 §5: `DirectReadError` → 502 `read-error` with `detail { file, kind }`.
- **Hand-over addition (task-012):** never log `DirectReadError.message`, because it embeds file
  values (a `status`, an `id`). Log `{ kind, file }` only.
- **Checks after the fixes (load 2.9–5.5):** `npx tsc -b server`, typecheck, lint and
  format:check are clean · `docs:api` OK · `npx vitest run --coverage --coverage.reportOnFailure`:
  41 files, **547 passed / 1 skipped** (the capture test), 0 failed. The TypeDoc-build and
  REQ-PERF-06 timing tests pass on this quiet machine. Coverage **96.32 %** statements /
  **90.04 %** branches / 96.18 % functions / 98.07 % lines (`server/src/reads` 96.18 %,
  `server/src/cli` 98.9 % statements) · `test:e2e` 3/3.
- Re-verification by the same agent: **PASS** — all 11 findings confirmed fixed (probes re-run
  against the pinned CLI; loosened schemas still refuse `version: 0`, `project: "x"`, `email: 3`,
  a negative memory `version`, a non-string `path`). Nits left as known limits: `stat` then
  `readFile` (a file growing in between is read before the post-read length check; a folder
  swapped and back during the read defeats the re-check — local-only); a FIFO inside the project
  would block the read (no `isFile()` check yet); the yaml library refuses > ~100 uses of one
  anchor (js-yaml does not); the "using <path>" warning regex does not match paths with spaces
  (falls back to the last entry, correct on 0.2.2).
- **Hand-overs (explicit):** task-008 — `dna.project.name` is optional in 0.2.2: the project's
  display name falls back (e.g. to the folder's base name) when it is absent
  (`server/src/state/store.ts` takes `name: string`). task-019 — the DNA view must render without
  `project` fields, stack lists, member `email`, agent `approval_authority`.
- Spec errata no longer pending: spec-001 errata and spec-004 §5 `502 read-error` committed on
  `main` (`aba1464`, decided by the user); `wingfoil-cli` 1.5 (W-09 qualified, W-23, `8fb47e9`).
  `main` merged into this branch before submit; full suite at load ≈ 2: **547 passed, 1 skipped**,
  coverage 96.32 % / 90.04 % · lint, format, typecheck clean · `docs:api` OK · e2e 3/3.
