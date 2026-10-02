# Coherence Audit — Specification

**Version:** 1.0
**Date:** 2026-10-02
**Status:** Step 6 of `specification-downcast` (plan
`docs/05_plans/sw-life-cycle/specification-downcast-specification-plan.md`)
**Auditor:** an independent agent with no part in sessions 1–5, read-only on the repository, given
only the documents and the plan's checks; it verified each claim against the files, the pinned CLI
0.2.2 (`node_modules/wingfoil`) and the `init` templates. Fixes applied afterwards by the session
agent; their result re-verified by the validators.
**Scope:** `01_user_story_map/`, `02_bdd/`, `03_sard/`, `docs/03_backlog/`, against
`docs/01_vision/` and the evidence (`docs/00_reference/`, directives, `.wingfoil/`).

Each finding is **fixed** (the document changed, its version bumped) or **recorded** (a decision
kept, with its reason). Severity as reported: **major** would make scenarios fail or links wrong;
**minor** is stale text, wording or testability.

---

## Result

**Passed with fixes.** 0 blocker, 10 major, 24 minor findings — all 10 major fixed; 23 minor
fixed, 1 fixed in part and recorded (1.2). The four validators pass after the fixes, and `check_sard.py` gained the check
that would have caught finding 1.1.

| Measure | Before | After |
|---------|--------|-------|
| MVP features · stories | 44 · 110 | 44 · 110 |
| Scenarios (nominal / edge) | 292 (116 / 176) | 294 (116 / 178) |
| SARD requirements | 50 | 50 |
| Backlog items · dependency links | 160 · 221 | 160 · 237 |
| Stories with no technical-task dependency | 12 | 10 |

## Major findings

| # | Finding | Outcome |
|---|---------|---------|
| 1.1 | 17 REQ→scenario citations named a scenario whose story was missing from the REQ, so the backlog dropped the links (US-T-04, US-R-10 without dependencies; TT-INT-08 without stories) | **Fixed** — stories added to the REQs (SARD v0.2); the generator also derives `stories` from the cited scenarios; `check_sard.py` now refuses a scenario cited without its story |
| 3.1 | Cloning a remote (US-S-04) was outside the write classes ("nothing else is written"), and REQ-ARC-03 said v0.1 writes nothing | **Fixed** — class (c) now includes `clone` into a new, empty folder; the UI's local state is stated as outside every repository (`02_product-vision.md` v0.4, directive `cli-only-writes` v1.3, REQ-ARC-03) |
| 3.2 | The closed git list allowed `commit -- .wingfoil/ui.yaml` but not `add`: the first preset (untracked file) could not be committed | **Fixed** — `add -- .wingfoil/ui.yaml` added to REQ-INT-06 |
| 5.1 | CLI 0.2.2 writes `wf(<type>): add <id>` and `wf(<type>): submit <id>` with no `[from → to]`; scenarios expected brackets, and the Timeline/Recent activity premise relied on them | **Fixed** — conventions rule corrected; G-10.1, G-10.2, G-15.1 and the timeline variant fixed; a submit's transition is read from the file's `status` before and after the commit (REQ-INT-06, T-08.1) |
| 6.1 | CLI ids pad numeric tokens to 3 digits (`task-001-…`); the fixtures used `task-1-…` (≈ 175 occurrences) | **Fixed** — every id renamed in the conventions, features and SARD; the `unknown` fixture's patterns stated |
| 6.2 | The Kanban template's ingest workflows have one phase with no action, so under the conventions' own rule Kanban has no ingestion, yet G-16.2 and REQ-INT-05 expected three | **Fixed** — the kanban fixture offers no ingestion (hidden: not applicable; G-16.2 rewritten, REQ-INT-05); the main workflow is the first non-ingestion `kind: main` included. **Recorded** for WingFoil: request R-10 (local notes) |
| 6.3 | The preset's `requires` also covers `adr`, so `adr-001-local-server` lacks a reference: M-03.1 and coverage 3/4 were wrong | **Fixed** — M-03.1 lists two elements; coverage 3/5, project-wide (conventions, R-01.1, REQ-STATE-08) |
| 6.4 | `triaged` (custom `bug`) is both a gate and a `waiting:` state, with no precedence; T-12.3 depended on one | **Fixed** — rule: engine advances it, not a pending gate, approver sees only its reject (conventions, REQ-ARC-06, REQ-STATE-08); new scenario S-24.4 |
| 6.5 | "Review state" was used (T-04.x, A-02.2) but never defined | **Fixed** — rule: the reviewer and approver views list gate states, actionable only for members holding `approver` (conventions, REQ-ARC-06); A-02.2 reworded |
| 6.6 | C-03.2 expected the Scrum preset to map a `story` type; WingFoil's Scrum template has the Kanban types | **Fixed** — the refusal is exercised with the `sw-life-cycle` preset on the kanban fixture (`service` undeclared) |

## Minor findings

| # | Finding | Outcome |
|---|---------|---------|
| 1.2 | Some REQs cite stories without their scenarios, or scenarios that do not exercise them (REQ-ARC-03, REQ-SEC-10; REQ-SEC-09 traces context scenarios) | **Fixed** for ARC-03 (Y-05.1, Y-07.1, S-04.3) and SEC-10 (US-G-05 removed). **Recorded** for SEC-09: its scenarios are the places where secrets could appear; the secret scan is the check |
| 1.3 | Backlog titles cut mid-word at 120 characters | **Fixed** — cut at a word boundary with "…" |
| 2.3 | "Open runs" of an ingestion on 0.2.2 (no run state) undefined | **Fixed** — rule in the conventions |
| 3.3 | The dogfooding action log was not among the allowed persistent state | **Fixed** — `03_is-isnot.md` v0.6, REQ-ARC-08 |
| 3.4 | The `cli-only-writes` check would count the fixtures' set-up commits | **Fixed** — scoped to commits created while driving the UI (v1.3) |
| 4.2 | REQ-INT-08 named browsers and versions but measured engines | **Fixed** — description narrowed to the engines of the pinned Playwright |
| 4.3 | REQ-ARC-10's fit criterion did not measure screen-reader announcements | **Fixed** — X-07.1–X-07.3 added to it |
| 5.2 | Phase names not those of the workflow files ("dev-loop · implement", "Phase 2 — dev-loop") | **Fixed** — "dev-loop · red", "implementation", full position path in M-06.1 |
| 5.3 | UX reference and ADR draft kept the Permissions tab, `files.edit` and a fixed scope id | **Fixed** — sections marked superseded, scope example type-only (evidence, not versioned documents) |
| 6.7 | The timeline Background replaced the history and dropped the team | **Fixed** — named *timeline variant* keeping the standard team |
| 6.8 | The fixtures' project names were never set | **Fixed** — the builder sets `dna.project.name` |
| 6.9 | G-01.3 mixed a template required field with `ui.yaml` references | **Fixed** — shown as "required field, missing" |
| 7.1 | `06_features.md` still cited "advisory permissions (C3)" | **Fixed** — v0.6 |
| 7.2 | `07_sequencer.md` input line said 45 features | **Fixed** — v0.5 |
| 7.3 | Edited documents without a version bump (`01_backbone.md`, vision `00_index.md`, SARD area file) | **Fixed** — all bumped; backlog rebuilt with the new versions |
| 7.4 | Input lines citing superseded versions | **Fixed** in the story map, cut, conventions and plan context |
| 7.5 | `open-questions.md` still recorded Q11 as advisory | **Fixed** — marked superseded |
| 8.1 | S-11.1 never opened its fixture | **Fixed** |
| 8.2 | X-07.2's refused action unnamed | **Fixed** — the refused submit of `adr-001-local-server` |
| 8.3 | G-17 forced CLI refusals with no declared mechanism | **Fixed** — *CLI stub* variant in the conventions |
| 8.4 | The reason field's behaviour when switching to reject was undefined, and G-06.3 had two actions | **Fixed** — untouched default cleared, typed text kept; G-06.3 split, G-06.4 added |
| 8.5 | Unstated data: clock, inferred categories, default clone folder, creation events | **Fixed** — test clock, inference rule, `~/projects/<repository>`, creation events show "created" |
| 8.6 | The cache key ignored git configuration, needed by the identity refresh | **Fixed** — REQ-STATE-02 watches the effective `user.email` |

Note: the plan's Session log keeps the counts of its time (e.g. "112 stories" in session 1) — it is
history; the current counts are in the documents.

## Re-verification

The same auditor re-verified the fixes: **confirmed with remarks** — 33 of 34 findings fixed as
claimed, 1.2's recorded part accepted; validators pass and the backlog rebuild changes nothing.
New findings, all fixed:

| # | Finding | Outcome |
|---|---------|---------|
| N1 (major) | The reviewer-view rule, read literally, listed gate states for a reviewer without `approver`, against T-06.1 | **Fixed** — gate states in *Requires you* only for members holding `approver`, in *Waiting on others* for the others (conventions, REQ-ARC-06) |
| N2 | "No write path" left in `07_sequencer.md`, `03_mvp-cut.md`, REQ-ARC-03 | **Fixed** — v0.1's only write is the clone |
| N3 | Memory buckets silent on states both gate and `waiting:` | **Fixed** — they go to *Waiting/drafts/closed* (`memory-list.feature`) |
| N4 | No session-6 entry in the plan's Session log | **Fixed** — entry added |
| N5 | Source of a submit's transition unnamed | **Fixed** — REQ-INT-06 names `git log -p` / `memory history`, exact choice in the Memory-event tech-spec |

## Checks that passed with no finding

- Every MVP feature has a story; every story has ≥ 1 nominal and ≥ 1 edge scenario in its release;
  backlog fields equal their sources (check 1).
- No story earlier than its features; v0.1–v0.3 scenarios use only 0.2.2 verbs, v0.4 only the 0.3
  verbs of the ADR draft (check 2).
- No scenario writes governed files, merges/rebases, edits a draft or stores permissions (check 3).
- All 7 MVP canvas metrics and all 10 SARD coverage items map to a REQ with a measurable fit
  criterion (check 4).
- Every other fixture figure recomputed and confirmed (Requires you counts, buckets, completion
  25 %, tasks 1/4, outcome labels, phase order, type lists).

## Hand-off to `initial-design` (`rl-v1`)

- **Tech-specs** to seed: action descriptor (REQ-ARC-06, conventions rules), CLI JSON contracts per
  consumed command (REQ-INT-01), server HTTP API and event stream (REQ-INT-09, SEC-02/03/04),
  `ui.yaml` schema and presets (REQ-ARC-07), Memory-event parsing from git (REQ-INT-06).
- **`adr-001`** from the ADR draft: binary discovery and version detection (REQ-ARC-02, INT-02),
  snapshot and cache (STATE-01/02), local security (SEC-01…06).
- **Releases** from `07_sequencer.md`, `requirements:` = `docs/03_backlog/04_backlog/by-release/vX.Y.json`;
  v0.1 carries 34 of 50 technical tasks — to be weighed by its `release-planning`.
- **Requests to WingFoil** (local notes): R-09 (action permissions), R-10 (template ingestions).
