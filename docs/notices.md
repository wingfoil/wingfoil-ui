# Runner notices

**Version:** 0.1 · **Date:** 2026-11-19 (0.1: created by the runner adoption, `governance-evolution-8-plan`)

What the script runner asks of the approver: a gate to rule, a decision, a blocked step, a halted
line. The runner writes this file itself, between the markers below; it is never edited by hand
(`wingfoil-cli` › *The script runner*). A notice closes when its cause is gone or the approver closes it with the
command it names.

## Open

<!-- runner:open -->

<!-- key:halt-trunk-rejected-task-093-backlog-tools-read-patch-releases-and-the-generated-backlog-rebuilt -->
### N-020 · 2026-11-24 · trunk:task-093-backlog-tools-read-patch-releases-and-the-generated-backlog-rebuilt

- **Status:** open
- **Kind:** halt
- **Opened:** 2026-11-24T09:56:49Z
- **Line:** trunk
- **Element:** trunk:task-093-backlog-tools-read-patch-releases-and-the-generated-backlog-rebuilt
- **Reason:** trunk:task-093-backlog-tools-read-patch-releases-and-the-generated-backlog-rebuilt rejected 2 times in review: rule it first (npx wingfoil memory history task-093-backlog-tools-read-patch-releases-and-the-generated-backlog-rebuilt)
- **Unblock:** `cd <runner home> && node scripts/runner/run.mjs --line trunk --resume`

## Closed

<!-- runner:closed -->

<!-- key:gate-trunk-sw-life-cycle-1-plan-backlog-item.approve@task:task-092-development-dependencies-refreshed-and-the-node-engine-aligned -->
### N-019 · 2026-11-24 · trunk:task-092-development-dependencies-refreshed-and-the-node-engine-aligned

- **Status:** closed 2026-11-24T09:17:30Z — the approver ruled the gate
- **Kind:** gate
- **Opened:** 2026-11-24T09:10:07Z
- **Line:** trunk
- **Element:** trunk:task-092-development-dependencies-refreshed-and-the-node-engine-aligned
- **Reason:** backlog-item.approve@task:task-092-development-dependencies-refreshed-and-the-node-engine-aligned waits for the approver
- **Ready:** yes
- **Head:** f742d3af
- **Evidence:** run task-092-development-dependencies-refreshed-and-the-node-engine-aligned/review/8 completed
- **Unblock:** `cd <runner home> && node scripts/runner/gate.mjs --line trunk N-019 --reason 'Approved backlog-item.approve@task:task-092-development-dependencies-refreshed-and-the-node-engine-aligned at f742d3af: run task-092-development-dependencies-refreshed-and-the-node-engine-aligned/review/8 completed'`

<!-- key:decision-trunk-task-092-development-dependencies-refreshed-and-the-node-engine-aligned/review/7 -->
### N-018 · 2026-11-24 · trunk:task-092-development-dependencies-refreshed-and-the-node-engine-aligned

- **Status:** closed 2026-11-24T09:04:35Z — approved by the approver: Done: pushed task/task-092-development-dependencies-refreshed-and-the-node-engine-aligned at 19fc88426b60e849badb35b556213cda6f3395a5, gates.yml scope=wave run 45356047825, conclusion success. All green: checks, coverage, contract, smoke, publish-smoke, e2e-wave chromium 1 and 2, firefox 1 and 2, webkit 1 and 2 (repeat, own-specs, e2e-chromium skipped by the wave scope). Both N-017 findings closed: M-02.2 passes on all three engines; no Firefox 'Page crashed' with @playwright/test kept at 1.63.0. The push-triggered run 45356039380 was cancelled and is not evidence.
- **Kind:** decision
- **Opened:** 2026-11-24T07:48:28Z
- **Line:** trunk
- **Element:** trunk:task-092-development-dependencies-refreshed-and-the-node-engine-aligned
- **Reason:** decision (run task-092-development-dependencies-refreshed-and-the-node-engine-aligned/review/7): Will you push head 19fc88426b60e849badb35b556213cda6f3395a5 using these commands, dispatch the wave, and provide its run id, commit and job results?
- **Unblock:** `cd <runner home> && node scripts/runner/gate.mjs --line trunk N-018 --reason "<ruling>" [--reject]`

<!-- key:decision-trunk-task-092-development-dependencies-refreshed-and-the-node-engine-aligned/review/5 -->
### N-017 · 2026-11-23 · trunk:task-092-development-dependencies-refreshed-and-the-node-engine-aligned

- **Status:** closed 2026-11-24T07:36:59Z — approved by the approver: Done: pushed at 1398b53f3ab808b9d4026f14cd86370ef8bff31a, gates.yml scope=wave run 45283632876, conclusion failure. Green: checks, coverage, contract, smoke, publish-smoke, e2e-wave chromium 1 and webkit 1. Red, two findings. (a) M-02.2 on all three engines (4 tests each): test/e2e/memory-list.spec.ts:220 still selects the bucket links with /^<bucket>,/ (the comma the label fix removed), so the click times out at 180 s; fix the selector to the new label. (b) Firefox only: 127 tests fail with 'Page crashed' across every spec (shard 1: 61, shard 2: 66; also in run 45219044794), with @playwright/test 1.65.1 and Firefox 159.0 (playwright firefox v1572); the approver's side kept @playwright/test at 1.63.0 exact in commit 90fba817 on the task branch (node_modules reinstalled): record it in the Execution Notes as a pin kept on purpose for AC-1 (cause inferred from the version change, to be confirmed by the next wave run) and in docs/publishing.md if it lists the kept pins. The approver's ruling: park the task with (a) and (b), then the build fixes (a) and asks again for the wave run.
- **Kind:** decision
- **Opened:** 2026-11-23T22:23:24Z
- **Line:** trunk
- **Element:** trunk:task-092-development-dependencies-refreshed-and-the-node-engine-aligned
- **Reason:** decision (run task-092-development-dependencies-refreshed-and-the-node-engine-aligned/review/5): Will you push task/task-092-development-dependencies-refreshed-and-the-node-engine-aligned at 1398b53f3ab808b9d4026f14cd86370ef8bff31a from the runner home, dispatch gates.yml with scope=wave, and provide the run id, commit and results?
- **Unblock:** `cd <runner home> && node scripts/runner/gate.mjs --line trunk N-017 --reason "<ruling>" [--reject]`

<!-- key:halt-trunk-rejected-task-092-development-dependencies-refreshed-and-the-node-engine-aligned -->
### N-016 · 2026-11-23 · trunk:task-092-development-dependencies-refreshed-and-the-node-engine-aligned

- **Status:** closed 2026-11-23T19:28:28Z — resumed by the approver
- **Kind:** halt
- **Opened:** 2026-11-23T19:08:11Z
- **Line:** trunk
- **Element:** trunk:task-092-development-dependencies-refreshed-and-the-node-engine-aligned
- **Reason:** trunk:task-092-development-dependencies-refreshed-and-the-node-engine-aligned rejected 2 times in review: rule it first (npx wingfoil memory history task-092-development-dependencies-refreshed-and-the-node-engine-aligned)
- **Unblock:** `cd <runner home> && node scripts/runner/run.mjs --line trunk --resume`

<!-- key:decision-trunk-task-092-development-dependencies-refreshed-and-the-node-engine-aligned/review/3 -->
### N-015 · 2026-11-23 · trunk:task-092-development-dependencies-refreshed-and-the-node-engine-aligned

- **Status:** closed 2026-11-23T19:04:29Z — approved by the approver: Done: task/task-092-development-dependencies-refreshed-and-the-node-engine-aligned pushed at 81f33c247198a1cfa6d07fc5718e87f3831f9e63 and gates.yml dispatched with scope=wave: run 45219044794, conclusion failure. Green: checks, coverage, contract, smoke, publish-smoke; npm ci on Node 22.22.2 (checks job) added 715 packages, no EBADENGINE. Red: all six e2e-wave jobs (chromium, firefox, webkit x 2 shards), one cause only: axe-core 4.13.0 -> 4.14.1 (through @axe-core/playwright 4.14) reports label-content-name-mismatch (serious, WCAG 2.5.3) in accessibility.spec.ts X-06.4 (memory list, traceability) and X-08.1: the filter links and count buttons whose aria-label does not contain their visible text as is (a[aria-label='task, 4 elements'], 'All types, N elements', 'To approve, N elements', button 'In progress, 1 reference', the trace-toggle buttons). Logs: gh run view 45219044794 --log-failed. The approver's ruling: park the task with this finding; the build fixes the labels so the visible text is part of the accessible name (label in name), updates the tests that assert them, keeps axe-core 4.14, then asks again for the wave run.
- **Kind:** decision
- **Opened:** 2026-11-23T16:38:38Z
- **Line:** trunk
- **Element:** trunk:task-092-development-dependencies-refreshed-and-the-node-engine-aligned
- **Reason:** decision (run task-092-development-dependencies-refreshed-and-the-node-engine-aligned/review/3): Will you push task/task-092-development-dependencies-refreshed-and-the-node-engine-aligned at 81f33c247198a1cfa6d07fc5718e87f3831f9e63 from the runner home, dispatch gates.yml with scope=wave, and provide the run id, commit, gate results and Node 22.22.2 install log?
- **Unblock:** `cd <runner home> && node scripts/runner/gate.mjs --line trunk N-015 --reason "<ruling>" [--reject]`

<!-- key:decision-trunk-task-092-development-dependencies-refreshed-and-the-node-engine-aligned/review/1 -->
### N-013 · 2026-11-23 · trunk:task-092-development-dependencies-refreshed-and-the-node-engine-aligned

- **Status:** closed 2026-11-23T16:22:10Z — approved by the approver: Yes, and it is no exception: cli-only-writes covers the states a verb owns, not the body. The approver committed the build's Execution Notes as they were ('docs(tasks): task-092 execution notes — build', status untouched). Now memory park the task with F-1 and its fix in --reason, and answer rejected. The CI evidence for the final head stays the approver's command (push of the task branch and the gates.yml dispatch): ask for it with RESULT: blocked decision when the review needs it.
- **Kind:** decision
- **Opened:** 2026-11-23T13:57:41Z
- **Line:** trunk
- **Element:** trunk:task-092-development-dependencies-refreshed-and-the-node-engine-aligned
- **Reason:** decision (run task-092-development-dependencies-refreshed-and-the-node-engine-aligned/review/1): May the existing build notes for trunk:task-092-development-dependencies-refreshed-and-the-node-engine-aligned be committed without changing state, as an exception to CLI-only writes, so memory park can record rejection F-1?
- **Unblock:** `cd <runner home> && node scripts/runner/gate.mjs --line trunk N-013 --reason "<ruling>" [--reject]`

<!-- key:diverged-trunk -->
### N-014 · 2026-11-23 · trunk:runner

- **Status:** closed 2026-11-23T16:01:10Z — origin merges again
- **Kind:** diverged
- **Opened:** 2026-11-23T15:57:53Z
- **Line:** trunk
- **Element:** trunk:runner
- **Reason:** origin/design/dev-loop_v0.3.1 does not merge into the checkout: Auto-merging test/README.md
- **Unblock:** `cd <runner home> && node scripts/runner/run.mjs --line trunk --check-git && cd <trunk checkout> && git -c core.hooksPath=/dev/null -c core.fsmonitor=false -c protocol.ext.allow=never -c protocol.fd.allow=never merge origin/design/dev-loop_v0.3.1 (solve the conflict, commit; push from the runner home: git -C <runner home> fetch <trunk checkout> design/dev-loop_v0.3.1 && git -C <runner home> push origin FETCH_HEAD:refs/heads/design/dev-loop_v0.3.1)`

<!-- key:failure-trunk-npm_ci_--silent_--ignore-scripts_in_trunk_worktrees_task-0 -->
### N-012 · 2026-11-23 · trunk:runner

- **Status:** closed 2026-11-23T13:24:09Z — the line ran again without a failure
- **Kind:** failure
- **Opened:** 2026-11-23T13:19:23Z
- **Line:** trunk
- **Element:** trunk:runner
- **Reason:** runner failure: npm ci --silent --ignore-scripts in <trunk worktrees>/task-092-development-dependencies-refreshed-and-the-node-engine-aligned:  (the notice closes by itself once the line runs again without a failure)
- **Unblock:** `cd <runner home> && node scripts/runner/run.mjs --line trunk --dry-run`

<!-- key:decision-trunk-task-092-development-dependencies-refreshed-and-the-node-engine-aligned/build/1 -->
### N-011 · 2026-11-23 · trunk:task-092-development-dependencies-refreshed-and-the-node-engine-aligned

- **Status:** closed 2026-11-23T13:03:57Z — approved by the approver: No: the runner never queries the registry. The approver's side ran the refresh outside the sandbox: commit 2691f25e on the task branch (npm update within ranges, verdaccio 6.11.3 exact), node_modules reinstalled with npm ci. Its message holds npm outdated, npm audit (0 critical, 0 high, 18 moderate dev-only) and npm audit --omit=dev (0), and the engines data. Continue the build from that commit: Execution Notes with those outputs, the accepted moderate findings in docs/publishing.md, engines.node (decide at design: D29-5 in docs/publishing.md keeps the published floor at the run-time closure's 22.12.0 while the dev toolchain needs 22.22.2; raise it only with that reasoning), docs and CHANGELOG, tests only through npm run. Ask with RESULT: blocked decision if any further registry command is needed.
- **Kind:** decision
- **Opened:** 2026-11-23T10:49:12Z
- **Line:** trunk
- **Element:** trunk:task-092-development-dependencies-refreshed-and-the-node-engine-aligned
- **Reason:** decision (run task-092-development-dependencies-refreshed-and-the-node-engine-aligned/build/1): may the headless runner run the registry-querying npm commands (`npm outdated`, `npm audit`, `npm update`/`install`) that task-092 needs, or will the approver supply their output?
- **Unblock:** `cd <runner home> && node scripts/runner/gate.mjs --line trunk N-011 --reason "<ruling>" [--reject]`

<!-- key:blocked-trunk-task-091-session-recovery-scenario-made-deterministic/done/1 -->
### N-010 · 2026-11-23 · trunk:task-091-session-recovery-scenario-made-deterministic

- **Status:** closed 2026-11-23T10:20:16Z — Resolve the rebase conflict in test/package/gates-workflow.test.ts as the task's own merge b4aca3c6 already did: keep both sides, the phase branch's PHASE_BRANCH pattern /^design\/dev-loop_v\d+\.\d+(?:\.\d+)?$/ and every repeat-input addition of 53e4bdcf (EXPRESSIONS, the inputs check, the 'a repeat that runs by default' and 'a fourth input' cases, the repeat job). Then git rebase --continue, run npm run test -- test/package/gates-workflow.test.ts test/package/gates-repeat-step.test.ts and npm run typecheck, lint, format:check, and integrate as the step says.
- **Kind:** blocked
- **Opened:** 2026-11-23T10:18:37Z
- **Line:** trunk
- **Element:** trunk:task-091-session-recovery-scenario-made-deterministic
- **Reason:** blocked (run task-091-session-recovery-scenario-made-deterministic/done/1): rebase of task/task-091-session-recovery-scenario-made-deterministic onto design/dev-loop_v0.3.1 conflicts in test/package/gates-workflow.test.ts (commit 53e4bdcf); integration aborted, nothing merged, memory submit not run
- **Unblock:** `cd <runner home> && node scripts/runner/run.mjs --line trunk --close N-010 --how "<what solved it>"`

<!-- key:gate-trunk-sw-life-cycle-1-plan-backlog-item.approve@task:task-091-session-recovery-scenario-made-deterministic -->
### N-009 · 2026-11-23 · trunk:task-091-session-recovery-scenario-made-deterministic

- **Status:** closed 2026-11-23T10:18:15Z — the approver ruled the gate
- **Kind:** gate
- **Opened:** 2026-11-23T10:12:43Z
- **Line:** trunk
- **Element:** trunk:task-091-session-recovery-scenario-made-deterministic
- **Reason:** backlog-item.approve@task:task-091-session-recovery-scenario-made-deterministic waits for the approver
- **Ready:** yes
- **Head:** 45a48609
- **Evidence:** run task-091-session-recovery-scenario-made-deterministic/review/7 completed
- **Unblock:** `cd <runner home> && node scripts/runner/gate.mjs --line trunk N-009 --reason 'Approved backlog-item.approve@task:task-091-session-recovery-scenario-made-deterministic at 45a48609: run task-091-session-recovery-scenario-made-deterministic/review/7 completed'`

<!-- key:decision-trunk-task-091-session-recovery-scenario-made-deterministic/review/6 -->
### N-008 · 2026-11-23 · trunk:task-091-session-recovery-scenario-made-deterministic

- **Status:** closed 2026-11-23T10:03:37Z — approved by the approver: CI hand-off done by the approver: task/task-091-session-recovery-scenario-made-deterministic pushed at aaf02ac683264e2e4f02fec2bf300e55e6cec1f8; gates.yml run 45149414803 (workflow_dispatch, scope=task, specs=test/e2e/session-recovery.spec.ts, repeat=20) concluded success: repeat 40 passed with --repeat-each 20 on Chromium, no failure or flaky; e2e-chromium 235+235 passed; own specs Firefox 2 and WebKit 2 passed; checks, coverage, contract, smoke, publish-smoke green; e2e-wave skipped outside the wave scope. Resume the review with this evidence.
- **Kind:** decision
- **Opened:** 2026-11-23T09:28:04Z
- **Line:** trunk
- **Element:** trunk:task-091-session-recovery-scenario-made-deterministic
- **Reason:** decision (run task-091-session-recovery-scenario-made-deterministic/review/6): Do you approve the CI handoff: push task/task-091-session-recovery-scenario-made-deterministic at aaf02ac683264e2e4f02fec2bf300e55e6cec1f8 from the runner home, dispatch gates.yml with scope=task, specs=test/e2e/session-recovery.spec.ts and repeat=20, and provide the run id, commit and results before review resumes?
- **Unblock:** `cd <runner home> && node scripts/runner/gate.mjs --line trunk N-008 --reason "<ruling>" [--reject]`

<!-- key:blocked-trunk-task-091-session-recovery-scenario-made-deterministic/start/3 -->
### N-007 · 2026-11-23 · trunk:task-091-session-recovery-scenario-made-deterministic

- **Status:** closed 2026-11-23T08:08:40Z — Run every check through npm run, which the runner allows: npm run test -- test/package/gates-repeat-step.test.ts test/docs/public-text.test.ts test/scripts/e2e-own-specs.test.ts test/package/gates-workflow.test.ts (the test script is vitest run), plus npm run typecheck, lint and format:check. Never npx vitest. Keep the two fixes already in the worktree, commit them once the checks pass, then go on as the step says.
- **Kind:** blocked
- **Opened:** 2026-11-23T08:02:01Z
- **Line:** trunk
- **Element:** trunk:task-091-session-recovery-scenario-made-deterministic
- **Reason:** blocked (run task-091-session-recovery-scenario-made-deterministic/start/3): the two fixes are edited in the worktree but unverified and uncommitted, because the sandbox refused `npx vitest run` (needs approval), so I could not run the checks or `memory submit`
- **Unblock:** `cd <runner home> && node scripts/runner/run.mjs --line trunk --close N-007 --how "<what solved it>"`

<!-- key:halt-trunk-rejected-task-091-session-recovery-scenario-made-deterministic -->
### N-006 · 2026-11-23 · trunk:task-091-session-recovery-scenario-made-deterministic

- **Status:** closed 2026-11-23T07:54:12Z — resumed by the approver
- **Kind:** halt
- **Opened:** 2026-11-23T07:51:39Z
- **Line:** trunk
- **Element:** trunk:task-091-session-recovery-scenario-made-deterministic
- **Reason:** trunk:task-091-session-recovery-scenario-made-deterministic rejected 2 times in review: rule it first (npx wingfoil memory history task-091-session-recovery-scenario-made-deterministic)
- **Unblock:** `cd <runner home> && node scripts/runner/run.mjs --line trunk --resume`

<!-- key:blocked-trunk-task-091-session-recovery-scenario-made-deterministic/review/3 -->
### N-005 · 2026-11-22 · trunk:task-091-session-recovery-scenario-made-deterministic

- **Status:** closed 2026-11-23T07:46:34Z — Both findings are in this task's own change (e72f9648): they need no bug, as for N-004. Reject the review: memory park the task with each finding and its structural fix in --reason (the repeat count refused as an oversized decimal string before any integer comparison, with boundary tests; the recorder of gates-repeat-step.test.ts on the repository's POSIX-shell pattern, so test/docs/public-text.test.ts passes), and answer rejected. A finding in the task's own change never needs a bug.
- **Kind:** blocked
- **Opened:** 2026-11-22T08:02:25Z
- **Line:** trunk
- **Element:** trunk:task-091-session-recovery-scenario-made-deterministic
- **Reason:** blocked (run task-091-session-recovery-scenario-made-deterministic/review/3): WingFoil refuses the mandatory workflow-linked bug creation needed to record the review rejection
- **Unblock:** `cd <runner home> && node scripts/runner/run.mjs --line trunk --close N-005 --how "<what solved it>"`

<!-- key:blocked-trunk-task-091-session-recovery-scenario-made-deterministic/review/1 -->
### N-004 · 2026-11-21 · trunk:task-091-session-recovery-scenario-made-deterministic

- **Status:** closed 2026-11-21T20:51:44Z — The finding is in this task's own change (the repeat job of gates.yml, 53e4bdcf): it needs no bug. Reject the review: memory park the task with the finding and its structural fix (reuse the spec-path validator of scripts/e2e-own-specs.mjs, with a regression test) in --reason, and answer rejected.
- **Kind:** blocked
- **Opened:** 2026-11-21T20:47:30Z
- **Line:** trunk
- **Element:** trunk:task-091-session-recovery-scenario-made-deterministic
- **Reason:** blocked (run task-091-session-recovery-scenario-made-deterministic/review/1): required workflow-linked bug creation is refused because no step of sw-life-cycle-1-plan adds a bug
- **Unblock:** `cd <runner home> && node scripts/runner/run.mjs --line trunk --close N-004 --how "<what solved it>"`

<!-- key:decision-trunk-sprint-002/sprint-planning/3 -->
### N-003 · 2026-11-21 · trunk:sprint-002

- **Status:** closed 2026-11-21T13:22:37Z — approved by the approver: Final OK on the planning of v0.3.1 (Session 3): the four amends made (task-091, task-093, task-095, patch-v0.3.1), the waves as listed; the budget risk accepted, task-095, task-089, task-086 moved to v0.3.2 if Wave 2 ends past day 3
- **Kind:** decision
- **Opened:** 2026-11-21T13:02:08Z
- **Line:** trunk
- **Element:** trunk:sprint-002
- **Reason:** decision (run sprint-002/sprint-planning/3): Do you give the final OK on the planning of v0.3.1 as recorded in `sprint-planning-rel-v0.3.1-plan` Session 3 (step 7 done, the review PASS in round 2, the dispositions of its findings including your four amends to task-091, task-093, task-095 and `patch-v0.3.1`, the waves, and the budget risk with task-095, task-089 and task-086 named to move), so the next launch runs `memory submit sprint-002` and closes the plan?
- **Unblock:** `cd <runner home> && node scripts/runner/gate.mjs --line trunk N-003 --reason "<ruling>" [--reject]`

<!-- key:blocked-trunk-sprint-002/sprint-planning/2 -->
### N-002 · 2026-11-21 · trunk:sprint-002

- **Status:** closed 2026-11-21T12:52:26Z — The 12 tasks approved to backlog, the 8 bugs to planned, bug-051 closed (N-001 item 14)
- **Kind:** blocked
- **Opened:** 2026-11-21T12:38:05Z
- **Line:** trunk
- **Element:** trunk:sprint-002
- **Reason:** blocked (run sprint-002/sprint-planning/2): waiting for the approval of task-084-content-security-policy-on-the-console-pages, task-085-repository-keys-escaped-where-the-page-renders-them, task-086-header-user-name-without-sideways-scroll-at-a-narrow-width, task-087-zero-width-joiner-between-two-letters-kept-in-display-text, task-088-bounded-rendering-of-markdown-bodies-with-lazy-line-quotes, task-089-notification-bell-rows-keyed-by-element, task-090-hoverable-completion-and-chip-tooltips, task-091-session-recovery-scenario-made-deterministic, task-092-development-dependencies-refreshed-and-the-node-engine-aligned, task-093-backlog-tools-read-patch-releases-and-the-generated-backlog-rebuilt, task-094-a-broken-git-configuration-read-as-no-identity, task-095-feature-pattern-of-the-ui-configuration-matching-this-repository-feature-ids (pending → backlog) and of bug-039-the-console-serves-its-pages-without-a-content-security-policy, bug-041-repository-keys-shown-on-the-page-are-not-escaped, bug-044-the-page-scrolls-sideways-at-a-narrow-width-because-of-the-header-user-name, bug-045-a-name-with-a-zero-width-joiner-between-two-letters-shows-the-joiner-as-an-escape, bug-047-a-markdown-body-of-quotes-with-lazy-lines-blocks-the-page-while-it-is-rendered, bug-048-the-notification-bell-keys-its-rows-by-commit-so-a-grouped-commit-shows-wrong-rows, bug-052-completion-and-chip-tooltips-close-when-the-pointer-moves-onto-them, bug-053-scenario-x-02.3-of-the-session-recovery-spec-fails-intermittently (triaged → planned), and bug-051-closing-the-last-planned-sprint-moves-the-life-cycle-to-end-of-life closed per N-001
- **Unblock:** `cd <runner home> && node scripts/runner/run.mjs --line trunk --close N-002 --how "<what solved it>"`

<!-- key:decision-trunk-sprint-002/sprint-planning/1 -->
### N-001 · 2026-11-21 · trunk:sprint-002

- **Status:** closed 2026-11-21T12:23:09Z — approved by the approver: Scope approved as proposed (items 1-13, 6 active days, the exit criteria, patch-v0.3.1 with sprint: sprint-002), with two additions: (14) bug-051 gets release v0.3.1 and is closed by the approver after verifying the fix in force since ed26e1b4, no code task; (9) the dependency refresh also aligns engines.node with what the refreshed dependencies require, exit criterion: npm ci without EBADENGINE on the supported Node.
- **Kind:** decision
- **Opened:** 2026-11-21T12:18:28Z
- **Line:** trunk
- **Element:** trunk:sprint-002
- **Reason:** decision (run sprint-002/sprint-planning/1): Do you approve the scope of v0.3.1 as written in `sprint-planning-rel-v0.3.1-plan` Session 1, step 2 (content items 1–13, a budget of 6 active days, the listed exit criteria, and adding `patch-v0.3.1` with `sprint: sprint-002` at this step)?
- **Unblock:** `cd <runner home> && node scripts/runner/gate.mjs --line trunk N-001 --reason "<ruling>" [--reject]`
