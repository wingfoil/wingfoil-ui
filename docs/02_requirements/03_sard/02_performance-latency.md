# SARD — 2. Performance & Latency

**Version:** 0.1 · **Date:** 2026-10-02 · **Status:** Draft — specification-downcast session 4

Shell and conventions: `00_sard.md`. All timings are measured in the **reference environment**
(`00_sard.md`) on the **large fixture** unless a requirement says otherwise; p95 is over 20 runs.

---

### REQ-PERF-01 — Today first render

| Field | |
|-------|--|
| Release | v0.2 |
| Description | Today renders its greeting, Requires you and Waiting on others after the user opens a project or navigates to it. |
| Rationale | "Time to see what requires me" is the core value (*Unblock*); WingFoil has hundreds of elements (MVP canvas risk *Performance on large Memory*). |
| Traceability | US-T-01, US-T-02 · T-01.1, T-02.1 · T1, S8 · MVP canvas risks |
| Fit criterion | [numeric] Navigation to Today → cards rendered: p95 ≤ 2.0 s with a warm cache; ≤ 5.0 s for the first open after the server starts. |
| Verified by | e2e performance run |

### REQ-PERF-02 — Gate and submit latency

| Field | |
|-------|--|
| Release | v0.2 |
| Description | From the click on a gate outcome or *Submit* to the result toast, CLI process included, auto-push off. |
| Rationale | A decision must feel immediate to stay in two clicks (J1). |
| Traceability | US-G-04, US-G-10, US-G-13 · G-04.1, G-10.1, G-13.2 · G2, G3, G4 |
| Fit criterion | [numeric] p95 ≤ 3.0 s on the large fixture. |
| Verified by | e2e performance run |

### REQ-PERF-03 — Refresh after an external change

| Field | |
|-------|--|
| Release | v0.1 |
| Description | After a commit, a working-tree change, a git configuration change or a DNA change made outside the UI, every open view shows the new state without a page reload. |
| Rationale | Never act on a stale screen (S8); value proposed in session 2. |
| Traceability | US-S-25, US-S-26, US-S-12, US-T-03, US-T-12, US-T-08, US-M-03 · S-25.2, S-26.1, S-26.2, S-27.2, S-12.3, S-13.3, S-15.3, T-03.2, T-04.2, T-12.3, T-08.2, M-03.2, Y-04.2 · S8 |
| Fit criterion | [numeric] Change → view updated within 5 s in 20 out of 20 trials. |
| Verified by | e2e |

### REQ-PERF-04 — Other views

| Field | |
|-------|--|
| Release | v0.1 |
| Description | The Memory list, an element panel and the Directives, DNA, Team and Documentation views render after navigation. |
| Rationale | Read views are the bulk of the use for Casey and Riley. |
| Traceability | US-M-01, US-G-01, US-R-05, US-R-06, US-R-07, US-R-08 · M-01.1, G-01.1, R-05.1, R-06.1, R-07.1, R-08.1 · M1, G1, R1–R4 |
| Fit criterion | [numeric] p95 ≤ 1.0 s with a warm cache. |
| Verified by | e2e performance run |

### REQ-PERF-05 — Batched CLI reads

| Field | |
|-------|--|
| Release | v0.1 |
| Description | The server batches CLI reads per state of the repository: one CLI process per consumed command and repository state, shared by every view. |
| Rationale | One process per call is the main latency cost (ADR draft, *Consequences*). |
| Traceability | US-S-26 · S-26.3 · S1, S8 |
| Fit criterion | [numeric] Opening Today on a cold cache starts ≤ 6 CLI processes; reopening any view with no commit and no working-tree change starts 0. |
| Verified by | e2e (process audit) |

### REQ-PERF-06 — Server start

| Field | |
|-------|--|
| Release | v0.1 |
| Description | Time from `npx wingfoil-ui` (package already in the npm cache) to the printed URL. |
| Rationale | The console is started often, per session. |
| Traceability | US-S-01 · S-01.1 · S1 |
| Fit criterion | [numeric] ≤ 3.0 s in 10 out of 10 runs. |
| Verified by | e2e-smoke `launch` |

### REQ-PERF-07 — Remote freshness

| Field | |
|-------|--|
| Release | v0.2 |
| Description | With auto-fetch on (default interval 60 s), a commit pushed to the remote by someone else appears in the ahead/behind status; with auto-update on, the copy is fast-forwarded. |
| Rationale | Act on a current copy (J8); value proposed in session 2. |
| Traceability | US-Y-02, US-Y-05 · Y-02.1, Y-05.2, C-07.3 · Y2, Y4, C4 |
| Fit criterion | [numeric] Remote commit → "1 behind" (or fast-forward) within 65 s in 10 out of 10 trials; with auto-fetch off, 0 `git fetch` processes in 120 s. |
| Verified by | e2e |

### REQ-PERF-08 — Agent log streaming

| Field | |
|-------|--|
| Release | v0.4 |
| Description | Lines printed by an agent run started from the UI appear in the log view. |
| Rationale | Follow the run inside the UI (Q6, A2); value proposed in session 3. |
| Traceability | US-A-04 · A-04.1 · A2 |
| Fit criterion | [numeric] Each line appears ≤ 2 s after the agent prints it, for 100 % of the lines of a 60-line run. |
| Verified by | e2e (WingFoil 0.3 fixture) |

### REQ-PERF-09 — Zero navigation to what requires me

| Field | |
|-------|--|
| Release | v0.2 |
| Description | Every item whose next move needs one of the role view's roles is listed on Today, which is the landing screen of a project. |
| Rationale | MVP canvas metric *Time to see what requires me*. |
| Traceability | US-T-01, US-T-02, US-S-23 · T-01.1, T-02.1, S-23.1 · T1, S5 |
| Fit criterion | [percentage] On each fixture and role view, 100 % of the items the action descriptor assigns to the view's roles are listed on Today, reached with 0 navigation steps after opening the project. |
| Verified by | e2e |

### REQ-PERF-10 — Two clicks per gate

| Field | |
|-------|--|
| Release | v0.2 |
| Description | A member holding the gate's role passes or rejects it from Today. |
| Rationale | MVP canvas metric *Clicks to pass or reject a gate*. |
| Traceability | US-G-04 · G-04.1, G-04.3, X-06.2 · G2, T1 |
| Fit criterion | [numeric] ≤ 2 clicks from Today to the `wf(…)` commit with the pre-filled reason. |
| Verified by | e2e click count |

### REQ-PERF-11 — Display limits

| Field | |
|-------|--|
| Release | v0.2 (bell, summary) · v0.3 (Recent activity) |
| Description | Lists that summarise show a fixed number of items, newest or most urgent first, with a link to the rest. |
| Rationale | Values proposed in sessions 2–3; keeps Today scannable. |
| Traceability | US-S-21, US-S-23, US-T-08 · S-21.1, S-23.4, T-08.1 · S5, S7, T5 |
| Fit criterion | [numeric] Bell *Updates*: last 10 Memory events; all-roles summary: ≤ 3 items per role plus "N more"; Recent activity: last 5 Memory events. |
| Verified by | e2e |
