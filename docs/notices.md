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

<!-- key:decision-trunk-sprint-002/sprint-planning/1 -->
### N-001 · 2026-11-21 · trunk:sprint-002

- **Status:** closed 2026-11-21T12:23:09Z — approved by the approver: Scope approved as proposed (items 1-13, 6 active days, the exit criteria, patch-v0.3.1 with sprint: sprint-002), with two additions: (14) bug-051 gets release v0.3.1 and is closed by the approver after verifying the fix in force since ed26e1b4, no code task; (9) the dependency refresh also aligns engines.node with what the refreshed dependencies require, exit criterion: npm ci without EBADENGINE on the supported Node.
- **Kind:** decision
- **Opened:** 2026-11-21T12:18:28Z
- **Line:** trunk
- **Element:** trunk:sprint-002
- **Reason:** decision (run sprint-002/sprint-planning/1): Do you approve the scope of v0.3.1 as written in `sprint-planning-rel-v0.3.1-plan` Session 1, step 2 (content items 1–13, a budget of 6 active days, the listed exit criteria, and adding `patch-v0.3.1` with `sprint: sprint-002` at this step)?
- **Unblock:** `cd <runner home> && node scripts/runner/gate.mjs --line trunk N-001 --reason "<ruling>" [--reject]`
