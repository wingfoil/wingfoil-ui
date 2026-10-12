---
id: task-029-npm-publishing-pipeline-and-registry-setup-checklist
type: task
title: "npm publishing pipeline and registry setup checklist"
status: backlog
release: "v0.2"
module: "governance"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.2","governance","publishing"]               # optional — additional labels, e.g. [today, a11y]
ref: "GOV"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-026-load-independent-tests-and-one-temp-folder-convention"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

npm publishing of `wingfoil-ui`, deferred from v0.1 by dl-004 and placed in the scope of
`minor-v0.2` by `governance-alignment-rel-v0.2-plan` GA-4 (RP-3 (d), RP-42, RP-46): the publish
pipeline that `release-publishing` (`.wingfoil/workflows/custom/release-publishing.yaml` v1.2,
step `publish`) runs for the pushed tag — staged by the pipeline, made live by the approver
(`npm stage approve`, 2FA; RP-54) — and a checklist of the registry-side setup the approver
performs. dl-004 keeps `release: v0.1` and is cited here (RP-6). Governance task
(`module: governance`, `ref: GOV`); may run in any wave before release validation (RP-43); first
candidate to defer with task-042-notification-bell-all-roles-summary-and-empty-today if the
budget runs short (RP-51).

**Backlog items:** GOV (governance — dl-004 Actions, GA-4)

## Acceptance Criteria

- **AC-1 (pipeline, RP-54)** `.github/workflows/publish.yml`, run by a pushed `v*` tag, on the
  model of WingFoil's publish pipeline (`.github/workflows/publish.yml` of the public repository
  `wingfoil/wingfoil`, its header runbook): the repository gates (`typecheck`, `lint`,
  `format:check`, `test:coverage`, `test:smoke`) and a staging smoke on a local registry
  (Verdaccio: publish the packed tarball, install it into an empty folder, run `npx wingfoil-ui
  --version` and a `--no-open` start); then two gates — (1) the GitHub environment `npm-publish`
  (deployments from `v*` tags only; the approver reviews the deployment), (2) `npm stage publish`
  through an npm trusted publisher (OIDC) limited to staging, with no token in the repository or
  the workflow (directive `security-secrets`). The version goes live only when the approver runs
  `npm stage approve` with 2FA; the workflow never publishes live by itself.
- **AC-2 (package)** `package.json` drops `private: true` (root only; the workspaces stay private);
  `test/package/pack.test.ts` and `test/package/allow-list.ts` follow; the tarball's file list is
  unchanged otherwise.
- **AC-3 (local smoke)** The staging smoke runs locally as a script (e.g. `npm run
  test:publish-smoke`), with a recorded run; it never contacts the public registry.
- **AC-4 (approver checklist, RP-46, RP-54)** A checklist in the README's maintainer section or
  `docs/`: package name check on the registry; the GitHub environment `npm-publish` (approver as
  required reviewer, `v*` tags only); 2FA on the approver's npm account; the trusted publisher
  for this repository and workflow, limited to staging (stage-only); the `npm stage approve` step. The task is done
  with AC-1…AC-3 and the checklist; the approver performs the registry-side steps before
  `release-submit`, otherwise v0.2 ships as a tag only and a decision-log records it (as dl-004).
- **AC-5** `release-publishing` `publish` description still matches (no workflow change unless the
  approver asks); docs updated in the same change (directive `documentation`).

## Implementation Notes

- RP-54: two gates as in WingFoil's publish pipeline (public repository `wingfoil/wingfoil`,
  `.github/workflows/publish.yml` header runbook); read it at design for the exact steps.
- dl-004 *Context* (what the publish step presupposes) and *Actions*; GA-4; sequencer Q1
  (`docs/01_vision/07_sequencer.md`: published as `0.x` from the first releases).
- The packaging guard and launch smoke of task-025-installable-package-and-e2e-smoke-gaps (v0.1)
  are the base: reuse `test/smoke/` rather than a second install path.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
