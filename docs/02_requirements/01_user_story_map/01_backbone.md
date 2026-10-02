# User Story Map — Backbone

**Version:** 0.1
**Date:** 2026-10-01
**Status:** Draft — specification-downcast session 1 (`user-story-mapping`, phase `backbone`)
**Input:** `docs/01_vision/05_journeys.md` (v0.3) · `06_features.md` (v0.4) · `04_personas.md`

The backbone is the horizontal axis of the map: the **activities** a member does with WingFoil UI,
left to right in the order they are first met, each split into **user tasks**. It is extracted
from the journey steps (`J<n>.<step>` = `05_journeys.md` Journey n, step n). Stories hang under
the tasks in `02_story-map.md`.

A last row, **Across every activity**, holds the stories of the cross-cutting features (S1, S8,
S9, X1–X4, `06_features.md`): they serve every task and are not tied to one.

---

## Activities and tasks

| # | Activity | User tasks | Journey steps | Personas |
|---|----------|------------|---------------|----------|
| 1 | **Launch the console** | 1.1 Start the console · 1.2 Reach it safely | (precondition of every journey) | all |
| 2 | **Open a project** | 2.1 Add a project · 2.2 Learn what it supports · 2.3 Be recognised · 2.4 Switch and remove projects | J0.1–4 · J5.3 · J6.1 | Alex, all |
| 3 | **See what requires me** | 3.1 Know how much is waiting · 3.2 Read what requires my roles · 3.3 See who else must act · 3.4 Switch hats | J1.1–2 · J1.5 · J3.1 · J4.1 · J5.1–2 · J2.1 (activity) | Morgan, Jordan, Sam, Alex |
| 4 | **Decide and act** | 4.1 Inspect an element · 4.2 Decide a gate · 4.3 Submit my work · 4.4 Know the outcome | J1.3–4 · J2.3–4 · J3.5 · J4.2, J4.4 · J7.3–4 | Morgan, Casey, Sam, Jordan |
| 5 | **Understand the project** | 5.1 Follow progress · 5.2 Browse Memory · 5.3 Trace features to work · 5.4 Read the history · 5.5 Read rules and team · 5.6 Read documents and files · 5.7 See the workflows | J2.1–2 · J2.5 · J4.1 · J6.2 | Casey, Riley, Morgan, all |
| 6 | **Capture new elements** | 6.1 Find the ingestion · 6.2 Run the ingestion | J7.1–2 | all |
| 7 | **Work with agents** | 7.1 Prepare the step · 7.2 Launch the agent · 7.3 Follow the run | J3.2–4 · J4.3 | Jordan, Sam |
| 8 | **Stay in sync** | 8.1 Know the copy's state · 8.2 Bring the copy up to date · 8.3 Share what was committed | J8.1–5 | all |
| 9 | **Configure the UI** | 9.1 Make the project's conventions explicit · 9.3 Set my own preferences · 9.4 Learn how to join (9.2, advisory permissions, dropped — permissions are WingFoil's, L6) | J0.3 · J2.1 · J6.3 · J8.1–2, J8.5 | Alex, Morgan, Riley, all |
| — | **Across every activity** | X.1 See the project as the CLI reads it · X.2 Work with any methodology · X.3 Use it with any ability and setting | all | all |

## Journey steps → tasks

Every journey step of the MVP (J0–J8) lands on a task; J9 (file editing) is after v1.0 (L4).

| Journey | Steps → tasks |
|---------|---------------|
| J0 Add a project | 1–2 → 2.1 · 3 → 2.2 · 4 → 2.3, 3.2 |
| J1 Morgan clears the gates | 1 → 3.1 · 2 → 3.2 · 3 → 4.1 · 4 → 4.2, 4.4 · 5 → 3.3, 5.5 |
| J2 Casey follows and decides | 1 → 5.1, 3.2 · 2 → 5.1, 5.2 · 3 → 4.1, 5.6 · 4 → 4.2, 4.4 · 5 → 5.3 |
| J3 Jordan with an agent | 1 → 3.2 · 2 → 7.1 · 3 → 7.2 · 4 → 7.3 · 5 → 4.3, 4.4 |
| J4 Sam reviews | 1 → 3.2, 5.2 · 2 → 4.1, 5.5 · 3 → 7.2, 7.3 · 4 → 4.2, 4.4 |
| J5 Alex switches | 1 → 3.4 · 2 → 3.4 · 3 → 2.4 |
| J6 Riley explores | 1 → 2.3 · 2 → 5.2–5.7 · 3 → 9.4 |
| J7 Bug ingestion | 1 → 6.1 · 2 → 6.2 · 3 → 4.3 · 4 → 4.2 |
| J8 Remote sync | 1 → 8.1, 9.3 · 2 → 8.2 · 3 → 8.2 · 4 → 4.4 · 5 → 8.3 |
| J9 Edit a file (after v1.0) | 1–2 → Future (L4) |

The rules common to every journey (snapshot, behind the remote, roles on WingFoil 0.2.2,
unavailable capabilities) are not tasks: they become **edge-case stories** under the tasks they
constrain (see `03_mvp-cut.md`, *Edge cases*).
