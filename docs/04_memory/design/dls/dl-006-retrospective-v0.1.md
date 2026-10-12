---
id: dl-006-retrospective-v0.1
type: decision-log
title: "Retrospective v0.1"
status: ready
context: "retrospective" # optional — short label for the context, e.g. "retrospective", "planning", "ad-hoc"
release: ""            # optional — implementation release this DL is assigned to (stamped at release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

Retrospective of release `minor-v0.1` (`docs/04_memory/planning/v1/minor-v0.1.md`, `released`, tag
`v0.1.0`), phase `retrospective` of `release-cycle` v1.1, plan `retrospective-rel-v0.1-plan`. The
phase `explore` mined the Execution Notes of tasks task-001 … task-025, bugs bug-001 … bug-008,
dl-004, dl-005, the six `done` plans of `docs/05_plans/rl-v1/rel-v0.1/`, `docs/wingfoil-feedback/`
and directive `wingfoil-cli`; the source-cited friction inventory (themes T1 … T10) is in that plan,
*Friction inventory of `minor-v0.1`*. The approver chose the actions at `additional-points` (plan
decisions RT-7 … RT-12).

Deviation: `retrospective.yaml` `capture` names the output
`docs/04_memory/design/dls/retro-{release.version}.md`, but `memory.yaml` gives decision-logs the
id `dl-{n}-{slug}`; this record keeps the CLI id (plan decision RT-3). Correcting the `produces`
line is part of dl-008.

## Decision

**What went well — keep:**

- An independent, fresh-context, read-only review of every task but one (task-024: coordinator
  check), and of specs, plans and documents, repeated until PASS. It found at least one defect in
  23 of 25 tasks. Reviews or release validation, not tests, found 5 of the 8 bugs (bug-002, 003,
  006, 008 by review; bug-007 at release validation).
- Red-first commits for review fixes; repository checkers (`check_tasks.py`, `check_releases.py`,
  `check_backlog.py`) negative-tested on injected defects.
- Spec gaps fed back to the specs as dated Process Notes, not left in the code.
- Resuming interrupted agents from commits: at least 14 stops, no recorded loss.
- Known limitations documented in `CHANGELOG.md` rather than hidden.

**What to improve — actions adopted:**

1. **Load-independent tests** (themes T2, T3): one v0.2 task covering
   - a single temp-dir convention under `TempWorkspace`, documented in `test/README.md`, that also
     fixes bug-008;
   - perf and fingerprint assertions that prove a fresh read, not cached data (bug-005, task-021
     R-05.1);
   - the package smoke (`npm run test:smoke`) run as a gate at every wave, not only at release
     validation (bug-007 was found there).
2. **Hand transitions** (T4): decided in dl-007.
3. **Inherited workflows** (T5): decided in dl-008.
4. **Public-text check** (T9, dl-005 Actions): one v0.2 task adding a test that fails when a
   tracked text file contains an absolute filesystem path outside the repository; session names
   stay an item of the review checklist (no pattern list is committed, as in dl-005).
5. **Spec amendments** (T6): one v0.2 task amending spec-007 §1/§3/§6 and spec-006 §1 to the
   shipped behaviour (user-docs decision UD-7).
6. **Process rules** (T1, T8, T9):
   - a security fix is reviewed by an adversarial reviewer who runs the tool itself (lesson of
     task-021, three consecutive credential bypasses);
   - the release Execution Notes record actual effort per phase, so the next retrospective can
     compare it with the budget (v0.1: budget 6 → 9 active days, no per-phase actuals);
   - a plan's frontmatter `version` is kept equal to its Context header `Version`;
   - governance tasks are planned at `release-planning`, not added between waves (v0.1: task-022 …
     task-025).

## Rationale

- The review found what the tests missed, and the test harness itself hid bug-002 and bug-007:
  the cheapest improvement is to make the tests catch these classes, not to add review rounds.
- External machine load caused spurious failures in at least 15 tasks and skipped `test:timing`
  seven times; load itself stays handled by `test:timing` and the load threshold, while the
  temp-dir and fresh-read rules address the T2 classes (leaked temp folders, assertions passing on
  cached data).
- Actions 1, 4 and 5 are tasks, not decisions: they go to the backlog of `minor-v0.2` at its
  `release-planning`. Actions 2 and 3 change the governance configuration, so they get their own
  decision-logs.
- Trade-off: the process rules of action 6 are recorded here and applied by the agents' review
  practice; none is enforced by a check yet.

## Actions

- `release-planning` of `minor-v0.2`: plan the tasks of actions 1, 4 and 5, with bug-008 under
  action 1 (tech-lead).
- Apply the rules of action 6 from `minor-v0.2` on (tech-lead, reviewer).
- Carry out dl-007 and dl-008 (tech-lead), dl-008 within `wingfoil-sync` (plan decisions RT-9,
  RT-6).
- Next retrospective: check each action of this record against the v0.2 Execution Notes
  (facilitator).
