---
id: task-046-wingfoil-0.3-support-read-wingfoil-0.3.x-and-pin-0.3.1
type: task
title: "WingFoil 0.3 support: read WingFoil 0.3.x and pin 0.3.1"
status: in-progress
release: "v0.3"
module: "governance"      # optional — server | web | contracts (dna.yaml modules)
priority: "high"       # optional — high | medium | low
tags: ["v0.3","governance","wingfoil-0.3"] # optional — additional labels, e.g. [today, a11y]
ref: "GOV"             # optional — backlog item ID, e.g. "TASK-001"
bug: []
depends_on: []
tmpl_version: 260703   # Orignal template version
---

## Description

Governance task of `minor-v0.3`, step 2b of `governance-alignment-rel-v0.3-plan` (decision GA3-9):
the contract probe of step 2 on WingFoil 0.3.1 was red (plan Session log, *Step 2*), so WingFoil
UI cannot advance its pin, and the packs of `wingfoil/wingfoil-templates` (range `>=0.3.0
<=0.3.1`) cannot be adopted. This task makes the server read WingFoil 0.3.x as it reads 0.2.2,
keeps 0.2.2 supported, and advances the pin to `wingfoil@0.3.1` and the support matrix to
[0.2.2, 0.3.1].

The probe found four adaptations of the configuration and the harness (a1 … a4, each valid on 0.2.2
too) and five red results (r1 … r5); this task carries all of them. Its starting point is the
probe's diff (outside the repository; the coordinator hands it over at `design`), not a design: the
design phase decides each point and may replace the probe's fixes.

**Backlog items:** GOV (governance — WingFoil 0.3 support, step 2b of the v0.3 governance
alignment)

## Acceptance Criteria

- **AC-1 — Version text (r1).** A `--version` text `X.Y.Z (<commit sha>)`, as WingFoil 0.3.x prints
  it, is classified by its version (`0.3.1 (870bd44…)` → `0.3.1`, in range); a text that is not a
  semantic version, with or without such a suffix, stays `unrecognised`; the header still shows
  the text the CLI printed. `contracts/cli/version.schema.json` and the version tests cover both
  forms (spec-001 §3, adr-001 D3 amended if its wording requires the bare form).
- **AC-2 — `workflow list` (r2).** The output of 0.2.2 and of 0.3.x both validate against the
  contract (one schema with both shapes, or one per version range — decided at `design`), and
  `GET /api/p/:pid/config` answers a valid `workflows` section for a project on either version;
  what the API passes on is documented (spec-001, spec-004 and `contracts/api/config.schema.json`
  amended as needed). No view starts reading workflow fields it does not read today.
- **AC-3 — 0.3 behaviours in the contract (r3, r4).** The contract expectations follow what each
  version does: `memory add` writes the type's first declared state on 0.3.x (W-21 fixed) and
  `draft` on 0.2.2; the `kanban` fixture's type list follows each version's `init` (a `plan` type
  on 0.3.1). No expectation is loosened for 0.2.2.
- **AC-4 — Configuration and harness (a1 … a4).** `release` lists `features` in
  `template.frontmatter.lists` (`.wingfoil/memory.yaml`); the two `produces` of
  `.wingfoil/workflows/custom/retrospective.yaml` are path patterns; `archiveOne`
  (`test/contracts/support.ts`) matches the `status:` line with or without a trailing comment; the
  `unknown` fixture has one workflow with no Memory action instead of `init`'s. Each one checked on
  0.2.2 and 0.3.1; the `.wingfoil/` changes reviewed by the approver before their commit
  (`governance-alignment-rel-v0.3-plan`).
- **AC-5 — Pin and matrix (r5).** `package.json` and `package-lock.json` pin `wingfoil@0.3.1`;
  `contracts/matrix.json` `min` 0.2.2, `pinned` 0.3.1, `versions` [0.2.2, 0.3.1], its `$comment`
  naming the pre-step before `release-planning` (GA3-5); the samples of both versions captured;
  the README *Supported WingFoil versions* (range `0.2.2 to 0.3.x`, matrix `0.2.2`, `0.3.1`);
  `contracts/capabilities.json` and the README capability table checked: the header names no
  capability as available that this release does not use (the workflow capabilities of 0.3.0 are
  not used by v0.2's views).
- **AC-6 — This repository on the new pin.** `npm run -s wingfoil -- --version`, `workflow list`
  and `memory search` work on this repository with the new pin (every element listed once); the
  `wingfoil-cli` directive's re-check is NOT part of this task (plan step 4), but every surprise
  met here is reported to the coordinator for it.
- **AC-7 — Gates.** `typecheck`, `lint`, `format:check`, `test:contract` (0.2.2 and 0.3.1),
  `test:coverage` (≥ 80 %), `docs:api`, `test:smoke`, `test:publish-smoke`, the e2e suite on
  Chromium, Firefox and WebKit, all on the new pin; the git-touching suites under the
  strict-identity recipe of `test/README.md` (dl-011); heavy gates through the machine-free slot;
  `check_tasks.py v0.3` green. Docs updated in the same change (`test/README.md`, `CLAUDE.md`
  status lines on the pin, `CHANGELOG.md` *Unreleased*).

## Implementation Notes

- Read at `design` the Execution Notes of the v0.1 tasks that built what this task changes:
  task-004 (CLI adapter), task-005 (CLI contracts and direct reads), task-006 (version range and
  capabilities), task-012 (project read API); `depends_on` lists tasks of the same release only.
- The probe (plan Session log *Step 2*): a1 … a4 made the sample capture pass on both versions;
  `test:contract` then gave 10 failures, all on 0.3.1 except the README check.
- `server/src/cli/version.ts` `parseSemVer` is anchored on the whole text; `classifyVersion`
  feeds the header and the read-only rule (spec-003 §6, spec-004 §4).
- `workflow list` is read by `server/src/snapshot/snapshot.ts` (`workflows()`) and passed on by
  `server/src/http/project-routes.ts` (`config`); the web reads no workflow field in v0.2.
- `cliBuildFor` installs a non-pinned matrix version into `node_modules/.cache/wingfoil-ui-matrix/`;
  after the pin change 0.2.2 becomes the cached one.
- Security: no new tool-sourced string reaches an API body unsanitised (0.3.1's `diagnostics` and
  `baseline` included, if passed on).

## Execution Notes

### design (2026-10-28)

**Read (dl-015):** this task; `governance-alignment-rel-v0.3-plan` (Session log *Step 2*: a1 … a4,
r1 … r5; GA3-3 … GA3-6, GA3-9); `dev-loop.yaml`; directive `wingfoil-cli` (W-01 … W-31);
`test/README.md`; `contracts/matrix.json`, `capabilities.json`, `cli/*.schema.json`; `server/src/cli/`
(`version.ts`, `capabilities.ts`, `commands.ts`, `adapter.ts`); `test/contracts/*`; spec-001, spec-004
§3, adr-001 D3/D4; the Execution Notes of task-004, task-005, task-006 and task-012 (v0.1). Taken from
them: the `--version` text is returned trimmed by the adapter and parsed by `version.ts` (task-006);
"a shape that changes in a later version gets a versioned variant" (spec-001 §5), deferred by task-005
and task-006 until a second version entered the matrix — this task is that moment; every exit-0
`stderr` line goes through `redactLocalPaths` (bug-017) and every tool-sourced string must too
(dev-loop lessons, Wave 6); `cliBuildFor` installs a non-pinned matrix version into the matrix cache;
release-planning's matrix-advance recipe (task-005, task-006 hand-overs: re-capture, `test:contract`,
`capabilities.json` and README in step). `depends_on` is empty.

**Probes (2026-10-28,** `wingfoil@0.3.1` installed in a scratch folder, `wingfoil@0.2.2` the pinned
devDependency; scratch repositories with `init --template Kanban` and a clone of this branch):

- `--version` (also with `--format json`): 0.2.2 → `0.2.2`; 0.3.1 → `0.3.1
  (870bd4406f3b9bba5ecde7a5f8198b80c2a98583)`. 0.3.1's `dist/storage/build-stamp.js` builds it as
  `<package version> (<commit>)` from `dist/build-info.json`, the commit being `unknown` when the
  record is missing or not a sha (a dev build); the same stamp is the `WingFoil-Version:` trailer
  0.3.1 adds to every commit it writes.
- `workflow list --format json`: 0.2.2 → `{manifest{version?, include[]}, workflows[{name, kind,
  description?, version?, element?, phases[…]}]}`; 0.3.1 → `{baseline{rev: "HEAD", commit},
  workflows[{name, startable, includable, description (string or null), executableNow}], message?,
  diagnostics[{code, severity, file, path, message}]}` (`dist/core/workflow-list-show.d.ts`
  `ListResult`): no `manifest`, `kind` or `phases`; read "as committed at HEAD"; without `--all`
  only the workflows executable now (the includable subs no open workflow reached are left out).
  `diagnostics` are configuration messages: on this repository with a1/a2, 115 warnings
  (`W_WORKFLOW_UNBOUND_TOKEN`, `W_PHASE_PRODUCES_OWNER_IMPLICIT`, `W_PHASE_ACTION_UNTARGETED`),
  `file` relative to `.wingfoil/`, `message` quoting configuration values.
- This repository's `.wingfoil/` on 0.3.1: `workflow list` refused (exit 1,
  `E_PHASE_PRODUCES_NOT_A_PATH … workflows/custom/retrospective.yaml`, the warnings in the refusal's
  `details`); with a1 + a2 committed: exit 0 on both versions, `stderr` empty; `memory search` 120
  elements on both versions, each id once (AC-6 precondition).
- `init --template Kanban`: 0.2.2 → types `adr, bug, decision-log, release, release-line, task,
  tech-spec`; 0.3.1 → the same plus `plan` (`draft → active → done`); `workflows.yaml` gains
  `format: 1`; the same five workflow files.
- `memory add --type task` on both: `status: draft` (the type's first state); the first-state
  behaviour of a non-`draft` sequence (r3, `story` → `idea` on 0.3.1) is checked by the contract
  test on the `unknown` fixture. The 0.3.1 commit body ends with `WingFoil-Version: 0.3.1 (…)`.

**AC classification (T1):** AC-1, AC-2 (0.3.x shape and the diagnostics sanitiser), AC-3 and the
capability rule of AC-5 are **red-first** (the contract test on 0.3.1 and new units fail today);
AC-4 a1 … a4 are configuration/harness adaptations (characterization: the capture on 0.2.2 already
passes, the red is the 0.3.1 capture); the pin, the matrix and the docs of AC-5, AC-6 and AC-7 are
characterization (the gates).

**Decisions per AC:**

- **AC-1 — version text.** `version.ts` gains `versionCore(text)`: the whole text is a semantic
  version, optionally followed by one space and WingFoil 0.3's build stamp `(<commit>)`, the commit
  7–64 lowercase hex digits or `unknown`; anything else (another suffix, two stamps, a stamp alone,
  a non-semantic core) is `unrecognised`. `classifyVersion` classifies the core; `VersionClass.text`
  stays the trimmed printed text (`GET /api/p/:pid` `wingfoil.text`), `version` the canonical core.
  The web header keeps rendering `version ?? text` (S-08.1 "WingFoil 0.2.2"; 0.3.1 → "WingFoil
  0.3.1"); an unrecognised text is still shown as printed. `version.schema.json` keeps "one
  non-empty line" (the parse is `version.ts`'s, task-005) and its `$comment`/`description` name both
  forms; samples of both versions. adr-001 D3 "The output must be a semantic version" amended (both
  forms); spec-001 §3 `--version` row amended.
- **AC-2 — `workflow list`.** One schema file with the two shapes as `oneOf` branches
  (`definitions.v0.2`, `definitions.v0.3`), mutually exclusive by their required keys (0.2.x
  `manifest` + items `kind`, `phases`; 0.3.x `baseline` + `diagnostics` + items `startable`,
  `includable`, `executableNow`): an output must match exactly one, so neither shape is loosened
  (an output with both `manifest` and `baseline` fails). Selected by shape, not by the detected
  version: the adapter validates without the version (a separate, cached process), and a project
  with an out-of-range or unrecognised version still reads its configuration. The contract test
  asserts each version's output matches its own branch (0.2.2 → `v0.2`, 0.3.1 → `v0.3`).
  `WorkflowList` becomes the union `WorkflowList02 | WorkflowList03` with a type guard.
  `GET /api/p/:pid/config` passes the section on as the CLI answered it (`config.schema.json`
  already `$ref`s the CLI schema), except that every string of a 0.3.x `diagnostics` entry and its
  `message` go through the adapter's one sanitiser (`redactLocalPaths`, as the `stderr` warnings):
  done in the adapter after validation (`commands.ts` `toolText(name, data, redact)`), so no read
  path can skip it. `baseline` is `{rev, commit}` (`rev` the literal `HEAD`, `commit` 40–64 hex,
  enforced by the schema) and passes as is. No view reads a workflow field (unchanged).
  spec-001 §3 (`workflow list` row with the 0.3.x shape), §5 (the variant rule: one schema,
  versioned `oneOf` branches, exactly one matches) and spec-004 §3 (`/config` row) amended.
- **AC-3 — 0.3 behaviours in the contract.** A per-version behaviour table in
  `test/contracts/support.ts` — `behaviours(version)` → `{ addState: 'draft' | 'first-declared',
  kanbanTypes: string[] }`, listing 0.2.2 and 0.3.1 and **throwing for an unlisted matrix version**
  (the next matrix advance must state what that version does, rather than inherit a guess).
  `cli-contract.test.ts`: `memory add` writes `draft` on 0.2.2 (W-21) and the type's first declared
  state on 0.3.1 (`unknown` `story` → `idea`); `cli.version()` is classified (`classifyVersion(text)
  .version === version`). `descriptor-contract.test.ts` S-28.1: the `kanban` type list per version
  (0.3.1 adds `plan`). 0.2.2's expectations are unchanged.
- **AC-4 — configuration and harness (a1 … a4).**
  - a1 `.wingfoil/memory.yaml` `release.template.frontmatter.lists: [ features ]`;
  - a2 `.wingfoil/workflows/custom/retrospective.yaml`: `explore` produces
    `docs/05_plans/{scope}/{id}.md` (the retrospective plan holds the friction inventory —
    `retrospective-rel-v0.2-plan`'s T1 … T12), `capture` produces `docs/04_memory/design/dls/{id}.md`;
    the former texts kept as YAML comments; `version: 1.3` with its history comment;
  - a3 `archiveOne`: `^status: draft\b.*$` (the 0.3.1 template comment after the state);
  - a4 the `unknown` fixture: `init`'s five workflow files removed and `workflows.yaml` replaced by
    one include of `workflows/custom/notes-review.yaml`, a main workflow with one phase and no
    action (0.2.2 needs one include at least; 0.3.1 refuses `init`'s workflows, which name the types
    this schema replaces).
  The `.wingfoil/` diff (a1, a2) goes to the approver before its commit (reported to the
  coordinator); until then it stays uncommitted in the worktree (the `custom` fixture copies the
  working tree's `.wingfoil/`).
- **AC-5 — pin, matrix, capabilities.** Pin `wingfoil@0.3.1` (exact); matrix `min` 0.2.2, `pinned`
  0.3.1, `versions` [0.2.2, 0.3.1], `$comment` naming the pre-step before `release-planning`
  (GA3-5); samples of both versions re-captured; README *Supported WingFoil versions* (`0.2.2 to
  0.3.x`, `0.2.2`, `0.3.1`, the `--version` sentence with the stamp). **Capability rule:** with the
  range reaching 0.3.x, the four rows `workflow-position`, `workflow-next-step`, `workflow-start`,
  `agent-launch` (`minVersion` 0.3.0, `via: null`) would turn `enabled` on a 0.3.1 project and enter
  the version notice of a 0.2.2 project (S-08.1 "Every capability of this release is available"
  would fail). Rule added to `evaluateCapabilities`: a row with `via: null` (no source in this
  release) is never `enabled` and never in `missing`; below its `minVersion` it stays read-only
  `needs-version` (0.2.2 unchanged), at or above it read-only with the new reason
  `not-in-release`; `minVersion: null` keeps `not-released` first. The table keeps WingFoil's
  minimum versions (no data falsified). `contracts/api/project.schema.json` and
  `contracts/src/api.ts` gain the reason; the web renders only `missing` (no catalogue key needed).
  spec-001 §6 amended (`via: null` = not used by this release; the rule).
- **AC-6** — run on the worktree with the new pin (`--version`, `workflow list`, `memory search`,
  each id once), recorded below; every CLI surprise goes to the coordinator, the directive is not
  edited (plan step 4).
- **AC-7** — the gates of the dev-loop rules on the new pin, heavy ones through the slot; the
  strict-identity recipe for the git-touching suites; docs in the same change (`test/README.md`,
  `CHANGELOG.md` *Unreleased*, `CLAUDE.md` pin lines, README).

**Expected knock-on of the pin (to be confirmed by the gates):** every fixture of the default suite
and of the e2e suite is built with 0.3.1 — `kanban` gains the `plan` type (e2e `memory-list.spec.ts`
S-28.1 type list), the range label becomes `0.2.2 to 0.3.x` (unit and e2e tests that read the real
matrix), commits carry the `WingFoil-Version:` trailer. Each such test changes to what the pinned
version does; none is loosened.

**File layout:** `server/src/cli/version.ts`, `capabilities.ts`, `commands.ts`, `adapter.ts`;
`contracts/cli/version.schema.json`, `workflow-list.schema.json`, `contracts/api/project.schema.json`,
`contracts/src/cli.ts`, `api.ts`, `contracts/matrix.json`; `test/contracts/support.ts`,
`cli-contract.test.ts`, `descriptor-contract.test.ts`, `schemas.test.ts`, `samples/wingfoil-0.2.2/`,
`samples/wingfoil-0.3.1/`; `test/harness/fixtures/builder.ts`; `test/server/cli/version.test.ts`,
`capabilities.test.ts`, `adapter.test.ts` (sanitiser); `.wingfoil/memory.yaml`,
`.wingfoil/workflows/custom/retrospective.yaml` (approver); `package.json`, `package-lock.json`;
`README.md`, `test/README.md`, `CHANGELOG.md`, `CLAUDE.md`; spec-001, spec-004, adr-001 (dated
Process Notes, no Version line).

**Test plan:** red first — `version.test.ts` (both forms, the refused suffixes, `unknown`),
`capabilities.test.ts` (the `via: null` rule on 0.2.2 and 0.3.1 with the real table; the v0.4
simulation's rows get a `via`, as v0.4 will), `adapter.test.ts` (a 0.3.x `workflow list` whose
diagnostic quotes the project root and a control character comes back redacted and neutralised),
`schemas.test.ts` (each sample matches exactly one branch; an output with both shapes, a 0.3 entry
without `executableNow`, a `baseline.commit` that is not hex fail; the config section validates
for both), the contract suites on 0.3.1 (r1 … r4); then the pin and the full gates.

**Points for the coordinator:** (1) the `.wingfoil/` diff of a1/a2 for the approver; (2) the
reading of AC-1 "the header still shows the text the CLI printed" — the API keeps the printed text,
the header line shows the canonical version as today (alternative: show the whole stamp);
(3) the capability rule of AC-5 (`via: null`) and its reason code; (4) the AC-2 variant rule (by
shape, `oneOf`) against spec-001 §5's "selected by the detected version".

**Decisions (the approver, in chat, 2026-10-28, through the coordinator):**

- **D46-1** — the `.wingfoil/` diff of a1/a2 as proposed (approver OK 2026-10-28), committed on its
  own before any change that depends on it (`chore(wingfoil): …`).
- **D46-2** — capabilities, option A: a row with `via: null` is never `enabled` and never in
  `missing`; at or above its `minVersion` it is read-only with the reason `not-in-release`; below it
  `needs-version` as before. spec-001 §6 amended; `contracts/api/project.schema.json`,
  `contracts/src/api.ts`.
- **D46-3** — `workflow list` variants, option A: selected by shape (`oneOf`, mutually exclusive
  branches); spec-001 §5 amended.
- **D46-4** — header, option A: the API keeps the printed text (`wingfoil.text`), the header shows
  the canonical version.

### red / green / refactor (2026-10-28 … 2026-10-29)

- **a1/a2** committed on their own after the approver's OK (`d44868a`, D46-1).
- **Red** (`0be9474`, `e893baf`): `test/server/cli/version.test.ts` (7 stamp forms failed, 14
  refused forms already unrecognised), `capabilities.test.ts` (the two D46-2 tests failed),
  `test/server/tool-messages.test.ts` (0.3 diagnostics sanitised; the producer scan),
  `test/contracts/schemas.test.ts` (9 failed: the 0.3.1 samples, the branch tests, the config
  section), `cli-contract.test.ts` on 0.3.1 (r1, r2; the REQ-INT-01 count). The behaviours table
  (`test/contracts/support.ts`) states r3/r4 per version: with it, `memory add` (`unknown` `story` →
  `idea`) and the `kanban` type list (with `plan`) pass on 0.3.1 without product code — they were
  red with the 0.2.2 expectations (plan Session log *Step 2*). Before them, a1 … a4 and the matrix
  [0.2.2, 0.3.1] with both versions' samples (`ace7dfd`; the 0.3.1 `directives-list-shadowed.json`
  made by hand like 0.2.2's).
- **Green** (`11c4c35`): `versionCore`/`classifyVersion` (D46-4); `workflow-list.schema.json` with
  the exclusive branches `v0.2`/`v0.3` (`not` on the other's key; guard removed → "refuses both
  shapes at once" failed), the `WorkflowList02 | WorkflowList03` union, `isWorkflowList02`,
  `toolText` in the adapter (guard removed → both sanitiser tests failed) (D46-3); the `via: null`
  rule and `not-in-release` (D46-2); README section. The optional-fields contract test commits its
  edits: 0.3.1 reads the workflows at HEAD.
- **Pin** (`49ec302`): `wingfoil@0.3.1` exact (package.json, lock: wingfoil and its transitive
  `@modelcontextprotocol/sdk` 1.32 tree); matrix `pinned` 0.3.1 and `$comment` (GA3-5). Samples
  re-captured on the new pin (0.2.2 from the matrix cache): byte-identical, the two hand-made ones
  restored.
- **The suites on the pin** (`34f978f`, `bef3870`, `84936eb`, `bffd97f`) — each change follows what
  0.3.1 does, none loosened for 0.2.2:
  - `--version` text: `pinnedVersionText()` (harness) in the adapter, variants, version-detection,
    snapshot, watcher and project-routes tests; range label `0.2.2 to 0.3.x`;
  - `plan` in the `kanban`/`scrum` type lists (harness, e2e `memory-list.spec.ts` S-28.1); e2e
    `project-header.spec.ts` S-08.1/S-08.2 show `WingFoil 0.3.1`; S-27.1: 0.3.1 names `dna.yaml`
    relative to the project (the root redaction stays proved on the adapter);
  - 0.3.1 keeps the template comment after `name:` in `dna.yaml` (projects test regex);
  - **W-30 fixed on 0.3.1:** a failed commit (stale `index.lock`, failing `pre-commit`) is refused
    with `E_COMMIT_FAILED … nothing was committed, and the working tree and the index are as they
    were` (exit 1) → 422 `cli-refused`, file unchanged; the `write-incomplete` (500) path stays
    tested on a 0.2.2 build of the kanban fixture (`cliBuildFor('0.2.2')`), with N1 on both;
  - W-29's message names `WingFoil-Version:`; a usage error (exit 2) is JSON on 0.3.1, so its
    logged kind is `usage error`; 0.3.1 knows the directive field `scope` (the test uses another);
  - **0.3 writes each stderr warning as a JSON line** `{"warning": "…"}`: red test, then
    `warningText` in the adapter (the text, sanitised; other lines as written); spec-001 §2;
  - the sanitiser of 0.3's diagnostics resolves the CLI's folder (`node_modules/wingfoil`, never
    read) — allowed in the TT-ARC-04 spy as a sanitiser root; `toolText` sanitises each distinct
    text once.
- **AC-6** (worktree, pin 0.3.1): `npm run -s wingfoil -- --version` → `0.3.1 (870bd44…)`;
  `workflow list --format json` exit 0, stderr empty, 5 workflows, 115 diagnostics (98
  `W_WORKFLOW_UNBOUND_TOKEN`, 10 `W_PHASE_PRODUCES_OWNER_IMPLICIT`, 4 `W_PHASE_TOKEN_OUT_OF_SCOPE`, 1
  each `W_PHASE_ACTION_UNTARGETED`, `W_PHASE_FALLBACK_NOT_REENTRANT`, `W_INSTANCE_WORKFLOW_UNKNOWN`);
  `memory search` 120 matches, 120 distinct ids (120 Memory files with an `id:`).
- **Open (reported to the coordinator, waiting):** 0.3.1 `workflow list` rewrites `.git/index`
  (`git status` with optional locks in `dist/core/workflow-deduction.js`; none of the other reads,
  nor 0.2.2): e2e `no-commit.spec.ts` AC-5.1 fails on the three engines (`.git/index rewritten`),
  and TT-PERF-05's "0 processes when reopened unchanged" failed in 2 of 4 full runs (16, 17 against
  13). `GIT_OPTIONAL_LOCKS=0` in the CLI's environment keeps the index unchanged (probe).

**Gates on the pin (2026-10-28/29, through the slot; load at grant → end):**

| Gate | Result |
|------|--------|
| typecheck, lint, format:check | clean |
| `docs:api` | 0 errors, 0 warnings |
| `test:contract` (0.2.2, 0.3.1) | 312 passed, 1 skipped (support.test fixed after: 8/8) |
| `test:coverage` (3.6 → 20.2) | 3297 passed, 1 skipped; 96.58 % statements, 91.43 % branches, 97.31 % functions, 98.36 % lines |
| `test:smoke` (11.6 → 9.9) | 4/4 |
| `test:publish-smoke` (5.2 → 4.5) | 11/11 |
| `test:e2e:chromium`, strict identity (3.9 → 14.2) | 317 passed, 2 failed: AC-5.1 (open point), S-27.1 (fixed, `bffd97f`) |
| `npm test`, strict identity (10.6 → 23.3) | 3296 passed, 1 failed (TT-PERF-05, open point), 1 skipped |
| `test:e2e` three engines (11.6 → 18.4) | 931 passed, 4 failed: AC-5.1 × 3 (open point), Firefox M-02.2 (5 s `aria-current` wait under load; `memory-list.spec.ts` alone on Firefox 21/21, load 10.8) |
| `check_tasks.py v0.3` | the 28 expected "listed by 0 tasks", none naming task-046 |
