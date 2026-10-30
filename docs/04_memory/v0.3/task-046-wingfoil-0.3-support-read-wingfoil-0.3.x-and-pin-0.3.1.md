---
id: task-046-wingfoil-0.3-support-read-wingfoil-0.3.x-and-pin-0.3.1
type: task
title: "WingFoil 0.3 support: read WingFoil 0.3.x and pin 0.3.1"
status: in-review
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

### D46-5 — WingFoil processes without optional git locks (2026-10-29)

- **Decision (the approver, 2026-10-29, option A of the open point above):** the adapter runs every
  WingFoil process with `GIT_OPTIONAL_LOCKS=0` added to its environment (the given one, or the
  server's) — `server/src/cli/adapter.ts` `exec`. WingFoil 0.3.1's `workflow list` runs `git status`
  with optional locks (`dist/core/workflow-deduction.js`), which rewrote a stale `.git/index` during a
  read; commits take required locks, so writes are unaffected. spec-001 §1 amended (Process Note);
  adr-001 and spec-004 do not describe the CLI's environment. spec-001's frontmatter (`scope`,
  `wingfoil_version`) now names 0.2.2 and 0.3.1; `docs/user-guide.md` and `BOOTSTRAP.md` stay as they
  are (true for the released v0.2, historical).
- **Red** (`25939b6`), `test/server/cli/adapter.test.ts` *D46-5*: the spawned environment carries
  `GIT_OPTIONAL_LOCKS=0` (a given environment's `1` replaced, the inherited one extended) for a read,
  a write and `--version`; and a regression on the real pinned CLI: a tracked file's timestamps moved
  (`utimes`), then `workflow list` through the adapter, twice — `.git/index` byte-identical. Both
  failed before the fix (`expected { PATH: '/bin', … } to deeply equal …`; `expected false to be
  true`); green with `acad38f`, and failing again with the fix removed (checked).
- **TT-PERF-05** (`test/server/snapshot/process-audit.test.ts`, the file alone, 10 runs in a row
  through the slot): 10/10 passed, 3/3 tests each, load 1.85–5.45. It also passed in the two full
  runs after the fix at higher load (`test:coverage`, load 6.8 → 25.6; strict-identity `npm test`,
  11.6 → 21.3), where it had failed twice before (16 and 17 processes against 13).
- **AC-5.1** (`test/e2e/no-commit.spec.ts` on the three engines): 3/3 passed (load 4.9 → 10.4), and
  in the full three-engine run below.

### Decisions beyond the design (for the review)

Each one follows what the pinned 0.3.1 does; none loosens an expectation of 0.2.2.

1. **stderr warnings as JSON lines** — 0.3 writes each warning as `{"warning": "<text>"}` under
   `--format json`; the adapter passes on its text, sanitised (`warningText`, `84936eb`; red in
   `bef3870`); any other line as written. spec-001 §2.
2. **A failed commit is atomic on 0.3.1 → 422** — a stale `index.lock` or a failing `pre-commit`:
   `E_COMMIT_FAILED … nothing was committed, and the working tree and the index are as they were`
   (exit 1) → 422 `cli-refused`, file unchanged, nothing logged or announced, no root in the body;
   W-30's `write-incomplete` (500) path stays tested on a 0.2.2 build of the kanban fixture
   (`cliBuildFor('0.2.2')`), and N1 (no reason in the log) on both versions.
3. **TT-ARC-04 spy allowance** — the sanitiser of 0.3's `diagnostics` resolves the CLI's own folder
   (`node_modules/wingfoil`, `realpath` for the redaction of `<wingfoil>`), never reads it: allowed in
   `test/server/reads/project-reads.test.ts` as a resolved sanitiser root; the file-read checks are
   unchanged. `toolText` sanitises each distinct text once (a configuration repeats codes and files).
4. **D46-5** — `GIT_OPTIONAL_LOCKS=0` (above).
5. **Other changed expectations:** the `--version` text matched with `pinnedVersionText()` (harness);
   range label `0.2.2 to 0.3.x`; `plan` in the `kanban`/`scrum` type lists (harness, e2e S-28.1); e2e
   S-08.1/S-08.2 `WingFoil 0.3.1`; S-27.1: 0.3.1 names `dna.yaml` relative to the project (the root
   redaction stays proved on the adapter); W-29's wording names `WingFoil-Version:`; an exit-2
   usage error is JSON, its logged kind `usage error`; 0.3.1 knows the directive field `scope` (the
   warning test uses `flavour`); `dna.yaml`'s `name:` keeps a comment (projects test regex); the
   optional-fields contract test commits its edits (0.3.1 reads workflows at HEAD); the install
   refusal test uses an unpinned version (0.6.1); the capability unit test of a v0.4 table gives its
   workflow rows a `via`.

### Gates after D46-5 (on `b74c49d`, pin 0.3.1, through the slot; load at grant → end — superseded by review round 1)

| Gate | Result |
|------|--------|
| typecheck, lint, format:check, `docs:api` | clean — last run on `b74c49d`'s parent `acad38f`, before the spec commit (c3) |
| `test:contract` (0.2.2, 0.3.1) (9.3 → 7.1) | 312 passed, 1 skipped |
| `test:coverage` (6.8 → 25.6) | 3299 passed, 1 skipped; 96.59 % statements, 91.45 % branches, 97.31 % functions, 98.36 % lines |
| `npm test`, strict identity (11.6 → 21.3) | 3299 passed, 1 skipped |
| `test:e2e`, Chromium, Firefox, WebKit (1.8 → 29.6) | 935 passed, 0 failed (Firefox M-02.2 included); an earlier run (granted at 12.5) was cut by an app crash at 441 passed, 0 failed |
| `test:e2e -- no-commit.spec.ts` (4.9 → 10.4) | 3/3 |
| process audit ×10 (1.9–5.5) | 10/10 |
| `test:smoke` (11.6 → 9.9), `test:publish-smoke` (5.2 → 4.5) | 4/4, 11/11 — run on `567bf4a` (corrected in review round 1, c3); D46-5 changes neither packaging, the launcher nor the bin |
| strict-identity `test:e2e:chromium` (3.9 → 14.2) | run on `567bf4a` (corrected in review round 1, c3): 317 passed, 2 failed (AC-5.1 — fixed by D46-5, 3/3 since; S-27.1 — fixed in `bffd97f`) |
| `check_tasks.py v0.3` | the 28 expected "listed by 0 tasks", none naming task-046 |

### review round 1 (2026-10-29)

Both independent reviewers: **FAIL**. The approver confirmed fixing every finding in one round.
Red tests in `892896c` (8 failed: M1 × 3, m1 × 2, n1, n3, the refusal after warning lines); fixes in
`36684d4`; docs in `a3da7c9`; the public-text fix of the new runner test in `38351f3`.

| Finding | What changed | Commit | Guard |
|---------|--------------|--------|-------|
| **M1** (major, security) — 0.3.1's `workflow list` runs `git status` on every `GET /config`: a configured `core.fsmonitor` ran (4× per read) | **D46-6:** `ProcessRequest.gitConfig`, rendered by the runner as `GIT_CONFIG_COUNT`/`KEY_n`/`VALUE_n` after `gitEnv` dropped the inherited ones (`withGitConfig`); the adapter asks `core.fsmonitor=false` for every WingFoil process, writes included. Probe: a marker fsmonitor ran 4× through 0.3.1 `workflow list` with `GIT_OPTIONAL_LOCKS=0` alone, 0× with the environment setting, 0× on a `memory submit`. spec-001 §1, spec-010 §6 (the W4-5 text holds; the CLI's git now named, the filter residual covers its status reads) | `892896c` red, `36684d4` | runner unit (inherited `GIT_CONFIG_*`, a lower-case key, `GIT_CONFIG_PARAMETERS` dropped, the two settings rendered); adapter unit (`gitConfig` on a read, a write, `--version`); real pinned CLI: marker fsmonitor in `.git/config`, stale index, `workflow list`, `dna show`, `memory search`, `directives list`, `memory submit` → marker never written — all three failed before the fix |
| **m1** (minor) — no total cap on diagnostics and warnings | `MAX_TOOL_LINES` = 200 (`commands.ts`): the first 200 diagnostics kept before sanitising, `diagnosticsOmitted` (schema v0.3 branch, `WorkflowList03`, spec-001 §3, spec-004 §3); stderr warnings: the first 200, then `<n> more warnings omitted` (`capped`, spec-001 §2) | `36684d4` | 20 000 diagnostics → 200 + 19 800; 5 000 warnings → 200 + 1 line — both failed before |
| **n1** — an unrecognised `--version` text reached the header unsanitised | `wingfoilOf` sends `wingfoil.text` through `redactLocalPaths` (project root) | `36684d4` | project-routes: a stub printing the folder, ESC and RLO → `banana <project>/x \x1b[31m\u202etxt`, no folder in the body — failed before; the tool-message tripwire lists `project-routes.ts` |
| **n2** — the TT-ARC-04 allowance exempted any call on `node_modules/wingfoil` | limited to `realpath`/`stat`/`lstat` (sync and promise forms) | `892896c` | a tightening: no other call on that folder happens, so no failing case exists to show |
| **n3** — a differently-cased `GIT_OPTIONAL_LOCKS` could stay beside ours (Windows) | `withoutOptionalLocks` removes every spelling first; the `GIT_CONFIG_*` of M1 are already dropped case-insensitively by `gitEnv` | `36684d4` | `git_optional_locks: '1'` → only `GIT_OPTIONAL_LOCKS: '0'` — failed before |
| (display) a refusal with JSON warning lines before `{"error"}` | `refusalMessage` reads the whole text, else the last line with a string `error` | `36684d4` | failed before (the whole stderr shown) |
| **c1** — spec-001 §2 said exit 2 is plain text | §2 row: 0.2.2 plain text or JSON (W-22), 0.3.x JSON; refusal and warning rows updated | `a3da7c9` | — |
| **c2** — the optional-fields contract test passed with `bug-ingest` absent | the entry asserted present first | `892896c` | — |
| **c3** — the gate table named wrong commits; light gates not re-run after D46-5 | earlier table corrected (smoke, publish-smoke and the strict Chromium run were on `567bf4a`); every gate below re-run with its commit | this entry | — |
| **c4** — no real-CLI proof of the root redaction (0.3.1 messages are relative) | adapter test on the 0.2.2 build (`cliBuildFor('0.2.2')`): an invalid `dna.yaml`, the raw stderr quotes the folder, the refusal shows `<project>` and never the folder | `892896c` | passed first (characterization); with the redaction removed from the refusal path it failed (the message quoted the fixture folder instead of `<project>`) |
| nits | separate 2026-10-29 Process Note for D46-5/D46-6 in spec-001; `retrospective.yaml` comments kept as paraphrases | `a3da7c9` | — |

**Gates — final (through the slot; commit, load at grant → end).** `test:smoke` and
`test:publish-smoke` not re-run: round 1 changes neither packaging, the launcher nor the bin
(server modules only; their last runs, on `567bf4a`, were green).

| Gate | Commit | Result |
|------|--------|--------|
| typecheck, lint, format:check, `docs:api` | `a3da7c9` | clean, 0 warnings (`38351f3` changes a test string only: typecheck, lint and format re-checked clean) |
| `test:contract` (0.2.2, 0.3.1) | `a3da7c9` (2.4 → 3.9) | 312 passed, 1 skipped |
| `test:coverage` | `a3da7c9` (3.6 → 14.8) | 3307 passed, 1 failed (public-text: a fictitious temporary-folder path in the new runner test → `38351f3`), 1 skipped |
| `npm test`, strict identity | `a3da7c9` (11.1 → 19.4) | the same one failure |
| `test:e2e`, Chromium, Firefox, WebKit | `a3da7c9` (11.5 → 27.4) | **935 passed, 0 failed** |
| `test:coverage` | `38351f3` (13.1 → 24.0) | **3308 passed, 1 skipped**; 96.59 % statements, 91.43 % branches, 97.32 % functions, 98.37 % lines |
| `npm test`, strict identity | `38351f3` (12.0 → 27.3) | **3308 passed, 1 skipped** |
| `check_tasks.py v0.3` | `38351f3` | the 28 expected "listed by 0 tasks", none naming task-046 |

### review round 2 (2026-10-29)

Both fresh reviewers: **FAIL**; the round-1 fixes verified holding. The approver chose to fix every
finding here (M2 option A, the server's own reads included; d1, found by the developer, too). Red
tests in `7796c9c` (M2 × 5, n4, n5/n6, the `usageKind` nit, n7) and `581a6a2` (d1); fixes in
`f97fcc4` and `a055dac`; docs in `483a2aa` and `0e663c6`. Each number below has its log in the
session's scratchpad (`task046-r2-*`, `task046-g7-*`).

- **D46-7 — no transport in a read.** `protocol.allow=never` joins `core.fsmonitor=false` in the
  git configuration of every WingFoil process (the runner's `gitConfig`), `GIT_NO_LAZY_FETCH=1` its
  environment (any other spelling removed); every `GitReads` read gets `-c protocol.allow=never`
  (`NO_TRANSPORT`) and `GIT_NO_LAZY_FETCH=1`. `fetch`, `pull`, `push` and `clone` (`git/transport.ts`)
  keep their own protocol rules: the git, transport, sync, write and project suites pass (14 files,
  481 tests, `task046-r2-transport-tests.log`).
  - **Checked first that no CLI verb the UI runs does transport:** `GIT_TRACE` of every consumed
    command (`--version`, `dna show`, `paths`, `directives list`, `workflow list`, `memory search`
    with and without `--status`, `memory history`, `add`, `submit`, `approve`, `reject`) on scratch
    Kanban repositories with an `origin`: 0.2.2 runs `add`, `commit`, `config`, `diff`, `log`,
    `maintenance`, `rev-parse`, `show`; 0.3.1 also `cat-file`, `for-each-ref`, `hash-object`,
    `ls-files`, `ls-tree`, `status` — no `fetch`, `push`, `pull`, `clone` or `ls-remote`
    (`task046-r2-git-trace.log`; the static search of both builds' `dist/`: `task046-r2-transport-grep.log`).
  - **Regression tests** (`test/server/cli/adapter.test.ts` *D46-7*): a kanban copy made a partial
    clone (`core.repositoryformatversion=1`, `extensions.partialClone=evil`, `remote.evil.promisor`),
    the HEAD blobs of `.wingfoil/*.yaml` removed, a marker program as `remote.evil.uploadpack` (local
    remote) or `core.sshCommand` (`ssh://` remote): the pinned CLI's `workflow list` and `memory
    history`, and the server's `memoryLog` and `status`, never run it; a unit on the request's
    `gitConfig` and environment. All five failed before the fix (`task046-r2-red-m2.log`). Guard
    removal (git 2.43): with neither setting the four real-CLI tests fail again; each setting alone
    kept them green — but only for these two variants on this git (2.43.0, which honours
    `GIT_NO_LAZY_FETCH`) (`task046-r2-guard-m2.log`, `-m2b.log`, `-m2c.log`). Corrected in review
    round 3 (M1): `protocol.allow=never` alone yields to the repository's `protocol.<name>.allow` and
    to an inherited `GIT_ALLOW_PROTOCOL`, and a git that ignores `GIT_NO_LAZY_FETCH` then fetches.
  - spec-010 §6 (the W4-5 sentence: no transport in the server's reads and the CLI's git), spec-001
    §1, both with a 2026-10-29 Process Note.
- **n4** — a `diagnosticsOmitted` the CLI sends is dropped before the server's own is set (red →
  `f97fcc4`).
- **n5, n6** — the CLI's error is the whole text or its last line, `{"error": …}` (`cliError`): no
  line before the last is parsed (a 100 000-line refusal: at most 3 `JSON.parse` calls), and a
  hook's earlier `{"error"}` before a plain-text end does not win — the text is shown as written
  (decided here: the CLI writes its own error last). The `usageKind` nit uses the same rule.
- **n7** — `detectVersion` passes the printed text on through `WingfoilCli.sanitise` (the adapter's
  own roots: the project and the CLI's package folder → `<wingfoil>`); `project-routes` passes it as
  it is; the producer list of `redact.ts`' header comment names the warnings, the diagnostics and
  the `--version` text; the tripwire checks `cli.sanitise(text)` in `version.ts`.
- **n8** — spec-010 §6 W4-11: the residual names `filter.<x>.process` and the repository's own
  `.git/config` as well as included files, and the CLI's status reads (no code change).
- **d1** (developer, pre-existing) — the `warnings` field of `directives list` (`GET
  /api/p/:pid/directives`) reached the API unsanitised and uncapped, while `directiveInForce`'s
  comment said it was sanitised. `toolLines` (`commands.ts`) is now the one path of the `stderr`
  warnings and of that field: sanitised, at most 200 lines, then one counting the rest; the
  comment says where the sanitised text comes from and that a cut warning falls back to the last
  entry. Red: 250 warnings with the project folder, ESC/RLO and a 20 000-character line → 250 lines
  as written; green: 201 lines, `<project>`, escapes, the long line bounded. spec-001 §3, spec-004 §5;
  the tripwire lists `commands.ts`.
- **c5** — CHANGELOG: no fsmonitor and no transport in the console's reads; the filter residual
  stated.
- **c6** — spec-004 §3: the `GET /api/p/:pid` row names the sanitised `wingfoil.text`; §5 the
  warnings cap, for `/config`, `/elements` and `/directives`; the Process Note corrected.
- **nits** — spec-001 §1 and `runner.ts` name the dropped variables (`GIT_CONFIG_GLOBAL`,
  `GIT_CONFIG_NOSYSTEM` kept); the runner test filters only the rendered names (passes with
  `GIT_CONFIG_NOSYSTEM=1` exported).
- **Windows, not verified (candidate WingFoil feedback note for the coordinator):** 0.3.1 spawns a
  bare `git` (`dist/storage/git-read.js` `spawnGit`, `dist/storage/commit.js` `runGit`:
  `spawnSync('git', ['-C', root, …])` with no `cwd`, so the process's — the project root); on
  Windows a `git.exe` in the project root would be found before the `PATH` (`task046-r2-windows-git.log`).
  No code change.

**Gates — final of round 2 (on `db6524f`, through the slot; load at grant → end; logs
`task046-r2-light-db6524f.log`, `task046-g7-*`).** `test:smoke` and `test:publish-smoke` not re-run:
round 2 changes server modules, tests and docs only, not packaging, the launcher or the bin (last
green on `567bf4a`). The gate runs on `483a2aa` were stopped before their slot (superseded by d1).

| Gate | Result |
|------|--------|
| typecheck, lint, format:check, `docs:api` | exit 0 each (`docs:api`: html generated, no warning) |
| `check_tasks.py v0.3` | 28 failures, all "listed by 0 tasks", none naming task-046 |
| `test:contract` (0.2.2, 0.3.1) (3.3 → 6.7) | 312 passed, 1 skipped |
| `test:coverage` (6.3 → 24.0) | 3318 passed, 1 skipped; 96.61 % statements, 91.45 % branches, 97.32 % functions, 98.37 % lines |
| `npm test`, strict identity (11.3 → 24.9) | 3318 passed, 1 skipped |
| `test:e2e`, Chromium, Firefox, WebKit (3.5 → 25.4) | 935 passed, 0 failed |

This entry is a docs-only commit after `db6524f`; on it the light gates, the docs tests and
`check_tasks.py` were re-run (`task046-r2-light-final.log`).

### review round 3 (2026-10-29)

Both fresh reviewers: **FAIL**; the round-2 fixes verified, the n6 decision (the CLI's error is its
last line) agreed by the correctness reviewer and confirmed by the approver, who confirmed fixing
every finding here. Red tests in `b7b26c4`; fixes in `e728268`; docs in `4bc3252`. Logs:
`task046-r3-*` in the session's scratchpad.

| Finding | What changed | Commit | Red / guard |
|---------|--------------|--------|-------------|
| **M1** (major) — D46-7's `protocol.allow=never` was bypassed: git reads `protocol.<name>.allow` (the repository's `.git/config`, which the M2 attacker controls) and an inherited `GIT_ALLOW_PROTOCOL` before the `protocol.allow` default, so on a git that ignores `GIT_NO_LAZY_FETCH` the lazy fetch ran | `READ_GIT_ENV` (`git.ts`): `GIT_ALLOW_PROTOCOL=none` and `GIT_NO_LAZY_FETCH=1`, any inherited spelling removed (case-insensitive), in every `GitReads` read and — through `CLI_GIT_ENV` — every WingFoil process; `protocol.allow=never` and `GIT_NO_LAZY_FETCH=1` kept as extra layers; `git/transport.ts` and `projects/clone.ts` keep setting their own allowed list. D46-7, spec-001 §1, spec-010 §6, CHANGELOG reworded; the round-2 note "each setting alone keeps them green" corrected above | `b7b26c4`, `e728268` | 6 real cases — `protocol.file.allow=always` with a local `uploadpack`, `protocol.ext.allow=always` with `remote.evil.url = ext::<marker> %S`, an inherited `GIT_ALLOW_PROTOCOL=file:ext` — each through the pinned CLI (`workflow list`, `memory history`) and the server's `memoryLog`/`status`, all with a runner that drops `GIT_NO_LAZY_FETCH` (an older git): the marker ran in all 6 before the fix (`task046-r3-red-m1.log`), never after (`task046-r3-green-m1.log`); with `GIT_ALLOW_PROTOCOL` removed from `READ_GIT_ENV` all 6 fail again (`task046-r3-guard-m1.log`). The fetch, pull, push and clone suites, with http, sync, writes, projects and the launcher: 34 files, 982 tests passed (`task046-r3-transport-tests.log`) |
| **m1** (minor, pre-existing) — a failed `git status` read put git's stderr into the log verbatim (an included working-tree file setting `core.bigFileThreshold` to an ESC-coloured marker: `fatal: bad numeric config value …` logged raw on every `/api/p/:pid*` route) | `refusalOf` maps a `GitReadError` to the plain 500 `internal` and logs `{ kind: 'git-read', ended, exitCode }` only, as the repository check does; no code added; spec-004 §5 `internal` row | `b7b26c4`, `e728268` | project-routes: the body `{ code: 'internal', message: 'Internal error' }`, the log holds `git read failed` and neither the marker, ESC nor the fixture folder — red: the raw `GitReadError` message in the log (`task046-r3-red-other.log`) |
| **n1** — the whole `stderr` (up to 64 MiB) split into an array before 200 lines were kept | `boundedLines` (`commands.ts`): the first 200 non-empty lines by an `indexOf` scan, the rest counted; `stderrWarnings` in the adapter | `b7b26c4`, `e728268` | 2 000 000 lines: 200 kept, 1 999 800 counted, `String.prototype.split` never called; CR LF, blank and whitespace-only lines — red: no `boundedLines` |
| **n2** — `memory search`'s `message` reached `/elements` unsanitised | `toolText` sanitises it; the tripwire lists it | `b7b26c4`, `e728268` | the project folder and ESC/RLO in the message → `<project>`, escapes — failed before |
| **c7** — spec-001 §2's exit-1 row still described the backwards scan | "the `error` of the whole text or of its last line only, otherwise the text as written"; Process Note | `4bc3252` | — |

The unit expectations of the CLI's and the reads' environment (`adapter.test.ts`, `git.test.ts`) now
include `GIT_ALLOW_PROTOCOL: 'none'`, and an inherited `git_allow_protocol` / `Git_Allow_Protocol` is
shown replaced.

**Gates — final of round 3 (on `be1ded3`, through the slot; load at grant → end; logs
`task046-r3-light-be1ded3.log`, `task046-g8-*`).** `test:smoke` and `test:publish-smoke` not re-run:
round 3 changes server modules, tests and docs only, not packaging, the launcher or the bin (last
logs `task046-gate-smoke`, `task046-gate-publish-smoke`: exit 0, 2026-10-28).

| Gate | Result |
|------|--------|
| typecheck, lint, format:check, `docs:api` | exit 0 each |
| `check_tasks.py v0.3` | 28 failures, all "listed by 0 tasks", none naming task-046 |
| `test:contract` (0.2.2, 0.3.1) (4.7 → 4.9) | 312 passed, 1 skipped |
| `test:coverage` (4.6 → 15.3) | 3327 passed, 1 skipped; 96.6 % statements, 91.49 % branches, 97.32 % functions, 98.38 % lines |
| `npm test`, strict identity (12.0 → 24.9) | 3327 passed, 1 skipped |
| `test:e2e`, Chromium, Firefox, WebKit (12.5 → 28.1) | 935 passed, 0 failed |

This entry is a docs-only commit after `be1ded3`; on it the light gates, the docs tests and
`check_tasks.py` were re-run (`task046-r3-light-final.log`).

### review round 4 (2026-10-29)

Both fresh reviewers: **FAIL**; the round-3 fixes verified holding (transport traps, hostile
configuration sweep on 0.3.1 and 0.2.2, the read routes, the bounds). The approver confirmed fixing
every finding here. Red tests in `e738617`; fixes in `0eb6fd8`; docs in `3048412`. Logs:
`task046-r4-*` (red, green, guard removal: `task046-r4-guards.log`) and `task046-g9-*`.

| Finding | What changed | Commit | Red / guard |
|---------|--------------|--------|-------------|
| **MAJOR-1** (regression of D46-7) — `GitReads.transport()` merged the reads' environment, so `pull --ff-only` (the user's Update) and the automatic update's `merge --ff-only` inherited `GIT_NO_LAZY_FETCH=1` and failed on every partial clone | `GitReads` keeps `base` (the server's environment cleaned by `gitEnv`) apart from the reads' `env` (`base` + `READ_GIT_ENV`); `transport()` starts from `base`, then the transport's own variables (`transportEnv` / `unattendedEnv`: the allowed list); spec-010 §6 says so | `e738617`, `0eb6fd8` | a `--filter=blob:none` clone of a `file://` bare remote and a new upstream commit: `pull --ff-only` and `fetch` + `merge --ff-only` exited 128 (`lazy fetching disabled`) before, 0 after, HEAD at the upstream commit; a `GitReads` read built from the same environment keeps `GIT_ALLOW_PROTOCOL=none`, `GIT_NO_LAZY_FETCH=1` (a fake runner, not the clone — corrected in round 5, c-nit-2); with `this.env` put back both fail again |
| **MAJOR-2** (pre-existing, widened by 0.3.1) — an empty or relative `PATH` entry made WingFoil's bare `git` (spawned with the project root as working directory) run a `git` the repository ships | **D46-8:** the process runner gives every child (the CLI, git, and what they start) the absolute `PATH` entries only (`childEnv`: `gitEnv`, then `absolutePath` — moved from `git/transport.ts` to `git/git.ts`, still exported by `transport.ts` — then `gitConfig`); spec-001 §1, spec-010 §6 | `e738617`, `0eb6fd8` | runner unit (a `PATH` with empty, `.`, `bin` and `./x` entries between two absolute ones keeps the two absolute ones); a committed executable `git` at the root (logs, then runs the real git) with `PATH` `":"+PATH` and `".:"+PATH`: the pinned CLI's `dna show`, `paths`, `directives list`, `workflow list`, `memory search`, `memory history`, and the 0.2.2 build's same reads, never run it — all 4 failed before and with the filter removed |
| **minor-1** — the m1 rule (a failed git read never logs git's message) did not hold on the write routes: their `GitReadError` reached the global handler, which logged `{ err }` | the global error handler (`http/app.ts`) logs a `GitReadError` as `{ kind: 'git-read', ended, exitCode }` and answers the plain 500, on every route; spec-004 §5 and the CHANGELOG say "on every route" | `e738617`, `0eb6fd8` | `POST …/submit` with the marker configuration: 500 `internal`, the log without the marker, ESC or the folder — failed before; with both mappings removed the read- and write-route tests fail again |
| **n-a** | the long lines of spec-001 §1 and spec-010 §6 rewrapped | `3048412` | — |
| **n-b** | spec-010 §6 names `GitReads` (the identity read uses `gitEnv` only, no transport) | `3048412` | — |
| **n-c** | the test helper renamed `withoutCliGitVariables` | `0eb6fd8` | — |
| **n-d** | spec-001 §1: a user hook that a WingFoil write's commit runs inherits the no-transport variables; a CLI read on a partial clone fails rather than fetch a missing object | `3048412` | — |
| **nit-1** — `boundedLines` sliced every remaining line | the rest is counted by an `indexOf` scan and a character check against the set `trim` removes (checked equal to `trim` over the BMP), no slice; 32 Mi lines: 467 ms (was up to 1.65 s by the reviewer's measure) | `0eb6fd8` | `task046-r4-boundedlines.log`, `task046-r4-blank-set.log` |

Feedback note material (for the coordinator): the earlier Windows suspicion — 0.3.1 spawns a bare
`git` in the project root — is the same class as MAJOR-2, verified here on Linux through a relative
`PATH` entry (0.3.1: every read; 0.2.2: `memory history`).

Server, launcher and harness suites after the fixes: 92 files, 1791 tests passed
(`task046-r4-server-suites.log`).

**Gates — final of round 4 (on `eae30f2`, through the slot; load at grant → end; logs
`task046-r4-light-eae30f2.log`, `task046-g9-*`).** `test:smoke` re-run (D46-8 changes the runner the
launcher's children use); `test:publish-smoke` not re-run — packaging unchanged (last log
`task046-gate-publish-smoke`, exit 0, 2026-10-28).

| Gate | Result |
|------|--------|
| typecheck, lint, format:check, `docs:api` | exit 0 each |
| `check_tasks.py v0.3` | 28 failures, all "listed by 0 tasks", none naming task-046 |
| git, transport, sync, write, project suites (with the partial-clone cases) | 14 files, 484 tests passed |
| `test:contract` (0.2.2, 0.3.1) (1.8 → 2.1) | 312 passed, 1 skipped |
| `test:coverage` (2.0 → 15.5) | 3335 passed, 1 skipped; 96.62 % statements, 91.52 % branches, 97.33 % functions, 98.4 % lines |
| `npm test`, strict identity (11.1 → 16.8) | 3335 passed, 1 skipped |
| `test:e2e`, Chromium, Firefox, WebKit (12.1 → 17.6) | 935 passed, 0 failed |
| `test:smoke` (10.4 → 9.3) | 4/4 |

This entry is a docs-only commit after `eae30f2`; on it the light gates, the docs tests and
`check_tasks.py` were re-run (`task046-r4-light-final.log`).

### review round 5 (2026-10-29)

Both fresh reviewers: **FAIL**, minors only; every round-4 fix verified holding. The approver
confirmed fixing all of them here. Red tests in `4fdc6d4`; fixes in `5f46967`; docs in `9020aec`;
the notes in `cd3d11a`; a test fix of the gate run in `47121f2`. Logs: `task046-r5-*`, `task046-g10-*`; each
gate's `.meta` records the commit it ran on.

| Finding | What changed | Commit | Red / guard |
|---------|--------------|--------|-------------|
| **s-minor-1** (pre-existing) — 0.2.2's `memory history` (`git log --follow`) ran a configured `gpg.program` on a signed-looking commit with `log.showSignature=true` | `log.showSignature=false` joins the CLI's git settings (`CLI_GIT_CONFIG`); spec-010 §6 W4-11 widened to "a program the configuration names that git runs on the read itself", declared rather than guarded key by key; spec-001 §1 | `4fdc6d4`, `5f46967` | a commit with a fake `gpgsig` header, `log.showSignature=true`, `gpg.program=<marker>`: the pinned 0.3.1 already never ran it; the 0.2.2 build ran it before the fix (`task046-r5-red-gpg.log`), not after, both answering their history; with the setting removed the 0.2.2 test fails again (`task046-r5-guard-gpg.log`) |
| **s-minor-2** (consequence of D46-7) — a partial clone cannot be read in full | declared: spec-010 §6 *Known limitation — a partial clone* and CHANGELOG *Known limitations*, with the remedy — corrected in round 6 (r6-minor-1): `git fetch --refetch --no-filter <remote>`, then `git config --unset remote.<remote>.partialclonefilter` (checked by hand, git 2.43, `task046-r6-remedy.log`). `GET /today`'s 500 and the events error of the list and the panel: from the code, not probed. `docs/user-guide.md` describes the released v0.2: the limitation goes into it at v0.3 `user-docs` | docs | — |
| **s-nit-1 … 3** | declared as residuals in spec-001 §1: relative paths in other variables of the server's environment resolve in the project; `npx`/`npm run` put absolute `node_modules/.bin` folders first; a clone runs its committed `node_modules/wingfoil` on its first open. The clone comment of `projects/project-list.ts` says its rule holds at clone time only | `5f46967`, docs | — |
| **s-nit-4** — the identity read ran with `gitEnv` only | `readGitEmail` runs with `NO_FSMONITOR`, `NO_TRANSPORT` and `READ_GIT_ENV`, as `GitReads` | `4fdc6d4`, `5f46967` | the request's arguments and environment — failed before (`task046-r5-red-email.log`) |
| **c-minor-1** — spec-001 §1 claimed untested outcomes (a hook "can use no transport", a partial-clone read "fails instead of fetching") | reworded: what the D46-7 tests show (no promisor program on the CLI's reads) and what is expected, not tested | docs | — |
| **c-minor-2** — "every process" was false for the launcher's browser opener | "every process the process runner starts (the CLI, git and what they start)"; the opener named in spec-001 §1 (it starts outside the runner, not in the project); the opener's `PATH` left as it is | docs | — |
| **c-nit-1** | the D46-8 tests assert that `dna show` answers, so the absent marker means the reads ran | `4fdc6d4` | — |
| **c-nit-2** | the git test renamed (a fake runner with the same environment, not the clone); the round-4 note corrected | `4fdc6d4`, docs | — |
| **c-nit-3** | the Windows residual of D46-8 declared in spec-001 §1 (Node looks a bare command up in the working directory first) | docs | — |

Targeted suites after the fixes: 6 files, 141 tests passed (`task046-r5-green.log`). The runner,
the launcher and the opener are unchanged in this round.

**Gate runs of round 5.** First run on `cd3d11a` (`task046-g10-*`): `test:contract` 312 passed, 1
skipped (1.3 → 3.9); `test:coverage` 3338 passed, 1 skipped (3.6 → 24.0); the strict `npm test` failed
one test — the 0.2.2 W2-1 "stale `.git/index.lock`" test timed out at 30 s (12.0 → 25.2): it built the
0.2.2 kanban fixture inside the test; `47121f2` builds it in the file's `beforeAll` (under the hook's
timeout), and the file alone then passed 65/65 at load 25.1 (`task046-r5-element-writes.log`). The
full `test:e2e` on `cd3d11a` (12.4 → 22.0): 932 passed, 3 failed — [chromium] `accessibility.spec.ts`
X-10.1 and X-10.2 (`openConsole` waits 60 s for the page's banner; it did not show) and [firefox]
`memory-list.spec.ts` M-02.2 (`aria-current` after a click, the default 5 s). Load-bound, not real:
round 5 changes no web code and nothing these tests read (`server/src/cli/adapter.ts` one git setting,
`identity/git-email.ts` the identity read's arguments, a comment); each file alone on its engine
passed (`accessibility.spec.ts` on Chromium 62/62, 9.0 → 15.2; `memory-list.spec.ts` on Firefox 21/21,
11.2 → 19.3), and the next full run passed every one of them. As bug-004 asks, reported with the load,
no load-adaptive branch added.

**Gates — final of round 5 (on `47121f2`, the code of the final HEAD; through the slot; commit and
load at grant → end in each `.meta`; logs `task046-g11-*`).** `test:smoke` not re-run: the runner,
the launcher and the opener are unchanged in round 5 (last run on `eae30f2`, 4/4).

| Gate | Result |
|------|--------|
| `test:coverage` (11.4 → 19.0) | 3338 passed, 1 skipped; 96.62 % statements, 91.52 % branches, 97.33 % functions, 98.4 % lines |
| `npm test`, strict identity (11.6 → 21.4) | 3338 passed, 1 skipped |
| `test:e2e`, Chromium, Firefox, WebKit (12.5 → 15.2) | 935 passed, 0 failed |

On `801d524` (the docs-only commit after `47121f2`): typecheck, lint, format:check, `docs:api` exit 0;
the docs tests 68/68; `check_tasks.py v0.3`: 28 failures, all "listed by 0 tasks", none naming
task-046 (log `task046-r5-light-final.log`); `test:contract` 312 passed, 1 skipped (load 1.3 → 2.8,
`task046-g12-contract.log`).

### review round 6 (2026-10-30, targeted)

Security reviewer: **PASS** — 22 probes: the gpg trap in 12 combinations ran nothing; the identity
read with `include` and `includeIf` variants; the transport, `PATH` and blobless-pull regressions
clean. Correctness reviewer: **FAIL** on one text finding; the approver chose a text fix verified by
the coordinator on the diff (no round 7). All three in this commit:

| Finding | What changed |
|---------|--------------|
| **r6-minor-1** — the partial-clone remedy was wrong: a plain `git fetch --refetch` applies `remote.<r>.partialclonefilter` again, and the setting stays, so the next plain fetch filters again | spec-010 §6, CHANGELOG *Known limitations* and the round-5 s-minor-2 row: `git fetch --refetch --no-filter <remote>`, then `git config --unset remote.<remote>.partialclonefilter`; "once" removed. Checked by hand on git 2.43 (`task046-r6-remedy.log`): a blobless clone of a `file://` remote missing 3 objects; 3 after a plain `--refetch`; 0 after `--refetch --no-filter` (the filter still set); after unsetting it and fetching two new upstream commits, 0 |
| **r6-nit-1** | the round-5 record names the `check_tasks.py` result and its log explicitly |
| **r6-nit-2** | CHANGELOG *Known limitations*: the Today/events-error behaviour marked "from the code, not probed", as in spec-010 §6 |

### For the retrospective of minor-v0.3

- **What happened.** The task was planned as a compatibility change: read the output shapes of
  WingFoil 0.3.x. But a pin advance also changes what the CLI does inside a read: 0.3.1's `workflow
  list` runs `git status` on every `GET /config`, so the CLI's own git entered every read path
  without the guards the server's own git reads had since v0.2. Six review rounds (rounds 1–6
  above) found the cases the new version introduced — a configured fsmonitor (D46-6), the lazy fetch
  of a promisor remote (D46-7), the uncapped diagnostics (round 1 m1) — and two of our own fixes that
  were incomplete or regressed: D46-7 bypassed through `protocol.<name>.allow` (round 3 M1) and the
  transport commands inheriting `GIT_NO_LAZY_FETCH` (round 4 MAJOR-1). They also found cases already
  present in v0.2: the lazy fetch of the server's own `GitReads` (round 2 M2), a relative `PATH`
  entry (round 4 MAJOR-2, D46-8), `gpg.program` in 0.2.2's `memory history` (round 5), git's raw
  stderr in the logs (rounds 3 m1, 4 minor-1) and the unsanitised `/directives` warnings (round 2
  d1).
- **What made it converge.** The fixes stopped being key-by-key once they became one environment
  contract for every child of the process runner (`GIT_ALLOW_PROTOCOL=none`, absolute `PATH` entries,
  `CLI_GIT_CONFIG`), the residuals were declared by category (the W4-11 residual widened in round 5)
  rather than guarded one by one, and the reviewers had to classify each new case as a structural fix
  or a declared residual.
- **Actions proposed.** (a) Plan a pin advance — or any upgrade of a tool the console runs on
  projects — as a security-relevant task: at `design`, a `GIT_TRACE` of every consumed verb, a
  snapshot of `.git` before and after, and a dump of the children's environment on the new binary.
  (b) Keep one environment contract for children, in the runner. (c) From review round 2 on, the
  adversarial reviewer classifies each new case as (a) a structural fix or (b) a declared residual.
- **Cost.** About 1.5 active days and six review rounds.
