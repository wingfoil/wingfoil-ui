# Requirements — WingFoil UI

**Version:** 1.0
**Date:** 2026-10-02
**Status:** Produced by `specification-downcast` (phase `specification` of `sw-life-cycle`); plan
`docs/05_plans/sw-life-cycle/specification-downcast-specification-plan.md`

The engineering requirements of WingFoil UI, downcast from the Vision Package
(`docs/01_vision/`): user stories → examples → architecture requirements → backlog. Input of
`initial-design` for the release-line `rl-v1`.

| # | Document | Content | Session |
|---|----------|---------|---------|
| 01 | [User Story Map](01_user_story_map/) — [backbone](01_user_story_map/01_backbone.md), [stories](01_user_story_map/02_story-map.md), [MVP cut](01_user_story_map/03_mvp-cut.md) | 9 activities, 110 MVP stories (68 nominal, 42 edge) + 10 future, cut by release v0.1–v1.0; 44/44 features covered | 1 |
| 02 | [BDD scenarios](02_bdd/) — [conventions](02_bdd/00_conventions.md), [features](02_bdd/features/) | Fixtures `kanban` / `custom` / `unknown`, standard team and elements; 43 `.feature` files, 294 scenarios (116 nominal, 178 edge) | 2–3 |
| 03 | [SARD](03_sard/00_sard.md) | 50 requirements in the Volere shell, five macro-areas (ARC 11, PERF 11, STATE 9, INT 9, SEC 10), each with a measurable fit criterion | 4 |
| — | [Backlog](../03_backlog/00_backlog.md) | `backlog.json` (110 user stories + 50 technical tasks), `schema.json`, partitions `by-release/` | 5 |
| X | [Coherence Audit](X_coherence-audit.md) | Independent audit: 10 major + 24 minor findings, all major fixed; hand-off to `initial-design` | 6 |

**Validators** (`X_checks/`, `../03_backlog/X_tools/`): `check_usm.py`, `check_bdd.py`,
`check_sard.py`, `check_backlog.py` — all pass. Regenerate the backlog with
`python3 docs/03_backlog/X_tools/build_backlog.py` after any change to the stories, scenarios or SARD.
