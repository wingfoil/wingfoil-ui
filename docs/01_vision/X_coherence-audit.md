# Coherence Audit — Vision Package (WingFoil UI)

**Version:** 1.1
**Date:** 2026-10-01 (1.1: external review integrated — session 7)
**Status:** Passed with fixes — lean-inception sessions 6–7 (to accept)
**Scope:** `01_product-brief.md` (v0.2) · `02_product-vision.md` · `03_is-isnot.md` · `04_personas.md` ·
`05_journeys.md` · `06_features.md` · `07_sequencer.md` · `08_mvp-canvas.md` ·
`docs/00_reference/open-questions.md`
**Plan:** `lean-inception-inception-plan` (step 6)

Each check is the one listed in the plan. A finding is either **fixed** in this audit (the document
version notes it) or **recorded** as a decision or a hand-off to `specification-downcast`.

---

## Check 1 — Vision ↔ Is/Is Not ↔ brief §6–7

No MVP feature contradicts an "Is not" or a "Does not".

| # | Finding | Outcome |
|---|---------|---------|
| 1.1 | `03_is-isnot.md` said the only persistent state is the project list and `ui.yaml`; feature C4 adds local per-user settings | **Fixed** — `03_is-isnot.md` v0.3 |
| 1.2 | Brief §6 lists a *WingFoil settings* Configuration tab in the MVP; `06_features.md` places it in L7 (needs WingFoil core settings) | **Recorded** — the Vision Package supersedes the brief's MVP list; the brief stays as the inception input |
| 1.3 | "No element created outside a workflow" (Is not) vs G5 on WingFoil 0.2.2, which runs an ingestion's steps as `memory add` + `submit` | ~~Consistent~~ **Superseded by R1** — the steps are the workflow's own, but filling the required fields needs a hand edit the UI may not make |
| 1.4 | C1 *Use preset* commits `.wingfoil/ui.yaml` vs `cli-only-writes` | ~~Consistent~~ **Superseded by R2** — allowed, but the vision and the checks said "only `wf(…)` commits"; now write class (b) |
| 1.5 | Y2 fetch / Y3 push vs "not a git client" | **Consistent** — `03_is-isnot.md` v0.2 allows fetch and push, not merge/rebase |

## Check 2 — Personas ↔ journeys ↔ features ↔ sequencer (both ways)

| # | Finding | Outcome |
|---|---------|---------|
| 2.1 | Every persona has ≥ 1 journey (Taylor covered by Morgan/Sam, by decision) | ✓ |
| 2.2 | Every journey step maps to ≥ 1 feature | ✓ |
| 2.3 | T5, C1, C3 were not cited in the journey-coverage table (orphans in the reverse direction) | **Fixed** — `06_features.md` v0.2: T5, C1 in J2; C1 in J0; C3 in J1 |
| 2.4 | S1, S8, X1–X3 serve every journey and appear in no step | **Fixed** — declared as cross-cutting in `06_features.md` v0.2 |
| 2.5 | All 42 features are assigned to exactly one release; T2, W1, G5 also get a WingFoil 0.3 upgrade in v0.4 (by design) | ✓ (checked by script over `06`/`07`) |
| 2.6 | `07_sequencer.md` marked J0 complete in v0.1, but J0 step 4 opens Today (T1, v0.2) | **Fixed** — `07_sequencer.md` v0.2: v0.1 opens on the Memory list, J0 completes in v0.2 |

## Check 3 — WingFoil versions

Every feature that needs a WingFoil capability missing from 0.2.2 sits in a release whose floor
provides it.

| # | Finding | Outcome |
|---|---------|---------|
| 3.1 | T3, A1, A2 (0.3+) and the T2/W1/G5 upgrades are in v0.4 (floor 0.3); WingFoil's own v0.3 release scope includes agent execution and the workflow commands | ✓ |
| 3.2 | All v0.1–v0.3 features use 0.2.2 verbs (`dna/directives/paths/workflow list`, `memory search/history/add/submit/approve/reject`, `--version`) or git only | ✓ |
| 3.3 | **In 0.2.2 both `memory approve` and `memory reject` require the `approver` role** (CLI help), whatever the gate: a reviewer (J4) or product owner (J2) without it cannot pass or send back items | **Fixed** — obstacle added to J4 (`05_journeys.md` v0.2; J2 already had it); added to the `wingfoil-cli` directive (W-13). The per-gate role shown in the UX reference (§8) waits for WingFoil |
| 3.4 | Approve requires `--reason` in 0.2.2, the UX reference made it optional | ✓ already decided in session 4 (G2) |

## Check 4 — Open questions

All 12 questions of `open-questions.md` are answered and struck, each with a pointer to the
document that decides it (sessions 1–5). ✓ — **but** (found by the external review, R3) the
choice of which CLI the server runs was still deferred to the ADR although S1/S3 depend on it; it
is now a product decision (`02_product-vision.md`, session 7), only its technical details remain
for `adr-001`.

## Check 5 — Terminology (directive `ux-consistency`)

| # | Finding | Outcome |
|---|---------|---------|
| 5.1 | Element types, states (`in-discussion`, `in-review`, `triaged`, `closed`…), verbs (submit, approve, reject), roles and phases are used as WingFoil names them | ✓ |
| 5.2 | UI terms (*Requires you*, *element panel*, *gate footer*, *ingestion*) are defined once in the UX reference and used consistently | ✓ |
| 5.3 | "Area" (features) = `pillar` (release elements) — stated in `06_features.md` and `07_sequencer.md` | ✓ |

---

## Hand-off to `specification-downcast`

The UX reference is evidence, not specification. Where the Vision Package departs from it, the
specification follows the Vision Package:

- §4.2 "reason optional to approve" → required, pre-filled (G2).
- §4.2, §4.3, §4.5, §4.6, §4.7 edit modes → after v1.0 (L1, L2, L3).
- §4.11 *WingFoil* settings tab → after v1.0 (L7); a *UI settings* page (C4) is added.
- §8 per-gate roles → WingFoil 0.2.2 gates need `approver` (finding 3.3).
- New screens not in the UX reference: version/capability notice (S3), agent log view (A2),
  all-roles summary (S5), *How to join* (C2), repository status with sync options (Y1, C4),
  update control and blocked-update notice (Y4), *local changes* marker (S8).

The success metrics of `08_mvp-canvas.md` become SARD fit criteria.

## Session 7 — External review of the Vision Package

An external review found what the cross-document checks above could not: rules of the package
that its own features broke. Each finding was verified against the files and the CLI 0.2.2.

| # | Finding | Verification | Outcome |
|---|---------|--------------|---------|
| R1 | Ingestion on 0.2.2 needs hand-edited drafts, which `cli-only-writes` forbids | `--set` fills only `title` and id/path tokens; `severity`, `sard_ref`, `scope`… cannot be set | **Fixed** — G5 limited to types whose required fields the CLI sets (decision-log on 0.2.2); J7 moves to v0.4, conditional (`05` v0.3, `06` v0.3, `07` v0.3) |
| R2 | "WingFoil is the only writer" vs C1 committing `ui.yaml` | vision line, C1, directive check, e2e and canvas metric all required `wf(…)` only | **Fixed** — four write classes (`02` v0.2); directive `cli-only-writes` v1.1; e2e-smoke; canvas metric |
| R3 | Which CLI runs was undecided | see Check 4 | **Fixed** — product decision in `02`; details to `adr-001` |
| R4 | Gates promised to Sam and Casey on 0.2.2 | approve/reject need `approver` (W-13) | **Fixed** — exit criteria per role, informational experience without `approver`, fixtures with and without (`07` rule 6, `08`) |
| R5 | No snapshot semantics with local changes | **Worse than reported:** `memory search` reads the working tree, writes gate on HEAD, `submit` commits the target's uncommitted edits | **Fixed** — working-tree snapshot, *local changes* marker, actions blocked, cache on HEAD + status (`03` v0.4, `05`, S8, G2, G3, R8, ADR draft) |
| R6 | "Behind" detected but no way back | — | **Fixed** — Y4 fast-forward update; actions blocked while behind; diverged → terminal (`03`, J8, C4) |
| R7 | "Methodology-agnostic" without an operational contract | T1 relied on concepts not derivable for unknown states | **Fixed** — S9 action descriptor with "Action required" fallback; third fixture with unknown types/states and no `ui.yaml` (`02`, `06`, `07`, `08`) |
| R8 | Local server security missing | — | **Fixed** — X4 (loopback, session token, Origin/Host, opaque ids, no shell, confinement, git-email policy in S4); e2e-smoke `local-security` |
| R9 | Hidden vs read-only undefined | — | **Fixed** — rule in `02` (Q2 row), S3, journeys' common rules |
| R10 | Same remote twice blocks worktrees | — | **Recorded** — D3 kept for the MVP; L10 after v1.0 |

Features: 42 → **45** (S9, Y4, X4); v0.1 16, v0.2 13, v0.3 13, v0.4 3.

## Result

**Passed** — session 6: 5 findings fixed, 1 recorded (1.2); session 7: 9 review findings fixed, 1
recorded (R10). No open failure; the technical details of the CLI rule are handed to `adr-001`.
