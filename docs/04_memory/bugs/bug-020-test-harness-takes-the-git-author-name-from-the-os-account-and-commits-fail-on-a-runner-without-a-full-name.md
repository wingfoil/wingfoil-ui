---
id: bug-020-test-harness-takes-the-git-author-name-from-the-os-account-and-commits-fail-on-a-runner-without-a-full-name
type: bug
title: "Test harness takes the git author name from the OS account and commits fail on a runner without a full name"
status: closed
severity: "low"           # REQUIRED — critical | high | medium | low
release-origin: "v0.2"     # optional — release where the bug was FOUND, e.g. "v0.1"
release: "v0.2"            # optional — fix/implementation release, stamped by release-planning/build-backlog
feature: ""            # optional — related feature ID from docs/01_vision/06_features.md
module: "server"             # optional — server | web | contracts
wingfoil_version: "0.2.2"   # optional — `wingfoil --version` of the OBSERVED project (the UI drives its CLI)
browser: ""            # optional — for `web`: browser name + version, e.g. "Firefox 131"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Summary

The test harness isolates git's configuration (`harnessEnv`, `test/harness/fixtures/builder.ts`:
its own `.gitconfig`, no user or system file) but sets no `user.name`; tests set only
`user.email`, so git takes the author name from the OS account's full name. On a machine whose
account has none (a GitHub Actions runner) every test-side commit fails with "Author identity
unknown … empty ident name not allowed". Test-only: the product commits through the CLI with the
user's own identity.

## Steps to Reproduce

1. `.github/workflows/publish.yml` dispatched on `main` `08a84db` (the first CI run of this
   repository, `release-validation` dry run RV2-5), job `gate`, step *Tests with coverage*.
2. Or locally, as an OS account whose full name (the GECOS field) is empty: `npm run test:coverage`.

## Expected Behavior

The suite is independent of the machine's user account: every commit a test makes has an author
from the harness configuration.

## Actual Behavior

61 tests in 7 files fail on the runner (`test/server/sync/auto-sync.test.ts` 30,
`test/server/http/git-routes.test.ts` 16, `test/server/http/repository-status.test.ts` 4,
`test/harness/commit-provenance.test.ts` 3, `test/launcher/auto-sync.test.ts` 2,
`test/server/http/auto-push.test.ts` 1, `test/server/http/projects.test.ts` 1); 121 lines
"Author identity unknown". Locally the same files pass (217/217) also with an empty home, because
the account has a full name.

## Evidence

- GitHub Actions run `39315562583` (workflow `publish`, `workflow_dispatch` on `main`), job
  `gate` failed at *Tests with coverage*; `stage` and `promote` skipped.
- The failing commit, e.g. `test/launcher/auto-sync.test.ts` `remoteCommit`: a clone with only
  `user.email` set, then `git commit -qm outside: <file>` with the fixture environment.

## Notes

Suggested fix (approver, 2026-10-19: a test-only governance task): `user.name` in the harness
`.gitconfig` (not an email: tests of unidentified users rely on none being set), a test that fails
without it, and a check that no other test helper commits outside the harness environment (e2e
support included). Found by the release-validation dry run, before any tag.

## Triage & Execution Notes

<!-- Running log, not the retrospective itself.
     - triage (bug-ingest): severity call, wontfix/duplicate rationale if rejected to `closed`.
     - fix: once fix task(s) exist (release-planning/build-backlog), day-to-day execution notes
       live on those tasks (docs/04_memory/{release}/{id}.md, `bug: {this id}`, their own
       Execution Notes section) — this section only needs a pointer plus anything that doesn't
       belong on a specific fix task (e.g. why 2 tasks were needed instead of 1). -->

- 2026-10-19 — triage (approver): `low`, test-only; absorbed into task-044 (pre-step of
  `release-submit-rel-v0.2-plan`).

- 2026-10-20 — close (pre-step of `release-submit-rel-v0.2-plan`): fixed by task-044 (`done`); proved on the
  GitHub runner (git 2.55) by the third `workflow_dispatch` dry run, run `39451186680` on `main`
  `c22d847`: `gate` green (`test:coverage` 3220 passed / 1 skipped, `test:smoke` 4/4), `stage` green
  (`test:publish-smoke` 11/11 on Node 22.12.0).
