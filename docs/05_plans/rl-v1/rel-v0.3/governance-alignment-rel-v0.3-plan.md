---
id: governance-alignment-rel-v0.3-plan
type: plan
title: "Governance alignment rel-v0.3"
status: active
version: "0.4"         # optional — plan version
workflow: "governance-alignment"
phase: "rel-v0.3"
scope: "rl-v1/rel-v0.3"
element: "minor-v0.3" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.3"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.4 · **Date:** 2026-11-02 (0.1: plan created, checkpoint decisions GA3-1 … GA3-8; 0.2:
step 1 done, step 2 red on WingFoil 0.3.1, GA3-9 — a governance task for WingFoil 0.3 support, step 2b;
0.3: step 2b done (task-046), step 2 green on the pinned 0.3.1, GA3-10; 0.4: step 3 — the packs
adoption, task-047 / bug-025, GA3-11)
**Branch:** `design/governance-alignment_v0.3`, merged into `main` with `--no-ff` at the close (GA3-1)
**Workflow:** none — an ad-hoc plan, as `governance-alignment-rel-v0.2-plan` (GA-2);
`governance-alignment` is the plan's `workflow` token only. Its outcome is an input of the
`reconcile-governance` phase of `release-planning` for `minor-v0.3`.
**Roles:** tech-lead (the agent: edits, reproductions, notes, review coordination), approver (checkpoint
decisions, OK on each step's diff and on the result) — Roberto Pompermaier is the approver; the agent
has no approval authority.
**Input:** dl-010 (the specification of this pre-step), dl-009 and dl-011 (all `ready`);
`retrospective-rel-v0.2-plan` (inventory T1 … T12, decisions RT2-6 … RT2-18);
`governance-alignment-rel-v0.2-plan` (GA-1 … GA-5) as the precedent; `e2e-smoke-rel-v0.2-plan`
*For the retrospective*; dl-007 and dl-008 (the tailoring to re-apply); directive `wingfoil-cli`
1.12; `docs/wingfoil-feedback/`; `contracts/matrix.json`, `contracts/capabilities.json`; adr-001 D3,
D4; the packs of `wingfoil/wingfoil-templates` at the tags `base@2.0.1`, `software@1.0.0` and
`methodology/scrum@1.0.0` (README *Install and update* of each); WingFoil's v0.3 retrospective
(`docs/04_memory/design/dls/retro-v0.3.md` on `wingfoil/wingfoil` `main`, *Consumer feedback*).

Why now: the retrospective of `minor-v0.2` is done (`retrospective-rel-v0.2-plan` `done`, `6a5ad5c`);
dl-010 places this pre-step before `release-planning` of `minor-v0.3`, once the templates' packs are
published. They were published on 2026-10-28.

Deviation from dl-010 (GA3-2): dl-010 waits for the `base` pack. `base` alone does not cover this
repository, a software project (`release-cycle`, `release-submit`, `release-publishing`, `bug`,
releases), so the approver chose on 2026-10-22 to adopt `base` + `software` + `methodology/scrum`
together and to wait for all three. No WingFoil release installs packs yet (`pack-install` is not
declared for any WingFoil version in the templates' `compat.yaml`): the packs are adopted by hand,
following their READMEs.

Preconditions (checked on 2026-10-28):
- `npm run -s wingfoil -- --version` prints `0.2.2`, the version `package.json` pins for `wingfoil`;
  `npm view wingfoil dist-tags`: `latest` 0.3.1 (versions 0.2.1, 0.2.2, 0.3.0, 0.3.1).
- `main` = `origin/main` = `332e0df`; release `minor-v0.2` `released`; every plan of `rel-v0.2`
  `done`; dl-009 … dl-011 `ready`; bug-019, bug-023 and bug-024 `triaged`, release `v0.3`.
- `contracts/matrix.json`: `min` 0.2.2, `pinned` 0.2.2, `versions` [0.2.2].
- `wingfoil/wingfoil-templates`: tags `base@2.0.1`, `software@1.0.0`, `methodology/scrum@1.0.0`;
  its `catalog.yaml` lists all three `active` with the WingFoil range `>=0.3.0 <=0.3.1`; `software`
  requires `base@^2`, `scrum` requires `base@^2` and `software@^1`.
- npm `wingfoil-ui`: `0.2.0` only, `latest` (the placeholder `0.0.0-stage` was deleted by the
  approver on 2026-10-21).

Produces: the pin and the support matrix on WingFoil 0.3.1 if the contract tests pass (else unchanged);
`.wingfoil/` composed from the three packs with this repository's own entries and the tailoring of
dl-008 re-applied; directive `wingfoil-cli` re-checked against the new pin; the feedback inbox's
first-line rule widened, F-027 filed, the first feedback sync recorded; the header of
`release-publishing.yaml` corrected; `.wingfoil/README.md`, `CLAUDE.md` and the affected docs aligned.
Every `.wingfoil/` change is committed before any later CLI verb (directive `wingfoil-cli` W-24).

## Phases / Steps

| # | Step | Role | Output | Stop-check |
|---|------|------|--------|------------|
| 1 | This plan (`add` + `submit`); the line on the npm placeholder in `minor-v0.2` Execution Notes *Retrospective* | tech-lead | plan `active` | — |
| 2 | **Contract on WingFoil 0.3.1** (GA3-3) — add 0.3.1 to the matrix in the working tree only, capture its samples, run `test:contract` and `capabilities.test.ts`; also `workflow list` and `memory search` of this repository's current `.wingfoil/` under 0.3.1. Green → pin `wingfoil@0.3.1`, matrix `versions` [0.2.2, 0.3.1], `pinned` 0.3.1, `min` 0.2.2 (GA3-4), README *Supported WingFoil versions*, `$comment` of `matrix.json` (GA3-5); default suite after the pin change. Red → nothing committed but the findings; the pin stays 0.2.2, adoption (step 3) stops, the defect is presented to the approver | tech-lead | contract result; pin commit or findings | every contract test green on 0.3.1, or the defect reported |
| 2b | **WingFoil 0.3 support** (GA3-9) — one governance task of `minor-v0.3` (`dev-loop`, its own worktree, a developer agent, an independent review until PASS): the server reads WingFoil 0.3.x as it reads 0.2.2 (the `--version` text, the `workflow list` output, the contract expectations of 0.3's behaviours) with the configuration and harness adaptations of step 2; pin `wingfoil@0.3.1` and the matrix of step 2 in the same task; every gate of the dev-loop rules on the new pin (the three e2e engines included). Then step 2 is re-run on the merged result | developer, reviewer (agents); tech-lead | task `done`, merged into this branch | review PASS; `test:contract` green on 0.2.2 and 0.3.1 |
| 3 | **Packs adoption** (GA3-6) — the 7 steps of each README: compare types, states, workflows, phases; compose with the reference composer at the tags, with this repository's path and id values (no file moves); copy the composed `.wingfoil/`, keep `custom/`, re-add own entries; resolve every same-named file (table: each of `workflows/custom/` and `directives/custom/` → pack's / kept as own with a distinct name / removed), so no `E_WORKFLOW_DUPLICATE_NAME`; re-apply dl-008 (`release-submit`, `release-publishing`, `retrospective`) on the packs' workflows and check dl-007's W-entries; `tech-lead` given to the agent (GA3-7); `sprint` on open tasks and existing releases (`n/a — <reason>`); state migrations by explicit commits; old → new key mapping; adopted versions recorded. One diff for the approver before commit | tech-lead | `.wingfoil/` adopted | approver's OK on the diff; `workflow list` clean; `memory search` lists every element; default suite green |
| 4 | **Directive `wingfoil-cli`** — every W-entry re-checked against the new pin (rules 5, 9): fixed ones removed or limited to 0.2.2 (W-27 limited if 0.3.1 fixes the counter, else its workaround names placeholders like the type's files, e.g. `task-<n>-placeholder.md`); W-04 and W-20 against the packs' plan and task machines; new behaviours of 0.3.1 and of the packs' adoption as new entries; version and *Checked against* bumped | tech-lead | directive re-checked | each entry reproduced on the new pin or marked |
| 5 | **Feedback inbox** — widen the first-line rule of `test/wingfoil-feedback.test.ts` to notes that report no CLI behaviour; file F-027 from `.notes/draft-F-027-wingfoil-publish-pipeline.md` rewritten as public text (dl-005), then remove the draft; first sync (rule 7, WingFoil dl-163 R4/R5) from WingFoil's `retro-v0.3.md` *Consumer feedback*; `Last sync:` and the ledger of `docs/wingfoil-feedback/README.md` (F-023 … F-027 cited) | tech-lead | inbox synced | every status and `answered_by` from WingFoil's table, none by judgement |
| 6 | **`release-publishing` header** — the header no longer says the npm pipeline is "planned for minor-v0.2" (on the workflow the adoption leaves in place) | tech-lead | header corrected | — |
| 7 | Independent fresh-context read-only review of steps 2–6 until PASS (nothing above nit); re-read the whole changed file after every fix; the author checks Version/Date lines, wraps, ids and counts before each re-review (dl-009 action 9) | reviewer (agent) | PASS | review PASS |
| 8 | Approver's OK on the result; plan finalized (separate commit); merge `--no-ff` into `main`; push | approver, tech-lead | plan `done` | the approver's OK in chat |

Heavy gates (Playwright, `test:coverage`, `test:smoke`, `test:publish-smoke`, `test:timing`) run
through the machine-free slot of the dev-loop rules; the contract tests and the default suite run
after the pin change. No tag push, no command that writes to the npm registry and no other trigger of
GitHub Actions without the approver's OK; the wave-gate dispatch of dl-011 starts with the first wave
of v0.3, not here.

## Handoff

- **Approver:** the checkpoint decisions (GA3-1 … GA3-8); the OK on each step's diff before its
  commit (one commit per step); the OK on the reviewed result (step 8). No `memory approve` is needed
  unless an adoption step migrates a gated state.
- **Agent:** reproductions, composition, edits, review coordination, Session log, commits, push.
- **Completion:** plan `done`, merged into `main`. Next: `release-cycle` phase `release-planning`
  for `minor-v0.3` (plan `release-planning-rel-v0.3-plan`), whose `reconcile-governance` phase cites
  this plan.

## Session log

### Session 1 — 2026-10-28

Decisions (checkpoint, the approver: "Confermo", 2026-10-28):

- **GA3-1** — branch `design/governance-alignment_v0.3`, merged into `main` with `--no-ff`: the
  pin, the contracts and a whole `.wingfoil/` change; a red contract leaves `main` untouched.
- **GA3-2** — precondition: `base@2.0.1` + `software@1.0.0` + `methodology/scrum@1.0.0` published
  (2026-10-28), adopted by hand on WingFoil 0.3.x; no `pack-install` (deviation from dl-010).
- **GA3-3** — the contract tests run on WingFoil **0.3.1** (`latest`, inside the packs' range
  `>=0.3.0 <=0.3.1`) rather than 0.3.0: one pin advance instead of two.
- **GA3-4** — `min` stays 0.2.2: projects on 0.2.2 keep working (range 0.2.2 … 0.3.x, adr-001 D3).
- **GA3-5** — the `$comment` of `contracts/matrix.json` names the pre-step that precedes
  `release-planning` as a place where the matrix may advance (dl-010 Rationale, deviation).
- **GA3-6** — the adoption order: step 2 before step 3, since the packs' range excludes 0.2.2; a red
  contract stops the adoption.
- **GA3-7** — `tech-lead`, which the composed DNA gives to no one, goes to the agent's
  `executes_as` (as today); the approver keeps every approval.
- **GA3-8** — `sprint` for the elements already present: `n/a — <reason>` on open tasks and existing
  releases; the first Sprint is created at `release-planning` of `minor-v0.3`, not here.

Steps:

- Step 1: plan created (`aa5b7e3` add, `4fbce7f` body and the `minor-v0.2` line on the npm
  placeholder, `7e808f8` submit → `active`).
- Step 2 — contract on WingFoil 0.3.1, **red** (2026-10-28; nothing committed). The matrix gained
  0.3.1 in the working tree only; `cliBuildFor` installed `wingfoil@0.3.1` (`0.3.1 (870bd440…)`)
  into the matrix cache; samples captured with `WFUI_CAPTURE_SAMPLES=1`, then `npm run test:contract`.
  - Adaptations of the configuration and the harness, each also valid on 0.2.2 (with them the
    capture passes on both versions):
    - a1 — `memory submit` on 0.3.x counts a required field holding a YAML list as missing unless
      the type lists it in `template.frontmatter.lists` (`missing required field on submit:
      features`; 0.3.0 alike, 0.2.2 accepts the list); `lists: [ features ]` on `release` fixes it
      on 0.3.1 and is ignored by 0.2.2. The releases `minor-v0.3`, `minor-v0.4` and `minor-v1.0`
      (`draft`, `features` a list) could not be submitted on 0.3.x without it;
    - a2 — `workflow list` on 0.3.1 refuses this repository's `.wingfoil/`:
      `E_PHASE_PRODUCES_NOT_A_PATH` on two `produces` of `workflows/custom/retrospective.yaml`
      (text, not a path pattern); besides, warnings `W_WORKFLOW_UNBOUND_TOKEN`,
      `W_PHASE_PRODUCES_OWNER_IMPLICIT`, `W_PHASE_ACTION_UNTARGETED` on most workflows;
    - a3 — `memory add` on 0.3.1 keeps the template's comment on the `status:` line
      (`status: draft          # auto-set by wingfoil`; 0.2.2 wrote `status: draft`): the regex of
      `archiveOne` (`test/contracts/support.ts`) no longer matched;
    - a4 — the `unknown` fixture kept the workflows of `init --template Kanban`, which name the
      types its own `memory.yaml` replaces: 0.3.1 refuses them (`E_WORKFLOW_ELEMENT_TYPE_UNKNOWN`);
      one workflow with no Memory action replaces them (0.2.2 needs one include at least).
  - Red after a1 … a4: `test:contract` 10 failed, 284 passed, 1 skipped (295), all on 0.3.1 except
    the README check:
    - r1 — `--version` prints `0.3.1 (870bd4406f3b9bba5ecde7a5f8198b80c2a98583)`; the server's
      `classifyVersion` (`server/src/cli/version.ts`, an anchored semantic-version pattern) answers
      `unrecognised`, so a project on 0.3.x opens read-only;
    - r2 — `workflow list --format json` has another shape on 0.3.1 (`baseline`, `workflows` with
      `name`, `startable`, `includable`, `description`, `executableNow`, `diagnostics`; no
      `manifest`, `kind` or `phases`): `contracts/cli/workflow-list.schema.json` refuses it, and the
      project read that uses it (`server/src/http/project-routes.ts`, `view.workflows()`) fails;
    - r3 — `memory add` writes the type's first declared state (`story` → `idea`; W-21 fixed on
      0.3.1): the write expectations of the `unknown` fixture differ;
    - r4 — `init --template Kanban` on 0.3.1 declares a `plan` type: the descriptor contract's
      expected type list of the `kanban` fixture differs;
    - r5 — the README check expects the range `0.2.2 to 0.3.x` (the expected update of step 2);
    - the `REQ-INT-01` count (`directives list` not reached) follows from the earlier failures.
  - Not a WingFoil defect: each is a behaviour of 0.3.x this repository does not read yet. The pin
    stays 0.2.2 and step 3 does not start (GA3-6). The probe's diff is kept outside the repository
    for the task of GA3-9.

Decision (the approver, 2026-10-28, after the step 2 report; options: A — pin and packs after a Wave
0 task of `release-planning`; B — a governance task in this pre-step; C — everything to
`release-planning`):

- **GA3-9** — option **B**: this pre-step gains step 2b, one governance task of `minor-v0.3` that
  makes the server read WingFoil 0.3.x (r1 … r4), carries a1 … a4 and advances the pin and the matrix
  (r5, GA3-3 … GA3-5); steps 3 … 8 follow it, so `release-planning` of `minor-v0.3` starts on the
  pinned 0.3.1 with the packs adopted. Further deviation from dl-010 (product code in the pre-step);
  the task is planned and run by `dev-loop.yaml`, not as a free edit.

### Session 2 — 2026-10-28 … 2026-10-30

- Step 2b — task-046 (`docs/04_memory/v0.3/task-046-wingfoil-0.3-support-read-wingfoil-0.3.x-and-pin-0.3.1.md`):
  add `df3d2b9`, submit `a0ad9cc`, approved → `backlog` `e7a9c34` (the approver),
  `in-progress` `b92e114`; its own worktree and branch, a developer agent; design D46-1 … D46-4
  (the approver: the `.wingfoil/` diff of a1 and a2, `d44868a`; capabilities with no source in this
  release never available, reason `not-in-release`; the `workflow list` variant chosen by shape;
  the header shows the clean version), then D46-5 … D46-8 from the gates and the reviews
  (`GIT_OPTIONAL_LOCKS=0`; `core.fsmonitor=false`; no transport on reads — `GIT_ALLOW_PROTOCOL=none`,
  `protocol.allow=never`, `GIT_NO_LAZY_FETCH=1`, transport from the cleaned environment; absolute
  `PATH` entries for every child of the process runner). Independent review, a correctness reviewer
  and an adversarial reviewer who runs the tools in each round: rounds 1 … 5 FAIL, round 6 (targeted)
  PASS for security and one text finding, fixed and checked by the coordinator (the partial-clone
  remedy run by hand on git 2.43). Each round's findings, commits, red tests and guard checks are in
  the task's Execution Notes, with its *For the retrospective of minor-v0.3* (a pin advance is a
  security-relevant change of what the console runs on projects). Gates on `47121f2`:
  `test:coverage` 3338 passed, 1 skipped (96.62 % statements, 91.52 % branches), the strict-identity
  `npm test` 3338 passed, `test:e2e` 935 passed on Chromium, Firefox and WebKit; `test:contract` 312
  passed, 1 skipped on `801d524`; `test:smoke` 4/4 on `eae30f2`. Submit `d95443c`, approved
  `f3224a3` (the approver), merged into this branch `27fb0c4`, `done` `322869e`; worktree and branch
  removed.
- Step 2 — re-run on this branch at `322869e` (pin `wingfoil@0.3.1`, matrix [0.2.2, 0.3.1]):
  typecheck, lint, format:check clean; `test:contract` 312 passed, 1 skipped; `npm test` 3338 passed,
  1 skipped (heavy runs through the machine-free slot, load 7.2 … 22.2); on this repository
  `workflow list` exits 0 with 5 workflows and 115 diagnostics, `memory search` lists 120 elements,
  each once. **Green**: step 3 may start (GA3-6).
- Not merged into `main` before the pre-step closes (the approver, 2026-10-30): `main` gets
  WingFoil 0.3 support with the whole pre-step (GA3-1).

Decision (the approver, 2026-10-30):

- **GA3-10** — step 3 starts with an adoption design, before any `.wingfoil/` change: a file-by-file
  table (from a pack, kept as this repository's own under another name, or removed), the old → new
  key mapping of workflows and phases, the state migrations, dl-008's tailoring re-applied on the
  packs' workflows and dl-007's entries checked, the parameters still to choose, and design probes on
  the pinned CLI (git trace, a `.git` snapshot, the children's environment); the decisions go to the
  approver, then one `.wingfoil/` diff with its migrations for the approver's OK before commit.

### Session 3 — 2026-10-30 … 2026-11-02

- Step 3 — adoption design (GA3-10): a design agent on the branch `design/ga3-adoption` (its own
  worktree, from `93d2933`) composed `base@2.0.1`, `software@1.0.0` and `methodology/scrum@1.0.0`
  with the reference composer of `wingfoil/wingfoil-templates`, with this repository's path and id
  values (no file moves), and wrote the design `docs/wingfoil-adoption/rel-v0.3-packs-adoption-design.md`
  (§1 … §14: parameters, file-by-file outcome, old → new keys, dl-008 re-applied and dl-007 checked,
  state migrations — none needed —, roles, design probes, the proposed change, decisions, open risks).
- Step 3 — a directive defect found by the adoption's e2e run: bug-025 (a directive defined by two
  files is listed twice in the Directives view; in v0.2.0 as released): add `4717293`, submit
  `c547a8a`, triaged by the approver `5f98fe6` (medium, v0.3), absorbed into task-047 (`d4a4bfe`);
  task-047 (Directives view: one row per directive in force) add `7c23459`, submit `94dc86c`,
  approved `a9601e6`, `in-progress` `61d5538`; its own worktree, a developer agent; design D47-1 …
  D47-4 (the approver; R-06.2 amended, option A); independent review round 1 FAIL (D47-4 untested;
  WingFoil's precedence when the warning is cut), targeted round 2 PASS with one nit (N1, the
  smallest path), fixed and checked by the coordinator; submit `0e2dbb2`, approved `7242a3a`,
  merged into this branch `fb47128`, `done` `cbca05c`; bug-025 `in-progress` `c3a5c9b` (recorded at
  the merge), `in-review` `404ba24`, `resolved` `333efea` (the approver), close notes `37f005c`.
- Step 3 — this branch merged into `design/ga3-adoption` (`ababf9a`); full gates there: `test:e2e`
  938 passed, 0 failed on Chromium, Firefox and WebKit (`ababf9a`, R-06.1 … R-06.4 and the bug-025
  test with this repository's own `definition-of-done` override); `test:contract` 312 passed,
  1 skipped; `npm test` 3353 passed, 1 skipped (`694a666`, the bug-025 route test updated for the
  two shadowing warnings of the adopted governance).
- Step 3 — independent review of the adoption: a correctness reviewer and an adversarial reviewer
  who ran the CLI on throwaway copies; round 1 FAIL (see GA3-11 A-1 … A-4 and the minors, design
  §14), fixed in `4742863`, `9446f6f`, `5600c66`; targeted round 2 FAIL (MA-1: the deprecate rule
  not loaded by every role; mi-1 … mi-3, design §15), fixed in `49b7027`, `2ba6ec0`, `3105944`;
  targeted round 3 PASS, its nits fixed in `1399b29`. The approver's OK on the `.wingfoil/` diff
  (`93d2933..1399b29`, 72 files) and on this record (2026-11-02); `design/ga3-adoption` merged into
  this branch.

Decisions (the approver, 2026-11-01 … 2026-11-02):

- **GA3-11** — the packs adoption as designed (design doc 0.4, §9, §11, §14):
  - the 16 decisions of the design, as recommended: `methodology/scrum`'s `delivery` replaces this
    repository's delivery loop; the five procedures (`initial-design`, `release-planning`,
    `dev-loop`, `user-docs`, `e2e-smoke`) stay as included custom workflows, folded into
    directives later (scheduled at `release-planning` of `minor-v0.3`); the packs' inception and
    specification with `inception_path: docs/01_vision/00_index.md`; `retrospective_path:
    docs/05_plans/`; Sprints of 2 weeks at `docs/04_memory/sprints/{id}.md`, ids `sprint-{n}`;
    GA3-8 amended — a `release` has no `n/a` form: the released `minor-v0.1` and `minor-v0.2` are
    listed in `exempt.sprint`, the draft releases get their Sprint when it is planned; the packs'
    `determinism`, `doc-versioning`, `security-secrets`, `traceability` replace this repository's
    one-line stubs; dl-008's tailoring lives in the custom directive `release-conventions`; the
    packs' release order (the release commit after the approval, `staging-rehearsal` runs
    `test:publish-smoke`); `AGENTS.md` with the composer's region, `CLAUDE.md` points to it;
    `paths.governance` stays `.wingfoil/`; this repository's templates; the workflow engine is
    bootstrapped at `release-planning` of `minor-v0.3`; future pre-steps run as
    `governance-evolution`; the 0.2.2 contract fixture imports a frozen copy of `93d2933`'s
    `.wingfoil/`;
  - the risk mitigations R-1 … R-7: a gate on `release` `releasing` (R-1) and on `release-line`
    `active` (R-2); `bug` keeps the gate on `triaged`, not on `planned` (R-3; trade-off: a
    `planned` bug has no wontfix exit); a default-suite test comparing `workflow list`'s
    diagnostics with a committed baseline (R-4); the retrospective's inventory in its plan (R-5);
    the Today noise of `backlog` tasks accepted, a v0.3 candidate (R-6); the index refresh of the
    CLI's status reads handled by D46-5, a feedback note at step 5 (R-7); a separate git identity
    for agents, so that the CLI refuses their approvals, planned as a v0.3 task (and sent to the
    coordination channel as a practice for every WingFoil project);
  - decisions 1-A (four e2e scenarios run on the `custom` fixture with the pre-packs states) and 2-A
    (bug-025 fixed by task-047 before the merge);
  - review round 1: the gates are kept and their residuals declared — at `approve-release` the
    approver records the OK with `workflow finalize`, a release is approved only at `mark-released`
    after `publish` (A-1), a release line only at its end with every release `released` (A-2); a
    supersession banner on W-20, W-25, W-26 of `wingfoil-cli` now, the re-check at step 4 (A-3);
    `memory deprecate` only in `end-of-life` › `deprecate` or with the approver's OK in the active
    plan (A-4); the console candidates for v0.3 of A-1 and A-2; the other accepted limits in
    `.wingfoil/README.md`.
