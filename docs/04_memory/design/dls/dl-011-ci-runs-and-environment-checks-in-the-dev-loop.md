---
id: dl-011-ci-runs-and-environment-checks-in-the-dev-loop
type: decision-log
title: "CI runs and environment checks in the dev loop"
status: ready
context: "retrospective" # optional — short label for the context, e.g. "retrospective", "planning", "ad-hoc"
release: ""            # optional — implementation release this DL is assigned to (stamped at release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

The retrospective of `minor-v0.2` (plan `retrospective-rel-v0.2-plan`, decision RT2-7; dl-009)
found that the test suites were green on this machine and red on the first two of the three
`workflow_dispatch` dry runs of release-submit, the repository's first CI runs: bug-020 (the
runner's account has no full name) and bug-021 (git ≥ 2.48 creates `refs/remotes/<remote>/HEAD`
on fetch) on the first run, bug-022 (git 2.55 prints `(null)` where 2.43 quoted a path) on the
second. The local git is 2.43, the runner's 2.55. The fixes took two test-only tasks (task-044,
task-045) and about one active day at release validation. The strict-identity recipe of
`test/README.md` *Fixtures* › *Git identity* (task-044) reproduces the runner's identity and
remote-HEAD behaviour locally.

The same inventory found the plan rule of dl-006 action 6 — a plan's frontmatter `version` equals
its Context `Version` — broken in two of seven plans of v0.2, with no check enforcing it.

`.github/workflows/publish.yml` runs on a `vX.Y.Z` tag or on `workflow_dispatch`; on a dispatch
its `promote` job is skipped, so a dispatch runs `gate` and `stage` only and publishes nothing to
the npm registry (`stage` publishes to a local registry inside the job).

## Decision

**From `minor-v0.3`, the CI gate runs once at every wave gate, and environment-sensitive tests are
checked locally against the runner's conditions.**

- At every wave gate the coordinator runs one `workflow_dispatch` of `publish.yml` on `main`.
  The approver gives a standing OK for these dispatches with the approval of this record; tag
  pushes and every other Actions run still need the approver's OK each time.
- Every task that touches git runs its affected suites under the strict-identity recipe of
  `test/README.md` in its self-check.
- A newer local git is left to the approver.
- A v0.3 governance task adds a check that fails when a plan's frontmatter `version` differs from
  its Context `Version`.

## Rationale

- One dispatch per wave finds runner-only defects at the gate of the wave that wrote them instead of
  at release validation, at the cost of one run per wave gate (v0.2 had seven, Waves 0 … 6,
  `dev-loop-rel-v0.2-plan`); a run per task would cost more without catching a different class.
- The strict recipe catches the identity and remote-HEAD classes locally and at no CI cost; it does
  not cover git's wording, which the wave dispatch does.
- The plan-version rule failed in both releases while applied by hand (one plan in v0.1, two of
  seven in v0.2); a check is cheap.
- Trade-off: a red dispatch can delay a wave gate.

## Actions

- Run the wave-gate dispatch from the first wave of `minor-v0.3`, and record the run id in the
  dev-loop plan's Session log (coordinator).
- Add the strict-identity step to the dev-loop rules and to the self-check of git-touching tasks
  (tech-lead).
- Plan the plan-version check at `release-planning` of `minor-v0.3` (product-owner, tech-lead).
