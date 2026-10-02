# Backlog — WingFoil UI

**Version:** 0.2
**Date:** 2026-10-02 (0.2: rebuilt after the coherence audit — session 6)
**Status:** Draft — specification-downcast session 5 (`backlog-export`)
**Input:** `docs/02_requirements/01_user_story_map/02_story-map.md` (v0.4) ·
`docs/02_requirements/02_bdd/` (v0.3) · `docs/02_requirements/03_sard/` (v0.2)

The documentary chain (user story map → BDD scenarios → SARD) consolidated into one structured
backlog, ready to be turned into Memory `task` elements release by release.

| File | Content |
|------|---------|
| [`04_backlog/backlog.json`](04_backlog/backlog.json) | Every record: 110 user stories + 50 technical tasks |
| [`04_backlog/schema.json`](04_backlog/schema.json) | JSON Schema (draft 2020-12) of the backlog and of each partition |
| `04_backlog/by-release/v0.1.json` … `v1.0.json` | The same records partitioned by release — the file a release's `requirements:` field points to |
| [`X_tools/build_backlog.py`](X_tools/build_backlog.py) | Generator (deterministic) |
| [`X_tools/check_backlog.py`](X_tools/check_backlog.py) | Stop-check |

**The JSON files are generated — never edit them by hand.** Change the story map, a `.feature` file
or the SARD, then run:

```bash
python3 docs/03_backlog/X_tools/build_backlog.py
python3 docs/03_backlog/X_tools/check_backlog.py
```

---

## Records

**User story** (`US-<area>-<nn>`, one per MVP story): `story`, `persona`, `story_kind`
(nominal/edge), `features`, `journeys`, `release`, `wingfoil_min`; `acceptance_criteria` = every
Gherkin scenario of the story (id, title, file, release, kind, fixture, steps with the feature's
Background first); `dependencies` = the technical tasks whose requirement traces the story, when
that task's release is not later than the story's.

**Technical task** (`TT-<AREA>-<nn>`, one per SARD requirement `REQ-<AREA>-<nn>`): `requirement`,
`description`, `fit_criterion`, `verified_by`, `stories` it supports (the stories it names and the stories of the scenarios it cites), `release` (the first stage
of the requirement), `acceptance_criteria` = the scenarios the requirement traces;
`dependencies` = the technical tasks it builds on (table `TT_DEPS` of the generator: e.g.
`TT-INT-02` version range → `TT-INT-01` CLI contract → `TT-ARC-02` own CLI → `TT-ARC-01` server).

`wingfoil_min` follows the release: v0.1–v0.3 → 0.2.2, v0.4 → 0.3, v1.0 → 1.0.

## Partition

| Release | User stories | Technical tasks | Total |
|---------|--------------|-----------------|-------|
| v0.1 | 38 | 34 | 72 |
| v0.2 | 34 | 12 | 46 |
| v0.3 | 25 | 2 | 27 |
| v0.4 | 11 | 2 | 13 |
| v1.0 | 2 | 0 | 2 |
| **Total** | **110** | **50** | **160** |

Most technical tasks land in v0.1: the architecture, the security of the local server, the CLI
contract and the snapshot rules apply before the first write exists (sequencer rule 7). 10 user
stories depend on no technical task (pure screen behaviour, e.g. US-R-02 time axis); they still
depend on the release's foundation through its order.

## From backlog to Memory

The backlog ids are **not** Memory ids. Per release, `release-planning` (`build-backlog`) turns
the partition into Memory tasks:

- `memory add --type task --title "<title>" --set release=vX.Y`, then the task's `ref:` set to
  the backlog id and its *Acceptance Criteria* pointing to the scenarios (hand edit before
  `memory submit`, directive `wingfoil-cli` W-01);
- a technical task can be merged into the user-story task that first needs it, or kept as its own
  task; its fit criterion becomes a check of the task's review;
- the release element's `requirements:` field points to `docs/03_backlog/04_backlog/by-release/vX.Y.json`.

## Stop-check

`check_backlog.py` verifies: valid JSON against `schema.json` (backlog and partitions); no
duplicate ids; no circular dependencies; no dependency on a later release; every MVP story and
every SARD requirement exactly once, in exactly one partition, identical to `backlog.json`; the
files equal a fresh build. Result after session 6: **all checks passed** — 160 items, 237
dependency links.
