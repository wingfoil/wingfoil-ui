# Runner notices

**Version:** 0.1 · **Date:** 2026-11-19 (0.1: created by the runner adoption, `governance-evolution-8-plan`)

What the script runner asks of the approver: a gate to rule, a decision, a blocked step, a halted
line. The runner writes this file itself, between the markers below; it is never edited by hand
(`wingfoil-cli` › *The script runner*). A notice closes when its cause is gone or the approver closes it with the
command it names.

## Open

<!-- runner:open -->

## Closed

<!-- runner:closed -->

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
