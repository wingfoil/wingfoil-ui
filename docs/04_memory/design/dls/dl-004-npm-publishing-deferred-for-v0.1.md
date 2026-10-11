---
id: dl-004-npm-publishing-deferred-for-v0.1
type: decision-log
title: "npm publishing deferred for v0.1"
status: ready
context: "release-publishing"  # optional — short label for the context, e.g. "retrospective", "planning", "ad-hoc"
release: "v0.1"        # optional — implementation release this DL is assigned to (stamped at release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

`release-publishing` (`.wingfoil/workflows/custom/release-publishing.yaml` v1.1, derived from
WingFoil) has a `publish` step that pushes the tag so that `.github/workflows/publish.yml` runs the
gate, a Verdaccio staging smoke and `npm stage publish` through an OIDC trusted publisher, after
which the approver approves the staged version on npm with 2FA. WingFoil UI v0.1 has none of this:
no `.github/` folder (`git ls-files .github` is empty), no npm package of its name
(`https://registry.npmjs.org/wingfoil-ui` answers 404 on 2026-10-11), no trusted publisher, and
`package.json` is `private: true`. The v0.1 package is correct and installable from a tarball
(`npm pack`, guarded by `test/package/pack.test.ts` and smoke-tested by `npm run test:smoke`,
task-025), but it is not meant to be on the registry yet.

The approver decided at `user-docs` (RV-8,
`docs/05_plans/rl-v1/rel-v0.1/user-docs-rel-v0.1-plan.md`) that v0.1 is published as a git tag
only.

## Decision

**v0.1 is released as the annotated git tag `v0.1.0` on `main`, without npm publishing.**

- The `publish` step of `release-publishing` is skipped for release `minor-v0.1`: no
  `publish.yml` run, no npm stage, no npm approval; its post-check ("staged version approved on
  npm and live on the npm registry") does not apply.
- `package.json` keeps `private: true`; the version is `0.1.0` in the root and the workspaces.
- Users run v0.1 from a checkout of the tag or from a tarball they pack themselves (README
  *Install and run*, *Install from a package*).
- No GitHub Release is created unless the approver asks for one explicitly.
- npm publishing (package name, `publish.yml`, trusted publisher, removal of `private: true`) is
  planned for a later release by `release-planning`.

## Rationale

- **Nothing to publish into yet:** the registry-side setup the step presupposes (package name,
  trusted publisher, `npm-publish` environment) does not exist, and building it is not in the v0.1
  scope (`docs/04_memory/planning/v1/minor-v0.1.md`).
- **The package is ready, the channel is not:** task-025 made the tarball correct (allow-list,
  `prepack` build, smoke-tested launch), so publishing later is a pipeline task, not a product fix.
- **Reversible:** a later release can publish to npm; a published npm version cannot be taken
  back.
- Trade-off: v0.1 cannot be installed with `npx wingfoil-ui` from the registry.

## Actions

- `release-publishing-rel-v0.1-plan`: skip the `publish` step, citing this decision-log
  (tech-lead, release `minor-v0.1`).
- `release-planning` of a later release: schedule the npm publishing pipeline and the removal of
  `private: true` (approver).
