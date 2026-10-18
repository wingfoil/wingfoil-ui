---
id: task-043-e2e-smoke-gaps-of-v0.2-commit-provenance-and-gate-keyboard-paths
type: task
title: "E2E smoke gaps of v0.2: commit provenance and gate keyboard paths"
status: backlog
release: "v0.2"
module: "governance"   # optional — server | web | contracts (dna.yaml modules)
priority: "high"       # optional — high | medium | low
tags: ["v0.2","governance","e2e-smoke"] # optional — additional labels, e.g. [today, a11y]
ref: "GOV"             # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-034-auto-sync-scheduler-and-auto-push", "task-036-today-requires-you-and-waiting-on-others", "task-037-gate-footer-with-every-outcome", "task-038-submit-footer-action-toasts-and-blocked-actions", "task-040-update-and-push-from-the-sidebar"]  # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Release-validation task of minor-v0.2, phase `e2e-smoke` (plan `e2e-smoke-rel-v0.2-plan`, decisions
ES2-2 and ES2-4): close the gaps the mapping of `.wingfoil/workflows/custom/e2e-smoke.yaml` onto
the v0.2 suites found. The task adds tests only; a product defect a new test reveals is reported to
the coordinator (bug-ingest), not fixed here.

- **G2 — drive-browser, commit provenance.** "Every commit the UI causes is a CLI `wf(…)` commit or
  a `chore(ui)` commit touching only `.wingfoil/ui.yaml`" is proved on the server
  (`test/server/http/element-writes.test.ts`, `test/server/cli/governed-verbs.test.ts`) and, in e2e,
  only by the subject of `HEAD` after each write; no e2e test checks a whole session of UI writes.
  v0.2 makes no `chore(ui)` commit (the console writes no `ui.yaml` before v0.3).
- **G3 — success criterion 1** of the release ("a member holding `approver` passes a gate from
  Today in ≤ 2 clicks, with the `wf(…)` commit shown and pushed") is proved by separate tests: G-04.1
  counts the clicks with auto-push off; G-13.1 shows the commit and *pushed* from the panel.
- **G4 — accessibility, keyboard path of every gate action.** X-06.2 walks Today → Approve by
  keyboard; Reject and Cancel of the gate footer are reached by click only.
- **G5 — actions blocked while the copy is behind.** G-12.x prove it for Approve and Reject in the
  UI; Submit while behind is proved on the server only.

Governance task (`module: governance`, `ref: GOV`), as task-025 in v0.1; run through the full
dev-loop (worktree, red-first, independent review until PASS, the approver's gates).

**Backlog items:** GOV (governance — e2e-smoke gaps of minor-v0.2, ES2-2)

## Acceptance Criteria

- **AC-1 (G2, commit provenance)** A new e2e spec (e.g. `test/e2e/commit-provenance.spec.ts`)
  records the observed repository's state before a session, then drives from the UI a submit, an
  approve and a reject (with a reason), a manual Update after a commit pushed to the remote by the
  test, and a Push; it also changes a UI setting and the role view. Afterwards every commit in
  `<before>..HEAD` that the remote did not bring matches `^wf\((task|bug|[a-z-]+)\): (submit|approve|reject) `
  (the CLI's subject form, checked against `governed-verbs.test.ts`), touches only its element's file
  (`git diff-tree --no-commit-id --name-only -r`), and no other ref, tag, config entry or
  working-tree file changed (`no-commit.spec.ts` helpers); the remote's branch equals `HEAD` after
  the Push. The assertion fails when one extra commit of any other form is added (shown once, by
  hand, in the Execution Notes).
- **AC-2 (G3)** An e2e test (a G-04.1 variant, titled with G-04.1 and the success criterion) seeds
  `autoPush: true`, starts on Today as a member holding `approver`, passes the gate in exactly two
  clicks and asserts what the user sees: the toast's commit line (short sha and `wf(…)` subject
  equal to the repository's `HEAD`) and *pushed*; and the remote's branch head equals that commit.
- **AC-3 (G4)** An e2e test (an X-06.2 variant) reaches **Reject** of the gate footer by keyboard
  only: from Today's action to the element panel, the reason field, the reject outcome, Enter; it
  asserts the `wf(…): reject … [<from> → <to>]` commit and the reason recorded; a second walk
  reaches **Cancel** by keyboard and asserts nothing was written (`HEAD` unchanged) and the focus
  returns as the gate footer specifies (spec-003 §6, UX reference).
- **AC-4 (G5)** An e2e test (G-12.x style, on an element whose Submit is offered) makes the copy
  behind its upstream and asserts in the UI that Submit is disabled with the copy-behind reason
  (catalogue text, accessible description) and that no request is sent; `HEAD` unchanged.
- **AC-5** Each new test passes on Chromium, Firefox and WebKit (`npm run test:e2e -- <files>`);
  axe 0 serious/critical where a new screen state is shown, both themes; new tests are written
  red-first where they can fail on current code, otherwise their guard-removal failure is recorded.
- **AC-6** `typecheck`, `lint`, `format:check`, `test:coverage` (≥ 80 %), `test:e2e:chromium`,
  `docs:api` green; `check_tasks.py v0.2` OK; `test/README.md` version line and the e2e closure
  table of this task updated; every heavy gate through the machine-free slot.

## Implementation Notes

- Reuse `test/e2e/support/`: `console.ts` (`ConsoleOptions.settings` for `autoPush`, `stateDir`),
  `events.ts` (`mutateAndWait`, `commitFile`, `cli`, `lastCommitSubject`), `remote.ts`
  (`remoteHead`, `remoteCommit`, `setRemoteUrl`), `identity.ts` (`actAs`), `repo-state.ts` /
  `no-commit.spec.ts`, `cold-read.ts` (`COLD_READ_MS`), `axe.ts` (`scanThemes`), `keyboard.ts`.
- G-04.1 lives in `test/e2e/gate-footer.spec.ts`, X-06.2 there too (line ~384); G-12.x in
  `test/e2e/update-push.spec.ts`; G-13.1 in `test/e2e/submit-footer.spec.ts`.
- Toasts close after 8 s: assert the toast right after the action, before any server-read wait
  (Wave 5 lesson).
- No product change is expected; a spec gap or a defect → stop and report with options.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
