---
id: dl-009-retrospective-v0.2
type: decision-log
title: "Retrospective v0.2"
status: ready
context: "retrospective" # optional — short label for the context, e.g. "retrospective", "planning", "ad-hoc"
release: ""            # optional — implementation release this DL is assigned to (stamped at release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

Retrospective of release `minor-v0.2` (`docs/04_memory/planning/v1/minor-v0.2.md`, `released`, tag
`v0.2.0`, `wingfoil-ui@0.2.0` on npm), phase `retrospective` of `release-cycle` v1.1, plan
`retrospective-rel-v0.2-plan`. The phase `explore` mined the Execution Notes of task-026 …
task-045 and bug-008 … bug-023, dl-006 … dl-008, the seven `done` plans of
`docs/05_plans/rl-v1/rel-v0.2/`, `docs/wingfoil-feedback/`, directive `wingfoil-cli` and
`docs/publishing.md`; the source-cited friction inventory (themes T1 … T12) and the status of every
action of dl-006, dl-007 and dl-008 are in that plan (*Friction inventory of `minor-v0.2`*,
*Actions of the v0.1 records — status*). The approver chose the actions at
`additional-points` (plan decisions RT2-6 … RT2-18). This record follows `retrospective.yaml` v1.2:
`capture` produces a decision-log with the `dl-{n}-{slug}` id (dl-008), so the deviation RT-3 of
v0.1 no longer applies.

The actions of the v0.1 records, checked against the v0.2 record (plan *Actions of the v0.1
records — status*):

- dl-006 1 (load-independent tests): done (task-026), but load-bound test defects recurred
  (bug-009, bug-011, bug-015, bug-023);
- dl-006 2 and 3: done through dl-007 and dl-008;
- dl-006 4 (public-text check): done (task-028);
- dl-006 5 (spec-007 and spec-006 amendments): done at release-planning (RP-11); new differences
  of spec-007 are open (UD2-7);
- dl-006 6: the adversarial reviewer who runs the tools is applied to five tasks, not to task-029;
  the per-phase actuals are partly recorded (no working time on the validation days); governance
  tasks are partly planned at release-planning (task-026 … task-029; task-043 … task-045 added at
  validation); the plan `version` rule is not applied: two of seven plans drift;
- dl-007: done (W-25, W-26, F-020 … F-022), but no feedback sync has run;
- dl-008: done (three workflows tailored), but the header of `release-publishing.yaml` is stale.

## Decision

**What went well — keep:**

- The independent, fresh-context review until PASS, and the adversarial reviewer who runs the tools
  on security tasks: round 1 was not a PASS in 18 of 20 tasks, and reviews or design probes found
  7 of the 15 bugs found during v0.2 (bug-010, 011, 013, 014, 015, 017, 018; bug-008 was a v0.1
  find) (T1, T4).
- Design probes (git, the CLI, the browser) before code: they found bug-013 (a v0.1 hole), bug-014,
  bug-018 and W-28 before any fix was written (T12).
- Guard-removal checks recorded wherever a test passed on its first run (T12).
- `workflow_dispatch` dry runs before the tag: three defects found with no tag and no publish
  (T3, T12).
- The governance pre-step before `release-planning` (~1 h), which reduced v0.1's hand-transition
  friction and removed the inherited-workflow friction (T12; T6).
- Known limitations and declared residuals written into the user guide and `CHANGELOG.md` (T12).

**What to improve — actions adopted:**

1. **Governance alignment before v0.3** (T6, T8): decided in dl-010.
2. **CI runs and environment checks** (T3, T10): decided in dl-011.
3. **Automatic update** (T4, W4-16): the declared risk stays in v0.3, with `autoUpdate` off by
   default. A time-boxed design spike tries a structural guard — fast-forward only when no incoming
   path is matched by a `.gitattributes` filter, diff or merge driver, or a temporary
   `info/attributes` override — with an adversarial probe; no new heuristic is added. If the spike
   does not converge, the declared risk stays.
4. **Load** (T2): bug-023 is fixed in v0.3; no test starts more than one console in one test body;
   the machine-free slot stays as it is; every heavy-gate log records the load and the wait for
   the slot.
5. **GitHub Release** (T8): a governance task of v0.3 adds the automatic `release` job after
   `promote`, attaching the coverage totals only (the full reports hold absolute local paths,
   dl-005).
6. **`test:timing`** (T2, T7): run alone through the machine-free slot at every wave gate and at
   `pre-release-checks`, whatever the diff since the last run.
7. **Bug `release` field** (T6): the triage of a bug fixed in a later release sets `release`; the
   absorption into a task stamps it; a v0.3 check flags a closed bug with an empty `release`.
   bug-018 gets `release: "v0.2"`.
8. **spec-007 §1/§3/§6** (T5, UD2-7): amended in `identify-specs` of the `release-planning` of
   `minor-v0.3`, as RP-11 did for v0.2, not by a separate task.
9. **Process rules** (T1, T7, T9):
   - before asking for a re-review, the author checks the Version/Date line, the wraps, the ids
     and the counts the fixes touched (v0.2: five document reviews failed round 1, four of them
     twice);
   - release validation is budgeted at 2–3 active days (v0.2: 3 used, 1 planned); tasks found at
     validation are an expected category; working time is recorded on validation days too;
   - bug-019's fix brings a fixture element with an id over 100 characters; the action-log ratio
     target for v0.3 is 80 % (v0.2: 8 of 12).
10. **Candidates for the `release-planning` of `minor-v0.3`** (T4, T5): the typed
    `SafeToolMessage`, the key-rendering build, task-043's `opener.ts` follow-up, the accepted
    e2e-smoke gaps of ES2-3.
11. **Housekeeping**: the merged `design/*_v0.2` branches are deleted locally and on `origin`
    (`design/inception_v1` stays); the frontmatter `version` of `release-submit-rel-v0.2-plan` and
    `release-publishing-rel-v0.2-plan` is aligned to the Context `Version`; the npm placeholder
    `0.0.0-stage` is the approver's call.

## Rationale

- The review keeps finding what tests miss, but in v0.2 three costs were avoidable: defects that
  only a runner shows (dl-011), the same load class returning (action 4), and slips introduced by
  review fixes (action 9). Each action targets one of them rather than adding review rounds.
- W4-16 showed that heuristic guards on configuration do not converge; a structural guard is
  worth one bounded try, while the declared risk is acceptable for a setting that is off by
  default.
- A fixed `test:timing` run is simpler than a rule on which paths are timed: the v0.2 re-run
  (RS2-2) came from reusing evidence that a later change made stale (RV2-3), and a diff-based rule
  was the alternative considered. A run alone takes about 23 min (RS2-2).
- Validation took three days in v0.2 against one planned (`minor-v0.2` effort table); governance
  tasks were added late in both releases (v0.2: task-043 … task-045 at validation;
  v0.1: task-022 … task-025, three between waves and one at validation). Planning for it is more
  honest than a deviation each release.
- Trade-off: the process rules of action 9 are applied by the agents' practice; only the bug-field
  check (action 7) and the plan-version check (dl-011) are enforced by a check.

## Actions

- `release-planning` of `minor-v0.3`: plan the tasks of actions 3 (spike), 4 (bug-023), 5, 7 (the
  check) and the candidates of action 10; amend spec-007 (action 8); budget release validation by
  action 9 (product-owner, tech-lead).
- Apply the rules of actions 4, 6, 7 and 9 from `minor-v0.3` on (tech-lead, reviewer, developer).
- Carry out dl-010 and dl-011 (tech-lead).
- At the close of this retrospective: bug-018's `release`, the two plan versions and the branch
  deletion of action 11, each with the approver's OK (facilitator).
- Next retrospective: check each action of this record against the v0.3 Execution Notes
  (facilitator).
