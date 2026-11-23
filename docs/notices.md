# Runner notices

**Version:** 0.1 · **Date:** 2026-11-19 (0.1: created by the runner adoption, `governance-evolution-8-plan`)

What the script runner asks of the approver: a gate to rule, a decision, a blocked step, a halted
line. The runner writes this file itself, between the markers below; it is never edited by hand
(`wingfoil-cli` › *The script runner*). A notice closes when its cause is gone or the approver closes it with the
command it names.

## Open

<!-- runner:open -->

<!-- key:blocked-trunk-task-091-session-recovery-scenario-made-deterministic/start/3 -->
### N-007 · 2026-11-23 · trunk:task-091-session-recovery-scenario-made-deterministic

- **Status:** open
- **Kind:** blocked
- **Opened:** 2026-11-23T08:02:01Z
- **Line:** trunk
- **Element:** trunk:task-091-session-recovery-scenario-made-deterministic
- **Reason:** blocked (run task-091-session-recovery-scenario-made-deterministic/start/3): the two fixes are edited in the worktree but unverified and uncommitted, because the sandbox refused `npx vitest run` (needs approval), so I could not run the checks or `memory submit`
- **Unblock:** `cd <runner home> && node scripts/runner/run.mjs --line trunk --close N-007 --how "<what solved it>"`

## Closed

<!-- runner:closed -->

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
