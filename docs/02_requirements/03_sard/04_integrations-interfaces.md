# SARD — 4. Integrations & Interfaces

**Version:** 0.4 · **Date:** 2026-10-03 (0.2: coherence audit fixes — session 6; 0.3: REQ-INT-06 Memory-event source fixed by spec-002 — initial-design session 5; 0.4: REQ-INT-08 staged, Chromium in v0.1 — release-planning v0.1 session 2) · **Status:** Draft — specification-downcast session 4

Shell and conventions: `00_sard.md`.

---

### REQ-INT-01 — CLI JSON contract

| Field | |
|-------|--|
| Release | v0.1 |
| Description | Every CLI command the server invokes runs with `--format json`; each consumed output shape has a JSON schema in `contracts/`, captured from the pinned WingFoil version (`wingfoil_version` recorded), and a contract test that runs against every version of the support matrix. Output that fails its schema is reported as a read error, never guessed at. |
| Rationale | The CLI output is the UI's API (ADR draft, *Consequences*; MVP canvas risk *CLI JSON output changes*); request R-01 to WingFoil. |
| Traceability | US-S-02, US-S-27 · S-02.3, S-27.1 · S1 · e2e-smoke `contract` |
| Fit criterion | [percentage] 100 % of the CLI commands invoked by the server (static list from the adapter) have a schema and a passing contract test for each WingFoil version of the support matrix. |
| Verified by | contract tests (e2e-smoke `contract`) |

### REQ-INT-02 — Supported WingFoil range

| Field | |
|-------|--|
| Release | v0.1 |
| Description | The server reads `wingfoil --version` when a project opens. Inside the supported range (0.2.2 to the highest contract-tested version; 0.2.2 to 1.x at v1.0) the project is fully usable; outside it, read-only with the range in the reason. The range and the capabilities per version are published in the package README (support matrix). |
| Rationale | Q2; one behaviour per tested version (`02_product-vision.md`). |
| Traceability | US-S-08, US-S-09, US-S-02 · S-08.1, S-09.1, S-09.2, S-02.2, S-02.4 · S3 |
| Fit criterion | [boolean] A fixture pinning a version below or above the range opens with 0 enabled actions and the reason naming the range; a version inside it passes every scenario of the release. |
| Verified by | e2e · README review |

### REQ-INT-03 — Capability detection: read-only or hidden

| Field | |
|-------|--|
| Release | v0.1 (version notice) · v0.2 onward |
| Description | Each capability declares the minimum WingFoil version and the project conditions it needs. When it applies to the project but the version or the user's role lacks it, it is shown **read-only with the reason**; when it does not apply (e.g. no remote, no ingestion workflow, no required references) it is **hidden**. |
| Rationale | Q2 rule; external review R9. |
| Traceability | US-S-08, US-S-11, US-T-10, US-T-15, US-M-04, US-G-16, US-A-03, US-Y-04, US-M-06 · S-08.3, S-11.1, S-11.2, T-10.1, T-10.2, T-15.1, T-15.2, M-04.1, M-04.2, G-16.1, A-03.1, A-03.2, Y-04.1, M-06.2 · S3 |
| Fit criterion | [boolean] Every listed scenario passes on WingFoil 0.2.2; the capability table in `contracts/` declares a minimum version for 100 % of the capabilities. |
| Verified by | e2e · unit |

### REQ-INT-04 — CLI invocation and errors

| Field | |
|-------|--|
| Release | v0.1 |
| Description | CLI processes run with `execFile`, an argument array, the project root as working directory, and a timeout of 30 s (process killed, error reported). A refusal shows the CLI's own message in a red toast; the element is left as the CLI left it; when an ingestion's `add` succeeds and its `submit` fails, the created draft is named. |
| Rationale | The CLI owns the rules — its message is the truth (G4); no partial state hidden from the user. |
| Traceability | US-G-14, US-G-17, US-S-27 · G-14.1, G-14.2, G-17.1, G-17.2, S-27.1 · S1, G4, G5 |
| Fit criterion | [boolean] Every listed scenario passes; a CLI stub that sleeps 40 s is killed at 30 s ± 1 s and its request returns an error. |
| Verified by | unit (stub) · e2e |

### REQ-INT-05 — Ingestion only when the CLI sets every required field

| Field | |
|-------|--|
| Release | v0.3 (0.2.2) · v0.4 (WingFoil 0.3 or a field setter) |
| Description | An ingestion is offered only when every required field of its type can be set by the CLI version in use (0.2.2: `title` and id/path tokens through `memory add --set`); its steps run as the workflow's own verbs. Otherwise it is read-only with the missing field named. |
| Rationale | The UI never edits a draft file (`cli-only-writes`; external review R1). |
| Traceability | US-G-15, US-G-16, US-G-18, US-M-07 · G-15.1, G-15.3, G-16.1, G-16.2, G-18.1, G-18.2, M-07.1, M-07.2 · G5, W2 |
| Fit criterion | [boolean] On 0.2.2 the custom fixture offers exactly `decision-log-ingest`, and the kanban fixture (whose ingest workflows declare no action) offers none; every listed scenario passes. |
| Verified by | e2e |

### REQ-INT-06 — Git interface

| Field | |
|-------|--|
| Release | v0.1 (read, clone) · v0.2 (transport) |
| Description | The server runs only these git operations: read (`rev-parse`, `status --porcelain`, `log`, `rev-list --count`, `config user.email`, `remote`), `clone` (adding a remote project, into a new empty folder), `fetch`, `pull --ff-only`, `push`, and `add -- .wingfoil/ui.yaml` + `commit -- .wingfoil/ui.yaml` for presets. It never merges, rebases, resets, stashes or checks out. Git's error message is shown verbatim on failure. Memory events (Timeline, Recent activity) are parsed from `wf(…)` subjects; `add` and `submit` subjects carry no transition, so a submit's `from → to` is read from the element file's `status` before and after the commit (project-wide views: one `git log -p` over the Memory directories; element panel: `memory history <id>`, which carries the states — `spec-002-memory-events-from-git`). |
| Rationale | Not a git client (`03_is-isnot.md`); write classes (c). |
| Traceability | US-Y-01, US-Y-02, US-Y-03, US-Y-05, US-Y-06, US-Y-07, US-Y-08, US-S-04, US-S-07, US-C-02 · Y-01.1, Y-02.2, Y-03.1, Y-03.2, Y-05.1, Y-05.3, Y-06.1, Y-07.1, Y-07.3, Y-08.1, Y-08.2, S-04.3, S-07.1, C-02.2 · Y1–Y4, S2, C1 |
| Fit criterion | [percentage] 100 % of the git processes started during the e2e suite use a subcommand of the allowed list (process audit). |
| Verified by | e2e (process audit) |

### REQ-INT-07 — WingFoil 0.3 workflow and agent verbs

| Field | |
|-------|--|
| Release | v0.4 |
| Description | With WingFoil 0.3 the server reads the workflow position and the next step (`workflow status`, `workflow next`), starts ingestions through `workflow start` where it sets the required fields, and launches agents with `agent execute`, streaming their output. Exact options and output are confirmed against WingFoil 0.3 at v0.4 `release-planning` and captured as contracts (REQ-INT-01). |
| Rationale | `07_sequencer.md` v0.4; request R-02 to WingFoil. |
| Traceability | US-T-09, US-T-16, US-T-17, US-M-06, US-A-01, US-A-02, US-A-04, US-A-05, US-G-18 · T-09.1, T-16.1, T-17.1, M-06.1, A-01.1, A-02.1, A-04.2, A-05.1, A-05.2, G-18.1 · T3, T2, W1, A1, A2, G5 |
| Fit criterion | [boolean] Every listed scenario passes on a fixture pinning WingFoil 0.3, and each verb used has a contract (REQ-INT-01). |
| Verified by | e2e · contract tests |

### REQ-INT-08 — Supported browsers

| Field | |
|-------|--|
| Release | v0.1 (Chromium) · v0.2 (Chromium, Firefox, WebKit) |
| Description | The UI supports the desktop browsers built on the Chromium, Firefox (Gecko) and WebKit engines — Chrome, Edge, Firefox and Safari — in the versions those engines have in the Playwright release pinned by the project; the e2e suite runs on the three engines. |
| Rationale | Users open the console in their own browser; three engines cover the four browsers. |
| Traceability | US-S-01, US-S-28, US-G-04, US-X-06 · S-01.1, S-28.1, G-04.1, X-06.4 (run on each engine, with the rest of the release's scenarios) · e2e-smoke `drive-browser` · X1 |
| Fit criterion | [percentage] 100 % of the release's e2e scenarios pass on each of the three engines (v0.1: on Chromium). |
| Verified by | e2e-smoke `drive-browser` |

### REQ-INT-09 — Server ↔ browser live updates

| Field | |
|-------|--|
| Release | v0.1 |
| Description | The server pushes change notifications (repository state, agent output) to the open pages over a single authenticated event stream per page; pages never poll the CLI. |
| Rationale | REQ-PERF-03 without load from polling (ADR draft, `GET /p/:id/events`). |
| Traceability | US-S-26, US-A-04 · S-26.1, S-26.2, A-04.1 · S8, A2 |
| Fit criterion | [boolean] With one page open and no change for 60 s, the server starts 0 CLI processes; after a change the page updates without a reload (REQ-PERF-03). |
| Verified by | e2e (process audit) |
