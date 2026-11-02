---
id: release-conventions
name: release-conventions
type: directive
kind: custom
title: "Release conventions of WingFoil UI"
tags: [custom, release, git, npm]
---

# Directive — Release conventions of WingFoil UI

**Version:** 1.2 · **Date:** 2026-11-02 (1.0: dl-008's tailoring of `release-submit`,
`release-publishing` and `retrospective`, re-applied on the `software` and `base` packs' workflows
at their adoption — governance-alignment-rel-v0.3-plan step 3; 1.1: `mark-released` is the
approver's `approve`, the retrospective's inventory in its plan — GA3-11 R-1, R-5; 1.2: when the
approver approves a release and a release line, bound to the facilitator too — review round 1 of
the packs adoption, A-1, A-2, M1)

The packs' release workflows (`release-submit`, `release-publishing`, `.wingfoil/workflows/built-in/`)
name what each phase does, not how this repository does it. This directive says how; the pipeline
and the approver's steps are in `docs/publishing.md`.

## `release-submit`

- **`pre-release-checks`** (qa), on `main` once the release's tasks are merged:
  - every task of the release is `done`;
  - every bug of the release is `resolved` or `closed` — a bug belongs to the release when its
    `release` is the release's version, or when its `release` is empty and its `release-origin` is
    that version (this repository's bugs carry those fields, no release tag);
  - the `user-docs` and `e2e-smoke` procedures (`.wingfoil/workflows/custom/`) passed for the
    release;
  - `npm run test:coverage` green (statements at least 80 %), `npm run test:e2e` on Chromium,
    Firefox and WebKit, `npm run test:smoke`; `npm audit --omit=dev` reports 0 vulnerabilities.
- **`enter-releasing`** (tech-lead): `memory submit <release>` (`in-development → releasing`).
- **`approve-release`** (approver): the approver's OK, recorded in the run's plan and, when the
  release runs on the workflow engine, by `workflow finalize --step <the step key workflow next
  prints, e.g. release-submit.approve-release@release:minor-v0.3> --reason "…"`. **Never `memory
  approve` on the release here:** `releasing` is a gate, and its approve moves the release to
  `released` at once — the publication steps would be skipped (probe of the packs adoption's review,
  round 1). The console and `workflow status` offer that Approve as soon as the release is
  `releasing`; ignore it until `mark-released`.

## `release-publishing`

- **`release-commit`** (tech-lead), on `main`: `chore(release): v{package.version}` — the version
  `X.Y.0` for a minor `vX.Y`, `X.Y.Z` for a patch `vX.Y.Z`, in the root and workspace
  `package.json` files and the lockfile; the CHANGELOG section with the tag date; the project status
  in `CLAUDE.md`. (dl-008 placed it before the checks, in `release-submit`; the `software` pack
  places it here, after the approval: the commit changes only versions and docs, and the rehearsal
  below runs on it.)
- **`staging-rehearsal`** (qa), on the release commit: `npm run test:publish-smoke` (the pipeline's
  `stage`, run locally: `docs/publishing.md` *Local staging smoke*); optionally the pipeline's dry
  run (`workflow_dispatch`, `gate` and `stage`, which never promotes). Nothing is made public.
- **`tag`** (tech-lead): the annotated tag `v{package.version}` on `main`, on the release commit or
  on a later `main` commit that changes only governance or docs files — never on a phase branch.
  Pushing it starts `.github/workflows/publish.yml`, and needs the approver's OK.
- **`publish`** (tech-lead; approval by the approver): the tag run's `gate` and `stage` pass, the
  approver approves the `promote` deployment and runs `npm stage approve` (`docs/publishing.md`
  *Every release*); then `npm view wingfoil-ui@X.Y.Z version` answers the version. An agent never
  publishes or configures the registry.
- **`mark-released`** (tech-lead prepares, the approver decides): `releasing` is a gate in this
  repository (`memory.yaml`, GA3-11 R-1, a deviation from `software`, whose phase moves the release
  with `element.set_state(released)`): `memory submit` from `releasing` is refused, and the approver
  runs `memory approve <release> --reason "…"` once `publish`'s post-check answered — the only
  moment a release is approved. The tech-lead hands the approver that exact command, with the `npm
  view` output.

## The release line

`release-line` `active` is a gate in this repository (GA3-11 R-2): the approver closes a line with
`memory approve rl-vN --reason "…"` only at the end of the line — when every release of the line is
`released` and the next line, if any, is planned (the line's closing step, formerly
`release-line-cycle` › `plan-next-release-line`). The console offers that Approve for the whole life
of the line; ignore it until then.

The CLI authorises `memory approve` by the git identity of the commit (a non-approver email gets
"user not authorized to approve"); agents commit under the approver's identity in this repository,
so "an agent never approves" is a process rule here, not a check. A separate git identity for
agents is a v0.3 task, not part of these conventions.

## `retrospective`

- **`explore`**: the friction inventory — every point grouped by theme and citing its source
  (an element's Execution Notes, a plan's Session log, a review round) — is written in the
  retrospective's own plan under `docs/05_plans/` (`retrospective_path` is `docs/05_plans/`, GA3-11
  R-5). That directory always holds files, so the step's evidence is always met: the inventory in
  the plan is what shows the step done; a retrospective with none is not.
- **`capture`**: a decision-log with the type's `dl-{n}-{slug}` id, added with
  `--tags retrospective` (`retrospective` › `approve` selects it by that tag), titled
  `Retrospective <release or Sprint>`.
