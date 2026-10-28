---
id: task-046-wingfoil-0.3-support-read-wingfoil-0.3.x-and-pin-0.3.1
type: task
title: "WingFoil 0.3 support: read WingFoil 0.3.x and pin 0.3.1"
status: pending
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
